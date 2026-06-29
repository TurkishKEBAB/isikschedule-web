const DEV_API_URL = 'http://localhost:8000';

function publicHttpsOrigin(value: string): string | null {
    try {
        const url = new URL(value);
        const isValidOrigin = url.protocol === 'https:'
            && !['localhost', '127.0.0.1'].includes(url.hostname)
            && url.origin === value.replace(/\/$/, '');
        return isValidOrigin ? url.origin : null;
    } catch {
        return null;
    }
}

function resolveApiBaseUrl(): string {
    const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (configured) {
        const productionOrigin = publicHttpsOrigin(configured);
        if (process.env.NODE_ENV === 'production' && !productionOrigin) {
            throw new Error('NEXT_PUBLIC_API_URL must be a public HTTPS origin in production');
        }
        return productionOrigin ?? configured.replace(/\/$/, '');
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('NEXT_PUBLIC_API_URL is required in production');
    }
    return DEV_API_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

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
