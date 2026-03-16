import express from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { getPool } from '../database.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// 导入询价单Excel并匹配产品
router.post('/inquiry', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传文件' });
        }

        const pool = getPool();
        const { template_id } = req.body;

        // 解析Excel
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return res.status(400).json({ error: 'Excel文件为空' });
        }

        // 获取模板价格
        let templatePrices = {};
        if (template_id) {
            const [templates] = await pool.execute('SELECT prices FROM quotation_templates WHERE id = ?', [template_id]);
            if (templates.length > 0 && templates[0].prices) {
                templatePrices = typeof templates[0].prices === 'string'
                    ? JSON.parse(templates[0].prices)
                    : templates[0].prices;
            }
        } else {
            // 获取默认或最新模板
            let [templates] = await pool.execute('SELECT prices FROM quotation_templates WHERE is_default = 1 LIMIT 1');
            if (templates.length === 0) {
                [templates] = await pool.execute('SELECT prices FROM quotation_templates ORDER BY created_at DESC LIMIT 1');
            }
            if (templates.length > 0 && templates[0].prices) {
                templatePrices = typeof templates[0].prices === 'string'
                    ? JSON.parse(templates[0].prices)
                    : templates[0].prices;
            }
        }

        // 获取所有产品用于匹配
        const [products] = await pool.execute('SELECT * FROM products');

        // 处理每一行询价数据
        const result = [];
        const unmatched = [];

        for (const row of data) {
            // 尝试从不同可能的列名获取数据
            const name = row['名称'] || row['产品名称'] || row['name'] || row['Name'] || '';
            const code = row['编码'] || row['产品编码'] || row['code'] || row['Code'] || row['产品编号'] || '';
            const specs = row['规格'] || row['specifications'] || row['Specifications'] || '';
            const quantity = parseInt(row['数量'] || row['quantity'] || row['Quantity'] || 1) || 1;

            // 匹配产品 - 名称优先，编码其次
            let matchedProduct = null;

            // 1. 先按名称匹配（模糊匹配）
            if (name) {
                matchedProduct = products.find(p =>
                    p.name_cn === name ||
                    p.name_en === name ||
                    p.name_cn?.includes(name) ||
                    name.includes(p.name_cn)
                );
            }

            // 2. 名称无匹配则按编码匹配
            if (!matchedProduct && code) {
                matchedProduct = products.find(p => p.product_code === code);
            }

            if (matchedProduct) {
                // 从模板获取价格，没有则使用产品基础价格
                const templatePrice = templatePrices[matchedProduct.product_code];
                const unitPrice = templatePrice !== undefined ? templatePrice : matchedProduct.base_price;

                result.push({
                    product_id: matchedProduct.id,
                    product_code: matchedProduct.product_code,
                    product_name: matchedProduct.name_cn,
                    specifications: specs || JSON.stringify(matchedProduct.specifications || {}),
                    quantity,
                    unit_price: unitPrice,
                    discount: 0,
                    amount: quantity * unitPrice,
                    matched: true
                });
            } else {
                // 未匹配到的产品
                unmatched.push({
                    product_id: null,
                    product_code: code,
                    product_name: name,
                    specifications: specs,
                    quantity,
                    unit_price: 0,
                    discount: 0,
                    amount: 0,
                    matched: false
                });
            }
        }

        res.json({
            matched: result,
            unmatched,
            total: data.length,
            matchedCount: result.length,
            unmatchedCount: unmatched.length
        });
    } catch (error) {
        console.error('导入询价单失败:', error);
        res.status(500).json({ error: '导入询价单失败: ' + error.message });
    }
});

// 批量导入产品
router.post('/products', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传文件' });
        }

        const pool = getPool();

        // 解析Excel
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return res.status(400).json({ error: 'Excel文件为空' });
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const row of data) {
            try {
                const product_code = row['编码'] || row['产品编码'] || row['code'] || '';
                const name_cn = row['名称'] || row['中文名称'] || row['产品名称'] || '';
                const name_en = row['英文名称'] || row['name_en'] || '';
                const category = row['分类'] || row['category'] || '';
                const unit = row['单位'] || row['unit'] || '个';
                const cost_price = parseFloat(row['成本'] || row['成本价'] || row['cost_price'] || 0) || 0;
                const base_price = parseFloat(row['价格'] || row['基础价格'] || row['base_price'] || 0) || 0;

                if (!product_code || !name_cn) {
                    errors.push({ row, error: '缺少必填字段：编码或名称' });
                    errorCount++;
                    continue;
                }

                await pool.execute(
                    `INSERT INTO products (product_code, name_cn, name_en, category, unit, cost_price, base_price)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name_cn = ?, name_en = ?, category = ?, unit = ?, cost_price = ?, base_price = ?`,
                    [product_code, name_cn, name_en, category, unit, cost_price, base_price,
                        name_cn, name_en, category, unit, cost_price, base_price]
                );

                successCount++;
            } catch (err) {
                errors.push({ row, error: err.message });
                errorCount++;
            }
        }

        res.json({
            message: `导入完成: 成功 ${successCount} 条, 失败 ${errorCount} 条`,
            successCount,
            errorCount,
            errors: errors.slice(0, 10) // 只返回前10个错误
        });
    } catch (error) {
        console.error('批量导入产品失败:', error);
        res.status(500).json({ error: '批量导入产品失败: ' + error.message });
    }
});

// 批量导入模板价格
router.post('/template/:id', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传文件' });
        }

        const pool = getPool();
        const templateId = req.params.id;

        // 解析Excel
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // 我们不直接使用 sheet_to_json(worksheet)，因为文件顶部有几行模板信息
        // 先获取原始数组，找到包含“产品编码”或“Product Code”的那一行作为表头
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const headerRowIndex = rawData.findIndex(row =>
            row && row.some(cell => typeof cell === 'string' && (cell.includes('产品编码') || cell.includes('Product Code')))
        );

        if (headerRowIndex === -1) {
            return res.status(400).json({ error: 'Excel格式不正确，未找到“产品编码”列' });
        }

        const data = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });
        console.log('解析到的数据项数量:', data.length);
        console.log('数据样例:', data.slice(0, 1));

        if (data.length === 0) {
            return res.status(400).json({ error: 'Excel文件数据部分为空' });
        }

        // 获取原模板数据
        const [templates] = await pool.execute('SELECT prices FROM quotation_templates WHERE id = ?', [templateId]);
        if (templates.length === 0) {
            return res.status(404).json({ error: '模板不存在' });
        }

        let currentPrices = typeof templates[0].prices === 'string'
            ? JSON.parse(templates[0].prices)
            : (templates[0].prices || {});

        let updateCount = 0;
        for (const row of data) {
            const cleanRow = {};
            Object.keys(row).forEach(k => { cleanRow[String(k).trim()] = row[k]; });

            const code = cleanRow['产品编码'] || cleanRow['Product Code'] || cleanRow['code'] || '';
            const price = parseFloat(cleanRow['模板价格'] || cleanRow['Template Price'] || cleanRow['price'] || 0);

            if (code && !isNaN(price)) {
                currentPrices[code] = price;
                updateCount++;
            }
        }

        console.log('更新后模板价格:', currentPrices);
        console.log('尝试写入数据库, id:', templateId);

        // 更新数据库
        const [result] = await pool.execute(
            'UPDATE quotation_templates SET prices = ? WHERE id = ?',
            [JSON.stringify(currentPrices), templateId]
        );

        console.log('数据库更新结果:', result);

        res.json({
            message: `导入完成: 成功更新 ${updateCount} 条价格数据`,
            updateCount
        });
    } catch (error) {
        console.error('导入模板失败:', error);
        res.status(500).json({ error: '导入模板失败: ' + error.message });
    }
});

export default router;
