import { apiRequest, tokenStore } from './client';

export const authApi = {
  login: body => apiRequest('/auth/login', { method: 'POST', body, auth: false }),
  me: () => apiRequest('/auth/me'),
  refresh: refreshToken => apiRequest('/auth/refresh', { method: 'POST', body: { refreshToken }, auth: false }),
  logout: async () => {
    const refreshToken = tokenStore.getRefresh();
    if (refreshToken) await apiRequest('/auth/logout', { method: 'POST', body: { refreshToken } });
  },
};

export const patientApi = {
  list: (page = 0, size = 25) => apiRequest('/patients', { query: { page, size } }),
  search: (query, page = 0, size = 10) => apiRequest('/patients/search', { query: { query, page, size } }),
  get: id => apiRequest(`/patients/${id}`),
  create: body => apiRequest('/patients', { method: 'POST', body }),
  update: (id, body) => apiRequest(`/patients/${id}`, { method: 'PUT', body }),
};

export const doctorApi = {
  list: (active = true, department) => apiRequest('/doctors', { query: { active, department } }),
  get: id => apiRequest(`/doctors/${id}`),
  create: body => apiRequest('/doctors', { method: 'POST', body }),
  update: (id, body) => apiRequest(`/doctors/${id}`, { method: 'PUT', body }),
  delete: id => apiRequest(`/doctors/${id}`, { method: 'DELETE' }),
};

export const opApi = {
  create: body => apiRequest('/op-visits', { method: 'POST', body }),
  update: (id, body) => apiRequest(`/op-visits/${id}`, { method: 'PUT', body }),
  get: id => apiRequest(`/op-visits/${id}`),
  search: query => apiRequest('/op-visits', { query }),
  receipt: id => apiRequest(`/op-visits/${id}/receipt`),
};

export const labApi = {
  tests: (query = '', department, active = true) => apiRequest('/lab-tests', { query: { query, department, active } }),
  createTest: body => apiRequest('/lab-tests', { method: 'POST', body }),
  updateTest: (id, body) => apiRequest(`/lab-tests/${id}`, { method: 'PUT', body }),
  updateReportTemplate: (id, html) => apiRequest(`/lab-tests/${id}/report-template`, { method: 'PUT', body: { html } }),
  deleteTest: id => apiRequest(`/lab-tests/${id}`, { method: 'DELETE' }),
  createOrder: body => apiRequest('/lab-orders', { method: 'POST', body }),
  orders: query => apiRequest('/lab-orders', { query }),
  getOrder: id => apiRequest(`/lab-orders/${id}`),
  cancelOrder: (id, reason) => apiRequest(`/lab-orders/${id}/cancel`, { method: 'PATCH', body: { reason } }),
  pendingReports: query => apiRequest('/lab-reports/pending', { query }),
  getReport: id => apiRequest(`/lab-orders/${id}/report`),
  saveReport: (id, body) => apiRequest(`/lab-orders/${id}/report`, { method: 'PUT', body }),
  publishReport: (id, body) => apiRequest(`/lab-orders/${id}/report/publish`, { method: 'POST', body }),
};

export const userApi = {
  list: () => apiRequest('/users'),
  get: id => apiRequest(`/users/${id}`),
  create: body => apiRequest('/users', { method: 'POST', body }),
  update: (id, body) => apiRequest(`/users/${id}`, { method: 'PUT', body }),
};

export const ipdApi = {
  createAdmission: body => apiRequest('/ipd-admissions', { method: 'POST', body }),
  updateAdmission: (id, body) => apiRequest(`/ipd-admissions/${id}`, { method: 'PUT', body }),
  searchAdmissions: (query = '', status = 'ACTIVE') => apiRequest('/ipd-admissions/search', { query: { query, status } }),
  getAdmission: id => apiRequest(`/ipd-admissions/${id}`),
  charges: id => apiRequest(`/ipd-admissions/${id}/charges`),
  addCharge: (id, body) => apiRequest(`/ipd-admissions/${id}/charges`, { method: 'POST', body }),
  updateCharge: (id, chargeId, body) => apiRequest(`/ipd-admissions/${id}/charges/${chargeId}`, { method: 'PUT', body }),
  deleteCharge: (id, chargeId) => apiRequest(`/ipd-admissions/${id}/charges/${chargeId}`, { method: 'DELETE' }),
  catalog: () => apiRequest('/ipd-charge-catalog'),
  addAdvance: (id, body) => apiRequest(`/ipd-admissions/${id}/advances`, { method: 'POST', body }),
  advances: id => apiRequest(`/ipd-admissions/${id}/advances`),
  finalBill: id => apiRequest(`/ipd-admissions/${id}/final-bill`),
  settle: (id, body) => apiRequest(`/ipd-admissions/${id}/final-bill/settle`, { method: 'POST', body }),
  saveDischarge: (id, body) => apiRequest(`/ipd-admissions/${id}/discharge`, { method: 'PUT', body }),
  finalizeDischarge: (id, confirmedBy) => apiRequest(`/ipd-admissions/${id}/discharge/finalize`, { method: 'POST', body: { confirmedBy } }),
  discharge: id => apiRequest(`/ipd-admissions/${id}/discharge`),
};

export const pharmacyApi = {
  medicines: (query = '', active) => apiRequest('/pharmacy/medicines', { query: { query, active } }),
  medicine: id => apiRequest(`/pharmacy/medicines/${id}`),
  createMedicine: body => apiRequest('/pharmacy/medicines', { method: 'POST', body }),
  updateMedicine: (id, body) => apiRequest(`/pharmacy/medicines/${id}`, { method: 'PUT', body }),
  deleteMedicine: id => apiRequest(`/pharmacy/medicines/${id}`, { method: 'DELETE' }),
  createSale: body => apiRequest('/pharmacy/sales', { method: 'POST', body }),
  sale: id => apiRequest(`/pharmacy/sales/${id}`),
};

export const followUpApi = {
  create: body => apiRequest('/follow-ups', { method: 'POST', body }),
  reminders: () => apiRequest('/follow-ups/reminders'),
  markReminded: id => apiRequest(`/follow-ups/${id}/reminded`, { method: 'PATCH' }),
};
