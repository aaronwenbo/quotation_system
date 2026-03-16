import { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Select, Dropdown, message, Popconfirm } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    CopyOutlined,
    DownloadOutlined,
    MoreOutlined
} from '@ant-design/icons';
import { quotationApi } from '../services/api';
import { useAppStore } from '../stores';

function Quotations() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const language = useAppStore((state) => state.language);
    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        loadQuotations();
    }, [page, status]);

    const loadQuotations = async () => {
        try {
            setLoading(true);
            const res = await quotationApi.getAll({ page, pageSize: 20, status });
            setQuotations(res.data.data || []);
            setTotal(res.data.total || 0);
        } catch (error) {
            message.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await quotationApi.delete(id);
            message.success(t('common.success'));
            loadQuotations();
        } catch (error) {
            message.error(t('common.error'));
        }
    };

    const handleCopy = async (id) => {
        try {
            await quotationApi.copy(id);
            message.success(t('common.success'));
            loadQuotations();
        } catch (error) {
            message.error(t('common.error'));
        }
    };

    const handleExportExcel = (id) => {
        window.open(quotationApi.exportExcel(id, language), '_blank');
    };

    const handleExportPdf = (id) => {
        window.open(quotationApi.exportPdf(id, language), '_blank');
    };

    const statusOptions = [
        { value: null, label: t('common.selectPlaceholder') },
        { value: 'draft', label: t('quotation.statusDraft') },
        { value: 'sent', label: t('quotation.statusSent') },
        { value: 'confirmed', label: t('quotation.statusConfirmed') },
        { value: 'expired', label: t('quotation.statusExpired') }
    ];

    const statusColors = {
        draft: 'default',
        sent: 'processing',
        confirmed: 'success',
        expired: 'warning'
    };

    const getActionMenu = (record) => ({
        items: [
            {
                key: 'edit',
                icon: <EditOutlined />,
                label: t('common.edit'),
                onClick: () => navigate(`/quotations/${record.id}`)
            },
            {
                key: 'copy',
                icon: <CopyOutlined />,
                label: t('common.copy'),
                onClick: () => handleCopy(record.id)
            },
            { type: 'divider' },
            {
                key: 'excel',
                icon: <DownloadOutlined />,
                label: t('quotation.exportExcel'),
                onClick: () => handleExportExcel(record.id)
            },
            {
                key: 'pdf',
                icon: <DownloadOutlined />,
                label: t('quotation.exportPdf'),
                onClick: () => handleExportPdf(record.id)
            },
            { type: 'divider' },
            {
                key: 'delete',
                icon: <DeleteOutlined />,
                label: t('common.delete'),
                danger: true,
                onClick: () => handleDelete(record.id)
            }
        ]
    });

    const columns = [
        { title: t('quotation.no'), dataIndex: 'quotation_no', key: 'quotation_no' },
        { title: t('quotation.customer'), dataIndex: 'customer_name', key: 'customer_name' },
        {
            title: t('quotation.status'),
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <Tag color={statusColors[status]}>
                    {t(`quotation.status${status.charAt(0).toUpperCase() + status.slice(1)}`)}
                </Tag>
            )
        },
        {
            title: t('quotation.validUntil'),
            dataIndex: 'valid_until',
            key: 'valid_until',
            render: (v) => v ? new Date(v).toLocaleDateString() : '-'
        },
        {
            title: t('common.actions'),
            key: 'actions',
            width: 100,
            render: (_, record) => (
                <Dropdown menu={getActionMenu(record)} trigger={['click']}>
                    <Button type="text" icon={<MoreOutlined />} />
                </Dropdown>
            )
        }
    ];

    return (
        <div>
            <div className="page-header">
                <h1>{t('quotation.title')}</h1>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/quotations/new')}>
                    {t('quotation.createQuotation')}
                </Button>
            </div>

            <div className="card">
                <div className="search-bar">
                    <Select
                        style={{ width: 200 }}
                        placeholder={t('quotation.status')}
                        allowClear
                        options={statusOptions}
                        value={status}
                        onChange={(v) => { setStatus(v); setPage(1); }}
                    />
                </div>

                <Table
                    columns={columns}
                    dataSource={quotations}
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
        </div>
    );
}

export default Quotations;
