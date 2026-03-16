import express from 'express';
import { getPool } from '../database.js';

const router = express.Router();

// 获取所有模板
router.get('/', async (req, res) => {
    try {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM quotation_templates ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        console.error('获取模板列表失败:', error);
        res.status(500).json({ error: '获取模板列表失败' });
    }
});

// 获取最近创建的模板
router.get('/latest', async (req, res) => {
    try {
        const pool = getPool();
        // 优先获取默认模板，否则获取最新创建的
        let [rows] = await pool.execute('SELECT * FROM quotation_templates WHERE is_default = 1 LIMIT 1');
        if (rows.length === 0) {
            [rows] = await pool.execute('SELECT * FROM quotation_templates ORDER BY created_at DESC LIMIT 1');
        }
        res.json(rows[0] || null);
    } catch (error) {
        console.error('获取最新模板失败:', error);
        res.status(500).json({ error: '获取最新模板失败' });
    }
});

// 获取单个模板
router.get('/:id', async (req, res) => {
    try {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM quotation_templates WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: '模板不存在' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('获取模板失败:', error);
        res.status(500).json({ error: '获取模板失败' });
    }
});

// 创建模板
router.post('/', async (req, res) => {
    try {
        const pool = getPool();
        const { name, description, prices, is_default } = req.body;

        // 如果设为默认，先取消其他默认
        if (is_default) {
            await pool.execute('UPDATE quotation_templates SET is_default = 0');
        }

        const [result] = await pool.execute(
            `INSERT INTO quotation_templates (name, description, prices, is_default)
       VALUES (?, ?, ?, ?)`,
            [name, description || '', JSON.stringify(prices || {}), is_default ? 1 : 0]
        );

        res.status(201).json({ id: result.insertId, message: '模板创建成功' });
    } catch (error) {
        console.error('创建模板失败:', error);
        res.status(500).json({ error: '创建模板失败' });
    }
});

// 更新模板
router.put('/:id', async (req, res) => {
    try {
        const pool = getPool();
        const { name, description, prices, is_default } = req.body;

        // 如果设为默认，先取消其他默认
        if (is_default) {
            await pool.execute('UPDATE quotation_templates SET is_default = 0');
        }

        await pool.execute(
            `UPDATE quotation_templates SET name = ?, description = ?, prices = ?, is_default = ? WHERE id = ?`,
            [name, description || '', JSON.stringify(prices || {}), is_default ? 1 : 0, req.params.id]
        );

        res.json({ message: '模板更新成功' });
    } catch (error) {
        console.error('更新模板失败:', error);
        res.status(500).json({ error: '更新模板失败' });
    }
});

// 删除模板
router.delete('/:id', async (req, res) => {
    try {
        const pool = getPool();
        await pool.execute('DELETE FROM quotation_templates WHERE id = ?', [req.params.id]);
        res.json({ message: '模板删除成功' });
    } catch (error) {
        console.error('删除模板失败:', error);
        res.status(500).json({ error: '删除模板失败' });
    }
});

// 设置默认模板
router.post('/:id/set-default', async (req, res) => {
    try {
        const pool = getPool();
        await pool.execute('UPDATE quotation_templates SET is_default = 0');
        await pool.execute('UPDATE quotation_templates SET is_default = 1 WHERE id = ?', [req.params.id]);
        res.json({ message: '已设为默认模板' });
    } catch (error) {
        console.error('设置默认模板失败:', error);
        res.status(500).json({ error: '设置默认模板失败' });
    }
});

export default router;
