import express from 'express';
import * as XLSX from 'xlsx';
import PdfPrinter from 'pdfmake';
import { getPool } from '../database.js';

const router = express.Router();

// PDF字体配置
const fonts = {
    Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
    }
};

// 导入默认字体
import pkg from 'pdfmake/build/vfs_fonts.js';
// pdfmake/build/vfs_fonts.js 导出一个对象，其中包含 pdfMake.vfs
const vfs = pkg.pdfMake ? pkg.pdfMake.vfs : pkg.vfs;


// 导出报价单为Excel
router.get('/quotation/:id/excel', async (req, res) => {
    try {
        const pool = getPool();
        const { lang = 'cn' } = req.query;

        // 获取报价单
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

        const quotation = quotations[0];

        // 获取明细
        const [items] = await pool.execute(
            'SELECT * FROM quotation_items WHERE quotation_id = ?',
            [req.params.id]
        );

        // 创建工作簿
        const wb = XLSX.utils.book_new();

        // 报价单信息
        const headerData = [
            [lang === 'cn' ? '报价单' : 'Quotation'],
            [],
            [lang === 'cn' ? '报价单号' : 'Quotation No.', quotation.quotation_no],
            [lang === 'cn' ? '客户名称' : 'Customer', quotation.customer_name || ''],
            [lang === 'cn' ? '联系人' : 'Contact', quotation.contact_person || ''],
            [lang === 'cn' ? '电话' : 'Phone', quotation.phone || ''],
            [lang === 'cn' ? '有效期至' : 'Valid Until', quotation.valid_until || ''],
            [lang === 'cn' ? '创建日期' : 'Date', quotation.created_at?.toISOString?.()?.split('T')[0] || ''],
            []
        ];

        // 明细表头
        const itemHeaders = lang === 'cn'
            ? ['序号', '产品编码', '产品名称', '数量', '单价', '折扣(%)', '金额']
            : ['No.', 'Code', 'Product Name', 'Qty', 'Unit Price', 'Discount(%)', 'Amount'];

        // 明细数据
        const itemData = items.map((item, index) => [
            index + 1,
            item.product_code,
            item.product_name,
            item.quantity,
            item.unit_price,
            item.discount,
            item.amount
        ]);

        // 合计
        const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
        const discountedTotal = totalAmount * (1 - (quotation.discount_rate || 0) / 100);

        const summaryData = [
            [],
            [lang === 'cn' ? '小计' : 'Subtotal', '', '', '', '', '', totalAmount],
            [lang === 'cn' ? '整单折扣' : 'Discount', '', '', '', '', '', `${quotation.discount_rate || 0}%`],
            [lang === 'cn' ? '合计' : 'Total', '', '', '', '', '', discountedTotal]
        ];

        // 备注
        if (quotation.notes) {
            summaryData.push([], [lang === 'cn' ? '备注' : 'Notes', quotation.notes]);
        }

        // 合并数据
        const allData = [...headerData, itemHeaders, ...itemData, ...summaryData];

        const ws = XLSX.utils.aoa_to_array ? XLSX.utils.aoa_to_sheet(allData) : XLSX.utils.aoa_to_sheet(allData);
        XLSX.utils.book_append_sheet(wb, ws, lang === 'cn' ? '报价单' : 'Quotation');

        // 生成Buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=quotation_${quotation.quotation_no}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('导出Excel失败:', error);
        res.status(500).json({ error: '导出Excel失败' });
    }
});

// 导出报价单为PDF
router.get('/quotation/:id/pdf', async (req, res) => {
    try {
        const pool = getPool();
        const { lang = 'cn' } = req.query;

        // 获取报价单
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

        const quotation = quotations[0];

        // 获取明细
        const [items] = await pool.execute(
            'SELECT * FROM quotation_items WHERE quotation_id = ?',
            [req.params.id]
        );

        // 计算合计
        const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
        const discountedTotal = totalAmount * (1 - (quotation.discount_rate || 0) / 100);

        // 构建PDF内容
        const docDefinition = {
            content: [
                { text: lang === 'cn' ? '报价单' : 'QUOTATION', style: 'header' },
                { text: ' ' },
                {
                    columns: [
                        {
                            width: '*',
                            text: [
                                { text: (lang === 'cn' ? '报价单号: ' : 'No.: ') + quotation.quotation_no + '\n' },
                                { text: (lang === 'cn' ? '日期: ' : 'Date: ') + (quotation.created_at?.toISOString?.()?.split('T')[0] || '') + '\n' },
                                { text: (lang === 'cn' ? '有效期至: ' : 'Valid Until: ') + (quotation.valid_until || '') }
                            ]
                        },
                        {
                            width: '*',
                            text: [
                                { text: (lang === 'cn' ? '客户: ' : 'Customer: ') + (quotation.customer_name || '') + '\n' },
                                { text: (lang === 'cn' ? '联系人: ' : 'Contact: ') + (quotation.contact_person || '') + '\n' },
                                { text: (lang === 'cn' ? '电话: ' : 'Phone: ') + (quotation.phone || '') }
                            ]
                        }
                    ]
                },
                { text: ' ' },
                {
                    table: {
                        headerRows: 1,
                        widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto'],
                        body: [
                            lang === 'cn'
                                ? ['#', '编码', '名称', '数量', '单价', '折扣', '金额']
                                : ['#', 'Code', 'Name', 'Qty', 'Price', 'Disc', 'Amount'],
                            ...items.map((item, i) => [
                                i + 1,
                                item.product_code || '',
                                item.product_name || '',
                                item.quantity,
                                item.unit_price?.toFixed(2) || '0.00',
                                (item.discount || 0) + '%',
                                item.amount?.toFixed(2) || '0.00'
                            ])
                        ]
                    }
                },
                { text: ' ' },
                {
                    text: (lang === 'cn' ? '小计: ' : 'Subtotal: ') + totalAmount.toFixed(2),
                    alignment: 'right'
                },
                {
                    text: (lang === 'cn' ? '整单折扣: ' : 'Discount: ') + (quotation.discount_rate || 0) + '%',
                    alignment: 'right'
                },
                {
                    text: (lang === 'cn' ? '合计: ' : 'Total: ') + discountedTotal.toFixed(2),
                    alignment: 'right',
                    style: 'total'
                },
                quotation.notes ? { text: '\n' + (lang === 'cn' ? '备注: ' : 'Notes: ') + quotation.notes } : ''
            ],
            styles: {
                header: { fontSize: 20, bold: true, alignment: 'center' },
                total: { fontSize: 14, bold: true }
            },
            defaultStyle: { fontSize: 10 }
        };

        const printer = new PdfPrinter(fonts);
        const pdfDoc = printer.createPdfKitDocument(docDefinition, {
            tableLayouts: null,
            vfs: vfs
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=quotation_${quotation.quotation_no}.pdf`);

        pdfDoc.pipe(res);
        pdfDoc.end();

    } catch (error) {
        console.error('导出PDF失败:', error);
        res.status(500).json({ error: '导出PDF失败' });
    }
});

// 导出报价模板为Excel
router.get('/template/:id/excel', async (req, res) => {
    try {
        const pool = getPool();
        const { lang = 'cn' } = req.query;

        // 获取模板
        const [templates] = await pool.execute(
            'SELECT * FROM quotation_templates WHERE id = ?',
            [req.params.id]
        );

        if (templates.length === 0) {
            return res.status(404).json({ error: '模板不存在' });
        }

        const template = templates[0];
        const templatePrices = typeof template.prices === 'string'
            ? JSON.parse(template.prices)
            : (template.prices || {});

        // 获取所有产品用于导出
        const [products] = await pool.execute('SELECT * FROM products');

        // 创建工作簿
        const wb = XLSX.utils.book_new();

        // 模板信息
        const headerData = [
            [lang === 'cn' ? '报价模板' : 'Quotation Template'],
            [],
            [lang === 'cn' ? '模板名称' : 'Template Name', template.name],
            [lang === 'cn' ? '说明' : 'Description', template.description || ''],
            []
        ];

        // 表头
        const itemHeaders = lang === 'cn'
            ? ['产品编码', '产品名称', '基础价格', '模板价格']
            : ['Product Code', 'Product Name', 'Base Price', 'Template Price'];

        // 数据
        const itemData = products.map(product => [
            product.product_code,
            product.name_cn,
            Number(product.base_price || 0),
            templatePrices[product.product_code] !== undefined ? Number(templatePrices[product.product_code]) : ''
        ]);

        // 合并数据
        const allData = [...headerData, itemHeaders, ...itemData];

        const ws = XLSX.utils.aoa_to_sheet(allData);
        XLSX.utils.book_append_sheet(wb, ws, lang === 'cn' ? '模板价格' : 'Prices');

        // 生成Buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=template_${template.id}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('导出模板失败:', error);
        res.status(500).json({ error: '导出模板失败' });
    }
});

export default router;
