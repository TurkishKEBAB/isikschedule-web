'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { AuroraBackground } from '../components/AuroraBackground';

export default function ResultsPage() {
    return (
        <Suspense fallback={<RedirectFallback />}>
            <ResultsRedirect />
        </Suspense>
    );
}

function ResultsRedirect() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useLanguage();

    useEffect(() => {
        const fileId = searchParams.get('file_id');
        const target = fileId ? `/scheduler?file_id=${encodeURIComponent(fileId)}` : '/scheduler';
        router.replace(target);
    }, [router, searchParams]);

    return <RedirectFallback title={t.redirectTitle} description={t.redirectDescription} />;
}

function RedirectFallback({ title, description }: { title?: string; description?: string }) {
    return (
        <main className="relative min-h-screen bg-[#0B1020] flex items-center justify-center px-6">
            <AuroraBackground variant="absolute" className="opacity-70" />
            <div className="relative z-10 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-isik-blue-lighter" />
                {title && <h1 className="text-lg font-semibold text-white">{title}</h1>}
                {description && <p className="text-sm text-slate-400 mt-2 max-w-sm">{description}</p>}
            </div>
        </main>
    );
}
