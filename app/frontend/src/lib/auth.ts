import axios, { AxiosInstance } from 'axios';
import { getAPIBaseURL } from './config';

const TOKEN_KEY = 'auth_token';
const TOKEN_EXPIRY_KEY = 'auth_token_expires_at';

export function getStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!token) return null;
  if (expiresAt && Date.now() > parseInt(expiresAt) * 1000) {
    clearStoredToken();
    return null;
  }
  return token;
}

export function storeToken(token: string, expiresAt?: number): void {
  localStorage.setItem(TOKEN_KEY, token);
  if (expiresAt) {
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt));
  }
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

class RPApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
    });

    // Attach token to every request
    this.client.interceptors.request.use((config) => {
      const token = getStoredToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  private getBaseURL() {
    return getAPIBaseURL();
  }

  async getCurrentUser() {
    const token = getStoredToken();
    if (!token) return null;

    const response = await this.client.get(
      `${this.getBaseURL()}/api/v1/auth/me`
    );
    return response.data;
  }

  login() {
    // Navigate browser directly to the login endpoint.
    // The backend returns a 302 redirect to the OIDC provider,
    // which the browser handles natively.
    window.location.href = `${this.getBaseURL()}/api/v1/auth/login`;
  }

  async logout() {
    const response = await this.client.get(
      `${this.getBaseURL()}/api/v1/auth/logout`
    );
    clearStoredToken();
    if (response.data?.redirect_url) {
      window.location.href = response.data.redirect_url;
    } else {
      window.location.href = '/';
    }
  }
}

export const authApi = new RPApi();