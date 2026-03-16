import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { useTranslation } from 'react-i18next';
import './locales';
import Layout from './components/Layout';
import Home from './pages/Home';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Templates from './pages/Templates';
import Quotations from './pages/Quotations';
import QuotationForm from './pages/QuotationForm';
import ImportInquiry from './pages/ImportInquiry';
import { useAppStore } from './stores';
import './App.css';

function App() {
  const { i18n } = useTranslation();
  const language = useAppStore((state) => state.language);

  return (
    <ConfigProvider
      locale={language === 'zh' ? zhCN : enUS}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
        },
        components: {
          Layout: {
            headerBg: '#001529',
            siderBg: '#001529'
          }
        }
      }}
    >
      <AntApp>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<Products />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/quotations" element={<Quotations />} />
              <Route path="/quotations/new" element={<QuotationForm />} />
              <Route path="/quotations/:id" element={<QuotationForm />} />
              <Route path="/import" element={<ImportInquiry />} />
            </Routes>
          </Layout>
        </Router>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
