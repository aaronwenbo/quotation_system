import express from 'express';
import { getPool } from '../database.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// 获取所有别名（支持分页、搜索）
router.get('/', async (req, res) => {
    try {
        const pool = getPool();
        const { search, page = 1, pageSize = 50 } = req.query;
        const offset = (Number(page) - 1) * Number(pageSize);

        let sql = `
            SELECT a.*, p.product_code as product_target_code, p.name_cn as product_target_name
            FROM product_aliases a
            LEFT JOIN products p ON a.product_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            sql += ' AND (a.alias_code LIKE ? OR a.alias_name LIKE ? OR p.name_cn LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        const [countRows] = await pool.execute(
            sql.replace('SELECT a.*, p.product_code as product_target_code, p.name_cn as product_target_name', 'SELECT COUNT(*) as total'),
            params
        );
        const total = countRows[0].total;

        sql += ` ORDER BY a.is_new DESC, a.hit_count DESC LIMIT ${Number(pageSize)} OFFSET ${offset}`;
        const [rows] = await pool.execute(sql, params);

        res.json({ data: rows, total, page: Number(page), pageSize: Number(pageSize) });
    } catch (err) {
        logger.error('获取别名列表失败', { error: err.message });
        res.status(500).json({ error: '获取别名列表失败' });
    }
});

// 手动创建别名
router.post('/', async (req, res) => {
    try {
        const pool = getPool();
        const { alias_code, alias_name, product_id, match_level = 1 } = req.body;
        if (!alias_code || !product_id) {
            return res.status(400).json({ error: '缺少必要参数: alias_code, product_id' });
        }

        // 检查是否已存在
        const [existing] = await pool.execute(
            'SELECT id FROM product_aliases WHERE alias_code = ? AND product_id = ?',
            [alias_code, product_id]
        );
        if (existing.length > 0) {
            // 更新命中次数
            await pool.execute(
                'UPDATE product_aliases SET hit_count = hit_count + 1, is_new = 0 WHERE id = ?',
                [existing[0].id]
            );
            return res.json({ id: existing[0].id, message: '别名已存在, 命中次数已更新' });
        }

        const [result] = await pool.execute(
            'INSERT INTO product_aliases (alias_code, alias_name, product_id, match_level, hit_count, is_new) VALUES (?, ?, ?, ?, 1, 1)',
            [alias_code, alias_name || '', product_id, match_level]
        );
        logger.info('创建别名成功', { alias_code, product_id });
        res.status(201).json({ id: result.insertId, message: '别名创建成功' });
    } catch (err) {
        logger.error('创建别名失败', { error: err.message });
        res.status(500).json({ error: '创建别名失败' });
    }
});

// 从人工队列确认并写入别名（专用接口）
router.post('/confirm', async (req, res) => {
    try {
        const pool = getPool();
        const { alias_code, alias_name, product_id } = req.body;
        if (!alias_code || !product_id) {
            return res.status(400).json({ error: '缺少必要参数: alias_code, product_id' });
        }

        // 检查是否已存在
        const [existing] = await pool.execute(
            'SELECT id FROM product_aliases WHERE alias_code = ?',
            [alias_code]
        );
        if (existing.length > 0) {
            // 若已存在则更新 product_id（用户可能修改了目标）
            await pool.execute(
                'UPDATE product_aliases SET product_id = ?, alias_name = ?, hit_count = hit_count + 1, is_new = 1 WHERE id = ?',
                [product_id, alias_name || '', existing[0].id]
            );
            return res.json({ id: existing[0].id, message: '别名已更新' });
        }

        const [result] = await pool.execute(
            'INSERT INTO product_aliases (alias_code, alias_name, product_id, match_level, hit_count, is_new) VALUES (?, ?, ?, 1, 1, 1)',
            [alias_code, alias_name || '', product_id]
        );
        logger.info('人工确认别名', { alias_code, product_id });
        res.status(201).json({ id: result.insertId, message: '别名已确认并写入' });
    } catch (err) {
        logger.error('确认别名失败', { error: err.message });
        res.status(500).json({ error: '确认别名失败' });
    }
});

// 更新别名
router.put('/:id', async (req, res) => {
    try {
        const pool = getPool();
        const { alias_code, alias_name, product_id } = req.body;
        await pool.execute(
            'UPDATE product_aliases SET alias_code = ?, alias_name = ?, product_id = ?, is_new = 0 WHERE id = ?',
            [alias_code, alias_name || '', product_id, req.params.id]
        );
        res.json({ message: '别名更新成功' });
    } catch (err) {
        logger.error('更新别名失败', { error: err.message });
        res.status(500).json({ error: '更新别名失败' });
    }
});

// 删除别名
router.delete('/:id', async (req, res) => {
    try {
        const pool = getPool();
        await pool.execute('DELETE FROM product_aliases WHERE id = ?', [req.params.id]);
        logger.info('删除别名', { id: req.params.id });
        res.json({ message: '别名已删除' });
    } catch (err) {
        logger.error('删除别名失败', { error: err.message });
        res.status(500).json({ error: '删除别名失败' });
    }
});

// 将★新 标记已读
router.post('/mark-read', async (req, res) => {
    try {
        const pool = getPool();
        const { ids } = req.body; // 可传 ids 数组，不传则全部标记
        if (ids && ids.length > 0) {
            await pool.execute(
                `UPDATE product_aliases SET is_new = 0 WHERE id IN (${ids.map(() => '?').join(',')})`,
                ids
            );
        } else {
            await pool.execute('UPDATE product_aliases SET is_new = 0');
        }
        res.json({ message: '已标记为已读' });
    } catch (err) {
        res.status(500).json({ error: '标记失败' });
    }
});

export default router;
