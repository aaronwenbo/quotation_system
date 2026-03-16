import { useState, useEffect } from 'react';
import { Table, Button, Space, Input, Modal, Form, message, Popconfirm } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { customerApi } from '../services/api';

const { Search } = Input;
const { TextArea } = Input;

function Customers() {
    const { t } = useTranslation();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [form] = Form.useForm();

    useEffect(() => {
        loadCustomers();
    }, [page, search]);

    const loadCustomers = async () => {
        try {
            setLoading(true);
            const res = await customerApi.getAll({ page, pageSize: 20, search });
            setCustomers(res.data.data || []);
            setTotal(res.data.total || 0);
        } catch (error) {
            message.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingCustomer(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEdit = (record) => {
        setEditingCustomer(record);
        form.setFieldsValue(record);
        setModalVisible(true);
    };

    const handleDelete = async (id) => {
        try {
            await customerApi.delete(id);
            message.success(t('common.success'));
            loadCustomers();
        } catch (error) {
            message.error(t('common.error'));
        }
    };

    const handleSubmit = async (values) => {
        try {
            if (editingCustomer) {
                await customerApi.update(editingCustomer.id, values);
            } else {
                await customerApi.create(values);
            }
            message.success(t('common.success'));
            setModalVisible(false);
            loadCustomers();
        } catch (error) {
            message.error(t('common.error'));
        }
    };

    const columns = [
        { title: t('customer.name'), dataIndex: 'name', key: 'name' },
        { title: t('customer.contactPerson'), dataIndex: 'contact_person', key: 'contact_person' },
        { title: t('customer.phone'), dataIndex: 'phone', key: 'phone' },
        { title: t('customer.email'), dataIndex: 'email', key: 'email' },
        { title: t('customer.address'), dataIndex: 'address', key: 'address', ellipsis: true },
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
                <h1>{t('customer.title')}</h1>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    {t('customer.addCustomer')}
                </Button>
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
                    dataSource={customers}
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
                title={editingCustomer ? t('customer.editCustomer') : t('customer.addCustomer')}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={600}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item name="name" label={t('customer.name')} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="contact_person" label={t('customer.contactPerson')}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="phone" label={t('customer.phone')}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="email" label={t('customer.email')}>
                        <Input type="email" />
                    </Form.Item>
                    <Form.Item name="address" label={t('customer.address')}>
                        <TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name="notes" label={t('customer.notes')}>
                        <TextArea rows={3} />
                    </Form.Item>
                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">{t('common.save')}</Button>
                            <Button onClick={() => setModalVisible(false)}>{t('common.cancel')}</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

export default Customers;
