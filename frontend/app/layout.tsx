import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClientProviders } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'IşıkSchedule — Ders Programı Oluşturucu',
    description: 'Işık Üniversitesi öğrencileri için ders programı planlayıcı',
    keywords: ['schedule', 'university', 'course', 'işık', 'timetable'],
    icons: {
        icon: '/icon.svg',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="tr" suppressHydrationWarning>
            <body className={`${inter.className} bg-surface-900 text-slate-100 antialiased`} suppressHydrationWarning>
                <ClientProviders>
                    {children}
                </ClientProviders>
            </body>
        </html>
    );
}
