import { create } from 'zustand';

// 全局应用状态
export const useAppStore = create((set) => ({
    language: localStorage.getItem('language') || 'zh',
    setLanguage: (lang) => {
        localStorage.setItem('language', lang);
        set({ language: lang });
    },

    // 全局loading状态
    loading: false,
    setLoading: (loading) => set({ loading }),

    // 通知消息
    notification: null,
    showNotification: (notification) => set({ notification }),
    clearNotification: () => set({ notification: null })
}));

// 产品状态
export const useProductStore = create((set) => ({
    products: [],
    total: 0,
    loading: false,
    setProducts: (products, total) => set({ products, total }),
    setLoading: (loading) => set({ loading })
}));

// 客户状态
export const useCustomerStore = create((set) => ({
    customers: [],
    total: 0,
    loading: false,
    setCustomers: (customers, total) => set({ customers, total }),
    setLoading: (loading) => set({ loading })
}));

// 模板状态
export const useTemplateStore = create((set) => ({
    templates: [],
    loading: false,
    setTemplates: (templates) => set({ templates }),
    setLoading: (loading) => set({ loading })
}));

// 报价单状态
export const useQuotationStore = create((set) => ({
    quotations: [],
    total: 0,
    loading: false,
    currentQuotation: null,
    setQuotations: (quotations, total) => set({ quotations, total }),
    setCurrentQuotation: (quotation) => set({ currentQuotation: quotation }),
    setLoading: (loading) => set({ loading })
}));
