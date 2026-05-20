import CryptoJS from 'crypto-js';
import { API_URL } from '../config';

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const userStr = localStorage.getItem('asicme_user');
  const headers = new Headers(options.headers || {});
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.token) {
        headers.set('Authorization', `Bearer ${user.token}`);
      }
    } catch (e) {}
  }
  
  // Generar firma matemática Anti-Postman
  const timestamp = Date.now().toString();
  const method = options.method || 'GET';
  
  // Ignorar GET o FormData por compatibilidad, igual que el backend
  if (method !== 'GET' && !(options.body instanceof FormData)) {
    try {
      const urlObj = new URL(url, window.location.origin);
      const originalUrl = urlObj.pathname + urlObj.search;
      const payload = originalUrl + timestamp + method;
      const secret = 'super_secret_api_key_123'; // Debe coincidir con el process.env.API_SECRET del backend
      const signature = CryptoJS.HmacSHA256(payload, secret).toString(CryptoJS.enc.Hex);
      
      headers.set('x-signature', signature);
      headers.set('x-timestamp', timestamp);
    } catch (e) {
      console.warn('No se pudo firmar la petición:', e);
    }
  }

  return fetch(url, { ...options, headers });
};
