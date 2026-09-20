export const BASE_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE) || 'http://127.0.0.1:3001';

function getToken() {
  return uni.getStorageSync('aitodo_token') || '';
}

export function setToken(token: string) {
  if (token) uni.setStorageSync('aitodo_token', token);
  else uni.removeStorageSync('aitodo_token');
}

export function request(options: { url: string; method?: string; data?: any; header?: Record<string, string> }) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + options.url,
      method: (options.method || 'GET') as any,
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        Authorization: getToken() ? `Bearer ${getToken()}` : '',
        ...(options.header || {}),
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else reject((res.data as any)?.error || '请求失败');
      },
      fail: reject,
    });
  });
}

export const login = (email: string, password: string) =>
  request({
    url: '/api/auth/login',
    method: 'POST',
    data: { email, password, platform: 'mobile-uniapp', deviceName: 'UniApp Mobile', clientVersion: '1.0.0' },
  });

export const sendVerifyCode = (email: string) =>
  request({ url: '/api/auth/send-code', method: 'POST', data: { email } });

export const register = (payload: Record<string, string>) =>
  request({ url: '/api/auth/register', method: 'POST', data: payload });

export const fetchTodoList = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request({ url: `/api/todos${qs}` });
};
export const toggleTodoStatus = (id: string) => request({ url: `/api/todos/${id}/toggle`, method: 'PATCH' });
export const deleteTodoItem = (id: string) => request({ url: `/api/todos/${id}`, method: 'DELETE' });
export const sendAIIntent = (prompt: string) => request({ url: '/api/ai/todo-action', method: 'POST', data: { prompt: String(prompt).slice(0, 1000) } });
