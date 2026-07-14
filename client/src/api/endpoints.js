import apiClient from './client';

export const authApi = {
  login: (email, password) => apiClient.post('/auth/login', { email, password }),
  me: () => apiClient.get('/auth/me'),
  logout: () => apiClient.post('/auth/logout'),
  forgotPassword: (email) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => apiClient.post('/auth/reset-password', { token, newPassword }),
};

export const leadsApi = {
  list: (params) => apiClient.get('/leads', { params }),
  dueToday: () => apiClient.get('/leads/due-today'),
  pipeline: () => apiClient.get('/leads/pipeline'),
  byDay: (params) => apiClient.get('/leads/by-day', { params }),
  get: (id) => apiClient.get(`/leads/${id}`),
  create: (payload) => apiClient.post('/leads', payload),
  addFollowUp: (id, payload) => apiClient.post(`/leads/${id}/followups`, payload),
};

export const customersApi = {
  search: (search) => apiClient.get('/customers', { params: { search } }),
  listAll: () => apiClient.get('/customers/all'),
  rename: (id, name) => apiClient.put(`/customers/${id}`, { name }),
};

export const productsApi = {
  list: (includeInactive = false) => apiClient.get('/products', { params: { includeInactive } }),
  create: (name, category = 'fonfox') => apiClient.post('/products', { name, category }),
  update: (id, payload) => apiClient.put(`/products/${id}`, payload),
  remove: (id) => apiClient.delete(`/products/${id}`),
};

export const usersApi = {
  list: () => apiClient.get('/users'),
  create: (payload) => apiClient.post('/users', payload),
  update: (id, payload) => apiClient.put(`/users/${id}`, payload),
  setActive: (id, isActive) => apiClient.put(`/users/${id}/active-status`, { isActive }),
  resetPassword: (id) => apiClient.put(`/users/${id}/reset-password`),
  adjustPoints: (id, delta) => apiClient.put(`/users/${id}/adjust-points`, { delta }),
};

export const dashboardApi = {
  userStats: () => apiClient.get('/dashboard/user-stats'),
  adminStats: () => apiClient.get('/dashboard/admin-stats'),
  userPerformance: (params) => apiClient.get('/dashboard/user-performance', { params }),
  userDetail: (id) => apiClient.get(`/dashboard/user-detail/${id}`),
  claimDailyPoints: () => apiClient.post('/dashboard/claim-daily-points'),
  weeklyAttendance: () => apiClient.get('/dashboard/weekly-attendance'),
};

export const reportsApi = {
  leadActivity: (params) => apiClient.get('/reports/lead-activity', { params }),
  productWise: () => apiClient.get('/reports/product-wise'),
  followUps: () => apiClient.get('/reports/followups'),
  orderConversion: () => apiClient.get('/reports/order-conversion'),
  leadsByDay: (params) => apiClient.get('/reports/leads-by-day', { params }),
  exportUrl: (type) => `${apiClient.defaults.baseURL}/reports/export?type=${type}`,
};
