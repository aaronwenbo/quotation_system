import { getPool } from '../database.js';
import fs from 'fs';
import path from 'path';

async function main() {
    const filePath = process.argv[2];
    if (!filePath || !fs.existsSync(filePath)) {
        console.error("Usage: node ai_auto_quote.js <path_to_inquiry_json>");
        process.exit(1);
    }

    const items = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
        const matched = [];
        const unmatched = [];
        let subtotal = 0;

        // Fetch products
        const [products] = await connection.execute('SELECT * FROM products');
        // Fetch aliases
        const [aliases] = await connection.execute('SELECT * FROM product_aliases');

        for (const item of items) {
            const query = (item.name || item.code || '').trim().toLowerCase();
            const qty = Number(item.quantity) || 1;
            if (!query) continue;

            let foundProduct = null;
            let matchLevel = 0;

            // L1: Exact product code
            foundProduct = products.find(p => p.product_code?.toLowerCase() === query.toLowerCase());
            if (foundProduct) matchLevel = 1;

            // L2/L3: Exact alias or name matching
            if (!foundProduct) {
                const aliasMatch = aliases.find(a => 
                    a.alias_code?.toLowerCase() === query || 
                    a.alias_name?.toLowerCase() === query
                );
                if (aliasMatch) {
                    foundProduct = products.find(p => p.id === aliasMatch.product_id);
                    if (foundProduct) {
                        matchLevel = 3;
                        await connection.execute('UPDATE product_aliases SET hit_count = hit_count + 1 WHERE id = ?', [aliasMatch.id]);
                    }
                }
            }

            if (!foundProduct) {
                foundProduct = products.find(p => p.name_cn?.toLowerCase() === query || p.name_en?.toLowerCase() === query);
            }

            if (foundProduct) {
                const amount = (foundProduct.base_price || 0) * qty;
                subtotal += amount;
                matched.push({
                    product_id: foundProduct.id,
                    product_code: foundProduct.product_code,
                    product_name: foundProduct.name_cn,
                    unit_price: foundProduct.base_price || 0,
                    cost_price: foundProduct.cost_price || 0,
                    quantity: qty,
                    discount: 100,
                    amount: amount
                });
            } else {
                unmatched.push({ query, quantity: qty, issue: "未在系统和别名库中找到完全匹配的产品，转入人工队列" });
            }
        }

        let quotationNo = null;
        let quotationId = null;

        if (matched.length > 0) {
            // Generate quotation no
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const random = Math.random().toString(36).substring(2, 6).toUpperCase();
            quotationNo = `Q${year}${month}${day}-AI${random}`;

            // Create draft quotation
            // 假设 customer_id=1 为默认或未知客户
            const [result] = await connection.execute(
                `INSERT INTO quotations (quotation_no, customer_id, status, notes) VALUES (?, 1, 'draft', 'AI自动生成的草稿报价单')`,
                [quotationNo]
            );
            quotationId = result.insertId;

            for (const m of matched) {
                await connection.execute(
                    `INSERT INTO quotation_items (quotation_id, product_id, product_code, product_name, quantity, unit_price, cost_price, discount, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [quotationId, m.product_id, m.product_code, m.product_name, m.quantity, m.unit_price, m.cost_price, m.discount, m.amount]
                );
            }
        }

        console.log(JSON.stringify({
            quotation_id: quotationId,
            quotation_no: quotationNo,
            subtotal,
            matched_count: matched.length,
            unmatched_count: unmatched.length,
            unmatched,
            items: matched
        }, null, 2));

    } catch (err) {
        console.error("AI Quote Failed:", err);
    } finally {
        connection.release();
        process.exit(0);
    }
}

main();
