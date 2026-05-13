import apiClient from './axiosClient';

export const authApi = {
  login: (email, password) =>
    apiClient.post('/auth/login', { email, password }).then((r) => r.data),

  me: () => apiClient.get('/auth/me').then((r) => r.data),
};
