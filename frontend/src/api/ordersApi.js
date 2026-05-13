import apiClient from './axiosClient';

export const ordersApi = {
  list: (params = {}) =>
    apiClient.get('/orders', { params }).then((r) => r.data),

  get: (id) => apiClient.get(`/orders/${id}`).then((r) => r.data),

  upload: (file) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient
      .post('/orders/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  updateItem: (orderId, itemId, newQuantity) =>
    apiClient
      .patch(`/orders/${orderId}/items/${itemId}`, {
        quantity_boxes_requested: newQuantity,
      })
      .then((r) => r.data),

  confirm: (orderId, acceptNegative = false) =>
    apiClient
      .post(`/orders/${orderId}/confirm`, { accept_negative: acceptNegative })
      .then((r) => r.data),
};
