import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClientProviders } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'IşıkSchedule - Course Schedule Generator',
    description: 'Create optimal course schedules for Işık University students',
    keywords: ['schedule', 'university', 'course', 'işık', 'timetable'],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="tr" suppressHydrationWarning>
            <body className={inter.className} suppressHydrationWarning>
                <ClientProviders>
                    <div className="min-h-screen bg-gray-50">
                        {children}
                    </div>
                </ClientProviders>
            </body>
        </html>
    );
}
