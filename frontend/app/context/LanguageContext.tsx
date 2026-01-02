'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'tr' | 'en';

interface Translations {
    // Header
    changeFile: string;
    settings: string;
    courses: string;
    ects: string;
    createSchedule: string;
    creating: string;

    // Sidebar
    searchCourse: string;
    coursesSelected: string;
    noFileUploaded: string;
    uploadFile: string;
    allSectionsLocked: string;

    // Grid
    weeklySchedule: string;
    program: string;
    time: string;

    // Days
    mon: string;
    tue: string;
    wed: string;
    thu: string;
    fri: string;

    // Upload Modal
    uploadTitle: string;
    uploadSubtitle: string;
    uploading: string;
    selectFile: string;
    continue: string;

    // Settings Panel
    settingsTitle: string;
    algorithm: string;
    dfs: string;
    genetic: string;
    astar: string;
    maxEcts: string;
    conflictTolerance: string;

    // Course Modal
    lecture: string;
    lab: string;
    problemSession: string;
    teacher: string;
    schedule: string;
    switchSection: string;
    removeCourse: string;

    // Alerts
    pleaseSelectCourse: string;
    courseCannotBeAdded: string;
    allSectionsConflict: string;
    solutionRemoveLocks: string;
    sectionConflictsWithLock: string;
    locked: string;
    sectionChanged: string;
    removedNoAlternative: string;
    toReaddRemoveLocks: string;
    backendConflict: string;
    generationFailed: string;
    unknownError: string;

    // Lock
    unlock: string;
    lock: string;
}

const translations: Record<Language, Translations> = {
    tr: {
        // Header
        changeFile: '📁 Dosya Değiştir',
        settings: '⚙️ Ayarlar',
        courses: 'ders',
        ects: 'ECTS',
        createSchedule: '🚀 Program Oluştur',
        creating: '⏳ Oluşturuluyor...',

        // Sidebar
        searchCourse: '🔍 Ders ara...',
        coursesSelected: 'ders seçildi',
        noFileUploaded: 'Henüz dosya yüklenmedi',
        uploadFile: '📁 Dosya Yükle',
        allSectionsLocked: 'Tüm section\'lar kilitli',

        // Grid
        weeklySchedule: 'Haftalık Program',
        program: 'Program',
        time: 'Saat',

        // Days
        mon: 'Pzt',
        tue: 'Sal',
        wed: 'Çar',
        thu: 'Per',
        fri: 'Cum',

        // Upload Modal
        uploadTitle: 'Ders Programını Yükle',
        uploadSubtitle: 'Excel dosyasını sürükle veya seç',
        uploading: '⏳ Yükleniyor...',
        selectFile: '📤 Dosya Seç',
        continue: 'Devam Et →',

        // Settings Panel
        settingsTitle: '⚙️ Ayarlar',
        algorithm: 'Algoritma',
        dfs: 'DFS (Hızlı)',
        genetic: 'Genetik',
        astar: 'A*',
        maxEcts: 'Max ECTS',
        conflictTolerance: 'Çakışma Toleransı',

        // Course Modal
        lecture: 'Ders',
        lab: 'Lab',
        problemSession: 'PS',
        teacher: 'Hoca',
        schedule: 'Saatler',
        switchSection: '🔄 Section Değiştir',
        removeCourse: '🗑️ Dersi Kaldır',

        // Alerts
        pleaseSelectCourse: 'Lütfen önce ders seçin!',
        courseCannotBeAdded: 'eklenemiyor!',
        allSectionsConflict: 'Tüm section\'lar kilitli saatlerle çakışıyor.',
        solutionRemoveLocks: 'Çözüm: Bazı kilitleri kaldırın veya farklı bir ders seçin.',
        sectionConflictsWithLock: 'Bu section kilitli saatlerle çakışıyor!',
        locked: 'kilitlendi',
        sectionChanged: 'Section değiştirildi',
        removedNoAlternative: 'Alternatif bulunamadığı için kaldırıldı',
        toReaddRemoveLocks: 'Bu dersleri tekrar eklemek için kilitleri kaldırın',
        backendConflict: 'Backend programları kilitlerle çakışıyor. Mevcut seçiminiz kullanılıyor.',
        generationFailed: 'Oluşturma başarısız',
        unknownError: 'Bilinmeyen hata',

        // Lock
        unlock: 'Kilidi Kaldır',
        lock: 'Kilitle',
    },
    en: {
        // Header
        changeFile: '📁 Change File',
        settings: '⚙️ Settings',
        courses: 'courses',
        ects: 'ECTS',
        createSchedule: '🚀 Generate Schedule',
        creating: '⏳ Creating...',

        // Sidebar
        searchCourse: '🔍 Search course...',
        coursesSelected: 'courses selected',
        noFileUploaded: 'No file uploaded yet',
        uploadFile: '📁 Upload File',
        allSectionsLocked: 'All sections locked',

        // Grid
        weeklySchedule: 'Weekly Schedule',
        program: 'Schedule',
        time: 'Time',

        // Days
        mon: 'Mon',
        tue: 'Tue',
        wed: 'Wed',
        thu: 'Thu',
        fri: 'Fri',

        // Upload Modal
        uploadTitle: 'Upload Course Schedule',
        uploadSubtitle: 'Drag & drop or select Excel file',
        uploading: '⏳ Uploading...',
        selectFile: '📤 Select File',
        continue: 'Continue →',

        // Settings Panel
        settingsTitle: '⚙️ Settings',
        algorithm: 'Algorithm',
        dfs: 'DFS (Fast)',
        genetic: 'Genetic',
        astar: 'A*',
        maxEcts: 'Max ECTS',
        conflictTolerance: 'Conflict Tolerance',

        // Course Modal
        lecture: 'Lecture',
        lab: 'Lab',
        problemSession: 'PS',
        teacher: 'Instructor',
        schedule: 'Schedule',
        switchSection: '🔄 Switch Section',
        removeCourse: '🗑️ Remove Course',

        // Alerts
        pleaseSelectCourse: 'Please select a course first!',
        courseCannotBeAdded: 'cannot be added!',
        allSectionsConflict: 'All sections conflict with locked slots.',
        solutionRemoveLocks: 'Solution: Remove some locks or select a different course.',
        sectionConflictsWithLock: 'This section conflicts with locked slots!',
        locked: 'locked',
        sectionChanged: 'Section changed',
        removedNoAlternative: 'Removed (no alternative found)',
        toReaddRemoveLocks: 'Remove locks to re-add these courses',
        backendConflict: 'Backend schedules conflict with locks. Using your current selection.',
        generationFailed: 'Generation failed',
        unknownError: 'Unknown error',

        // Lock
        unlock: 'Unlock',
        lock: 'Lock',
    },
};

interface LanguageContextType {
    lang: Language;
    setLang: (lang: Language) => void;
    t: Translations;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLang] = useState<Language>('tr');

    return (
        <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return context;
}

export function LanguageSwitcher() {
    const { lang, setLang } = useLanguage();

    return (
        <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-1">
            <button
                onClick={() => setLang('tr')}
                className={`px-2 py-1 rounded text-sm transition ${lang === 'tr' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                title="Türkçe"
            >
                🇹🇷
            </button>
            <button
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded text-sm transition ${lang === 'en' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                title="English"
            >
                🇬🇧
            </button>
        </div>
    );
}
