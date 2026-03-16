import { useState, useEffect } from 'react';
import {
    Card, Upload, Button, Select, Table, Tag, Space, message, Alert
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UploadOutlined, FileExcelOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { importApi, templateApi, quotationApi, customerApi } from '../services/api';

function ImportInquiry() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [templates, setTemplates] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [matchResult, setMatchResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        loadTemplates();
        loadCustomers();
    }, []);

    const loadTemplates = async () => {
        try {
            const res = await templateApi.getAll();
            setTemplates(res.data || []);
        } catch (error) {
            console.error('加载模板失败:', error);
        }
    };

    const loadCustomers = async () => {
        try {
            const res = await customerApi.getAll({ pageSize: 1000 });
            setCustomers(res.data.data || []);
        } catch (error) {
            console.error('加载客户失败:', error);
        }
    };

    const handleUpload = async (info) => {
        const formData = new FormData();
        formData.append('file', info.file);
        if (selectedTemplate) {
            formData.append('template_id', selectedTemplate);
        }

        try {
            setLoading(true);
            const res = await importApi.inquiry(formData);
            setMatchResult(res.data);
            message.success(`解析完成: 匹配 ${res.data.matchedCount} 项, 未匹配 ${res.data.unmatchedCount} 项`);
        } catch (error) {
            message.error(error.response?.data?.error || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const handleCreateQuotation = async () => {
        if (!selectedCustomer) {
            message.warning('请选择客户');
            return;
        }

        if (!matchResult || matchResult.matched.length === 0) {
            message.warning('没有可创建的报价项');
            return;
        }

        try {
            setCreating(true);
            const items = [...matchResult.matched, ...matchResult.unmatched].map(item => ({
                product_id: item.product_id,
                product_code: item.product_code,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount: 0
            }));

            const res = await quotationApi.create({
                customer_id: selectedCustomer,
                template_id: selectedTemplate,
                items
            });

            message.success('报价单创建成功');
            navigate(`/quotations/${res.data.id}`);
        } catch (error) {
            message.error(t('common.error'));
        } finally {
            setCreating(false);
        }
    };

    const matchedColumns = [
        {
            title: '状态',
            width: 80,
            render: (_, record) => (
                record.matched
                    ? <Tag color="success"><CheckCircleOutlined /> 匹配</Tag>
                    : <Tag color="error"><CloseCircleOutlined /> 未匹配</Tag>
            )
        },
        { title: '产品编码', dataIndex: 'product_code', key: 'product_code' },
        { title: '产品名称', dataIndex: 'product_name', key: 'product_name' },
        { title: '规格', dataIndex: 'specifications', key: 'specifications', ellipsis: true },
        { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
        {
            title: '单价',
            dataIndex: 'unit_price',
            key: 'unit_price',
            width: 100,
            render: (v, record) => record.matched ? `¥${Number(v || 0).toFixed(2)}` : '-'
        },
        {
            title: '金额',
            dataIndex: 'amount',
            key: 'amount',
            width: 100,
            render: (v, record) => record.matched ? `¥${Number(v || 0).toFixed(2)}` : '-'
        }
    ];

    return (
        <div>
            <div className="page-header">
                <h1>{t('import.title')}</h1>
            </div>

            <Card style={{ marginBottom: 24 }}>
                <Alert
                    message={t('import.tips')}
                    type="info"
                    showIcon
                    style={{ marginBottom: 24 }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, marginBottom: 24 }}>
                    <div>
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('import.selectTemplate')}</div>
                        <Select
                            style={{ width: '100%' }}
                            placeholder={t('import.useLatest')}
                            allowClear
                            value={selectedTemplate}
                            onChange={setSelectedTemplate}
                            options={templates.map(t => ({
                                value: t.id,
                                label: t.name + (t.is_default ? ' (默认)' : '')
                            }))}
                        />
                    </div>

                    <div>
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('quotation.customer')}</div>
                        <Select
                            showSearch
                            style={{ width: '100%' }}
                            placeholder={t('common.selectPlaceholder')}
                            value={selectedCustomer}
                            onChange={setSelectedCustomer}
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={customers.map(c => ({ value: c.id, label: c.name }))}
                        />
                    </div>
                </div>

                <Upload.Dragger
                    accept=".xlsx,.xls"
                    customRequest={handleUpload}
                    showUploadList={false}
                    disabled={loading}
                >
                    <p className="ant-upload-drag-icon">
                        <FileExcelOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                    </p>
                    <p className="ant-upload-text">{t('import.uploadFile')}</p>
                    <p className="ant-upload-hint">
                        支持 .xlsx, .xls 格式，需包含列：产品编码、名称、规格、数量
                    </p>
                </Upload.Dragger>
            </Card>

            {matchResult && (
                <Card title={t('import.matchResult')}>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                        <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                            总计: {matchResult.total} 项
                        </Tag>
                        <Tag color="success" style={{ fontSize: 14, padding: '4px 12px' }}>
                            <CheckCircleOutlined /> 已匹配: {matchResult.matchedCount} 项
                        </Tag>
                        <Tag color="error" style={{ fontSize: 14, padding: '4px 12px' }}>
                            <CloseCircleOutlined /> 未匹配: {matchResult.unmatchedCount} 项
                        </Tag>
                    </div>

                    <Table
                        columns={matchedColumns}
                        dataSource={[...matchResult.matched, ...matchResult.unmatched]}
                        rowKey={(record, index) => `${record.product_code}-${index}`}
                        pagination={false}
                        size="small"
                    />

                    <div style={{ marginTop: 24, textAlign: 'right' }}>
                        <Space>
                            <Button onClick={() => setMatchResult(null)}>
                                {t('common.cancel')}
                            </Button>
                            <Button
                                type="primary"
                                onClick={handleCreateQuotation}
                                loading={creating}
                                disabled={!selectedCustomer}
                            >
                                {t('import.createQuotation')}
                            </Button>
                        </Space>
                    </div>
                </Card>
            )}
        </div>
    );
}

export default ImportInquiry;
