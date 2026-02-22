/* ============================================================
   PawLenx — Auth Helper Utility
   Central API configuration for authentication
   ============================================================ */

const PawLenx = {
  // Detect environment: use relative /api/ via Nginx proxy for Docker, or direct URL for Render
  API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? '/api'
    : 'https://webpage-1-pzkj.onrender.com/api',

  getToken() {
    return localStorage.getItem('pawlenxToken');
  },

  getUser() {
    return localStorage.getItem('pawlenxUser');
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  logout() {
    localStorage.removeItem('pawlenxToken');
    localStorage.removeItem('pawlenxUser');
    window.location.href = 'index.html';
  },

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  async apiCall(endpoint, options = {}) {
    const url = `${this.API_BASE}${endpoint}`;
    const defaultHeaders = {};
    
    const token = this.getToken();
    if (token) defaultHeaders['Authorization'] = `Bearer ${token}`;
    if (options.body && !(options.body instanceof FormData)) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers: { ...defaultHeaders, ...(options.headers || {}) }
    });

    if (response.status === 401 || response.status === 403) {
      this.logout();
      return null;
    }

    return response.json();
  }
};
