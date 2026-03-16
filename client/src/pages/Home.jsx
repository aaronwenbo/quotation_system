import { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Button, Table, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    AppstoreOutlined,
    TeamOutlined,
    FileTextOutlined,
    CopyOutlined,
    PlusOutlined,
    UploadOutlined
} from '@ant-design/icons';
import { productApi, customerApi, quotationApi, templateApi } from '../services/api';

function Home() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        products: 0,
        customers: 0,
        quotations: 0,
        templates: 0
    });
    const [recentQuotations, setRecentQuotations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [productsRes, customersRes, quotationsRes, templatesRes] = await Promise.all([
                productApi.getAll({ pageSize: 1 }),
                customerApi.getAll({ pageSize: 1 }),
                quotationApi.getAll({ pageSize: 5 }),
                templateApi.getAll()
            ]);

            setStats({
                products: productsRes.data.total || 0,
                customers: customersRes.data.total || 0,
                quotations: quotationsRes.data.total || 0,
                templates: templatesRes.data?.length || 0
            });

            setRecentQuotations(quotationsRes.data.data || []);
        } catch (error) {
            console.error('加载数据失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const statusColors = {
        draft: 'default',
        sent: 'processing',
        confirmed: 'success',
        expired: 'warning'
    };

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
            title: t('common.actions'),
            key: 'actions',
            render: (_, record) => (
                <Button type="link" onClick={() => navigate(`/quotations/${record.id}`)}>
                    {t('common.view')}
                </Button>
            )
        }
    ];

    const statCards = [
        { key: 'products', icon: <AppstoreOutlined />, color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
        { key: 'customers', icon: <TeamOutlined />, color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
        { key: 'quotations', icon: <FileTextOutlined />, color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
        { key: 'templates', icon: <CopyOutlined />, color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }
    ];

    const quickActions = [
        { label: t('quotation.createQuotation'), icon: <PlusOutlined />, path: '/quotations/new', type: 'primary' },
        { label: t('nav.import'), icon: <UploadOutlined />, path: '/import', type: 'default' }
    ];

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1>{t('home.title')}</h1>
            </div>

            {/* 统计卡片 */}
            <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                {statCards.map((card) => (
                    <Col xs={24} sm={12} lg={6} key={card.key}>
                        <Card
                            style={{
                                background: card.color,
                                border: 'none',
                                borderRadius: 12
                            }}
                            bodyStyle={{ padding: 24 }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, marginBottom: 8 }}>
                                        {t(`home.stats.${card.key}`)}
                                    </div>
                                    <div style={{ color: 'white', fontSize: 32, fontWeight: 700 }}>
                                        {stats[card.key]}
                                    </div>
                                </div>
                                <div style={{ fontSize: 36, color: 'rgba(255,255,255,0.3)' }}>
                                    {card.icon}
                                </div>
                            </div>
                        </Card>
                    </Col>
                ))}
            </Row>

            <Row gutter={[24, 24]}>
                {/* 快捷操作 */}
                <Col xs={24} lg={8}>
                    <Card title={t('home.quickActions')} style={{ height: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {quickActions.map((action, index) => (
                                <Button
                                    key={index}
                                    type={action.type}
                                    icon={action.icon}
                                    size="large"
                                    block
                                    onClick={() => navigate(action.path)}
                                >
                                    {action.label}
                                </Button>
                            ))}
                        </div>
                    </Card>
                </Col>

                {/* 最近报价单 */}
                <Col xs={24} lg={16}>
                    <Card title={t('home.recentQuotations')}>
                        <Table
                            columns={columns}
                            dataSource={recentQuotations}
                            rowKey="id"
                            loading={loading}
                            pagination={false}
                            size="small"
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
}

export default Home;
