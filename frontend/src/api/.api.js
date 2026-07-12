import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://emergencty-2000.onrender.com/api";

const API = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// BUG FIX: Added request interceptor to automatically attach the stored JWT token
// to every API call. Previously, each protected call (e.g. /emergency/create)
// had to manually read localStorage and set the header, and any call that
// forgot to do so would get a 401 from the middleware.
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: on 401, clear stale credentials and redirect to login.
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("driver");
      const currentPath = window.location.pathname;
      if (currentPath.includes("/driver")) {
        window.location.href = "/driver-login";
      } else if (!currentPath.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default API;