import { useState, useEffect } from 'react';
import {
    Form, Input, Button, Select, DatePicker, InputNumber, Table,
    Card, Space, message, Popover, Tag, Divider, Upload, Tooltip
} from 'antd';
import * as XLSX from 'xlsx';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, DeleteOutlined, HistoryOutlined, DownOutlined, QuestionCircleOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { quotationApi, customerApi, templateApi, productApi } from '../services/api';

const { TextArea } = Input;

function QuotationForm() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [products, setProducts] = useState([]);
    const [items, setItems] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [priceHistories, setPriceHistories] = useState({});

    useEffect(() => {
        loadInitialData();
        if (id) {
            loadQuotation(id);
        }
    }, [id]);

    const loadInitialData = async () => {
        try {
            const [customersRes, templatesRes, productsRes] = await Promise.all([
                customerApi.getAll({ pageSize: 1000 }),
                templateApi.getAll(),
                productApi.getAll({ pageSize: 1000 })
            ]);
            setCustomers(customersRes.data.data || []);
            setTemplates(templatesRes.data || []);
            setProducts(productsRes.data.data || []);
        } catch (error) {
            console.error('加载数据失败:', error);
        }
    };

    const loadQuotation = async (quotationId) => {
        try {
            setLoading(true);
            const res = await quotationApi.getOne(quotationId);
            const data = res.data;
            form.setFieldsValue({
                customer_id: data.customer_id,
                template_id: data.template_id,
                status: data.status,
                valid_until: data.valid_until ? dayjs(data.valid_until) : null,
                discount_rate: data.discount_rate,
                notes: data.notes
            });
            setItems(data.items || []);

            // 加载每个产品的价格历史
            for (const item of data.items || []) {
                if (item.product_id) {
                    loadPriceHistory(item.product_id);
                }
            }
        } catch (error) {
            message.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const loadPriceHistory = async (productId) => {
        try {
            const res = await productApi.getPriceHistory(productId, { limit: 5 });
            setPriceHistories(prev => ({ ...prev, [productId]: res.data }));
        } catch (error) {
            console.error('加载价格历史失败:', error);
        }
    };

    const loadAllPriceHistory = async (productId) => {
        try {
            const res = await productApi.getPriceHistory(productId, { all: true });
            setPriceHistories(prev => ({ ...prev, [productId]: res.data }));
        } catch (error) {
            console.error('加载价格历史失败:', error);
        }
    };

    const handleTemplateChange = async (templateId) => {
        if (!templateId) {
            setSelectedTemplate(null);
            return;
        }

        try {
            const res = await templateApi.getOne(templateId);
            const template = res.data;
            setSelectedTemplate(template);

            // 更新现有项目的价格
            const templatePrices = typeof template.prices === 'string'
                ? JSON.parse(template.prices)
                : (template.prices || {});

            setItems(prevItems => prevItems.map(item => {
                const templatePrice = templatePrices[item.product_code];
                if (templatePrice !== undefined) {
                    const newPrice = templatePrice;
                    return {
                        ...item,
                        unit_price: newPrice,
                        amount: (item.quantity || 1) * newPrice * ((item.discount || 100) / 100)
                    };
                }
                return item;
            }));
        } catch (error) {
            console.error('加载模板失败:', error);
        }
    };

    const handleAddItem = () => {
        setItems([...items, {
            key: Date.now(),
            product_id: null,
            product_code: '',
            product_name: '',
            quantity: 1,
            unit_price: 0,
            cost_price: 0,
            discount: 100,
            amount: 0
        }]);
    };

    const handleProductSelect = (index, productId) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        // 【去重逻辑】检查产品名称是否已存在
        const duplicateIndex = items.findIndex((item, i) => i !== index && item.product_name === product.name_cn);
        if (duplicateIndex !== -1) {
            message.warning(`${t('quotation.productName')} "${product.name_cn}" ${t('common.duplicateError') || '已存在'}`);
            return;
        }

        // 获取模板价格
        let price = product.base_price || 0;
        if (selectedTemplate) {
            const templatePrices = typeof selectedTemplate.prices === 'string'
                ? JSON.parse(selectedTemplate.prices)
                : (selectedTemplate.prices || {});
            if (templatePrices[product.product_code] !== undefined) {
                price = templatePrices[product.product_code];
            }
        }

        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            product_id: product.id,
            product_code: product.product_code,
            product_name: product.name_cn,
            unit_price: price,
            cost_price: product.cost_price || 0,
            amount: newItems[index].quantity * price * ((newItems[index].discount || 100) / 100)
        };
        setItems(newItems);

        // 加载价格历史
        loadPriceHistory(product.id);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;

        // 重新计算金额
        const quantity = newItems[index].quantity || 1;
        const unitPrice = newItems[index].unit_price || 0;
        const discount = newItems[index].discount || 100;
        newItems[index].amount = quantity * unitPrice * (discount / 100);

        setItems(newItems);
    };

    const handleDeleteItem = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = async (values) => {
        try {
            setLoading(true);
            const data = {
                ...values,
                valid_until: values.valid_until?.format('YYYY-MM-DD'),
                items: items.map(item => ({
                    product_id: item.product_id,
                    product_code: item.product_code,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    cost_price: item.cost_price,
                    discount: item.discount,
                    amount: item.amount,
                    notes: item.notes
                }))
            };

            if (id) {
                await quotationApi.update(id, data);
            } else {
                await quotationApi.create(data);
            }

            loadInitialData();
            message.success(t('common.success'));
            navigate('/quotations');
        } catch (error) {
            console.error('提交失败详情:', error.response?.data || error);
            const errorMsg = error.response?.data?.error || error.message || t('common.error');
            message.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleImportItems = async (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    message.warning('Excel文件为空');
                    return;
                }

                const newItems = [...items];
                for (const row of jsonData) {
                    const name = row['产品名称'] || row['名称'] || row['Name'] || '';
                    const quantity = parseInt(row['数量'] || row['Quantity'] || 1) || 1;

                    if (!name) continue;

                    // 【去重逻辑】检查是否已在当前列表中
                    if (newItems.some(item => item.product_name === name)) {
                        console.warn(`跳过重复产品: ${name}`);
                        continue;
                    }

                    // 尝试匹配产品
                    const product = products.find(p => p.name_cn === name || p.name_en === name);

                    let itemPrice = 0;
                    let productId = null;
                    let productCode = '';
                    let productName = name;

                    if (product) {
                        productId = product.id;
                        productCode = product.product_code;
                        productName = product.name_cn;
                        itemPrice = product.base_price || 0;

                        // 模板价格
                        if (selectedTemplate) {
                            const templatePrices = typeof selectedTemplate.prices === 'string'
                                ? JSON.parse(selectedTemplate.prices)
                                : (selectedTemplate.prices || {});
                            if (templatePrices[product.product_code] !== undefined) {
                                itemPrice = templatePrices[product.product_code];
                            }
                        }
                    }

                    newItems.push({
                        key: Date.now() + Math.random(),
                        product_id: productId,
                        product_code: productCode,
                        product_name: productName,
                        quantity: quantity,
                        unit_price: itemPrice,
                        cost_price: product ? (product.cost_price || 0) : 0,
                        discount: 100,
                        amount: quantity * itemPrice
                    });
                }
                setItems(newItems);
                message.success(`成功导入 ${jsonData.length} 条明细`);
            } catch (error) {
                console.error('导入失败:', error);
                message.error('解析Excel失败');
            }
        };
        reader.readAsArrayBuffer(file);
        return false;
    };

    const handleDownloadTemplate = () => {
        const data = [
            { '产品名称': '接头1', '数量': 10 },
            { '产品名称': '接头2', '数量': 5 }
        ];
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'quotation_items_template.xlsx');
    };

    // 计算合计
    const subtotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalCost = items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.cost_price) || 0)), 0);
    const discountRate = Form.useWatch('discount_rate', form) || 0;
    const total = subtotal * (1 - discountRate / 100);
    const totalProfit = total - totalCost;
    const totalMargin = total > 0 ? (totalProfit / total) * 100 : 0;

    const PriceHistoryPopover = ({ productId }) => {
        const history = priceHistories[productId] || [];

        return (
            <div style={{ maxWidth: 350 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('quotation.recentPrices')}</div>
                {history.length === 0 ? (
                    <div style={{ color: '#999' }}>{t('common.noData')}</div>
                ) : (
                    <>
                        {history.slice(0, 5).map((h, i) => (
                            <div key={i} className="price-history-item">
                                <div>
                                    <div style={{ fontWeight: 500 }}>{h.customer_name || '-'}</div>
                                    <div style={{ fontSize: 12, color: '#999' }}>
                                        {new Date(h.quoted_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <div style={{ fontWeight: 600, color: '#1677ff' }}>
                                    ¥{Number(h.unit_price || 0).toFixed(2)} x {h.quantity}
                                </div>
                            </div>
                        ))}
                        {history.length > 5 && (
                            <Button type="link" size="small" onClick={() => loadAllPriceHistory(productId)}>
                                {t('quotation.allPrices')} <DownOutlined />
                            </Button>
                        )}
                    </>
                )}
            </div>
        );
    };

    const itemColumns = [
        {
            title: t('quotation.productName'),
            dataIndex: 'product_id',
            width: 250,
            render: (_, record, index) => (
                <Select
                    showSearch
                    style={{ width: '100%' }}
                    placeholder={t('common.selectPlaceholder')}
                    value={record.product_id}
                    onChange={(v) => handleProductSelect(index, v)}
                    filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={products.map(p => ({
                        value: p.id,
                        label: `${p.product_code} - ${p.name_cn}`
                    }))}
                />
            )
        },
        {
            title: t('quotation.quantity'),
            dataIndex: 'quantity',
            width: 100,
            render: (_, record, index) => (
                <InputNumber
                    min={1}
                    value={record.quantity}
                    onChange={(v) => handleItemChange(index, 'quantity', v)}
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: t('quotation.unitPrice'),
            dataIndex: 'unit_price',
            width: 120,
            render: (_, record, index) => (
                <Space>
                    <InputNumber
                        min={0}
                        precision={2}
                        value={record.unit_price}
                        onChange={(v) => handleItemChange(index, 'unit_price', v)}
                        style={{ width: 100 }}
                    />
                    {record.product_id && (
                        <Popover content={<PriceHistoryPopover productId={record.product_id} />} trigger="click">
                            <Button type="text" size="small" icon={<HistoryOutlined />} />
                        </Popover>
                    )}
                </Space>
            )
        },
        {
            title: t('quotation.discount') + '(%)',
            dataIndex: 'discount',
            width: 100,
            render: (_, record, index) => (
                <InputNumber
                    min={0}
                    max={100}
                    value={record.discount}
                    onChange={(v) => handleItemChange(index, 'discount', v)}
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: t('quotation.amount'),
            dataIndex: 'amount',
            width: 100,
            render: (v) => <span style={{ fontWeight: 500 }}>¥{Number(v || 0).toFixed(2)}</span>
        },
        {
            title: t('quotation.costPrice'),
            dataIndex: 'cost_price',
            width: 100,
            render: (_, record, index) => (
                <InputNumber
                    min={0}
                    precision={2}
                    value={record.cost_price}
                    onChange={(v) => handleItemChange(index, 'cost_price', v)}
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: t('quotation.grossProfit'),
            width: 100,
            render: (_, record) => {
                const profit = (record.amount || 0) - (record.quantity * (record.cost_price || 0));
                return <span style={{ color: profit >= 0 ? '#52c41a' : '#ff4d4f' }}>¥{profit.toFixed(2)}</span>;
            }
        },
        {
            title: t('quotation.profitMargin'),
            width: 90,
            render: (_, record) => {
                const profit = (record.amount || 0) - (record.quantity * (record.cost_price || 0));
                const margin = record.amount > 0 ? (profit / record.amount) * 100 : 0;
                return <Tag color={margin >= 20 ? 'green' : (margin >= 10 ? 'orange' : 'red')}>{margin.toFixed(1)}%</Tag>;
            }
        },
        {
            title: '',
            width: 50,
            render: (_, record, index) => (
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteItem(index)} />
            )
        }
    ];

    return (
        <div>
            <div className="page-header">
                <h1>{id ? t('quotation.editQuotation') : t('quotation.createQuotation')}</h1>
                <Space>
                    <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                        {t('quotation.downloadImportTemplate')}
                    </Button>
                    <Upload
                        accept=".xlsx,.xls"
                        showUploadList={false}
                        beforeUpload={handleImportItems}
                    >
                        <Button icon={<UploadOutlined />} type="primary">
                            {t('quotation.importItems')}
                        </Button>
                    </Upload>
                    <Tooltip title={t('quotation.importTips')}>
                        <QuestionCircleOutlined style={{ fontSize: 16, color: '#999', cursor: 'pointer' }} />
                    </Tooltip>
                </Space>
            </div>

            <Card>
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        <Form.Item name="customer_id" label={t('quotation.customer')} rules={[{ required: true }]}>
                            <Select
                                showSearch
                                placeholder={t('common.selectPlaceholder')}
                                filterOption={(input, option) =>
                                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                                options={customers.map(c => ({ value: c.id, label: c.name }))}
                            />
                        </Form.Item>

                        <Form.Item name="template_id" label={t('quotation.template')}>
                            <Select
                                allowClear
                                placeholder={t('import.useLatest')}
                                onChange={handleTemplateChange}
                                options={templates.map(t => ({
                                    value: t.id,
                                    label: t.name + (t.is_default ? ' (默认)' : '')
                                }))}
                            />
                        </Form.Item>

                        <Form.Item name="valid_until" label={t('quotation.validUntil')}>
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        <Form.Item name="status" label={t('quotation.status')} initialValue="draft">
                            <Select
                                options={[
                                    { value: 'draft', label: t('quotation.statusDraft') },
                                    { value: 'sent', label: t('quotation.statusSent') },
                                    { value: 'confirmed', label: t('quotation.statusConfirmed') },
                                    { value: 'expired', label: t('quotation.statusExpired') }
                                ]}
                            />
                        </Form.Item>

                        <Form.Item name="discount_rate" label={t('quotation.discountRate') + ' (%)'} initialValue={0}>
                            <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
                        </Form.Item>
                    </div>

                    <Form.Item name="notes" label={t('quotation.notes')}>
                        <TextArea rows={2} />
                    </Form.Item>

                    <Divider>{t('quotation.items')}</Divider>

                    <Table
                        columns={itemColumns}
                        dataSource={items}
                        rowKey={(record, index) => record.key || index}
                        pagination={false}
                        size="small"
                        footer={() => (
                            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddItem} block>
                                {t('quotation.addItem')}
                            </Button>
                        )}
                    />

                    <div style={{ marginTop: 24, textAlign: 'right' }}>
                        <div style={{ marginBottom: 8 }}>
                            <span>{t('quotation.subtotal')}: </span>
                            <span style={{ fontWeight: 600, fontSize: 16 }}>¥{Number(subtotal || 0).toFixed(2)}</span>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                            <span>{t('quotation.discountRate')}: </span>
                            <span>{discountRate}%</span>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <span>{t('quotation.total')}: </span>
                            <span style={{ fontWeight: 700, fontSize: 24, color: '#1677ff' }}>¥{Number(total || 0).toFixed(2)}</span>
                        </div>
                        <Divider style={{ margin: '12px 0' }} />
                        <div style={{ color: '#666' }}>
                            <Space size="large">
                                <span>{t('quotation.totalProfit')}: <span style={{ color: totalProfit >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>¥{totalProfit.toFixed(2)}</span></span>
                                <span>{t('quotation.totalMargin')}: <span style={{ fontWeight: 600 }}>{totalMargin.toFixed(1)}%</span></span>
                            </Space>
                        </div>
                    </div>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                {t('common.save')}
                            </Button>
                            <Button onClick={() => navigate('/quotations')}>
                                {t('common.cancel')}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
}

export default QuotationForm;
