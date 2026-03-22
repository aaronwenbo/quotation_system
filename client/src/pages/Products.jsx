import { useState, useEffect } from 'react';
import { Table, Button, Space, Input, Modal, Form, message, Popconfirm, Upload, InputNumber, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
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
            if (res.data.errorCount > 0) {
                Modal.warning({
                    title: `部分导入失败 (成功 ${res.data.successCount} 条, 失败 ${res.data.errorCount} 条)`,
                    width: 600,
                    content: (
                        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                            <p style={{ color: '#666', marginBottom: 10 }}>可能是由于【产品编码已存在且无法更新】、【必填项(编码或名称)为空】或【数据格式错误】导致。以下是部分失败详情（最多显示 10 条）：</p>
                            <ul style={{ paddingLeft: 20 }}>
                                {res.data.errors?.map((err, i) => (
                                    <li key={i} style={{ marginBottom: 10 }}>
                                        <div>
                                            <span style={{ color: 'red', fontWeight: 'bold' }}>错误原因:</span> {err.error}
                                        </div>
                                        <div style={{ color: '#888', fontSize: '12px', wordBreak: 'break-all', marginTop: 4 }}>
                                            数据：{JSON.stringify(err.row)}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ),
                    onOk: () => {
                        setImportModalVisible(false);
                        loadProducts();
                    }
                });
            } else {
                message.success(res.data.message);
                setImportModalVisible(false);
                loadProducts();
            }
        } catch (error) {
            message.error(error.response?.data?.error || t('common.error'));
        }
    };

    const downloadTemplate = () => {
        const templateData = [
            ['编码', '名称', '英文名称', '分类', '单位', '成本价', '基础价格'],
            ['P001', '示例接头', 'Sample Joint', '液压接头', '个', 10.50, 20.00]
        ];
        const ws = XLSX.utils.aoa_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '产品导入模板');
        XLSX.writeFile(wb, '产品导入模板.xlsx');
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
                    <Form.Item name="name_cn" label={t('product.nameCn')}>
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
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#666' }}>请先下载标准模板，按格式要求填写产品信息后上传：</span>
                    <Button type="primary" icon={<DownloadOutlined />} onClick={downloadTemplate}>
                        下载导入模板
                    </Button>
                </div>
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
                        支持 .xlsx, .xls 格式，建议包含：编码、名称、英文名称、分类、单位、成本价、基础价格
                    </p>
                </Upload.Dragger>
            </Modal>
        </div>
    );
}

export default Products;
