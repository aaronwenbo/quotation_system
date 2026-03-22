import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Popconfirm, Tag, InputNumber, Collapse, Upload } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, DeleteOutlined, StarOutlined, StarFilled, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { templateApi, productApi } from '../services/api';
import { useAppStore } from '../stores';

const { TextArea } = Input;

function Templates() {
    const { t } = useTranslation();
    const language = useAppStore((state) => state.language);
    const [templates, setTemplates] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [prices, setPrices] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [form] = Form.useForm();
    const [importModalVisible, setImportModalVisible] = useState(false);
    const [importingId, setImportingId] = useState(null);

    useEffect(() => {
        loadTemplates();
        loadProducts();
    }, []);

    const loadTemplates = async () => {
        try {
            setLoading(true);
            const res = await templateApi.getAll();
            setTemplates(res.data || []);
        } catch (error) {
            message.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const loadProducts = async () => {
        try {
            // 本次更新：移除 1000 条限制，增加到 100000 以支持全量
            const res = await productApi.getAll({ pageSize: 100000 });
            setProducts(res.data.data || []);
        } catch (error) {
            console.error('加载产品失败:', error);
        }
    };

    const handleAdd = () => {
        setEditingTemplate(null);
        form.resetFields();
        setPrices({});
        setSearchTerm('');
        setModalVisible(true);
    };

    const handleEdit = (record) => {
        setEditingTemplate(record);
        form.setFieldsValue({
            name: record.name,
            description: record.description,
            is_default: record.is_default
        });
        const templatePrices = typeof record.prices === 'string' ? JSON.parse(record.prices) : (record.prices || {});
        setPrices(templatePrices);
        setSearchTerm('');
        setModalVisible(true);
    };

    const handleCopyFromTemplate = async (templateId) => {
        if (!templateId) return;
        try {
            const res = await templateApi.getOne(templateId);
            const sourcePrices = typeof res.data.prices === 'string' ? JSON.parse(res.data.prices) : (res.data.prices || {});
            setPrices(prev => ({ ...prev, ...sourcePrices }));
            message.success('已复制模板价格');
        } catch (error) {
            message.error('获取源模板价格失败');
        }
    };

    const handleDelete = async (id) => {
        try {
            await templateApi.delete(id);
            message.success(t('common.success'));
            loadTemplates();
        } catch (error) {
            message.error(t('common.error'));
        }
    };

    const handleSetDefault = async (id) => {
        try {
            await templateApi.setDefault(id);
            message.success(t('common.success'));
            loadTemplates();
        } catch (error) {
            message.error(t('common.error'));
        }
    };

    const handleDownload = (id) => {
        window.open(templateApi.exportExcel(id, language), '_blank');
    };

    const handleImportClick = (id) => {
        setImportingId(id);
        setImportModalVisible(true);
    };

    const handleImport = async (info) => {
        const formData = new FormData();
        formData.append('file', info.file);

        try {
            await templateApi.import(importingId, formData);
            message.success(t('common.success'));
            setImportModalVisible(false);
            loadTemplates();
        } catch (error) {
            message.error(error.response?.data?.error || t('common.error'));
        }
    };

    const handleSubmit = async (values) => {
        try {
            const data = { ...values, prices };
            if (editingTemplate) {
                await templateApi.update(editingTemplate.id, data);
            } else {
                await templateApi.create(data);
            }
            message.success(t('common.success'));
            setModalVisible(false);
            loadTemplates();
        } catch (error) {
            message.error(t('common.error'));
        }
    };

    const handlePriceChange = (productCode, value) => {
        setPrices(prev => ({ ...prev, [productCode]: value }));
    };

    const columns = [
        { title: t('template.name'), dataIndex: 'name', key: 'name' },
        { title: t('template.description'), dataIndex: 'description', key: 'description', ellipsis: true },
        {
            title: t('template.isDefault'),
            dataIndex: 'is_default',
            key: 'is_default',
            render: (v) => v ? <Tag color="gold"><StarFilled /> 默认</Tag> : null
        },
        {
            title: t('common.actions'),
            key: 'actions',
            width: 400,
            fixed: 'right',
            render: (_, record) => (
                <Space>
                    {!record.is_default && (
                        <Button type="link" icon={<StarOutlined />} onClick={() => handleSetDefault(record.id)}>
                            {t('template.setDefault')}
                        </Button>
                    )}
                    <Button type="link" icon={<DownloadOutlined />} onClick={() => handleDownload(record.id)}>
                        {t('template.downloadTemplate')}
                    </Button>
                    <Button type="link" icon={<UploadOutlined />} onClick={() => handleImportClick(record.id)}>
                        {t('template.importPrices')}
                    </Button>
                    <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                    <Popconfirm title={t('common.confirm') + '?'} onConfirm={() => handleDelete(record.id)}>
                        <Button type="link" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    // 过滤并按分类分组产品
    const filteredProducts = products.filter(p => 
        !searchTerm || 
        p.product_code.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.name_cn && p.name_cn.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const productsByCategory = filteredProducts.reduce((acc, product) => {
        const category = product.category || '未分类';
        if (!acc[category]) acc[category] = [];
        acc[category].push(product);
        return acc;
    }, {});

    return (
        <div>
            <div className="page-header">
                <h1>{t('template.title')}</h1>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    {t('template.addTemplate')}
                </Button>
            </div>

            <div className="card">
                <Table
                    columns={columns}
                    dataSource={templates}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                />
            </div>

            <Modal
                title={editingTemplate ? t('template.editTemplate') : t('template.addTemplate')}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={900}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div>
                            <Form.Item name="name" label={t('template.name')} rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>
                            <Form.Item name="description" label={t('template.description')}>
                                <TextArea rows={2} />
                            </Form.Item>
                            <Form.Item name="is_default" valuePropName="checked">
                                <label>
                                    <input type="checkbox" {...form.getFieldProps?.('is_default')} style={{ marginRight: 8 }} />
                                    {t('template.isDefault')}
                                </label>
                            </Form.Item>
                        </div>
                        <div style={{ borderLeft: '1px solid #f0f0f0', paddingLeft: '24px' }}>
                            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                <h4 style={{ margin: 0 }}>导入现有价格</h4>
                                <Space.Compact style={{ width: '200px' }}>
                                    <select 
                                        className="ant-input ant-input-sm"
                                        onChange={(e) => handleCopyFromTemplate(e.target.value)}
                                        value=""
                                    >
                                        <option value="" disabled>选择源模板...</option>
                                        {templates.filter(t => t.id !== editingTemplate?.id).map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </Space.Compact>
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <Input 
                                    placeholder="搜索产品编码或名称..." 
                                    prefix={<PlusOutlined style={{ transform: 'rotate(45deg)' }} />} 
                                    allowClear
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    value={searchTerm}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <h4>{t('template.prices')}</h4>
                            <span style={{ fontSize: '12px', color: '#8c8c8c' }}>仅显示匹配的产品 ({filteredProducts.length})</span>
                        </div>
                        <Collapse defaultActiveKey={Object.keys(productsByCategory)}>
                            {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
                                <Collapse.Panel header={`${category} (${categoryProducts.length})`} key={category}>
                                    <Table
                                        size="small"
                                        pagination={false}
                                        dataSource={categoryProducts}
                                        rowKey="product_code"
                                        columns={[
                                            { title: '编码', dataIndex: 'product_code', width: 120 },
                                            { title: '名称', dataIndex: 'name_cn' },
                                            { title: '基础价', dataIndex: 'base_price', width: 100, render: (v) => `¥${v || 0}` },
                                            {
                                                title: '模板报价',
                                                width: 150,
                                                render: (_, record) => (
                                                    <InputNumber
                                                        size="small"
                                                        min={0}
                                                        precision={2}
                                                        value={prices[record.product_code]}
                                                        placeholder={record.base_price?.toString()}
                                                        onChange={(v) => handlePriceChange(record.product_code, v)}
                                                        style={{ width: '100%', borderColor: prices[record.product_code] ? '#1890ff' : '#d9d9d9' }}
                                                    />
                                                )
                                            }
                                        ]}
                                    />
                                </Collapse.Panel>
                            ))}
                        </Collapse>
                    </div>

                    <Form.Item style={{ marginTop: 24 }}>
                        <Space>
                            <Button type="primary" htmlType="submit">{t('common.save')}</Button>
                            <Button onClick={() => setModalVisible(false)}>{t('common.cancel')}</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={t('template.importPrices')}
                open={importModalVisible}
                onCancel={() => setImportModalVisible(false)}
                footer={null}
            >
                <Upload.Dragger
                    accept=".xlsx,.xls"
                    customRequest={handleImport}
                    showUploadList={false}
                >
                    <p className="ant-upload-drag-icon">
                        <UploadOutlined />
                    </p>
                    <p className="ant-upload-text">{t('import.uploadFile')}</p>
                    <p className="ant-upload-hint">
                        支持 .xlsx, .xls 格式，需包含列：产品编码、模板价格
                    </p>
                </Upload.Dragger>
            </Modal>
        </div>
    );
}

export default Templates;
