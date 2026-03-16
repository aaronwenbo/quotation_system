import { useState, useEffect } from 'react';
import { Table, Button, Space, Input, Modal, Form, message, Popconfirm, Upload, InputNumber, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { productApi, importApi } from '../services/api';

const { Search } = Input;

function Products() {
    const { t } = useTranslation();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [importModalVisible, setImportModalVisible] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        loadProducts();
    }, [page, search]);

    const loadProducts = async () => {
        try {
            setLoading(true);
            const res = await productApi.getAll({ page, pageSize: 20, search });
            setProducts(res.data.data || []);
            setTotal(res.data.total || 0);
        } catch (error) {
            message.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingProduct(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEdit = (record) => {
        setEditingProduct(record);
        form.setFieldsValue(record);
        setModalVisible(true);
    };

    const handleDelete = async (id) => {
        try {
            await productApi.delete(id);
            message.success(t('common.success'));
            loadProducts();
        } catch (error) {
            message.error(t('common.error'));
        }
    };

    const handleSubmit = async (values) => {
        try {
            if (editingProduct) {
                await productApi.update(editingProduct.id, values);
            } else {
                await productApi.create(values);
            }
            message.success(t('common.success'));
            setModalVisible(false);
            loadProducts();
        } catch (error) {
            message.error(error.response?.data?.error || t('common.error'));
        }
    };

    const handleImport = async (info) => {
        const formData = new FormData();
        formData.append('file', info.file);

        try {
            const res = await importApi.products(formData);
            message.success(res.data.message);
            setImportModalVisible(false);
            loadProducts();
        } catch (error) {
            message.error(error.response?.data?.error || t('common.error'));
        }
    };

    const columns = [
        { title: t('product.code'), dataIndex: 'product_code', key: 'product_code', width: 120 },
        { title: t('product.nameCn'), dataIndex: 'name_cn', key: 'name_cn' },
        { title: t('product.nameEn'), dataIndex: 'name_en', key: 'name_en' },
        { title: t('product.category'), dataIndex: 'category', key: 'category', width: 120 },
        { title: t('product.unit'), dataIndex: 'unit', key: 'unit', width: 80 },
        { title: t('product.costPrice'), dataIndex: 'cost_price', key: 'cost_price', width: 100, render: (v) => `¥${Number(v || 0).toFixed(2)}` },
        { title: t('product.basePrice'), dataIndex: 'base_price', key: 'base_price', width: 100, render: (v) => `¥${Number(v || 0).toFixed(2)}` },
        {
            title: t('common.actions'),
            key: 'actions',
            width: 180,
            fixed: 'right',
            render: (_, record) => (
                <Space>
                    <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                    <Popconfirm title={t('common.confirm') + '?'} onConfirm={() => handleDelete(record.id)}>
                        <Button type="link" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div>
            <div className="page-header">
                <h1>{t('product.title')}</h1>
                <Space>
                    <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
                        {t('product.batchImport')}
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                        {t('product.addProduct')}
                    </Button>
                </Space>
            </div>

            <div className="card">
                <div className="search-bar">
                    <Search
                        placeholder={t('common.search')}
                        allowClear
                        onSearch={(value) => { setSearch(value); setPage(1); }}
                        style={{ width: 300 }}
                    />
                </div>

                <Table
                    columns={columns}
                    dataSource={products}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 'max-content' }}
                    pagination={{
                        current: page,
                        total,
                        pageSize: 20,
                        onChange: setPage,
                        showTotal: (total) => t('common.total', { count: total })
                    }}
                />
            </div>

            <Modal
                title={editingProduct ? t('product.editProduct') : t('product.addProduct')}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={600}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item name="product_code" label={t('product.code')} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="name_cn" label={t('product.nameCn')} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="name_en" label={t('product.nameEn')}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="category" label={t('product.category')}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="unit" label={t('product.unit')} initialValue="个">
                        <Input />
                    </Form.Item>
                    <Form.Item name="cost_price" label={t('product.costPrice')}>
                        <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="base_price" label={t('product.basePrice')}>
                        <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">{t('common.save')}</Button>
                            <Button onClick={() => setModalVisible(false)}>{t('common.cancel')}</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={t('product.batchImport')}
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
                        支持 .xlsx, .xls 格式，需包含：编码、名称、分类、单位、成本价、基础价格
                    </p>
                </Upload.Dragger>
            </Modal>
        </div>
    );
}

export default Products;
