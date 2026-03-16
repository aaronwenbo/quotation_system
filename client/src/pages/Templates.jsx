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
            const res = await productApi.getAll({ pageSize: 1000 });
            setProducts(res.data.data || []);
        } catch (error) {
            console.error('加载产品失败:', error);
        }
    };

    const handleAdd = () => {
        setEditingTemplate(null);
        form.resetFields();
        setPrices({});
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
        setModalVisible(true);
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

    // 按分类分组产品
    const productsByCategory = products.reduce((acc, product) => {
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
                width={800}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
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

                    <div style={{ marginBottom: 16 }}>
                        <h4>{t('template.prices')}</h4>
                        <Collapse>
                            {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
                                <Collapse.Panel header={`${category} (${categoryProducts.length})`} key={category}>
                                    <Table
                                        size="small"
                                        pagination={false}
                                        dataSource={categoryProducts}
                                        rowKey="product_code"
                                        columns={[
                                            { title: '编码', dataIndex: 'product_code', width: 100 },
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
                                                        style={{ width: '100%' }}
                                                    />
                                                )
                                            }
                                        ]}
                                    />
                                </Collapse.Panel>
                            ))}
                        </Collapse>
                    </div>

                    <Form.Item>
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
