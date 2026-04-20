/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                // Brand
                'isik-blue': {
                    DEFAULT: '#0018A8',
                    light: '#1E40AF',
                    lighter: '#3B82F6',
                    dark: '#001080',
                },
                'isik-gold': {
                    DEFAULT: '#F59E0B',
                    light: '#FCD34D',
                },
                // Surfaces (dark theme)
                surface: {
                    900: '#0F172A',
                    800: '#1E293B',
                    700: '#334155',
                    600: '#475569',
                },
                // Semantic
                success: '#10B981',
                warning: '#F59E0B',
                error: '#EF4444',
                info: '#3B82F6',
                // Schedule types
                lecture: '#3B82F6',
                lab: '#8B5CF6',
                ps: '#10B981',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                '2xl': '1rem',
                '3xl': '1.5rem',
            },
            backdropBlur: {
                xs: '2px',
            },
            animation: {
                'slide-in': 'slideIn 0.3s ease-out',
                'slide-out': 'slideOut 0.3s ease-in',
                'fade-in': 'fadeIn 0.2s ease-out',
            },
            keyframes: {
                slideIn: {
                    '0%': { transform: 'translateX(100%)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                slideOut: {
                    '0%': { transform: 'translateX(0)', opacity: '1' },
                    '100%': { transform: 'translateX(100%)', opacity: '0' },
                },
                fadeIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
            },
        },
    },
    plugins: [],
};
