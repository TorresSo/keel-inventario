import apiClient from './axiosClient';

export const productsApi = {
  list: () => apiClient.get('/products').then((r) => r.data),
  create: (data) => apiClient.post('/products', data).then((r) => r.data),
  update: (id, data) => apiClient.put(`/products/${id}`, data).then((r) => r.data),
  remove: (id) => apiClient.delete(`/products/${id}`),
  getRecipe: (id) => apiClient.get(`/products/${id}/recipe`).then((r) => r.data),
  setRecipe: (id, items) =>
    apiClient.put(`/products/${id}/recipe`, { items }).then((r) => r.data),
};
