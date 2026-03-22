import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR);
}

const writeLog = (level, message, context = null) => {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (context) {
        logMessage += ` | Context: ${JSON.stringify(context)}`;
    }
    
    logMessage += '\n';
    
    // 输出到控制台
    if (level === 'error') {
        console.error(logMessage.trim());
    } else {
        console.log(logMessage.trim());
    }
    
    // 写入文件
    fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
};

export const logger = {
    info: (msg, ctx) => writeLog('info', msg, ctx),
    warn: (msg, ctx) => writeLog('warn', msg, ctx),
    error: (msg, ctx) => writeLog('error', msg, ctx),
    
    // 获取日志流（可选）
    getLogFile: () => LOG_FILE
};

export default logger;
