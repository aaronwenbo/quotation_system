import { useState, useEffect } from 'react';
import { Table, Button, Space, Input, Popconfirm, message, Tag, Modal, Form, Select, DatePicker } from 'antd';
import { useTranslation } from 'react-i18next';
import { 
    PlusOutlined, 
    EditOutlined, 
    DeleteOutlined, 
    SearchOutlined,
    CheckOutlined
} from '@ant-design/icons';
import { aliasApi, productApi } from '../services/api';

const { Search } = Input;

function Aliases() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [aliases, setAliases] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [search, setSearch] = useState('');
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
    const [currentAlias, setCurrentAlias] = useState(null);
    const [form] = Form.useForm();
    const [products, setProducts] = useState([]);

    useEffect(() => {
        loadAliases();
        loadProducts();
    }, [page, pageSize, search]);

    const loadAliases = async () => {
        try {
            setLoading(true);
            const res = await aliasApi.getAll({ page, pageSize, search });
            setAliases(res.data.data || []);
            setTotal(res.data.total || 0);
        } catch (error) {
            console.error('加载别名失败:', error);
            message.error(t('common.error', '加载失败'));
        } finally {
            setLoading(false);
        }
    };

    const loadProducts = async () => {
        try {
            // Fetch products for the dropdown mapping
            const res = await productApi.getAll({ pageSize: 5000 });
            setProducts(res.data.data || []);
        } catch (error) {
            console.error('加载产品库失败:', error);
        }
    };

    const handleSearch = (value) => {
        setSearch(value);
        setPage(1);
    };

    const handleTableChange = (pagination) => {
        setPage(pagination.current);
        setPageSize(pagination.pageSize);
    };

    const handleDelete = async (id) => {
        try {
            await aliasApi.delete(id);
            message.success(t('common.success', '删除成功'));
            loadAliases();
        } catch (error) {
            message.error(t('common.error', '删除失败'));
        }
    };

    const handleMarkRead = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('请选择要标记为已读的别名');
            return;
        }
        try {
            await aliasApi.markRead(selectedRowKeys);
            message.success('已标记为已读');
            setSelectedRowKeys([]);
            loadAliases();
        } catch (error) {
            message.error('标记失败');
        }
    };

    const openAddModal = () => {
        setModalMode('add');
        setCurrentAlias(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const openEditModal = (record) => {
        setModalMode('edit');
        setCurrentAlias(record);
        form.setFieldsValue({
            alias_code: record.alias_code,
            alias_name: record.alias_name,
            product_id: record.product_id
        });
        setIsModalOpen(true);
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            
            if (modalMode === 'add') {
                await aliasApi.create(values);
                message.success('新增别名成功');
            } else {
                await aliasApi.update(currentAlias.id, values);
                message.success('别名更新成功');
            }
            
            setIsModalOpen(false);
            loadAliases();
        } catch (error) {
            if (error.errorFields) return; // Form validation failed
            message.error(error.response?.data?.error || '操作失败');
        }
    };

    const rowSelection = {
        selectedRowKeys,
        onChange: (newSelectedRowKeys) => {
            setSelectedRowKeys(newSelectedRowKeys);
        },
    };

    const columns = [
        {
            title: '状态',
            dataIndex: 'is_new',
            width: 80,
            align: 'center',
            render: (v) => v ? <Tag color="volcano" style={{ margin: 0 }}>★ 新</Tag> : null
        },
        {
            title: '别名编码 (客户方)',
            dataIndex: 'alias_code',
            render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>
        },
        {
            title: '别名名称 (客户方)',
            dataIndex: 'alias_name',
        },
        {
            title: '映射标准产品',
            key: 'mapped_product',
            render: (_, record) => (
                <Space direction="vertical" size={0}>
                    <span style={{ color: '#1677ff', fontWeight: 500 }}>{record.product_target_code}</span>
                    <span style={{ fontSize: '13px', color: '#666' }}>{record.product_target_name}</span>
                </Space>
            )
        },
        {
            title: '匹配类型',
            dataIndex: 'match_level',
            render: (level) => {
                if (level === 1) return <Tag color="orange">人工设定</Tag>;
                if (level === 2) return <Tag color="blue">结构解析提取</Tag>;
                return <Tag>{level}</Tag>;
            }
        },
        {
            title: '命中次数',
            dataIndex: 'hit_count',
            sorter: (a, b) => a.hit_count - b.hit_count,
            width: 100
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            render: (text) => new Date(text).toLocaleString(),
            width: 160
        },
        {
            title: t('common.actions', '操作'),
            width: 120,
            render: (_, record) => (
                <Space>
                    <Button 
                        type="text" 
                        icon={<EditOutlined />} 
                        onClick={() => openEditModal(record)} 
                    />
                    <Popconfirm
                        title={t('common.confirmDelete', '确定要删除吗？')}
                        onConfirm={() => handleDelete(record.id)}
                        okText={t('common.yes', '确定')}
                        cancelText={t('common.no', '取消')}
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: 24, background: '#fff', borderRadius: 8, minHeight: 'calc(100vh - 112px)' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
                        新增别名
                    </Button>
                    <Button onClick={handleMarkRead} icon={<CheckOutlined />} disabled={selectedRowKeys.length === 0}>
                        标记为已读
                    </Button>
                </Space>
                <Search
                    placeholder="搜别名编码、名称或产品..."
                    allowClear
                    onSearch={handleSearch}
                    style={{ width: 300 }}
                />
            </div>

            <Table
                columns={columns}
                dataSource={aliases}
                rowKey="id"
                rowSelection={rowSelection}
                pagination={{
                    current: page,
                    pageSize: pageSize,
                    total: total,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条记录`
                }}
                onChange={handleTableChange}
                loading={loading}
                size="middle"
            />

            <Modal
                title={modalMode === 'add' ? '新增产品别名' : '编辑产品别名映射'}
                open={isModalOpen}
                onOk={handleModalOk}
                onCancel={() => setIsModalOpen(false)}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    preserve={false}
                >
                    <Form.Item
                        name="alias_code"
                        label="别名编码 (客户所用编码)"
                        rules={[{ required: true, message: '请输入别名编码' }]}
                    >
                        <Input placeholder="例如：FL-08A" />
                    </Form.Item>

                    <Form.Item
                        name="alias_name"
                        label="别名名称 (客户所用名称)"
                    >
                        <Input placeholder="例如：特殊接头（选填）" />
                    </Form.Item>

                    <Form.Item
                        name="product_id"
                        label="关联到标准产品"
                        rules={[{ required: true, message: '请选择要映射的标准产品' }]}
                    >
                        <Select
                            showSearch
                            placeholder="搜索产品编码或名称"
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase()) || 
                                (option?.searchStr ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={products.map(p => ({
                                value: p.id,
                                label: `${p.product_code} (${p.name_cn || '-'})`,
                                searchStr: `${p.product_code} ${p.name_cn}`
                            }))}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

export default Aliases;
