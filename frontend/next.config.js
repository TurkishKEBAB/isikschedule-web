/** @type {import('next').NextConfig} */
const DEV_API_URL = 'http://localhost:8000';

function publicHttpsOrigin(value) {
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

function resolveApiUrl() {
    const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (configured) {
        const productionOrigin = publicHttpsOrigin(configured);
        if (process.env.NODE_ENV === 'production' && !productionOrigin) {
            throw new Error(
                'NEXT_PUBLIC_API_URL must be a public HTTPS origin in production, '
                + 'for example https://api.isikschedule.yigiokur.me'
            );
        }
        return productionOrigin ?? configured.replace(/\/$/, '');
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            'NEXT_PUBLIC_API_URL is required for production builds/starts. '
            + 'Use an absolute backend API origin, for example '
            + 'https://api.isikschedule.yigiokur.me'
        );
    }

    return DEV_API_URL;
}

const apiUrl = resolveApiUrl();

const nextConfig = {
    reactStrictMode: true,
    env: {
        NEXT_PUBLIC_API_URL: apiUrl,
    },
};

module.exports = nextConfig;
