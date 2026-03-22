import React, { useState, useEffect } from 'react';
import {
    Card, Upload, Button, Select, Table, Tag, Space, message, Alert, Tabs, Popconfirm, Input, Tooltip
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    FileExcelOutlined, CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined,
    SearchOutlined, SettingOutlined, BulbOutlined, DatabaseOutlined, CheckOutlined
} from '@ant-design/icons';
import { importApi, templateApi, quotationApi, customerApi, aliasApi, productApi } from '../services/api';

function ImportInquiry() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    
    // Basic state
    const [templates, setTemplates] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]); // For manual selection
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    
    // Upload & Match state
    const [matchResult, setMatchResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    
    // Tabs
    const [activeTab, setActiveTab] = useState('matched');
    
    // Aliases state
    const [aliases, setAliases] = useState([]);
    const [aliasTotal, setAliasTotal] = useState(0);
    const [aliasLoading, setAliasLoading] = useState(false);
    const [aliasParams, setAliasParams] = useState({ page: 1, pageSize: 20, search: '' });

    useEffect(() => {
        loadTemplates();
        loadCustomers();
        loadProducts();
        loadAliases();
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

    const loadProducts = async () => {
        try {
            const res = await productApi.getAll({ pageSize: 100000 });
            setProducts(res.data.data || []);
        } catch (error) {
            console.error('加载产品失败:', error);
        }
    };

    const loadAliases = async (params = aliasParams) => {
        try {
            setAliasLoading(true);
            const res = await aliasApi.getAll(params);
            setAliases(res.data.data || []);
            setAliasTotal(res.data.total || 0);
            setAliasParams(params);
        } catch (error) {
            console.error('加载别名失败:', error);
        } finally {
            setAliasLoading(false);
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
            message.success(`解析完成: 匹配 ${res.data.matchedCount} 项, 人工队列 ${res.data.unmatchedCount} 项`);
            if (res.data.unmatchedCount > 0) {
                setActiveTab('unmatched'); // Auto switch to manual queue if needed
            } else {
                setActiveTab('matched');
            }
            // Reload aliases in case L2 added new ones
            if (res.data.newAliases && res.data.newAliases.length > 0) {
                loadAliases();
            }
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
            message.warning('没有匹配的报价项，请先处理人工队列');
            return;
        }

        try {
            setCreating(true);
            // We only create quotation from matched items.
            const items = matchResult.matched.map(item => ({
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

    // Confirm alias in manual queue
    const handleConfirmManualQueue = async (unmatchedIndex, targetProductId) => {
        const item = matchResult.unmatched[unmatchedIndex];
        const targetProduct = products.find(p => p.id === targetProductId);
        if (!targetProduct) return;

        try {
            // Write to alias DB
            const aliasCode = item.original_code || item.original_name;
            await aliasApi.confirm({
                alias_code: aliasCode,
                alias_name: item.original_name,
                product_id: targetProduct.id
            });
            message.success('已确认并保存至别名库');

            // Move from unmatched to matched
            const price = targetProduct.base_price || 0; 
            const newMatchedItem = {
                ...item,
                product_id: targetProduct.id,
                product_code: targetProduct.product_code,
                product_name: targetProduct.name_cn || targetProduct.name_en,
                unit_price: price,
                amount: (item.quantity || 1) * price,
                match_level: 3, // resolved via manual -> behaves like alias now
                matched: true
            };

            const newUnmatched = [...matchResult.unmatched];
            newUnmatched.splice(unmatchedIndex, 1);
            
            const newStats = { ...matchResult.stats };
            newStats.l3 = (newStats.l3 || 0) + 1;
            newStats.l4 = newUnmatched.length;

            setMatchResult({
                ...matchResult,
                matched: [...matchResult.matched, newMatchedItem],
                unmatched: newUnmatched,
                matchedCount: matchResult.matchedCount + 1,
                unmatchedCount: newUnmatched.length,
                stats: newStats
            });
            
            // Auto switch tab to matched if unmatched becomes empty
            if (newUnmatched.length === 0) {
                setActiveTab('matched');
            }

            loadAliases(); // Refetch aliases
        } catch (error) {
            message.error('保存别名失败');
        }
    };

    const handleDeleteAlias = async (id) => {
        try {
            await aliasApi.delete(id);
            message.success('删除成功');
            loadAliases();
        } catch (err) {
            message.error('删除失败');
        }
    };

    const handleMarkAliasesRead = async () => {
        try {
            await aliasApi.markRead();
            message.success('已全部标记为已读');
            loadAliases();
        } catch (err) {
            message.error(t('common.error'));
        }
    };

    const renderMatchLevelTag = (level) => {
        switch (level) {
            case 1: return <Tag color="success">🟢 精确命中 (L1)</Tag>;
            case 2: return <Tag color="processing">🔵 结构解析 (L2)</Tag>;
            case 3: return <Tag color="warning">🟡 别名命中 (L3)</Tag>;
            case 4: return <Tag color="error">🔴 人工队列 (L4)</Tag>;
            default: return <Tag>未知</Tag>;
        }
    };

    const matchedColumns = [
        {
            title: '匹配级别',
            dataIndex: 'match_level',
            width: 140,
            render: (v) => renderMatchLevelTag(v)
        },
        { title: '原始参数 (客户)', render: (_, record) => <div>{record.original_code} <br/><span style={{color:'#888', fontSize:'12px'}}>{record.original_name}</span></div> },
        { title: '匹配产品 (系统)', render: (_, record) => <b>[{record.product_code}] {record.product_name}</b> },
        { title: '规格', dataIndex: 'specifications', ellipsis: true },
        { title: '数量', dataIndex: 'quantity', width: 80 },
        { title: '单价', dataIndex: 'unit_price', width: 100, render: (v) => `¥${Number(v || 0).toFixed(2)}` },
        { title: '金额', dataIndex: 'amount', width: 100, render: (v) => `¥${Number(v || 0).toFixed(2)}` }
    ];

    const unmatchedColumns = [
        {
            title: '状态',
            width: 120,
            render: () => renderMatchLevelTag(4)
        },
        { title: '原始输入参数', render: (_, record) => <div><b>编码:</b> {record.original_code || '-'} <br/><b>名称:</b> {record.original_name || '-'}</div> },
        { title: '规格', dataIndex: 'specifications', width: 150, ellipsis: true },
        { title: '数量', dataIndex: 'quantity', width: 80 },
        {
            title: '操作 - 选择对应系统产品 (将自动写入别名库)',
            render: (_, record, index) => {
                const suggestions = record.suggestions || [];
                return (
                    <Space direction="vertical" style={{ width: '100%' }}>
                        {suggestions.length > 0 && (
                            <div style={{fontSize: '12px', color: '#666'}}>根据相似度推荐:</div>
                        )}
                        <Space wrap>
                            {suggestions.map(s => (
                                <Button 
                                    key={s.id} 
                                    size="small" 
                                    type="dashed"
                                    onClick={() => handleConfirmManualQueue(index, s.id)}
                                >
                                    [{s.product_code}] {s.name_cn} (匹配度:{s.score}%)
                                </Button>
                            ))}
                        </Space>
                        <Select
                            showSearch
                            size="small"
                            placeholder="全局搜索产品库..."
                            style={{ width: 300, marginTop: 4 }}
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={products.map(p => ({ value: p.id, label: `[${p.product_code}] ${p.name_cn || ''}` }))}
                            onChange={(val) => handleConfirmManualQueue(index, val)}
                            value={null}
                        />
                    </Space>
                );
            }
        }
    ];

    const aliasColumns = [
        {
            title: '别名标识 (客户来源)',
            render: (_, record) => (
                <span>
                    {record.is_new === 1 && <Tag color="volcano">★ 新</Tag>}
                    <b>{record.alias_code}</b>
                    {record.alias_name && <div style={{fontSize:'12px', color:'#888'}}>{record.alias_name}</div>}
                </span>
            )
        },
        {
            title: '目标产品 (系统)',
            render: (_, record) => <span>[{record.product_target_code}] {record.product_target_name}</span>
        },
        { title: '产生方式', dataIndex: 'match_level', render: (v) => v === 2 ? <Tag color="blue">结构解析</Tag> : <Tag color="green">人工确认</Tag> },
        { title: '命中次数', dataIndex: 'hit_count', align: 'center' },
        { title: '创建时间', dataIndex: 'created_at', render: (v) => v ? new Date(v).toLocaleString() : '-' },
        {
            title: '操作',
            render: (_, record) => (
                <Popconfirm title="确定删除此别名?" onConfirm={() => handleDeleteAlias(record.id)}>
                    <Button type="link" danger icon={<DeleteOutlined />} />
                </Popconfirm>
            )
        }
    ];

    return (
        <div>
            <div className="page-header">
                <h1>{t('import.title')} - 多级匹配系统</h1>
            </div>

            <Card style={{ marginBottom: 24 }}>
                <Alert
                    message="支持精准、智能结构解析及别名匹配功能。所有无法匹配的行将进入人工队列，解决后自动学习为新别名。"
                    type="info"
                    showIcon
                    style={{ marginBottom: 24 }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, marginBottom: 24 }}>
                    <div>
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('import.selectTemplate')} (用于提取价格)</div>
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
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('quotation.customer')} (必填)</div>
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
                        <FileExcelOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                    </p>
                    <p className="ant-upload-text">点击或拖拽上传询价单 Excel</p>
                    <p className="ant-upload-hint">
                        支持列：[编码/产品编码/代码]、[名称/产品名称]、[规格]、[数量]
                    </p>
                </Upload.Dragger>
            </Card>

            <Card bodyStyle={{ padding: 0 }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    tabBarStyle={{ padding: '0 24px', marginBottom: 0 }}
                    items={[
                        {
                            key: 'matched',
                            label: <span><CheckCircleOutlined /> 匹配结果 ({matchResult?.matchedCount || 0})</span>,
                            children: (
                                <div style={{ padding: 24 }}>
                                    {matchResult && matchResult.matchedCount > 0 ? (
                                        <>
                                            <div style={{ marginBottom: 16 }}>
                                                <Space>
                                                    <Tag color="success">🟢 L1: {matchResult.stats?.l1 || 0}</Tag>
                                                    <Tag color="processing">🔵 L2: {matchResult.stats?.l2 || 0}</Tag>
                                                    <Tag color="warning">🟡 L3: {matchResult.stats?.l3 || 0}</Tag>
                                                </Space>
                                            </div>
                                            <Table
                                                columns={matchedColumns}
                                                dataSource={matchResult.matched}
                                                rowKey={(record, index) => `${record.product_code}-${index}`}
                                                pagination={false}
                                                size="middle"
                                                bordered
                                            />
                                        </>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>暂无已匹配数据，或请先上传文件</div>
                                    )}
                                </div>
                            )
                        },
                        {
                            key: 'unmatched',
                            label: <span>
                                <SettingOutlined /> 人工队列 
                                {matchResult?.unmatchedCount > 0 && <Tag color="error" style={{marginLeft: 8}}>{matchResult.unmatchedCount}</Tag>}
                            </span>,
                            children: (
                                <div style={{ padding: 24 }}>
                                    {matchResult && matchResult.unmatchedCount > 0 ? (
                                        <>
                                            <Alert 
                                                message="请为以下未匹配行选择正确的系统产品，选择后将自动转入已匹配，并记录到别名库中！" 
                                                type="warning" 
                                                showIcon 
                                                style={{marginBottom: 16}} 
                                            />
                                            <Table
                                                columns={unmatchedColumns}
                                                dataSource={matchResult.unmatched}
                                                rowKey={(record, index) => `unmatch-${index}`}
                                                pagination={false}
                                                size="middle"
                                                bordered
                                            />
                                        </>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#52c41a' }}>
                                            <CheckCircleOutlined style={{fontSize: 32, marginBottom: 16}} />
                                            <div>人工队列已清空，所有产品均已匹配！</div>
                                        </div>
                                    )}
                                </div>
                            )
                        },
                        {
                            key: 'aliases',
                            label: <span><DatabaseOutlined /> 别名库 ({aliasTotal})</span>,
                            children: (
                                <div style={{ padding: 24 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <Input.Search
                                            placeholder="搜索别名或产品"
                                            allowClear
                                            onSearch={(val) => loadAliases({ ...aliasParams, search: val, page: 1 })}
                                            style={{ width: 300 }}
                                        />
                                        <Button onClick={handleMarkAliasesRead} icon={<CheckOutlined />}>全部标为已读</Button>
                                    </div>
                                    <Table
                                        columns={aliasColumns}
                                        dataSource={aliases}
                                        rowKey="id"
                                        loading={aliasLoading}
                                        size="middle"
                                        pagination={{
                                            current: aliasParams.page,
                                            pageSize: aliasParams.pageSize,
                                            total: aliasTotal,
                                            onChange: (page, pageSize) => loadAliases({ ...aliasParams, page, pageSize })
                                        }}
                                    />
                                </div>
                            )
                        }
                    ]}
                />
            </Card>

            {(matchResult?.matchedCount > 0) && (
                <div style={{ 
                    position: 'fixed', bottom: 0, left: 200, right: 0, 
                    padding: '16px 24px', background: '#fff', borderTop: '1px solid #e8e8e8',
                    display: 'flex', justifyContent: 'flex-end', zIndex: 10,
                    boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
                }}>
                    <Space>
                        <Button onClick={() => setMatchResult(null)}>清除结果</Button>
                        <Button
                            type="primary"
                            onClick={handleCreateQuotation}
                            loading={creating}
                            disabled={!selectedCustomer}
                            size="large"
                        >
                            {t('import.createQuotation')} ({matchResult.matchedCount} 项)
                        </Button>
                    </Space>
                </div>
            )}
            {/* 增加页面底部内边距以防被底部控制栏遮挡 */}
            <div style={{ height: 80 }} />
        </div>
    );
}

export default ImportInquiry;
