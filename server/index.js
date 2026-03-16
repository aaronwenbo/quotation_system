import express from 'express';
import cors from 'cors';
import { initDatabase } from './database.js';
import productsRouter from './routes/products.js';
import customersRouter from './routes/customers.js';
import templatesRouter from './routes/templates.js';
import quotationsRouter from './routes/quotations.js';
import importRouter from './routes/import.js';
import exportRouter from './routes/export.js';

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/products', productsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/quotations', quotationsRouter);
app.use('/api/import', importRouter);
app.use('/api/export', exportRouter);

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 初始化数据库并启动服务器
async function start() {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log(`服务器运行在 http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('启动失败:', error);
        process.exit(1);
    }
}

start();
