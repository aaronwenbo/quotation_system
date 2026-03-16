import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: '液压管接头报价系统',
  });

  // 在开发模式下加载 Vite 的开发服务器
  // 在生产模式下加载构建后的 index.html
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // 生产环境下，client/dist 位于应用根目录
    mainWindow.loadFile(path.join(__dirname, 'client/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  const isDev = !app.isPackaged;
  // 由于我们已经把 server 目录复制到了 desktop 下，路径始终一致
  const serverPath = path.join(__dirname, 'server/index.js');
  
  // 设置环境变量以使用 SQLite
  const env = { 
    ...process.env, 
    DB_TYPE: 'sqlite',
    PORT: 3001 
  };

  serverProcess = spawn('node', [serverPath], { env });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverProcess) serverProcess.kill();
    app.quit();
  }
});

app.on('quit', () => {
  if (serverProcess) serverProcess.kill();
});
