import express from 'express';
import { getPool } from '../database.js';

const router = express.Router();

// 获取所有客户
router.get('/', async (req, res) => {
    try {
        const pool = getPool();
        const { search, page = 1, pageSize = 20 } = req.query;

        let sql = 'SELECT * FROM customers WHERE 1=1';
        const params = [];

        if (search) {
            sql += ' AND (name LIKE ? OR contact_person LIKE ? OR phone LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
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

        res.json({
            data: rows,
            total,
            page: Number(page),
            pageSize: Number(pageSize)
        });
    } catch (error) {
        console.error('获取客户列表失败:', error);
        res.status(500).json({ error: '获取客户列表失败' });
    }
});

// 获取单个客户
router.get('/:id', async (req, res) => {
    try {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM customers WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: '客户不存在' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('获取客户失败:', error);
        res.status(500).json({ error: '获取客户失败' });
    }
});

// 创建客户
router.post('/', async (req, res) => {
    try {
        const pool = getPool();
        const { name, contact_person, phone, email, address, notes } = req.body;

        const [result] = await pool.execute(
            `INSERT INTO customers (name, contact_person, phone, email, address, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [name, contact_person || '', phone || '', email || '', address || '', notes || '']
        );

        res.status(201).json({ id: result.insertId, message: '客户创建成功' });
    } catch (error) {
        console.error('创建客户失败:', error);
        res.status(500).json({ error: '创建客户失败' });
    }
});

// 更新客户
router.put('/:id', async (req, res) => {
    try {
        const pool = getPool();
        const { name, contact_person, phone, email, address, notes } = req.body;

        await pool.execute(
            `UPDATE customers SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, notes = ? WHERE id = ?`,
            [name, contact_person || '', phone || '', email || '', address || '', notes || '', req.params.id]
        );

        res.json({ message: '客户更新成功' });
    } catch (error) {
        console.error('更新客户失败:', error);
        res.status(500).json({ error: '更新客户失败' });
    }
});

// 删除客户
router.delete('/:id', async (req, res) => {
    try {
        const pool = getPool();
        await pool.execute('DELETE FROM customers WHERE id = ?', [req.params.id]);
        res.json({ message: '客户删除成功' });
    } catch (error) {
        console.error('删除客户失败:', error);
        res.status(500).json({ error: '删除客户失败' });
    }
});

// 获取客户历史报价单
router.get('/:id/quotations', async (req, res) => {
    try {
        const pool = getPool();
        const [rows] = await pool.execute(
            `SELECT * FROM quotations WHERE customer_id = ? ORDER BY created_at DESC`,
            [req.params.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('获取客户报价单失败:', error);
        res.status(500).json({ error: '获取客户报价单失败' });
    }
});

export default router;
