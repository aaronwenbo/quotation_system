import express from 'express';
import { getPool } from '../database.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// 获取所有产品
router.get('/', async (req, res) => {
    try {
        const pool = getPool();
        const { search, category, page = 1, pageSize = 20 } = req.query;

        let sql = 'SELECT * FROM products WHERE 1=1';
        const params = [];

        if (search) {
            sql += ' AND (name_cn LIKE ? OR name_en LIKE ? OR product_code LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }

        // 获取总数
        const [countResult] = await pool.execute(
            sql.replace('SELECT *', 'SELECT COUNT(*) as total'),
            params
        );
        const total = countResult[0].total;

        // 分页
        const offset = (Number(page) - 1) * Number(pageSize);
        sql += ` ORDER BY id DESC LIMIT ${Number(pageSize)} OFFSET ${offset}`;

        const [rows] = await pool.query(sql, params);

        if (rows.length > 0 && page === 1 && !search) {
            logger.info('查询产品列表', { count: rows.length, firstItem: rows[0].product_code });
        }

        res.json({
            data: rows,
            total,
            page: Number(page),
            pageSize: Number(pageSize)
        });
    } catch (error) {
        console.error('获取产品列表失败:', error);
        res.status(500).json({ error: '获取产品列表失败' });
    }
});

// 获取单个产品
router.get('/:id', async (req, res) => {
    try {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: '产品不存在' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('获取产品失败:', error);
        res.status(500).json({ error: '获取产品失败' });
    }
});

// 创建产品
router.post('/', async (req, res) => {
    try {
        const pool = getPool();
        const { product_code, name_cn, name_en, category, specifications, unit, cost_price, base_price } = req.body;

        const sql = `INSERT INTO products (product_code, name_cn, name_en, category, specifications, unit, cost_price, base_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [product_code, name_cn || null, name_en || '', category || '', JSON.stringify(specifications || {}), unit || '个', cost_price || 0, base_price || 0];
        const [result] = await pool.execute(sql, params);
        logger.info('新增产品成功', { product_code, id: result.insertId });
        res.status(201).json({ id: result.insertId, message: '产品添加成功' });
    } catch (error) {
        logger.error('创建产品失败:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: '产品编码已存在' });
        }
        res.status(500).json({ error: '创建产品失败' });
    }
});

// 更新产品
router.put('/:id', async (req, res) => {
    try {
        const pool = getPool();
        const { product_code, name_cn, name_en, category, specifications, unit, cost_price, base_price } = req.body;
        const id = req.params.id;

        const sql = `UPDATE products SET product_code = ?, name_cn = ?, name_en = ?, category = ?, 
       specifications = ?, unit = ?, cost_price = ?, base_price = ? WHERE id = ?`;
        const params = [product_code, name_cn || null, name_en || '', category || '', JSON.stringify(specifications || {}), unit || '个', cost_price || 0, base_price || 0, id];
        await pool.execute(sql, params);
        logger.info('更新产品成功', { id });
        res.json({ message: '产品更新成功' });
    } catch (error) {
        logger.error('更新产品失败:', error);
        res.status(500).json({ error: '更新产品失败' });
    }
});

// 删除产品
router.delete('/:id', async (req, res) => {
    try {
        const pool = getPool();
        await pool.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
        logger.info('删除产品成功', { id: req.params.id });
        res.json({ message: '产品删除成功' });
    } catch (error) {
        console.error('删除产品失败:', error);
        res.status(500).json({ error: '删除产品失败' });
    }
});

// 获取产品分类列表
router.get('/categories/list', async (req, res) => {
    try {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ""');
        res.json(rows.map(r => r.category));
    } catch (error) {
        console.error('获取分类列表失败:', error);
        res.status(500).json({ error: '获取分类列表失败' });
    }
});

// 获取产品历史报价
router.get('/:id/price-history', async (req, res) => {
    try {
        const pool = getPool();
        const { limit = 5, all = false } = req.query;

        let sql = `
      SELECT ph.*, c.name as customer_name, q.quotation_no
      FROM price_history ph
      LEFT JOIN customers c ON ph.customer_id = c.id
      LEFT JOIN quotations q ON ph.quotation_id = q.id
      WHERE ph.product_id = ?
      ORDER BY ph.quoted_at DESC
    `;

        if (!all || all === 'false') {
            sql += ` LIMIT ?`;
            const [rows] = await pool.query(sql, [req.params.id, Number(limit)]);
            res.json(rows);
        } else {
            const [rows] = await pool.query(sql, [req.params.id]);
            res.json(rows);
        }
    } catch (error) {
        console.error('获取价格历史失败:', error);
        res.status(500).json({ error: '获取价格历史失败' });
    }
});

export default router;
