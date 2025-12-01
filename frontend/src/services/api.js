// API service layer for backend communication
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Helper function to get full avatar URL
export const getAvatarUrl = (avatarUrl) => {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }
  return `${API_BASE_URL}${avatarUrl}`;
};

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  login: (utorid, password) => api.post('/auth/tokens', { utorid, password }),
  requestReset: (utorid) => api.post('/auth/resets', { utorid }),
  resetPassword: (resetToken, utorid, password) =>
    api.post(`/auth/resets/${resetToken}`, { utorid, password }),
};

// User endpoints
export const userAPI = {
  getMe: () => api.get('/users/me'),
  updateMe: (data) => {
    // If data is already a FormData instance, use it directly
    if (data instanceof FormData) {
      return api.patch('/users/me', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    
    // Otherwise, create FormData from plain object
    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && data[key] !== null) {
        if (key === 'avatar' && data[key] instanceof File) {
          formData.append('avatar', data[key]);
        } else if (key !== 'avatar') {
          formData.append(key, data[key]);
        }
      }
    });
    return api.patch('/users/me', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  changePassword: (oldPassword, newPassword) =>
    api.patch('/users/me/password', { old: oldPassword, new: newPassword }),
  getUsers: (params) => api.get('/users', { params }),
  getUser: (userId) => api.get(`/users/${userId}`),
  createUser: (data) => api.post('/users', data),
  updateUser: (userId, data) => api.patch(`/users/${userId}`, data),
  getUserTransactions: (userId, params) => api.get(`/users/${userId}/transactions`, { params }),
};

// Transaction endpoints
export const transactionAPI = {
  createTransaction: (data) => api.post('/transactions', data),
  getTransactions: (params) => api.get('/transactions', { params }),
  getTransaction: (transactionId) => api.get(`/transactions/${transactionId}`),
  markSuspicious: (transactionId, suspicious) =>
    api.patch(`/transactions/${transactionId}/suspicious`, { suspicious }),
  createRedemption: (amount, remark) =>
    api.post('/users/me/transactions', { type: 'redemption', amount, remark }),
  createTransfer: (userIdentifier, amount, remark) =>
    api.post(`/users/${userIdentifier}/transactions`, {
      type: 'transfer',
      amount,
      remark,
    }),
  getMyTransactions: (params) => api.get('/users/me/transactions', { params }),
  getRedemptionTransactions: (params) => api.get('/transactions/redemptions', { params }),
  processRedemption: (transactionId) =>
    api.patch(`/transactions/${transactionId}/processed`, { processed: true }),
  processTransaction: (transactionId) =>
    api.patch(`/transactions/${transactionId}/processed`, { processed: true }),
  updateTransactionAmount: (transactionId, amount) =>
    api.patch(`/transactions/${transactionId}/amount`, { amount }),
  updateTransactionSpent: (transactionId, spent) =>
    api.patch(`/transactions/${transactionId}/spent`, { spent }),
};

// Event endpoints
export const eventAPI = {
  createEvent: (data) => api.post('/events', data),
  getEvents: (params) => api.get('/events', { params }),
  getEvent: (eventId) => api.get(`/events/${eventId}`),
  updateEvent: (eventId, data) => api.patch(`/events/${eventId}`, data),
  deleteEvent: (eventId) => api.delete(`/events/${eventId}`),
  addOrganizer: (eventId, utorid) =>
    api.post(`/events/${eventId}/organizers`, { utorid }),
  removeOrganizer: (eventId, userId) =>
    api.delete(`/events/${eventId}/organizers/${userId}`),
  registerForEvent: (eventId) =>
    api.post(`/events/${eventId}/guests/me`),
  unregisterFromEvent: (eventId) =>
    api.delete(`/events/${eventId}/guests/me`),
  addGuest: (eventId, utorid) =>
    api.post(`/events/${eventId}/guests`, { utorid }),
  removeGuest: (eventId, userId) =>
    api.delete(`/events/${eventId}/guests/${userId}`),
  awardPointsToGuest: (eventId, utorid, amount) =>
    api.post(`/events/${eventId}/transactions`, { type: 'event', utorid, amount }),
  awardPointsToAllGuests: (eventId, amount) =>
    api.post(`/events/${eventId}/transactions`, { type: 'event', amount }),
};

// Promotion endpoints
export const promotionAPI = {
  createPromotion: (data) => api.post('/promotions', data),
  getPromotions: (params) => api.get('/promotions', { params }),
  getPromotion: (promotionId) => api.get(`/promotions/${promotionId}`),
  updatePromotion: (promotionId, data) =>
    api.patch(`/promotions/${promotionId}`, data),
  deletePromotion: (promotionId) => api.delete(`/promotions/${promotionId}`),
};

// Analytics endpoints
export const analyticsAPI = {
  // Cashier analytics
  getCashierStats: () => api.get('/analytics/cashier/stats'),
  
  // Manager analytics
  getOverview: () => api.get('/analytics/overview'),
  getUserAnalytics: () => api.get('/analytics/users'),
  getTransactionAnalytics: () => api.get('/analytics/transactions'),
  getEventAnalytics: () => api.get('/analytics/events'),
  getPromotionAnalytics: () => api.get('/analytics/promotions'),
  getFinancialAnalytics: () => api.get('/analytics/financial'),
};

export default api;

