'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

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

    // UX additions
    loadingCourses: string;
    activeSource: string;
    allCoursesLabel: string;
    selectedOnly: string;
    blockedOnly: string;
    codeGroup: string;
    allCodeGroups: string;
    academicUnit: string;
    allAcademicUnits: string;
    noSearchResults: string;
    resetFilters: string;
    clearLocks: string;
    clearSelection: string;
    quickTips: string;
    tipSelectCourses: string;
    tipLockSlots: string;
    tipCreateAlternatives: string;
    manualDraft: string;
    generatedOptions: string;
    pickCoursesHint: string;
    restoredSession: string;
    selectionReset: string;
    locksReset: string;
    selectionMayConflict: string;
    unavailableCoursesSkipped: string;
    prerequisiteWarning: string;
    corequisiteWarning: string;
    missingPreCoWarning: string;

    // Phase 2 UX additions
    undo: string;
    redo: string;
    nothingToUndo: string;
    nothingToRedo: string;
    undone: string;
    redone: string;
    exportMenu: string;
    exportIcal: string;
    exportPrint: string;
    exportIcalDone: string;
    exportNothingToExport: string;
    instructor: string;
    allInstructors: string;
    clearSearch: string;
    stats: string;
    statsFreeDays: string;
    statsFreeDay: string;
    statsBusyDays: string;
    statsTotalHours: string;
    statsGaps: string;
    statsFirstClass: string;
    statsLastClass: string;
    statsNoClass: string;
    confirmClearSelectionTitle: string;
    confirmClearSelectionMessage: string;
    confirmClearLocksTitle: string;
    confirmClearLocksMessage: string;
    confirmYes: string;
    confirmCancel: string;
    keyboardShortcuts: string;
    shortcutUndo: string;
    shortcutRedo: string;
    shortcutPrevSchedule: string;
    shortcutNextSchedule: string;
    shortcutGenerate: string;
    shortcutToggleHelp: string;
    shortcutCloseModal: string;
    shortcutFocusSearch: string;
    shortcutExport: string;
}

const translations: Record<Language, Translations> = {
    tr: {
        // Header
        changeFile: 'Dosya degistir',
        settings: 'Ayarlar',
        courses: 'ders',
        ects: 'ECTS',
        createSchedule: 'Program olustur',
        creating: 'Olusturuluyor...',

        // Sidebar
        searchCourse: 'Ders ara...',
        coursesSelected: 'ders secildi',
        noFileUploaded: 'Henuz dosya yuklenmedi',
        uploadFile: 'Dosya yukle',
        allSectionsLocked: 'Tum sectionlar kilitli',

        // Grid
        weeklySchedule: 'Haftalik program',
        program: 'Program',
        time: 'Saat',

        // Days
        mon: 'Pzt',
        tue: 'Sal',
        wed: 'Car',
        thu: 'Per',
        fri: 'Cum',

        // Upload Modal
        uploadTitle: 'Ders programini yukle',
        uploadSubtitle: 'Excel dosyasini surukle veya sec',
        uploading: 'Yukleniyor...',
        selectFile: 'Dosya sec',
        continue: 'Devam et',

        // Settings Panel
        settingsTitle: 'Ayarlar',
        algorithm: 'Algoritma',
        dfs: 'DFS (Hizli)',
        genetic: 'Genetik',
        astar: 'A*',
        maxEcts: 'Max ECTS',
        conflictTolerance: 'Cakisma toleransi',

        // Course Modal
        lecture: 'Ders',
        lab: 'Lab',
        problemSession: 'PS',
        teacher: 'Hoca',
        schedule: 'Saatler',
        switchSection: 'Section degistir',
        removeCourse: 'Dersi kaldir',

        // Alerts
        pleaseSelectCourse: 'Lutfen once ders secin.',
        courseCannotBeAdded: 'eklenemiyor.',
        allSectionsConflict: 'Tum sectionlar kilitli saatlerle cakisiyor.',
        solutionRemoveLocks: 'Cozum: Bazi kilitleri kaldirin veya farkli bir ders secin.',
        sectionConflictsWithLock: 'Bu section kilitli saatlerle cakisiyor.',
        locked: 'kilitlendi',
        sectionChanged: 'Section degistirildi',
        removedNoAlternative: 'Alternatif bulunamadigi icin kaldirildi',
        toReaddRemoveLocks: 'Bu dersleri tekrar eklemek icin kilitleri kaldirin',
        backendConflict: 'Olusturulan programlar kilitlerle cakisiyor. Mevcut secim kullaniliyor.',
        generationFailed: 'Olusturma basarisiz',
        unknownError: 'Bilinmeyen hata',

        // Lock
        unlock: 'Kilidi kaldir',
        lock: 'Kilitle',

        // UX additions
        loadingCourses: 'Ders verileri yukleniyor...',
        activeSource: 'Kaynak',
        allCoursesLabel: 'Tumu',
        selectedOnly: 'Secili',
        blockedOnly: 'Kilitli',
        codeGroup: 'Kod grubu',
        allCodeGroups: 'Tum kod gruplari',
        academicUnit: 'Akademik birim',
        allAcademicUnits: 'Tum akademik birimler',
        noSearchResults: 'Aramana uyan ders bulunamadi.',
        resetFilters: 'Filtreleri sifirla',
        clearLocks: 'Kilitleri temizle',
        clearSelection: 'Secimi temizle',
        quickTips: 'Hizli ipuclari',
        tipSelectCourses: 'Soldan ders ekleyip cikararak taslak programini olustur.',
        tipLockSlots: 'Tablodaki kilit ikonuyla istemedigin saatleri kapat.',
        tipCreateAlternatives: 'Hazir oldugunda program olusturup alternatifleri gez.',
        manualDraft: 'Manuel taslak gorunumu',
        generatedOptions: 'olusturulan alternatif',
        pickCoursesHint: 'Baslamak icin soldan ders sec.',
        restoredSession: 'Son calisma durumun geri yuklendi.',
        selectionReset: 'Secili dersler temizlendi.',
        locksReset: 'Tum kilitler kaldirildi.',
        selectionMayConflict: 'Secilen section mevcut programla cakisabilir.',
        unavailableCoursesSkipped: 'Bazi eski secimler yeni veri kaynaginda bulunamadi.',
        prerequisiteWarning: 'Secilen dersin bazi onkosullari programinda eksik:',
        corequisiteWarning: 'Secilen dersin bazi eskosullari programinda bulumuyor:',
        missingPreCoWarning: 'Eksik Onkosul/Eskosul Uyarilari',

        // Phase 2 UX additions
        undo: 'Geri al',
        redo: 'Yinele',
        nothingToUndo: 'Geri alinacak islem yok.',
        nothingToRedo: 'Yinelenecek islem yok.',
        undone: 'Son islem geri alindi.',
        redone: 'Islem yinelendi.',
        exportMenu: 'Disa aktar',
        exportIcal: 'Takvime aktar (.ics)',
        exportPrint: 'Yazdir / PDF',
        exportIcalDone: 'Takvim dosyasi hazir.',
        exportNothingToExport: 'Disa aktarilacak ders yok.',
        instructor: 'Ogretim uyesi',
        allInstructors: 'Tum ogretim uyeleri',
        clearSearch: 'Aramayi temizle',
        stats: 'Istatistikler',
        statsFreeDays: 'Bos gunler',
        statsFreeDay: 'Bos gun',
        statsBusyDays: 'Dolu gunler',
        statsTotalHours: 'Toplam ders saati',
        statsGaps: 'Ara saat',
        statsFirstClass: 'Ilk ders',
        statsLastClass: 'Son ders',
        statsNoClass: 'Ders yok',
        confirmClearSelectionTitle: 'Tum secimleri temizle?',
        confirmClearSelectionMessage: 'Secili tum dersler programindan kaldirilacak.',
        confirmClearLocksTitle: 'Tum kilitleri kaldir?',
        confirmClearLocksMessage: 'Isaretli saat kilitlerinin hepsi silinecek.',
        confirmYes: 'Evet, devam et',
        confirmCancel: 'Vazgec',
        keyboardShortcuts: 'Klavye kisayollari',
        shortcutUndo: 'Son islemi geri al',
        shortcutRedo: 'Islemi yinele',
        shortcutPrevSchedule: 'Onceki program',
        shortcutNextSchedule: 'Sonraki program',
        shortcutGenerate: 'Program olustur',
        shortcutToggleHelp: 'Bu pencereyi ac/kapat',
        shortcutCloseModal: 'Acik pencereyi kapat',
        shortcutFocusSearch: 'Aramaya odaklan',
        shortcutExport: 'Disa aktarma menusu',
    },
    en: {
        // Header
        changeFile: 'Change file',
        settings: 'Settings',
        courses: 'courses',
        ects: 'ECTS',
        createSchedule: 'Generate schedule',
        creating: 'Creating...',

        // Sidebar
        searchCourse: 'Search course...',
        coursesSelected: 'courses selected',
        noFileUploaded: 'No file uploaded yet',
        uploadFile: 'Upload file',
        allSectionsLocked: 'All sections locked',

        // Grid
        weeklySchedule: 'Weekly schedule',
        program: 'Schedule',
        time: 'Time',

        // Days
        mon: 'Mon',
        tue: 'Tue',
        wed: 'Wed',
        thu: 'Thu',
        fri: 'Fri',

        // Upload Modal
        uploadTitle: 'Upload course schedule',
        uploadSubtitle: 'Drag and drop or select an Excel file',
        uploading: 'Uploading...',
        selectFile: 'Select file',
        continue: 'Continue',

        // Settings Panel
        settingsTitle: 'Settings',
        algorithm: 'Algorithm',
        dfs: 'DFS (Fast)',
        genetic: 'Genetic',
        astar: 'A*',
        maxEcts: 'Max ECTS',
        conflictTolerance: 'Conflict tolerance',

        // Course Modal
        lecture: 'Lecture',
        lab: 'Lab',
        problemSession: 'PS',
        teacher: 'Instructor',
        schedule: 'Schedule',
        switchSection: 'Switch section',
        removeCourse: 'Remove course',

        // Alerts
        pleaseSelectCourse: 'Please select a course first.',
        courseCannotBeAdded: 'cannot be added.',
        allSectionsConflict: 'All sections conflict with locked slots.',
        solutionRemoveLocks: 'Remove some locks or choose a different course.',
        sectionConflictsWithLock: 'This section conflicts with locked slots.',
        locked: 'locked',
        sectionChanged: 'Section changed',
        removedNoAlternative: 'Removed because no alternative was found',
        toReaddRemoveLocks: 'Remove locks to add these courses back',
        backendConflict: 'Generated schedules conflict with locked slots. Keeping your current selection.',
        generationFailed: 'Generation failed',
        unknownError: 'Unknown error',

        // Lock
        unlock: 'Unlock',
        lock: 'Lock',

        // UX additions
        loadingCourses: 'Loading course data...',
        activeSource: 'Source',
        allCoursesLabel: 'All',
        selectedOnly: 'Selected',
        blockedOnly: 'Blocked',
        codeGroup: 'Code group',
        allCodeGroups: 'All code groups',
        academicUnit: 'Academic unit',
        allAcademicUnits: 'All academic units',
        noSearchResults: 'No courses match your search.',
        resetFilters: 'Reset filters',
        clearLocks: 'Clear locks',
        clearSelection: 'Clear selection',
        quickTips: 'Quick tips',
        tipSelectCourses: 'Build a draft schedule by adding and removing courses from the left.',
        tipLockSlots: 'Use the lock icon inside the table to block unwanted hours.',
        tipCreateAlternatives: 'When ready, generate schedules and browse the alternatives.',
        manualDraft: 'Manual draft view',
        generatedOptions: 'generated options',
        pickCoursesHint: 'Pick courses from the left to get started.',
        restoredSession: 'Your last workspace was restored.',
        selectionReset: 'Selected courses were cleared.',
        locksReset: 'All locks were cleared.',
        selectionMayConflict: 'The selected section may still conflict with your current draft.',
        unavailableCoursesSkipped: 'Some saved selections were not available in the new data source.',
        prerequisiteWarning: 'Missing prerequisites for selected course:',
        corequisiteWarning: 'Missing corequisites for selected course:',
        missingPreCoWarning: 'Missing Prerequisites/Corequisites',
        // Phase 2 UX additions
        undo: 'Undo',
        redo: 'Redo',
        nothingToUndo: 'Nothing to undo.',
        nothingToRedo: 'Nothing to redo.',
        undone: 'Reverted the last change.',
        redone: 'Reapplied the change.',
        exportMenu: 'Export',
        exportIcal: 'Download calendar (.ics)',
        exportPrint: 'Print / Save as PDF',
        exportIcalDone: 'Calendar file ready.',
        exportNothingToExport: 'No courses to export yet.',
        instructor: 'Instructor',
        allInstructors: 'All instructors',
        clearSearch: 'Clear search',
        stats: 'Statistics',
        statsFreeDays: 'Free days',
        statsFreeDay: 'Free day',
        statsBusyDays: 'Busy days',
        statsTotalHours: 'Class hours',
        statsGaps: 'Idle hours',
        statsFirstClass: 'First class',
        statsLastClass: 'Last class',
        statsNoClass: 'No classes',
        confirmClearSelectionTitle: 'Clear every course?',
        confirmClearSelectionMessage: 'All selected courses will be removed from your draft.',
        confirmClearLocksTitle: 'Remove every lock?',
        confirmClearLocksMessage: 'All locked slots will be unlocked.',
        confirmYes: 'Yes, continue',
        confirmCancel: 'Cancel',
        keyboardShortcuts: 'Keyboard shortcuts',
        shortcutUndo: 'Undo the last change',
        shortcutRedo: 'Redo the last change',
        shortcutPrevSchedule: 'Previous schedule',
        shortcutNextSchedule: 'Next schedule',
        shortcutGenerate: 'Generate schedule',
        shortcutToggleHelp: 'Open or close this panel',
        shortcutCloseModal: 'Close the open dialog',
        shortcutFocusSearch: 'Focus the course search',
        shortcutExport: 'Open export menu',
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

    useEffect(() => {
        try {
            const saved = localStorage.getItem('isikschedule:lang') as Language | null;
            if (saved === 'tr' || saved === 'en') {
                setLang(saved);
            }
        } catch {
            // Ignore storage access errors.
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('isikschedule:lang', lang);
        } catch {
            // Ignore storage access errors.
        }
    }, [lang]);

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
        <div className="flex items-center bg-surface-700/50 rounded-lg p-0.5 border border-white/5">
            <button
                onClick={() => setLang('tr')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${lang === 'tr'
                    ? 'bg-isik-blue-lighter/20 text-isik-blue-lighter shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
                title="Turkce"
            >
                TR
            </button>
            <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${lang === 'en'
                    ? 'bg-isik-blue-lighter/20 text-isik-blue-lighter shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
                title="English"
            >
                EN
            </button>
        </div>
    );
}
