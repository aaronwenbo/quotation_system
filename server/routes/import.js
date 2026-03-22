import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger.js';
import * as XLSX from 'xlsx';
import { getPool } from '../database.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

import { findTopSimilar } from '../utils/similarity.js';

// 导入询价单Excel并匹配产品（四级匹配逻辑）
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

        // 获取所有产品和别名表
        const [products] = await pool.execute('SELECT * FROM products');
        const [aliases] = await pool.execute(`
            SELECT a.*, p.product_code as product_target_code, p.name_cn as product_target_name
            FROM product_aliases a
            LEFT JOIN products p ON a.product_id = p.id
        `);

        const matched = [];
        const unmatched = [];     // L4: 人工队列
        const newAliases = [];    // 本次解析新识别的别名（L2）

        for (const row of data) {
            // 规范化键名
            const cleanRow = {};
            Object.keys(row).forEach(k => { cleanRow[String(k).trim()] = row[k]; });

            const rawCode = (cleanRow['编码'] || cleanRow['产品编码'] || cleanRow['code'] || cleanRow['Code'] || cleanRow['产品编号'] || '').toString().trim();
            const rawName = (cleanRow['名称'] || cleanRow['产品名称'] || cleanRow['name'] || cleanRow['Name'] || '').toString().trim();
            const specs = (cleanRow['规格'] || cleanRow['specifications'] || cleanRow['Specifications'] || '').toString().trim();
            const quantity = parseInt(cleanRow['数量'] || cleanRow['quantity'] || cleanRow['Quantity'] || 1) || 1;

            let matchedProduct = null;
            let matchLevel = 4;

            // ===== L1: 精确编码匹配 (绿色) =====
            if (rawCode) {
                const exactMatch = products.find(p => p.product_code === rawCode);
                if (exactMatch) {
                    matchedProduct = exactMatch;
                    matchLevel = 1;
                }
            }

            // ===== L2: 结构解析匹配 (蓝色) =====
            // 尝试从原始编码/名称中提取结构化特征，模糊匹配产品库
            if (!matchedProduct) {
                // 去掉常见无效字符，提取可能的编码片段
                const cleanedInput = (rawCode || rawName).replace(/[^\w\-\.]/g, '').toUpperCase();
                if (cleanedInput.length >= 4) {
                    const structMatch = products.find(p => {
                        const pCode = (p.product_code || '').toUpperCase();
                        return pCode === cleanedInput ||
                            pCode.includes(cleanedInput) ||
                            cleanedInput.includes(pCode);
                    });
                    if (structMatch) {
                        matchedProduct = structMatch;
                        matchLevel = 2;
                        // 自动写入新别名
                        const aliasKey = rawCode || rawName;
                        if (aliasKey && !aliases.find(a => a.alias_code === aliasKey && a.product_id === structMatch.id)) {
                            newAliases.push({ alias_code: aliasKey, alias_name: rawName, product_id: structMatch.id, match_level: 2 });
                        }
                    }
                }
            }

            // ===== L3: 别名表匹配 (黄色) =====
            if (!matchedProduct) {
                const aliasKey = rawCode || rawName;
                const aliasMatch = aliases.find(a =>
                    a.alias_code === aliasKey ||
                    (rawName && a.alias_name && a.alias_name === rawName)
                );
                if (aliasMatch) {
                    matchedProduct = products.find(p => p.id === aliasMatch.product_id);
                    matchLevel = 3;
                    // 更新命中次数
                    pool.execute('UPDATE product_aliases SET hit_count = hit_count + 1 WHERE id = ?', [aliasMatch.id]).catch(() => {});
                }
            }

            if (matchedProduct) {
                const templatePrice = templatePrices[matchedProduct.product_code];
                const unitPrice = templatePrice !== undefined ? Number(templatePrice) : Number(matchedProduct.base_price || 0);

                matched.push({
                    product_id: matchedProduct.id,
                    product_code: matchedProduct.product_code,
                    product_name: matchedProduct.name_cn || matchedProduct.name_en,
                    original_code: rawCode,
                    original_name: rawName,
                    specifications: specs || '',
                    quantity,
                    unit_price: unitPrice,
                    discount: 0,
                    amount: quantity * unitPrice,
                    match_level: matchLevel,  // 1=绿,2=蓝,3=黄
                    matched: true
                });
            } else {
                // ===== L4: 人工队列 (红色) + 相似度推荐 =====
                const inputStr = rawCode || rawName;
                const suggestions = findTopSimilar(inputStr, products, 3);

                unmatched.push({
                    product_id: null,
                    product_code: rawCode,
                    product_name: rawName,
                    original_code: rawCode,
                    original_name: rawName,
                    specifications: specs,
                    quantity,
                    unit_price: 0,
                    discount: 0,
                    amount: 0,
                    match_level: 4,           // 红色
                    matched: false,
                    suggestions                // TOP 3 候选产品
                });
            }
        }

        // 异步保存 L2 识别的新别名
        if (newAliases.length > 0) {
            for (const alias of newAliases) {
                pool.execute(
                    'INSERT IGNORE INTO product_aliases (alias_code, alias_name, product_id, match_level, hit_count, is_new) VALUES (?, ?, ?, ?, 1, 1)',
                    [alias.alias_code, alias.alias_name || '', alias.product_id, alias.match_level]
                ).catch(err => logger.error('保存L2别名失败', { error: err.message }));
            }
            logger.info('L2结构解析新增别名', { count: newAliases.length });
        }

        logger.info('询价单解析完成', {
            total: data.length,
            l1: matched.filter(m => m.match_level === 1).length,
            l2: matched.filter(m => m.match_level === 2).length,
            l3: matched.filter(m => m.match_level === 3).length,
            l4: unmatched.length
        });

        res.json({
            matched,
            unmatched,
            newAliases,
            total: data.length,
            matchedCount: matched.length,
            unmatchedCount: unmatched.length,
            stats: {
                l1: matched.filter(m => m.match_level === 1).length,
                l2: matched.filter(m => m.match_level === 2).length,
                l3: matched.filter(m => m.match_level === 3).length,
                l4: unmatched.length
            }
        });
    } catch (error) {
        logger.error('导入询价单失败', { error: error.message });
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

        if (data.length > 0) {
            logger.info('开始产品批量导入', { rowCount: data.length });
            logger.info('第一条原始数据样例', data[0]);
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const row of data) {
            try {
                // 规范化所有键名 (去除空格)
                const cleanRow = {};
                Object.keys(row).forEach(key => {
                    const cleanKey = String(key).trim();
                    cleanRow[cleanKey] = row[key];
                });

                if (successCount < 3) {
                    logger.info('规范化后的数据行', cleanRow);
                }

                const product_code = (cleanRow['编码'] || cleanRow['产品编码'] || cleanRow['code'] || '').toString().trim();
                const name_cn = (cleanRow['名称'] || cleanRow['中文名称'] || cleanRow['产品名称'] || cleanRow['name_cn'] || '').toString().trim();
                const name_en = (cleanRow['英文名称'] || cleanRow['name_en'] || '').toString().trim();
                const category = (cleanRow['分类'] || cleanRow['category'] || '').toString().trim();
                const unit = (cleanRow['单位'] || cleanRow['unit'] || '个').toString().trim();
                
                // 更精确地提取数值，区分 0 和 “未填写”
                const getNum = (val) => {
                    if (val === undefined || val === null || val === '') return null;
                    const n = parseFloat(val);
                    return isNaN(n) ? null : n;
                };

                const cost_price = getNum(cleanRow['成本'] || cleanRow['成本价'] || cleanRow['cost_price']);
                const base_price = getNum(cleanRow['价格'] || cleanRow['基础价格'] || cleanRow['base_price']);

                if (!product_code) {
                    errors.push({ row, error: '缺少必填字段：编码' });
                    errorCount++;
                    continue;
                }

                // 根据数据库类型使用不同的 UPSERT 语法
                if (process.env.DB_TYPE === 'sqlite') {
                    await pool.execute(
                        `INSERT INTO products (product_code, name_cn, name_en, category, unit, cost_price, base_price)
                         VALUES (?, ?, ?, ?, ?, ?, ?)
                         ON CONFLICT(product_code) DO UPDATE SET 
                            name_cn = CASE WHEN excluded.name_cn IS NOT NULL AND excluded.name_cn != '' THEN excluded.name_cn ELSE name_cn END,
                            name_en = CASE WHEN excluded.name_en IS NOT NULL AND excluded.name_en != '' THEN excluded.name_en ELSE name_en END,
                            category = CASE WHEN excluded.category IS NOT NULL AND excluded.category != '' THEN excluded.category ELSE category END,
                            unit = CASE WHEN excluded.unit IS NOT NULL AND excluded.unit != '' THEN excluded.unit ELSE unit END,
                            cost_price = IFNULL(excluded.cost_price, cost_price),
                            base_price = IFNULL(excluded.base_price, base_price),
                            updated_at = CURRENT_TIMESTAMP`,
                        [
                            product_code, 
                            name_cn || null, 
                            name_en || null, 
                            category || null, 
                            unit || '个', 
                            cost_price, 
                            base_price
                        ]
                    );
                } else {
                    // MySQL 语法
                    await pool.execute(
                        `INSERT INTO products (product_code, name_cn, name_en, category, unit, cost_price, base_price)
                         VALUES (?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE 
                            name_cn = IF(VALUES(name_cn) IS NOT NULL AND VALUES(name_cn) != '', VALUES(name_cn), name_cn),
                            name_en = IF(VALUES(name_en) IS NOT NULL AND VALUES(name_en) != '', VALUES(name_en), name_en),
                            category = IF(VALUES(category) IS NOT NULL AND VALUES(category) != '', VALUES(category), category),
                            unit = IF(VALUES(unit) IS NOT NULL AND VALUES(unit) != '', VALUES(unit), unit),
                            cost_price = IFNULL(VALUES(cost_price), cost_price),
                            base_price = IFNULL(VALUES(base_price), base_price),
                            updated_at = CURRENT_TIMESTAMP`,
                        [
                            product_code, 
                            name_cn || null, 
                            name_en || null, 
                            category || null, 
                            unit || '个', 
                            cost_price, 
                            base_price
                        ]
                    );
                }

                successCount++;
            } catch (err) {
                logger.error('导入行失败', { error: err.message, row });
                errors.push({ row, error: err.message });
                errorCount++;
            }
        }
        
        logger.info('产品批量导入完成', { successCount, errorCount });

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
