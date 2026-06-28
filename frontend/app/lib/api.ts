export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/**
 * Bearer auth header built from the JWT that AuthContext persists in
 * localStorage. Returns an empty object when there is no token (or during
 * SSR), so it can be spread into any fetch's headers safely:
 *   fetch(url, { headers: { ...authHeaders() } })
 */
export function authHeaders(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    const token = window.localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}
