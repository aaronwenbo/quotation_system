import express from 'express';
import fs from 'fs';
import { logger } from '../utils/logger.js';

const router = express.Router();

// 获取所有日志
router.get('/', (req, res) => {
    try {
        const logFile = logger.getLogFile();
        if (!fs.existsSync(logFile)) {
            return res.json({ logs: 'No logs found.' });
        }
        
        const data = fs.readFileSync(logFile, 'utf8');
        res.json({ logs: data });
    } catch (err) {
        res.status(500).json({ error: 'Failed to read logs', message: err.message });
    }
});

// 清理日志
router.delete('/clear', (req, res) => {
    try {
        const logFile = logger.getLogFile();
        fs.writeFileSync(logFile, '', 'utf8');
        logger.info('Logs cleared manually via API');
        res.json({ message: 'Logs cleared successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to clear logs', message: err.message });
    }
});

export default router;
