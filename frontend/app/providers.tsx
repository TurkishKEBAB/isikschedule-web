'use client';

import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';

export function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <LanguageProvider>
                {children}
            </LanguageProvider>
        </AuthProvider>
    );
}
