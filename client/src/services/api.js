import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// 产品API
export const productApi = {
    getAll: (params) => api.get('/products', { params }),
    getOne: (id) => api.get(`/products/${id}`),
    create: (data) => api.post('/products', data),
    update: (id, data) => api.put(`/products/${id}`, data),
    delete: (id) => api.delete(`/products/${id}`),
    getCategories: () => api.get('/products/categories/list'),
    getPriceHistory: (id, params) => api.get(`/products/${id}/price-history`, { params })
};

// 客户API
export const customerApi = {
    getAll: (params) => api.get('/customers', { params }),
    getOne: (id) => api.get(`/customers/${id}`),
    create: (data) => api.post('/customers', data),
    update: (id, data) => api.put(`/customers/${id}`, data),
    delete: (id) => api.delete(`/customers/${id}`),
    getQuotations: (id) => api.get(`/customers/${id}/quotations`)
};

// 模板API
export const templateApi = {
    getAll: () => api.get('/templates'),
    getLatest: () => api.get('/templates/latest'),
    getOne: (id) => api.get(`/templates/${id}`),
    create: (data) => api.post('/templates', data),
    update: (id, data) => api.put(`/templates/${id}`, data),
    delete: (id) => api.delete(`/templates/${id}`),
    setDefault: (id) => api.post(`/templates/${id}/set-default`),
    exportExcel: (id, lang) => `${API_BASE_URL}/export/template/${id}/excel?lang=${lang}`,
    import: (id, formData) => api.post(`/import/template/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
};

// 报价单API
export const quotationApi = {
    getAll: (params) => api.get('/quotations', { params }),
    getOne: (id) => api.get(`/quotations/${id}`),
    create: (data) => api.post('/quotations', data),
    update: (id, data) => api.put(`/quotations/${id}`, data),
    delete: (id) => api.delete(`/quotations/${id}`),
    updateStatus: (id, status) => api.patch(`/quotations/${id}/status`, { status }),
    copy: (id) => api.post(`/quotations/${id}/copy`),
    exportExcel: (id, lang) => `${API_BASE_URL}/export/quotation/${id}/excel?lang=${lang}`,
    exportPdf: (id, lang) => `${API_BASE_URL}/export/quotation/${id}/pdf?lang=${lang}`
};

// 导入API
export const importApi = {
    inquiry: (formData) => api.post('/import/inquiry', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    products: (formData) => api.post('/import/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
};

// 别名API
export const aliasApi = {
    getAll: (params) => api.get('/aliases', { params }),
    create: (data) => api.post('/aliases', data),
    confirm: (data) => api.post('/aliases/confirm', data),
    update: (id, data) => api.put(`/aliases/${id}`, data),
    delete: (id) => api.delete(`/aliases/${id}`),
    markRead: (ids) => api.post('/aliases/mark-read', { ids })
};

export default api;
