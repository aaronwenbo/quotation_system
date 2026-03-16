import express from 'express';
import { getPool } from '../database.js';

const router = express.Router();

// 生成报价单号
function generateQuotationNo() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `Q${year}${month}${day}-${random}`;
}

// 安全转换为数字
function toNum(val, defaultVal = null) {
    if (val === null || val === undefined || val === '') return defaultVal;
    const n = Number(val);
    return isNaN(n) ? defaultVal : n;
}

// 获取所有报价单
router.get('/', async (req, res) => {
    try {
        const pool = getPool();
        const { status, customer_id, page = 1, pageSize = 20 } = req.query;

        let sql = `
      SELECT q.*, c.name as customer_name
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE 1=1
    `;
        const params = [];

        if (status) {
            sql += ' AND q.status = ?';
            params.push(status);
        }

        if (customer_id) {
            sql += ' AND q.customer_id = ?';
            params.push(customer_id);
        }

        // 获取总数
        const countSql = sql.replace(/SELECT q\.\*, c\.name as customer_name/, 'SELECT COUNT(*) as total');
        const [countResult] = await pool.execute(countSql, params);
        const total = countResult[0].total;

        // 分页
        const offset = (Number(page) - 1) * Number(pageSize);
        sql += ` ORDER BY q.created_at DESC LIMIT ${Number(pageSize)} OFFSET ${offset}`;

        const [rows] = await pool.query(sql, params);

        res.json({
            data: rows,
            total,
            page: Number(page),
            pageSize: Number(pageSize)
        });
    } catch (error) {
        console.error('获取报价单列表失败:', error);
        res.status(500).json({ error: '获取报价单列表失败' });
    }
});

// 获取单个报价单（含明细）
router.get('/:id', async (req, res) => {
    try {
        const pool = getPool();
        const [quotations] = await pool.execute(
            `SELECT q.*, c.name as customer_name, c.contact_person, c.phone, c.email, c.address
       FROM quotations q
       LEFT JOIN customers c ON q.customer_id = c.id
       WHERE q.id = ?`,
            [req.params.id]
        );

        if (quotations.length === 0) {
            return res.status(404).json({ error: '报价单不存在' });
        }

        const [items] = await pool.execute(
            'SELECT * FROM quotation_items WHERE quotation_id = ?',
            [req.params.id]
        );

        res.json({
            ...quotations[0],
            items
        });
    } catch (error) {
        console.error('获取报价单失败:', error);
        res.status(500).json({ error: '获取报价单失败' });
    }
});

// 创建报价单
router.post('/', async (req, res) => {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { customer_id, template_id, valid_until, discount_rate, notes, items } = req.body;
        const quotation_no = generateQuotationNo();

        // 创建报价单
        const [result] = await connection.query(
            `INSERT INTO quotations (quotation_no, customer_id, template_id, valid_until, discount_rate, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [quotation_no, toNum(customer_id), toNum(template_id), valid_until || null, toNum(discount_rate, 0), notes || '']
        );

        const quotationId = result.insertId;

        // 创建报价单明细并记录价格历史
        if (items && Array.isArray(items)) {
            for (const item of items) {
                const qty = toNum(item.quantity, 1);
                const price = toNum(item.unit_price, 0);
                const disc = toNum(item.discount, 100);
                const cost = toNum(item.cost_price, 0);
                const amount = toNum(item.amount, 0);

                await connection.query(
                    `INSERT INTO quotation_items (quotation_id, product_id, product_code, product_name, quantity, unit_price, cost_price, discount, amount, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [quotationId, toNum(item.product_id), item.product_code, item.product_name, qty, price, cost, disc, amount, item.notes || '']
                );

                // 记录价格历史
                if (item.product_id && req.body.status === 'confirmed') {
                    console.log('记录历史报价:', item.product_id, item.unit_price);
                    await connection.query(
                        `INSERT INTO price_history (product_id, quotation_id, customer_id, unit_price, quantity)
                         VALUES (?, ?, ?, ?, ?)`,
                        [toNum(item.product_id), toNum(quotationId), toNum(customer_id), price, qty]
                    );
                }
            }
        }

        await connection.commit();
        res.status(201).json({ id: quotationId, quotation_no, message: '报价单创建成功' });
    } catch (error) {
        await connection.rollback();
        console.error('创建报价单失败:', error);
        res.status(500).json({ error: '创建报价单失败: ' + error.message });
    } finally {
        connection.release();
    }
});

// 更新报价单
router.put('/:id', async (req, res) => {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { customer_id, template_id, status, valid_until, discount_rate, notes, items } = req.body;
        const quotationId = req.params.id;

        // 更新报价单
        console.log('正在更新报价单 ID:', quotationId, '状态:', status);
        await connection.query(
            `UPDATE quotations SET customer_id = ?, template_id = ?, status = ?, valid_until = ?, discount_rate = ?, notes = ? WHERE id = ?`,
            [toNum(customer_id), toNum(template_id), status || 'draft', valid_until || null, toNum(discount_rate, 0), notes || '', toNum(quotationId)]
        );

        // 删除原有明细
        await connection.query('DELETE FROM quotation_items WHERE quotation_id = ?', [toNum(quotationId)]);

        // 如果是确认状态，先删除之前的该报价单的历史记录，防止重复
        if (status === 'confirmed') {
            await connection.query('DELETE FROM price_history WHERE quotation_id = ?', [toNum(quotationId)]);
        }

        // 重新创建明细
        if (items && items.length > 0) {
            for (const item of items) {
                const qty = toNum(item.quantity, 1);
                const price = toNum(item.unit_price, 0);
                const disc = toNum(item.discount, 100);
                const cost = toNum(item.cost_price, 0);
                const amount = toNum(item.amount, 0);

                await connection.query(
                    `INSERT INTO quotation_items (quotation_id, product_id, product_code, product_name, quantity, unit_price, cost_price, discount, amount, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [toNum(quotationId), toNum(item.product_id), item.product_code, item.product_name, qty, price, cost, disc, amount, item.notes || '']
                );

                // 记录价格历史
                if (item.product_id && status === 'confirmed') {
                    console.log('更新确认报价，记录历史:', item.product_id, item.unit_price);
                    await connection.query(
                        `INSERT INTO price_history (product_id, quotation_id, customer_id, unit_price, quantity)
                         VALUES (?, ?, ?, ?, ?)`,
                        [toNum(item.product_id), toNum(quotationId), toNum(customer_id), price, qty]
                    );
                }
            }
        }

        await connection.commit();
        res.json({ message: '报价单更新成功' });
    } catch (error) {
        await connection.rollback();
        console.error('更新报价单失败:', error);
        res.status(500).json({ error: '更新报价单失败: ' + error.message });
    } finally {
        connection.release();
    }
});

// 删除报价单
router.delete('/:id', async (req, res) => {
    try {
        const pool = getPool();
        await pool.execute('DELETE FROM quotations WHERE id = ?', [req.params.id]);
        res.json({ message: '报价单删除成功' });
    } catch (error) {
        console.error('删除报价单失败:', error);
        res.status(500).json({ error: '删除报价单失败' });
    }
});

// 更新报价单状态
router.patch('/:id/status', async (req, res) => {
    try {
        const pool = getPool();
        const { status } = req.body;
        await pool.execute('UPDATE quotations SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: '状态更新成功' });
    } catch (error) {
        console.error('更新状态失败:', error);
        res.status(500).json({ error: '更新状态失败' });
    }
});

// 复制报价单
router.post('/:id/copy', async (req, res) => {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 获取原报价单
        const [quotations] = await connection.execute('SELECT * FROM quotations WHERE id = ?', [req.params.id]);
        if (quotations.length === 0) {
            return res.status(404).json({ error: '报价单不存在' });
        }

        const original = quotations[0];
        const quotation_no = generateQuotationNo();

        // 创建新报价单
        const [result] = await connection.execute(
            `INSERT INTO quotations (quotation_no, customer_id, template_id, status, valid_until, discount_rate, notes)
       VALUES (?, ?, ?, 'draft', ?, ?, ?)`,
            [quotation_no, original.customer_id, original.template_id, original.valid_until, original.discount_rate, original.notes]
        );

        const newQuotationId = result.insertId;

        // 复制明细
        const [items] = await connection.execute('SELECT * FROM quotation_items WHERE quotation_id = ?', [req.params.id]);

        for (const item of items) {
            await connection.execute(
                `INSERT INTO quotation_items (quotation_id, product_id, product_code, product_name, quantity, unit_price, cost_price, discount, amount, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [newQuotationId, item.product_id, item.product_code, item.product_name, item.quantity, item.unit_price, item.cost_price, item.discount, item.amount, item.notes]
            );
        }

        await connection.commit();
        res.status(201).json({ id: newQuotationId, quotation_no, message: '报价单复制成功' });
    } catch (error) {
        await connection.rollback();
        console.error('复制报价单失败:', error);
        res.status(500).json({ error: '复制报价单失败' });
    } finally {
        connection.release();
    }
});

export default router;
