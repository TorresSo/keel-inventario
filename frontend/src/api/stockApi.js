import apiClient from './axiosClient';

export const stockApi = {
  listCurrent: () => apiClient.get('/stock').then((r) => r.data),
  listAlerts: () => apiClient.get('/stock/alerts').then((r) => r.data),
  listMovements: (productId, params = {}) =>
    apiClient
      .get(`/stock/${productId}/movements`, { params })
      .then((r) => r.data),
  createMovement: (data) =>
    apiClient.post('/stock/movement', data).then((r) => r.data),
  reverseMovement: (movementId, data = {}) =>
    apiClient
      .post(`/stock/movements/${movementId}/reverse`, data)
      .then((r) => r.data),
};
