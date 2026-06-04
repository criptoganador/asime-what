// Prioritize environment variable, fallback to Render URL if env var is missing, fallback to localhost for pure local dev
export const API_URL = import.meta.env.VITE_BACKEND_URL || 'https://asime-chat-backend-shfl.onrender.com';
