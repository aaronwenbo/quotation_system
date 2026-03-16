import { useState } from 'react';
import { Layout as AntLayout, Menu, Button, Dropdown, Space } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    HomeOutlined,
    AppstoreOutlined,
    TeamOutlined,
    FileTextOutlined,
    CopyOutlined,
    UploadOutlined,
    GlobalOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined
} from '@ant-design/icons';
import { useAppStore } from '../stores';

const { Header, Sider, Content } = AntLayout;

function Layout({ children }) {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { t, i18n } = useTranslation();
    const { language, setLanguage } = useAppStore();

    const menuItems = [
        { key: '/', icon: <HomeOutlined />, label: t('nav.home') },
        { key: '/products', icon: <AppstoreOutlined />, label: t('nav.products') },
        { key: '/customers', icon: <TeamOutlined />, label: t('nav.customers') },
        { key: '/templates', icon: <CopyOutlined />, label: t('nav.templates') },
        { key: '/quotations', icon: <FileTextOutlined />, label: t('nav.quotations') },
        { key: '/import', icon: <UploadOutlined />, label: t('nav.import') }
    ];

    const handleMenuClick = ({ key }) => {
        navigate(key);
    };

    const handleLanguageChange = (lang) => {
        setLanguage(lang);
        i18n.changeLanguage(lang);
    };

    const languageMenu = {
        items: [
            { key: 'zh', label: '中文' },
            { key: 'en', label: 'English' }
        ],
        onClick: ({ key }) => handleLanguageChange(key)
    };

    return (
        <AntLayout style={{ minHeight: '100vh' }}>
            <Sider
                trigger={null}
                collapsible
                collapsed={collapsed}
                style={{
                    overflow: 'auto',
                    height: '100vh',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    zIndex: 100
                }}
            >
                <div style={{
                    height: 64,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <span style={{
                        color: 'white',
                        fontSize: collapsed ? 16 : 18,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden'
                    }}>
                        {collapsed ? 'QS' : (language === 'zh' ? '报价系统' : 'QS')}
                    </span>
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    onClick={handleMenuClick}
                />
            </Sider>
            <AntLayout style={{
                marginLeft: collapsed ? 80 : 200,
                transition: 'all 0.2s',
                minHeight: '100vh',
                width: '100%',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <Header style={{
                    padding: '0 24px',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 99,
                    width: '100%'
                }}>
                    <Button
                        type="text"
                        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        onClick={() => setCollapsed(!collapsed)}
                        style={{ fontSize: 16, width: 48, height: 48 }}
                    />
                    <Space>
                        <Dropdown menu={languageMenu} placement="bottomRight">
                            <Button type="text" icon={<GlobalOutlined />}>
                                {language === 'zh' ? '中文' : 'EN'}
                            </Button>
                        </Dropdown>
                    </Space>
                </Header>
                <Content style={{ margin: 24, flex: '1 0 auto' }}>
                    <div className="animate-fade-in" style={{ height: '100%' }}>
                        {children}
                    </div>
                </Content>
            </AntLayout>
        </AntLayout>
    );
}

export default Layout;
