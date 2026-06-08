'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
    GraduationCap, Search, FolderOpen, Settings, Rocket, Loader2,
    Lock, Unlock, ChevronLeft, ChevronRight, X, RefreshCw,
    BookOpen, FlaskConical, PenTool, User as UserIcon, Clock,
    Upload as UploadIcon, FileSpreadsheet, Undo2, Redo2, Download,
    Printer, CalendarDays, Keyboard, BarChart3, Sparkles, Share2, AlertTriangle,
    SlidersHorizontal
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage, LanguageSwitcher } from '../context/LanguageContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import TeacherLink from '../components/TeacherLink';
import { UploadDropzone } from '../components/UploadDropzone';
import { ScheduleTypeLegend } from '../components/ScheduleTypeLegend';
import { AuroraBackground } from '../components/AuroraBackground';
import { GeneratedSchedulesView } from '../components/GeneratedSchedulesView';
import { ScheduleHealthBar } from '../components/scheduler/ScheduleHealthBar';
import { BuildPanel, type SelectedCourseItem } from '../components/scheduler/BuildPanel';
import { API_BASE_URL } from '../lib/api';
import {
    clearSchedulerSnapshot,
    readSchedulerSnapshot,
    writeSchedulerSnapshot,
} from '../lib/schedulerStorage';
import {
    buildScheduleICS,
    computeScheduleStats,
    downloadICS,
} from '../lib/scheduleExport';

interface Course {
    code: string;
    main_code: string;
    name: string;
    ects: number;
    type: string;
    teacher?: string;
    faculty?: string;
    schedule: [string, number][];
    schedule_str?: string;
    prerequisites?: string[];
    corequisites?: string[];
}

interface Schedule {
    id: string;
    score: number;
    total_ects: number;
    conflict_count: number;
    course_count: number;
    courses: Course[];
}

interface CourseSource {
    fileId: string;
    sourceLabel: string | null;
    courses: Course[];
}

interface ScoredOption {
    option: Course[];
    lockedConflictCount: number;
    conflictCount: number;
    missingComponents: number;
}

interface CourseListItem {
    course: Course;
    prefix: string;
    academicUnit: string | null;
    isSelected: boolean;
    isBlocked: boolean;
}

type CourseFilter = 'all' | 'selected' | 'blocked';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PERIOD_TIMES = ['08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:30'];
const DEFAULT_ALGORITHM = 'dfs';
const DEFAULT_MAX_ECTS = 31;
const DEFAULT_MAX_CONFLICTS = 1;
const KNOWN_ACADEMIC_UNITS = [
    'İktisadi, İdari ve Sosyal Bilimler Fakültesi',
    'Mühendislik ve Doğa Bilimleri Fakültesi',
    'Sanat, Tasarım ve Mimarlık Fakültesi',
    'Meslek Yüksekokulu',
    'Lisansüstü Eğitim Enstitüsü',
    'Yabancı Diller Okulu',
    'Ortak Dersler Koordinatörlüğü',
    'Bologna Süreci',
    'Sağlık, Kültür ve Spor Direktörlüğü',
    'Sürekli Eğitim Merkezi',
    'Türkçe Öğretimi Uygulama ve Araştırma Merkezi',
];

const TYPE_STYLES: Record<string, { bg: string; border: string; icon: React.ReactNode }> = {
    lecture: { bg: 'bg-lecture/90', border: 'border-lecture/30', icon: <BookOpen className="w-3 h-3" /> },
    lab: { bg: 'bg-lab/90', border: 'border-lab/30', icon: <FlaskConical className="w-3 h-3" /> },
    ps: { bg: 'bg-ps/90', border: 'border-ps/30', icon: <PenTool className="w-3 h-3" /> },
};

function getSlotKey(day: string, period: number) {
    return `${day}-${period}`;
}

function courseConflictsWithLocks(course: Course, lockedSlots: Set<string>) {
    return course.schedule?.some(([day, period]) => lockedSlots.has(getSlotKey(day, period))) || false;
}

function countCourseConflicts(courses: Course[]) {
    const seen = new Set<string>();
    let conflicts = 0;

    courses.forEach((course) => {
        (course.schedule || []).forEach(([day, period]) => {
            const key = getSlotKey(day, period);
            if (seen.has(key)) {
                conflicts += 1;
            } else {
                seen.add(key);
            }
        });
    });

    return conflicts;
}

function dedupeCourses(courses: Course[]) {
    const seen = new Set<string>();
    return courses.filter((course) => {
        if (seen.has(course.code)) return false;
        seen.add(course.code);
        return true;
    });
}

function normalizeText(value: string) {
    return value
        .toLocaleLowerCase('tr-TR')
        .replace(/ı/g, 'i')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function extractCoursePrefix(mainCode: string) {
    let prefix = '';

    for (const char of Array.from(mainCode.trim())) {
        if (/\d/u.test(char)) break;
        prefix += char;
    }

    return prefix || mainCode;
}

function resolveAcademicUnit(faculty?: string) {
    if (!faculty) return null;

    const trimmedFaculty = faculty.trim();
    if (!trimmedFaculty || normalizeText(trimmedFaculty) === normalizeText('Unknown Faculty')) {
        return null;
    }

    const normalizedFaculty = normalizeText(trimmedFaculty);
    const matchedUnit = KNOWN_ACADEMIC_UNITS.find((unit) => {
        const normalizedUnit = normalizeText(unit);
        return normalizedFaculty === normalizedUnit ||
            normalizedFaculty.includes(normalizedUnit) ||
            normalizedUnit.includes(normalizedFaculty);
    });

    return matchedUnit || trimmedFaculty;
}

function getCourseOptions(allCourses: Course[], mainCode: string) {
    const group = allCourses.filter((course) => course.main_code === mainCode);
    const lectures = group.filter((course) => course.type === 'lecture');
    const labs = group.filter((course) => course.type === 'lab');
    const problemSessions = group.filter((course) => course.type === 'ps');

    const options: Course[][] = [];

    if (!lectures.length) {
        if (labs.length) labs.forEach((lab) => options.push([lab]));
        if (!labs.length && problemSessions.length) problemSessions.forEach((ps) => options.push([ps]));
        return options;
    }

    lectures.forEach((lecture) => {
        if (!labs.length && !problemSessions.length) {
            options.push([lecture]);
            return;
        }

        if (labs.length && problemSessions.length) {
            labs.forEach((lab) => {
                problemSessions.forEach((ps) => {
                    options.push([lecture, lab, ps]);
                });
            });
        }

        if (labs.length) labs.forEach((lab) => options.push([lecture, lab]));
        if (problemSessions.length) problemSessions.forEach((ps) => options.push([lecture, ps]));
        options.push([lecture]);
    });

    return options;
}

function chooseBestOption(
    allCourses: Course[],
    mainCode: string,
    activeCourses: Course[],
    lockedSlots: Set<string>
): ScoredOption | null {
    const options = getCourseOptions(allCourses, mainCode);
    if (!options.length) return null;

    const withoutCurrentMain = activeCourses.filter((course) => course.main_code !== mainCode);
    const maxComponents = Math.max(...options.map((option) => option.length), 1);
    const existingConflicts = countCourseConflicts(withoutCurrentMain);

    return options
        .map((option) => ({
            option,
            lockedConflictCount: option.filter((course) => courseConflictsWithLocks(course, lockedSlots)).length,
            conflictCount: countCourseConflicts([...withoutCurrentMain, ...option]) - existingConflicts,
            missingComponents: maxComponents - option.length,
        }))
        .sort((left, right) =>
            left.lockedConflictCount - right.lockedConflictCount ||
            left.conflictCount - right.conflictCount ||
            left.missingComponents - right.missingComponents
        )[0];
}

function pickBestAlternative(
    alternatives: Course[],
    activeCourses: Course[],
    courseToReplace: Course
) {
    const baseCourses = activeCourses.filter((course) =>
        !(course.main_code === courseToReplace.main_code && course.type === courseToReplace.type)
    );
    const baseConflicts = countCourseConflicts(baseCourses);

    return alternatives
        .map((alternative) => ({
            alternative,
            conflictCount: countCourseConflicts([...baseCourses, alternative]) - baseConflicts,
        }))
        .sort((left, right) => left.conflictCount - right.conflictCount)[0]?.alternative ?? null;
}

/**
 * Given a target set of locked slots, swap or drop the active course sections that now
 * conflict with them. Mirrors the per-slot reconciliation inside `toggleLock`, but works
 * for a whole batch of newly-locked slots at once (used by drag-to-paint).
 */
function reconcileCoursesToLocks(
    courses: Course[],
    allCourses: Course[],
    nextLockedSlots: Set<string>,
): { nextCourses: Course[]; switched: string[]; removed: string[] } {
    let nextCourses = [...courses];
    const handled = new Set<string>();
    const switched: string[] = [];
    const removed: string[] = [];

    courses.forEach((course) => {
        if (!courseConflictsWithLocks(course, nextLockedSlots)) return;

        const componentKey = `${course.main_code}:${course.type}`;
        if (handled.has(componentKey)) return;
        handled.add(componentKey);

        const alternatives = allCourses.filter((alternative) =>
            alternative.main_code === course.main_code &&
            alternative.type === course.type &&
            alternative.code !== course.code &&
            !courseConflictsWithLocks(alternative, nextLockedSlots)
        );

        if (!alternatives.length) {
            nextCourses = nextCourses.filter((activeCourse) => activeCourse.main_code !== course.main_code);
            removed.push(course.main_code);
            return;
        }

        const replacement = pickBestAlternative(alternatives, nextCourses, course);
        if (!replacement) {
            nextCourses = nextCourses.filter((activeCourse) => activeCourse.main_code !== course.main_code);
            removed.push(course.main_code);
            return;
        }

        nextCourses = nextCourses.map((activeCourse) =>
            activeCourse.main_code === course.main_code && activeCourse.type === course.type
                ? replacement
                : activeCourse
        );
        switched.push(`${course.code} -> ${replacement.code}`);
    });

    return { nextCourses, switched, removed };
}

async function parseErrorMessage(response: Response, fallback: string) {
    try {
        const data = await response.json();
        if (typeof data.detail === 'string') return data.detail;
        if (typeof data.message === 'string') return data.message;
    } catch {
        // Ignore JSON parse issues.
    }

    return fallback;
}

async function loadCourseSource(targetFileId: string, uploadLabel?: string | null): Promise<CourseSource | null> {
    try {
        if (targetFileId === 'global') {
            const semestersResponse = await fetch(`${API_BASE_URL}/api/courses/semesters`);
            if (semestersResponse.ok) {
                const semesters = await semestersResponse.json();
                const hasActiveSemester = Array.isArray(semesters) && semesters.some((semester) => semester.is_active);
                if (!hasActiveSemester) return null;
            }

            const response = await fetch(`${API_BASE_URL}/api/courses/global`);
            if (!response.ok) return null;

            const data = await response.json();
            return {
                fileId: 'global',
                sourceLabel: typeof data.semester === 'string' && data.semester.trim() ? data.semester : null,
                courses: data.courses || [],
            };
        }

        const response = await fetch(`${API_BASE_URL}/api/upload/${targetFileId}/courses`);
        if (!response.ok) return null;

        const data = await response.json();
        return {
            fileId: targetFileId,
            sourceLabel: uploadLabel || targetFileId.slice(0, 8),
            courses: data.courses || [],
        };
    } catch {
        return null;
    }
}

export default function SchedulerPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-surface-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-isik-blue-lighter animate-spin" />
            </main>
        }>
            <SchedulerContent />
        </Suspense>
    );
}

function SchedulerContent() {
    const searchParams = useSearchParams();
    const requestedFileId = searchParams.get('file_id');
    const requestedSourceLabel = searchParams.get('source');

    const { t } = useLanguage();
    const { toastSuccess, toastError, toastWarning, toastInfo } = useToast();

    const DAY_ABBR: Record<string, string> = {
        Monday: t.mon,
        Tuesday: t.tue,
        Wednesday: t.wed,
        Thursday: t.thu,
        Friday: t.fri,
    };
    const getCourseTypeLabel = (type: string) =>
        type === 'lab' ? t.lab : type === 'ps' ? t.problemSession : t.lecture;

    const [allCourses, setAllCourses] = useState<Course[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sourceMissing, setSourceMissing] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showCourseDrawer, setShowCourseDrawer] = useState(false);
    const [activeMobileDay, setActiveMobileDay] = useState(DAYS[0]);
    const [isUploading, setIsUploading] = useState(false);
    const [hasInitialized, setHasInitialized] = useState(false);
    const [fileId, setFileId] = useState<string | null>(null);
    const [sourceLabel, setSourceLabel] = useState<string | null>(null);

    const [activeCourses, setActiveCourses] = useState<Course[]>([]);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [currentScheduleIdx, setCurrentScheduleIdx] = useState(0);
    const [lockedSlots, setLockedSlots] = useState<Set<string>>(new Set());

    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [courseFilter, setCourseFilter] = useState<CourseFilter>('all');
    const [selectedAcademicUnit, setSelectedAcademicUnit] = useState('all');
    const [selectedPrefix, setSelectedPrefix] = useState('all');
    const [isGenerating, setIsGenerating] = useState(false);

    const [maxEcts, setMaxEcts] = useState(DEFAULT_MAX_ECTS);
    const [maxConflicts, setMaxConflicts] = useState(DEFAULT_MAX_CONFLICTS);

    const [selectedInstructor, setSelectedInstructor] = useState('all');
    const [history, setHistory] = useState<{ courses: Course[]; lockedSlots: string[] }[]>([]);
    const [historyIdx, setHistoryIdx] = useState(-1);
    const [confirmKind, setConfirmKind] = useState<null | 'selection' | 'locks'>(null);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showToolsMenu, setShowToolsMenu] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareCode, setShareCode] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const exportMenuRef = useRef<HTMLDivElement | null>(null);
    const toolsMenuRef = useRef<HTMLDivElement | null>(null);

    const invalidateSchedules = () => {
        setSchedules([]);
        setCurrentScheduleIdx(0);
    };

    const pushHistory = useCallback((nextCourses: Course[], nextLockedSlots: Set<string>) => {
        setHistory((prev) => {
            const trimmed = prev.slice(0, historyIdx + 1);
            const snapshot = {
                courses: nextCourses.map((course) => ({ ...course })),
                lockedSlots: Array.from(nextLockedSlots),
            };
            const next = [...trimmed, snapshot].slice(-50);
            setHistoryIdx(next.length - 1);
            return next;
        });
    }, [historyIdx]);

    const updateDraft = (
        nextCourses: Course[],
        nextLockedSlots: Set<string> = lockedSlots,
        options: { recordHistory?: boolean } = {}
    ) => {
        const deduped = dedupeCourses(nextCourses);
        const locksCopy = new Set(nextLockedSlots);
        setActiveCourses(deduped);
        setLockedSlots(locksCopy);
        invalidateSchedules();
        if (options.recordHistory !== false) pushHistory(deduped, locksCopy);
    };

    useEffect(() => {
        let isMounted = true;

        const bootstrap = async () => {
            setIsLoading(true);

            const savedSnapshot = readSchedulerSnapshot();
            const preferredFileId = requestedFileId || savedSnapshot?.fileId || 'global';
            const preferredLabel = requestedSourceLabel || savedSnapshot?.sourceLabel || null;

            let source = await loadCourseSource(preferredFileId, preferredLabel);
            if (!source && preferredFileId !== 'global') {
                source = await loadCourseSource('global');
            }

            if (!isMounted) return;

            setMaxEcts(savedSnapshot?.maxEcts || DEFAULT_MAX_ECTS);
            setMaxConflicts(savedSnapshot?.maxConflicts || DEFAULT_MAX_CONFLICTS);

            if (!source) {
                setAllCourses([]);
                setFileId(null);
                setSourceLabel(null);
                setActiveCourses([]);
                setLockedSlots(new Set());
                setSourceMissing(true);
                setShowUploadModal(true);
                setIsLoading(false);
                setHasInitialized(true);
                return;
            }

            setSourceMissing(false);
            setAllCourses(source.courses);
            setFileId(source.fileId);
            setSourceLabel(source.sourceLabel);
            setShowUploadModal(false);
            invalidateSchedules();

            const canReuseSavedSelection = !!savedSnapshot && savedSnapshot.fileId === source.fileId && !requestedFileId;
            const reusableSnapshot = canReuseSavedSelection ? savedSnapshot : null;
            const nextLockedSlots = new Set(reusableSnapshot?.lockedSlots || []);

            const nextCoursesByCode = new Map(source.courses.map((course) => [course.code, course]));
            let restoredCourses = dedupeCourses(
                (reusableSnapshot?.selectedCourseCodes || [])
                    .map((courseCode) => nextCoursesByCode.get(courseCode))
                    .filter(Boolean) as Course[]
            );

            const restoredMainCodes = new Set(restoredCourses.map((course) => course.main_code));
            (reusableSnapshot?.selectedMainCodes || []).forEach((mainCode) => {
                if (restoredMainCodes.has(mainCode)) return;

                const bestOption = chooseBestOption(source!.courses, mainCode, restoredCourses, nextLockedSlots);
                if (bestOption && bestOption.lockedConflictCount === 0) {
                    restoredCourses = dedupeCourses([...restoredCourses, ...bestOption.option]);
                    restoredMainCodes.add(mainCode);
                }
            });

            setLockedSlots(nextLockedSlots);
            setActiveCourses(restoredCourses);
            setHistory([{ courses: restoredCourses.map((course) => ({ ...course })), lockedSlots: Array.from(nextLockedSlots) }]);
            setHistoryIdx(0);

            if (reusableSnapshot && (restoredCourses.length > 0 || nextLockedSlots.size > 0)) {
                toastInfo(t.restoredSession);

                if ((reusableSnapshot.selectedMainCodes || []).length > restoredMainCodes.size) {
                    toastWarning(t.unavailableCoursesSkipped);
                }
            }

            setIsLoading(false);
            setHasInitialized(true);
        };

        bootstrap();

        return () => {
            isMounted = false;
        };
    }, [requestedFileId, requestedSourceLabel, t.restoredSession, t.unavailableCoursesSkipped, toastInfo, toastWarning]);

    useEffect(() => {
        if (!hasInitialized) return;

        if (!fileId) {
            clearSchedulerSnapshot();
            return;
        }

        writeSchedulerSnapshot({
            fileId,
            sourceLabel,
            selectedCourseCodes: activeCourses.map((course) => course.code),
            selectedMainCodes: Array.from(new Set(activeCourses.map((course) => course.main_code))),
            lockedSlots: Array.from(lockedSlots),
            algorithm: DEFAULT_ALGORITHM,
            maxEcts,
            maxConflicts,
        });
    }, [hasInitialized, fileId, sourceLabel, activeCourses, lockedSlots, maxEcts, maxConflicts]);

    useEffect(() => {
        if (!selectedCourse) return;

        const stillExists = activeCourses.some((course) => course.code === selectedCourse.code);
        if (!stillExists) {
            setSelectedCourse(null);
        }
    }, [activeCourses, selectedCourse]);

    const handleUpload = async (file: File) => {
        if (!file.name.toLowerCase().endsWith('.xlsx')) {
            toastError(t.uploadInvalidFile);
            return;
        }

        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body: formData });
            if (!response.ok) {
                throw new Error(await parseErrorMessage(response, t.uploadFailed));
            }

            const result = await response.json();
            const source = await loadCourseSource(result.file_id, result.filename);

            if (!source) {
                throw new Error(t.uploadFailed);
            }

            setSourceMissing(false);
            setAllCourses(source.courses);
            setFileId(source.fileId);
            setSourceLabel(source.sourceLabel);
            setActiveCourses([]);
            setLockedSlots(new Set());
            setSelectedCourse(null);
            setSearchQuery('');
            setCourseFilter('all');
            setSelectedAcademicUnit('all');
            setSelectedPrefix('all');
            invalidateSchedules();
            setShowUploadModal(false);
            window.history.replaceState({}, '', `/scheduler?file_id=${source.fileId}&source=${encodeURIComponent(source.sourceLabel || result.filename)}`);
            toastSuccess(t.uploadSuccessTitle);
        } catch (error) {
            toastError((error as Error).message || t.uploadFailed);
        } finally {
            setIsUploading(false);
        }
    };

    const isCourseSelected = (mainCode: string) => activeCourses.some((course) => course.main_code === mainCode);

    const getCourseListItems = () => {
        const seen = new Set<string>();
        const normalizedQuery = normalizeText(searchQuery.trim());

        return allCourses.filter((course) => {
            if (seen.has(course.main_code)) return false;
            seen.add(course.main_code);
            return true;
        }).map((course): CourseListItem => {
            const prefix = extractCoursePrefix(course.main_code);
            const academicUnit = resolveAcademicUnit(course.faculty);
            const isSelected = isCourseSelected(course.main_code);
            const bestOption = chooseBestOption(allCourses, course.main_code, activeCourses, lockedSlots);
            const isBlocked = !isSelected && !!bestOption && bestOption.lockedConflictCount > 0 && lockedSlots.size > 0;

            return {
                course,
                prefix,
                academicUnit,
                isSelected,
                isBlocked,
            };
        }).filter((item) => {
            const searchableText = normalizeText(`${item.course.main_code} ${item.prefix} ${item.course.name} ${item.academicUnit || ''} ${item.course.teacher || ''}`);
            const matchesSearch = normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);
            if (!matchesSearch) return false;

            if (selectedAcademicUnit !== 'all' && item.academicUnit !== selectedAcademicUnit) return false;
            if (selectedPrefix !== 'all' && item.prefix !== selectedPrefix) return false;

            if (selectedInstructor !== 'all') {
                const sectionsForMain = allCourses.filter((candidate) => candidate.main_code === item.course.main_code);
                const hasInstructor = sectionsForMain.some((section) =>
                    (section.teacher || '').trim() === selectedInstructor
                );
                if (!hasInstructor) return false;
            }

            if (courseFilter === 'selected') return item.isSelected;
            if (courseFilter === 'blocked') return item.isBlocked;
            return true;
        }).sort((left, right) =>
            (left.academicUnit || '').localeCompare(right.academicUnit || '', 'tr') ||
            left.prefix.localeCompare(right.prefix, 'tr') ||
            left.course.main_code.localeCompare(right.course.main_code, 'tr')
        );
    };

    const getPrefixOptions = () => {
        const seen = new Set<string>();
        const counts = new Map<string, { totalCount: number; selectedCount: number }>();

        allCourses.forEach((course) => {
            if (seen.has(course.main_code)) return;
            seen.add(course.main_code);

            const academicUnit = resolveAcademicUnit(course.faculty);
            if (selectedAcademicUnit !== 'all' && academicUnit !== selectedAcademicUnit) return;

            const prefix = extractCoursePrefix(course.main_code);
            const current = counts.get(prefix) || { totalCount: 0, selectedCount: 0 };
            current.totalCount += 1;
            if (isCourseSelected(course.main_code)) current.selectedCount += 1;
            counts.set(prefix, current);
        });

        return Array.from(counts.entries())
            .map(([prefix, stats]) => ({ prefix, ...stats }))
            .sort((left, right) => left.prefix.localeCompare(right.prefix, 'tr'));
    };

    const getAcademicUnitOptions = () => {
        const seen = new Set<string>();
        const counts = new Map<string, { totalCount: number; selectedCount: number }>();

        allCourses.forEach((course) => {
            if (seen.has(course.main_code)) return;
            seen.add(course.main_code);

            const academicUnit = resolveAcademicUnit(course.faculty);
            if (!academicUnit) return;

            const current = counts.get(academicUnit) || { totalCount: 0, selectedCount: 0 };
            current.totalCount += 1;
            if (isCourseSelected(course.main_code)) current.selectedCount += 1;
            counts.set(academicUnit, current);
        });

        return Array.from(counts.entries())
            .map(([academicUnit, stats]) => ({ academicUnit, ...stats }))
            .sort((left, right) => left.academicUnit.localeCompare(right.academicUnit, 'tr'));
    };

    const getInstructorOptions = () => {
        const counts = new Map<string, number>();

        allCourses.forEach((course) => {
            const teacher = (course.teacher || '').trim();
            if (!teacher) return;
            counts.set(teacher, (counts.get(teacher) || 0) + 1);
        });

        return Array.from(counts.entries())
            .map(([teacher, count]) => ({ teacher, count }))
            .sort((left, right) => left.teacher.localeCompare(right.teacher, 'tr'));
    };

    const getTypeBadges = (mainCode: string) => {
        const types = new Set(
            allCourses
                .filter((course) => course.main_code === mainCode)
                .map((course) => course.type)
        );

        return {
            hasLab: types.has('lab'),
            hasPs: types.has('ps'),
        };
    };

    const toggleCourse = (mainCode: string) => {
        if (isCourseSelected(mainCode)) {
            updateDraft(activeCourses.filter((course) => course.main_code !== mainCode));
            return;
        }

        const courseWithPrereqs = allCourses.find((c) => c.main_code === mainCode);
        if (courseWithPrereqs) {
            const missingPrereqs = (courseWithPrereqs.prerequisites || []).filter(
                (req) => !activeCourses.some((c) => c.main_code === req)
            );
            if (missingPrereqs.length > 0) {
                toastWarning(`${t.prerequisiteWarning} ${missingPrereqs.join(', ')}`);
            }
            const missingCoreqs = (courseWithPrereqs.corequisites || []).filter(
                (req) => !activeCourses.some((c) => c.main_code === req)
            );
            if (missingCoreqs.length > 0) {
                toastWarning(`${t.corequisiteWarning} ${missingCoreqs.join(', ')}`);
            }
        }

        const bestOption = chooseBestOption(allCourses, mainCode, activeCourses, lockedSlots);
        if (!bestOption || bestOption.option.length === 0 || bestOption.lockedConflictCount > 0) {
            toastWarning(`${mainCode} ${t.courseCannotBeAdded} ${t.allSectionsConflict}`);
            return;
        }

        updateDraft([...activeCourses, ...bestOption.option]);

        if (bestOption.conflictCount > 0) {
            toastInfo(t.selectionMayConflict);
        }
    };

    const switchSection = (currentCourse: Course, newCourse: Course) => {
        if (courseConflictsWithLocks(newCourse, lockedSlots)) {
            toastWarning(t.sectionConflictsWithLock);
            return;
        }

        const nextCourses = activeCourses.map((course) =>
            course.main_code === currentCourse.main_code && course.type === currentCourse.type
                ? newCourse
                : course
        );

        updateDraft(nextCourses);
        setSelectedCourse(null);

        if (countCourseConflicts(nextCourses) > countCourseConflicts(activeCourses)) {
            toastInfo(t.selectionMayConflict);
        }
    };

    const toggleLock = (day: string, period: number) => {
        const slotKey = getSlotKey(day, period);

        if (lockedSlots.has(slotKey)) {
            const nextLockedSlots = new Set(lockedSlots);
            nextLockedSlots.delete(slotKey);
            updateDraft(activeCourses, nextLockedSlots);
            return;
        }

        const coursesInSlot = activeCourses.filter((course) =>
            course.schedule?.some(([courseDay, coursePeriod]) => courseDay === day && coursePeriod === period)
        );

        const nextLockedSlots = new Set(lockedSlots);
        nextLockedSlots.add(slotKey);

        if (!coursesInSlot.length) {
            updateDraft(activeCourses, nextLockedSlots);
            return;
        }

        let nextCourses = [...activeCourses];
        const handledComponents = new Set<string>();
        const switchedCourses: string[] = [];
        const removedCourses: string[] = [];

        coursesInSlot.forEach((course) => {
            const componentKey = `${course.main_code}:${course.type}`;
            if (handledComponents.has(componentKey)) return;
            handledComponents.add(componentKey);

            const alternatives = allCourses.filter((alternative) =>
                alternative.main_code === course.main_code &&
                alternative.type === course.type &&
                alternative.code !== course.code &&
                !courseConflictsWithLocks(alternative, nextLockedSlots)
            );

            if (!alternatives.length) {
                nextCourses = nextCourses.filter((activeCourse) => activeCourse.main_code !== course.main_code);
                removedCourses.push(course.main_code);
                return;
            }

            const replacement = pickBestAlternative(alternatives, nextCourses, course);
            if (!replacement) {
                nextCourses = nextCourses.filter((activeCourse) => activeCourse.main_code !== course.main_code);
                removedCourses.push(course.main_code);
                return;
            }

            nextCourses = nextCourses.map((activeCourse) =>
                activeCourse.main_code === course.main_code && activeCourse.type === course.type
                    ? replacement
                    : activeCourse
            );
            switchedCourses.push(`${course.code} -> ${replacement.code}`);
        });

        if (switchedCourses.length > 0) {
            toastInfo(`${t.sectionChanged}: ${switchedCourses.join(', ')}`);
        }

        if (removedCourses.length > 0) {
            toastWarning(`${t.removedNoAlternative}: ${Array.from(new Set(removedCourses)).join(', ')}`);
        }

        updateDraft(nextCourses, nextLockedSlots);
    };

    // --- Drag-to-paint busy (locked) slots on the grid ---
    const paintModeRef = useRef<null | 'lock' | 'unlock'>(null);
    const paintedRef = useRef<Set<string>>(new Set());
    const [, bumpPaint] = useState(0);

    const isSlotPreviewLocked = (day: string, period: number) => {
        const key = getSlotKey(day, period);
        if (paintedRef.current.has(key)) return paintModeRef.current === 'lock';
        return lockedSlots.has(key);
    };

    const handlePaintStart = (event: React.PointerEvent, day: string, period: number, occupied: boolean) => {
        // Let clicks on the lock button / course blocks behave normally; only start
        // painting from an empty cell so a stray click can't drop an occupied section.
        if (event.button !== 0) return;
        if ((event.target as HTMLElement).closest('button')) return;
        if (occupied) return;
        event.preventDefault();
        const key = getSlotKey(day, period);
        paintModeRef.current = lockedSlots.has(key) ? 'unlock' : 'lock';
        paintedRef.current = new Set([key]);
        bumpPaint((value) => value + 1);
    };

    const handlePaintEnter = (day: string, period: number) => {
        if (!paintModeRef.current) return;
        paintedRef.current.add(getSlotKey(day, period));
        bumpPaint((value) => value + 1);
    };

    const commitPaint = useCallback(() => {
        const mode = paintModeRef.current;
        const painted = paintedRef.current;
        paintModeRef.current = null;
        paintedRef.current = new Set();
        if (!mode || painted.size === 0) return;

        const nextLockedSlots = new Set(lockedSlots);
        painted.forEach((key) => {
            if (mode === 'lock') nextLockedSlots.add(key);
            else nextLockedSlots.delete(key);
        });

        if (mode === 'unlock') {
            updateDraft(activeCourses, nextLockedSlots);
        } else {
            const { nextCourses, switched, removed } = reconcileCoursesToLocks(activeCourses, allCourses, nextLockedSlots);
            if (switched.length > 0) toastInfo(`${t.sectionChanged}: ${switched.join(', ')}`);
            if (removed.length > 0) toastWarning(`${t.removedNoAlternative}: ${Array.from(new Set(removed)).join(', ')}`);
            updateDraft(nextCourses, nextLockedSlots);
        }
        bumpPaint((value) => value + 1);
        // updateDraft is intentionally omitted: it is recreated each render and closes over the
        // same activeCourses/lockedSlots already listed here, so the captured copy stays correct.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lockedSlots, activeCourses, allCourses, t.sectionChanged, t.removedNoAlternative, toastInfo, toastWarning]);

    useEffect(() => {
        const onPointerUp = () => commitPaint();
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
        return () => {
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
        };
    }, [commitPaint]);

    const sectionHasLockConflict = (course: Course) => courseConflictsWithLocks(course, lockedSlots);

    const performClearLocks = () => {
        if (!lockedSlots.size) return;
        updateDraft(activeCourses, new Set());
        toastInfo(t.locksReset);
    };

    const performClearSelection = () => {
        if (!activeCourses.length) return;
        setSelectedCourse(null);
        updateDraft([], lockedSlots);
        toastInfo(t.selectionReset);
    };

    const clearLocks = () => {
        if (!lockedSlots.size) return;
        setConfirmKind('locks');
    };

    const clearSelection = () => {
        if (!activeCourses.length) return;
        setConfirmKind('selection');
    };

    const applyHistorySnapshot = useCallback((snapshot: { courses: Course[]; lockedSlots: string[] }) => {
        setActiveCourses(snapshot.courses.map((course) => ({ ...course })));
        setLockedSlots(new Set(snapshot.lockedSlots));
        setSelectedCourse(null);
        invalidateSchedules();
    }, []);

    const undo = useCallback(() => {
        if (historyIdx <= 0) {
            toastInfo(t.nothingToUndo);
            return;
        }
        const nextIndex = historyIdx - 1;
        setHistoryIdx(nextIndex);
        applyHistorySnapshot(history[nextIndex]);
        toastInfo(t.undone);
    }, [applyHistorySnapshot, history, historyIdx, t.nothingToUndo, t.undone, toastInfo]);

    const redo = useCallback(() => {
        if (historyIdx >= history.length - 1) {
            toastInfo(t.nothingToRedo);
            return;
        }
        const nextIndex = historyIdx + 1;
        setHistoryIdx(nextIndex);
        applyHistorySnapshot(history[nextIndex]);
        toastInfo(t.redone);
    }, [applyHistorySnapshot, history, historyIdx, t.nothingToRedo, t.redone, toastInfo]);

    const canUndo = historyIdx > 0;
    const canRedo = historyIdx >= 0 && historyIdx < history.length - 1;

    const handleExportIcs = () => {
        if (!activeCourses.length) {
            toastWarning(t.exportNothingToExport);
            setShowExportMenu(false);
            return;
        }
        const ics = buildScheduleICS(
            activeCourses.map((course) => ({
                code: course.code,
                name: course.name,
                type: course.type,
                teacher: course.teacher,
                ects: course.ects,
                schedule: course.schedule,
            })),
            { termLabel: sourceLabel || 'IşıkSchedule' }
        );
        const safeLabel = (sourceLabel || 'schedule').toString().replace(/[^a-z0-9\-_.]+/gi, '_');
        downloadICS(ics, `${safeLabel || 'schedule'}.ics`);
        toastSuccess(t.exportIcalDone);
        setShowExportMenu(false);
    };

    const handlePrint = () => {
        if (!activeCourses.length) {
            toastWarning(t.exportNothingToExport);
            setShowExportMenu(false);
            return;
        }
        setShowExportMenu(false);
        setTimeout(() => window.print(), 50);
    };

    const handleShareSchedule = async () => {
        if (!activeCourses.length) {
            toastWarning(t.exportNothingToExport);
            setShowExportMenu(false);
            return;
        }
        setShowExportMenu(false);
        setIsSharing(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/schedules/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courses: activeCourses })
            });
            
            if (!response.ok) {
                throw new Error(t.schedulerShareFailed);
            }
            const data = await response.json();
            setShareCode(data.share_code);
            setShowShareModal(true);
        } catch (error) {
            console.error(error);
            toastError(t.schedulerShareFailed);
        } finally {
            setIsSharing(false);
        }
    };

    const createShareCode = async (): Promise<string | null> => {
        if (!activeCourses.length) {
            toastWarning(t.exportNothingToExport);
            return null;
        }
        setIsSharing(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/schedules/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courses: activeCourses }),
            });
            if (!response.ok) throw new Error(t.schedulerShareFailed);
            const data = await response.json();
            setShareCode(data.share_code);
            return data.share_code as string;
        } catch (error) {
            console.error(error);
            toastError(t.schedulerShareFailed);
            return null;
        } finally {
            setIsSharing(false);
        }
    };

    const handleResultsShare = async () => {
        await createShareCode();
    };

    const handleResultsCopyLink = async () => {
        const code = shareCode || (await createShareCode());
        if (code && typeof window !== 'undefined') {
            await navigator.clipboard.writeText(`${window.location.origin}/shared/${code}`);
            toastSuccess(t.resultsCopied);
        }
    };

    const handleResultsSelect = (idx: number) => {
        const nextCourses = dedupeCourses(schedules[idx]?.courses || []);
        setActiveCourses(nextCourses);
        setCurrentScheduleIdx(idx);
    };

    const generateSchedules = async () => {
        if (!fileId || activeCourses.length === 0) {
            toastWarning(t.pleaseSelectCourse);
            return;
        }

        setIsGenerating(true);

        try {
            const lockedSlotsArray = Array.from(lockedSlots).map((slot) => {
                const [day, period] = slot.split('-');
                return [day, parseInt(period, 10)];
            });

            const response = await fetch(`${API_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_id: fileId,
                    selected_main_codes: Array.from(new Set(activeCourses.map((course) => course.main_code))),
                    algorithm: DEFAULT_ALGORITHM,
                    params: {
                        max_ects: maxEcts,
                        max_conflicts: maxConflicts,
                        locked_slots: lockedSlotsArray,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(await parseErrorMessage(response, t.generationFailed));
            }

            const result = await response.json();

            const poll = async () => {
                try {
                    const statusResponse = await fetch(`${API_BASE_URL}/api/jobs/${result.job_id}`);
                    const data = await statusResponse.json();

                    if (data.status === 'completed' && data.result) {
                        const backendSchedules = data.result.schedules || [];
                        const validSchedules = backendSchedules.filter((schedule: Schedule) =>
                            schedule.courses.every((course) => !courseConflictsWithLocks(course, lockedSlots))
                        );

                        if (validSchedules.length > 0) {
                            setSchedules(validSchedules);
                            const firstCourses = dedupeCourses(validSchedules[0].courses);
                            setActiveCourses(firstCourses);
                            setCurrentScheduleIdx(0);
                            pushHistory(firstCourses, lockedSlots);
                            toastSuccess(`${validSchedules.length} ${t.schedulerGeneratedCount}`);
                            setShowResults(true);
                        } else {
                            toastWarning(t.backendConflict);
                        }

                        setIsGenerating(false);
                    } else if (data.status === 'failed') {
                        toastError(`${t.generationFailed}: ${data.message || t.unknownError}`);
                        setIsGenerating(false);
                    } else {
                        setTimeout(poll, 500);
                    }
                } catch {
                    toastError(t.unknownError);
                    setIsGenerating(false);
                }
            };

            poll();
        } catch (error) {
            toastError((error as Error).message || t.unknownError);
            setIsGenerating(false);
        }
    };

    const buildGrid = () => {
        const grid: Record<string, Record<number, Course[]>> = {};
        DAYS.forEach((day) => { grid[day] = {}; });

        activeCourses.forEach((course) => {
            (course.schedule || []).forEach(([day, period]) => {
                if (!grid[day]) return;
                if (!grid[day][period]) grid[day][period] = [];
                if (!lockedSlots.has(getSlotKey(day, period))) {
                    grid[day][period].push(course);
                }
            });
        });

        return grid;
    };

    const grid = buildGrid();
    const courseListItems = getCourseListItems();
    const academicUnitOptions = getAcademicUnitOptions();
    const prefixOptions = getPrefixOptions();
    const instructorOptions = getInstructorOptions();
    const stats = useMemo(
        () => computeScheduleStats(
            activeCourses.map((course) => ({
                code: course.code,
                name: course.name,
                type: course.type,
                teacher: course.teacher,
                ects: course.ects,
                schedule: course.schedule,
            })),
            lockedSlots
        ),
        [activeCourses, lockedSlots]
    );
    const groupedCourses = courseListItems.reduce((groups, item) => {
        const currentGroup = groups.get(item.prefix) || [];
        currentGroup.push(item);
        groups.set(item.prefix, currentGroup);
        return groups;
    }, new Map<string, CourseListItem[]>());
    const totalEcts = activeCourses.reduce((sum, course) => sum + (course.ects || 0), 0);
    const selectedCount = new Set(activeCourses.map((course) => course.main_code)).size;
    const draftConflicts = countCourseConflicts(activeCourses);
    const selectedItems = useMemo<SelectedCourseItem[]>(() => {
        const byMain = new Map<string, number>();
        activeCourses.forEach((course) => {
            byMain.set(course.main_code, (byMain.get(course.main_code) || 0) + (course.ects || 0));
        });
        return Array.from(byMain.entries()).map(([mainCode, ects]) => ({ mainCode, ects }));
    }, [activeCourses]);

    useEffect(() => {
        if (selectedPrefix === 'all') return;
        if (prefixOptions.some((option) => option.prefix === selectedPrefix)) return;
        setSelectedPrefix('all');
    }, [prefixOptions, selectedPrefix]);

    useEffect(() => {
        if (selectedAcademicUnit === 'all') return;
        if (academicUnitOptions.some((option) => option.academicUnit === selectedAcademicUnit)) return;
        setSelectedAcademicUnit('all');
    }, [academicUnitOptions, selectedAcademicUnit]);

    useEffect(() => {
        if (selectedInstructor === 'all') return;
        if (instructorOptions.some((option) => option.teacher === selectedInstructor)) return;
        setSelectedInstructor('all');
    }, [instructorOptions, selectedInstructor]);

    useEffect(() => {
        if (!showExportMenu) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (!exportMenuRef.current) return;
            if (exportMenuRef.current.contains(event.target as Node)) return;
            setShowExportMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showExportMenu]);

    useEffect(() => {
        if (!showToolsMenu) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (!toolsMenuRef.current) return;
            if (toolsMenuRef.current.contains(event.target as Node)) return;
            setShowToolsMenu(false);
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setShowToolsMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showToolsMenu]);

    useEffect(() => {
        const isEditableTarget = (target: EventTarget | null) => {
            if (!(target instanceof HTMLElement)) return false;
            const tag = target.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            const key = event.key;
            const isMeta = event.ctrlKey || event.metaKey;

            if (isMeta && (key === 'z' || key === 'Z')) {
                event.preventDefault();
                if (event.shiftKey) redo();
                else undo();
                return;
            }

            if (isMeta && (key === 'y' || key === 'Y')) {
                event.preventDefault();
                redo();
                return;
            }

            if (isEditableTarget(event.target)) return;
            if (showResults) return;

            if (key === '?' || (event.shiftKey && key === '/')) {
                event.preventDefault();
                setShowShortcuts((prev) => !prev);
                return;
            }

            if (key === '/') {
                event.preventDefault();
                searchInputRef.current?.focus();
                return;
            }

            if (key === 'ArrowLeft' && schedules.length > 0) {
                event.preventDefault();
                prevSchedule();
                return;
            }

            if (key === 'ArrowRight' && schedules.length > 0) {
                event.preventDefault();
                nextSchedule();
                return;
            }

            if (key === 'g' || key === 'G') {
                if (!isGenerating && activeCourses.length > 0) {
                    event.preventDefault();
                    generateSchedules();
                }
                return;
            }

            if (key === 'e' || key === 'E') {
                event.preventDefault();
                if (window.innerWidth < 1536) {
                    setShowToolsMenu((prev) => !prev);
                } else {
                    setShowExportMenu((prev) => !prev);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [undo, redo, schedules.length, currentScheduleIdx, activeCourses.length, isGenerating, showResults]);

    const prevSchedule = () => {
        if (currentScheduleIdx <= 0) return;
        const nextIndex = currentScheduleIdx - 1;
        setCurrentScheduleIdx(nextIndex);
        setActiveCourses(schedules[nextIndex]?.courses || []);
    };

    const nextSchedule = () => {
        if (currentScheduleIdx >= schedules.length - 1) return;
        const nextIndex = currentScheduleIdx + 1;
        setCurrentScheduleIdx(nextIndex);
        setActiveCourses(schedules[nextIndex]?.courses || []);
    };

    if (isLoading) {
        return (
            <div className="relative min-h-screen bg-[#0B1020] flex items-center justify-center px-6">
                <AuroraBackground variant="absolute" className="opacity-70" />
                <div className="relative z-10 text-center">
                    <div className="w-12 h-12 rounded-full border-2 border-isik-blue-lighter/20 border-t-isik-blue-lighter animate-spin mx-auto mb-4" />
                    <p className="text-sm text-slate-400">{t.loadingCourses}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-screen flex flex-col bg-[#0B1020]">
            <AuroraBackground variant="absolute" vignette={false} className="opacity-75" />
            <header className="relative z-40 flex-shrink-0 bg-surface-800/80 backdrop-blur-xl border-b border-white/5 px-3 sm:px-4 py-2.5 no-print">
                <div className="max-w-[1800px] mx-auto flex items-center gap-2 sm:gap-3">
                    <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="IşıkSchedule">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-isik-blue to-isik-blue-lighter flex items-center justify-center shadow-lg shadow-blue-500/10">
                            <GraduationCap className="w-4 h-4 text-white" />
                        </div>
                        <div className="hidden lg:block">
                            <span className="block text-base font-bold text-white">IşıkSchedule</span>
                            {sourceLabel && (
                                <span className="block max-w-40 truncate text-[11px] text-slate-400">
                                    {t.activeSource}: {sourceLabel}
                                </span>
                            )}
                        </div>
                    </Link>

                    <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
                        <LanguageSwitcher />

                        <div className="flex items-center gap-0.5 bg-surface-700/40 rounded-lg border border-white/5 p-0.5">
                            <button
                                type="button"
                                onClick={undo}
                                disabled={!canUndo}
                                aria-label={t.undo}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-30 sm:h-8 sm:w-8"
                                title={`${t.undo} (Ctrl+Z)`}
                            >
                                <Undo2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={redo}
                                disabled={!canRedo}
                                aria-label={t.redo}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-30 sm:h-8 sm:w-8"
                                title={`${t.redo} (Ctrl+Y)`}
                            >
                                <Redo2 className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="hidden 2xl:flex items-center gap-1">
                            <button type="button" onClick={() => setShowUploadModal(true)} className="btn-ghost !py-1.5 !text-xs" aria-label={t.changeFile}>
                                <FolderOpen className="w-3.5 h-3.5" />
                                {t.changeFile}
                            </button>

                            <button type="button" onClick={clearLocks} disabled={!lockedSlots.size} className="btn-ghost !py-1.5 !text-xs" aria-label={t.clearLocks}>
                                <RefreshCw className="w-3.5 h-3.5" />
                                {t.clearLocks}
                            </button>

                            <button type="button" onClick={clearSelection} disabled={!activeCourses.length} className="btn-ghost !py-1.5 !text-xs" aria-label={t.clearSelection}>
                                <X className="w-3.5 h-3.5" />
                                {t.clearSelection}
                            </button>

                            <div className="relative" ref={exportMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowExportMenu((prev) => !prev)}
                                    disabled={!activeCourses.length}
                                    aria-label={t.exportMenu}
                                    aria-expanded={showExportMenu}
                                    className={`btn-ghost !py-1.5 !text-xs ${showExportMenu ? '!bg-isik-blue-lighter/10 !text-isik-blue-lighter' : ''}`}
                                    title={`${t.exportMenu} (E)`}
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    {t.exportMenu}
                                </button>

                                {showExportMenu && (
                                    <div className="absolute right-0 top-full mt-2 w-60 glass-panel p-1 shadow-2xl shadow-black/40 z-40 animate-fade-in">
                                        <button type="button" onClick={handleExportIcs} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-white/5 transition-colors">
                                            <CalendarDays className="w-3.5 h-3.5 text-isik-blue-lighter" />
                                            {t.exportIcal}
                                        </button>
                                        <button type="button" onClick={handlePrint} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-white/5 transition-colors">
                                            <Printer className="w-3.5 h-3.5 text-emerald-400" />
                                            {t.exportPrint}
                                        </button>
                                        <button type="button" onClick={handleShareSchedule} disabled={isSharing} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-white/5 transition-colors">
                                            {isSharing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> : <Share2 className="w-3.5 h-3.5 text-blue-400" />}
                                            {t.schedulerShareAction}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowStats((prev) => !prev)}
                                aria-label={t.stats}
                                className={`btn-ghost !py-1.5 !text-xs ${showStats ? '!bg-isik-blue-lighter/10 !text-isik-blue-lighter' : ''}`}
                            >
                                <BarChart3 className="w-3.5 h-3.5" />
                                {t.stats}
                            </button>

                            <button type="button" onClick={() => setShowShortcuts(true)} aria-label={t.keyboardShortcuts} className="btn-ghost !p-2" title={`${t.keyboardShortcuts} (?)`}>
                                <Keyboard className="w-3.5 h-3.5" />
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowSettings(!showSettings)}
                                aria-label={t.settings}
                                className={`btn-ghost !py-1.5 !text-xs ${showSettings ? '!bg-isik-gold/10 !text-isik-gold' : ''}`}
                            >
                                <Settings className="w-3.5 h-3.5" />
                                {t.settings}
                            </button>
                        </div>

                        <div className="relative 2xl:hidden" ref={toolsMenuRef}>
                            <button
                                type="button"
                                onClick={() => setShowToolsMenu((prev) => !prev)}
                                className={`btn-secondary !p-2 sm:!px-3 sm:!py-2 !text-xs ${showToolsMenu ? '!border-isik-blue-lighter/40 !text-white' : ''}`}
                                aria-label={t.openTools}
                                aria-expanded={showToolsMenu}
                                aria-controls="scheduler-tools-menu"
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{t.tools}</span>
                            </button>

                            {showToolsMenu && (
                                <div id="scheduler-tools-menu" className="absolute right-0 top-full mt-2 w-72 glass-panel p-2 shadow-2xl shadow-black/40 z-50 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-1">
                                        <ToolMenuButton icon={<FolderOpen className="w-4 h-4 text-blue-300" />} label={t.changeFile} onClick={() => { setShowUploadModal(true); setShowToolsMenu(false); }} />
                                        <ToolMenuButton icon={<Settings className="w-4 h-4 text-amber-300" />} label={t.settings} onClick={() => { setShowSettings((prev) => !prev); setShowToolsMenu(false); }} />
                                        <ToolMenuButton icon={<BarChart3 className="w-4 h-4 text-violet-300" />} label={t.stats} onClick={() => { setShowStats((prev) => !prev); setShowToolsMenu(false); }} />
                                        <ToolMenuButton icon={<Keyboard className="w-4 h-4 text-slate-300" />} label={t.keyboardShortcuts} onClick={() => { setShowShortcuts(true); setShowToolsMenu(false); }} />
                                        <ToolMenuButton icon={<RefreshCw className="w-4 h-4 text-emerald-300" />} label={t.clearLocks} onClick={() => { clearLocks(); setShowToolsMenu(false); }} disabled={!lockedSlots.size} />
                                        <ToolMenuButton icon={<X className="w-4 h-4 text-red-300" />} label={t.clearSelection} onClick={() => { clearSelection(); setShowToolsMenu(false); }} disabled={!activeCourses.length} />
                                    </div>

                                    <div className="my-2 border-t border-white/5" />
                                    <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t.exportMenu}</p>
                                    <ToolMenuButton icon={<CalendarDays className="w-4 h-4 text-isik-blue-lighter" />} label={t.exportIcal} onClick={() => { handleExportIcs(); setShowToolsMenu(false); }} disabled={!activeCourses.length} fullWidth />
                                    <ToolMenuButton icon={<Printer className="w-4 h-4 text-emerald-400" />} label={t.exportPrint} onClick={() => { handlePrint(); setShowToolsMenu(false); }} disabled={!activeCourses.length} fullWidth />
                                    <ToolMenuButton icon={isSharing ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <Share2 className="w-4 h-4 text-blue-400" />} label={t.schedulerShareAction} onClick={() => { void handleShareSchedule(); setShowToolsMenu(false); }} disabled={!activeCourses.length || isSharing} fullWidth />
                                </div>
                            )}
                        </div>

                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700/50 border border-white/5 text-xs">
                            <span className="font-bold text-white">{selectedCount}</span>
                            <span className="text-slate-400">{t.courses}</span>
                            <span className="text-slate-400 mx-0.5">·</span>
                            <span className="font-bold text-white">{totalEcts}</span>
                            <span className="text-slate-400">{t.ects}</span>
                        </div>

                        <button
                            type="button"
                            onClick={generateSchedules}
                            disabled={isGenerating || activeCourses.length === 0}
                            className="btn-primary magnetic shrink-0 !px-3 sm:!px-4 !py-2 !text-xs"
                        >
                            {isGenerating ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span className="hidden sm:inline">{t.creating}</span></>
                            ) : (
                                <><Rocket className="w-3.5 h-3.5" /><span className="hidden sm:inline">{t.createSchedule}</span><span className="sm:hidden">{t.generateShort}</span></>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {showResults && schedules.length > 0 && (
                <GeneratedSchedulesView
                    schedules={schedules}
                    currentIdx={currentScheduleIdx}
                    lockedSlots={lockedSlots}
                    sourceLabel={sourceLabel}
                    shareUrl={shareCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}/shared/${shareCode}` : null}
                    isSharing={isSharing}
                    onSelect={handleResultsSelect}
                    onClose={() => setShowResults(false)}
                    onExportIcs={handleExportIcs}
                    onPrint={handlePrint}
                    onShare={handleResultsShare}
                    onCopyLink={handleResultsCopyLink}
                />
            )}

            <div className="flex-1 flex overflow-hidden">
                <div className="hidden lg:flex w-80 flex-shrink-0 bg-surface-800/50 border-r border-white/5 flex-col no-print">
                    <div className="p-3 border-b border-white/5 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                id="scheduler-course-search"
                                ref={searchInputRef}
                                type="text"
                                aria-label={t.searchCourse}
                                placeholder={t.searchCourse}
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                className="input-field !pl-9 !pr-9 !py-2 !text-sm !rounded-lg"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        searchInputRef.current?.focus();
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
                                    aria-label={t.clearSearch}
                                    title={t.clearSearch}
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {[
                                { key: 'all', label: t.allCoursesLabel },
                                { key: 'selected', label: t.selectedOnly },
                                { key: 'blocked', label: t.blockedOnly },
                            ].map((filter) => (
                                <button
                                    key={filter.key}
                                    onClick={() => setCourseFilter(filter.key as CourseFilter)}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                                        courseFilter === filter.key
                                            ? 'bg-isik-blue-lighter/15 text-isik-blue-lighter border border-isik-blue-lighter/30'
                                            : 'bg-surface-700/40 text-slate-400 border border-white/5 hover:text-slate-200'
                                    }`}
                                >
                                    {filter.label}
                                </button>
                                ))}
                        </div>

                        <div>
                            <label htmlFor="scheduler-academic-unit" className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block mb-1.5">
                                {t.academicUnit}
                            </label>
                            <select
                                id="scheduler-academic-unit"
                                value={selectedAcademicUnit}
                                onChange={(event) => setSelectedAcademicUnit(event.target.value)}
                                className="input-field !py-2 !text-sm"
                            >
                                <option value="all">{t.allAcademicUnits}</option>
                                {academicUnitOptions.map((option) => (
                                    <option key={option.academicUnit} value={option.academicUnit}>
                                        {option.academicUnit} ({option.totalCount})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="scheduler-code-group" className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block mb-1.5">
                                {t.codeGroup}
                            </label>
                            <select
                                id="scheduler-code-group"
                                value={selectedPrefix}
                                onChange={(event) => setSelectedPrefix(event.target.value)}
                                className="input-field !py-2 !text-sm"
                            >
                                <option value="all">{t.allCodeGroups}</option>
                                {prefixOptions.map((option) => (
                                    <option key={option.prefix} value={option.prefix}>
                                        {option.prefix} ({option.totalCount})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {instructorOptions.length > 0 && (
                            <div>
                                <label htmlFor="scheduler-instructor" className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block mb-1.5">
                                    {t.instructor}
                                </label>
                                <select
                                    id="scheduler-instructor"
                                    value={selectedInstructor}
                                    onChange={(event) => setSelectedInstructor(event.target.value)}
                                    className="input-field !py-2 !text-sm"
                                >
                                    <option value="all">{t.allInstructors}</option>
                                    {instructorOptions.map((option) => (
                                        <option key={option.teacher} value={option.teacher}>
                                            {option.teacher} ({option.count})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="flex justify-between text-[11px] text-slate-400 px-1">
                            <span>{selectedCount} {t.coursesSelected}</span>
                            <span>{totalEcts} {t.ects}</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {allCourses.length === 0 ? (
                            <div className="text-center py-12 px-4">
                                <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                                <p className="text-sm text-slate-400 mb-2">{t.noFileUploaded}</p>
                                <button type="button" onClick={() => setShowUploadModal(true)} className="text-sm text-isik-blue-lighter hover:text-blue-300 transition-colors">
                                    {t.uploadFile}
                                </button>
                            </div>
                        ) : courseListItems.length === 0 ? (
                            <div className="text-center py-12 px-4">
                                <p className="text-sm text-slate-400 mb-3">{t.noSearchResults}</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setCourseFilter('all');
                                        setSelectedAcademicUnit('all');
                                        setSelectedPrefix('all');
                                        setSelectedInstructor('all');
                                    }}
                                    className="text-sm text-isik-blue-lighter hover:text-blue-300 transition-colors"
                                >
                                    {t.resetFilters}
                                </button>
                            </div>
                        ) : (
                            Array.from(groupedCourses.entries()).map(([prefix, items]) => {
                                const selectedInGroup = items.filter((item) => item.isSelected).length;

                                return (
                                    <div key={prefix} className="space-y-1.5">
                                        <div className="flex items-center justify-between px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                            <span className="font-semibold">{prefix}</span>
                                            <span className="tracking-normal text-slate-400">
                                                {selectedInGroup}/{items.length}
                                            </span>
                                        </div>

                                        {items.map((item) => {
                                            const { course, academicUnit, isSelected, isBlocked } = item;
                                            const types = getTypeBadges(course.main_code);

                                            return (
                                                <button
                                                    key={course.main_code}
                                                    onClick={() => toggleCourse(course.main_code)}
                                                    className={`w-full text-left p-3 rounded-xl transition-all duration-150 ${
                                                        isSelected
                                                            ? 'bg-isik-blue-lighter/10 border border-isik-blue-lighter/30'
                                                            : isBlocked
                                                                ? 'bg-red-500/5 border border-red-500/20 opacity-60'
                                                                : 'border border-transparent hover:bg-white/5'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1 gap-3">
                                                        <span className="font-semibold text-sm text-white">{course.main_code}</span>
                                                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                                            {isBlocked && <Lock className="w-3 h-3 text-red-400" />}
                                                            {types.hasLab && <span className="badge badge-purple">Lab</span>}
                                                            {types.hasPs && <span className="badge badge-green">PS</span>}
                                                            <span className="text-[11px] text-slate-400">{course.ects} ECTS</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-slate-400 leading-relaxed">{course.name}</p>
                                                    {academicUnit && selectedAcademicUnit === 'all' && (
                                                        <p className="text-[10px] text-slate-400 mt-1 truncate">{academicUnit}</p>
                                                    )}
                                                    {isBlocked && <p className="text-[10px] text-red-400/80 mt-1.5">{t.allSectionsLocked}</p>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })
                        )}

                        <div className="glass-panel p-4 mt-4">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-3">{t.quickTips}</p>
                            <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
                                <p>{t.tipSelectCourses}</p>
                                <p>{t.tipLockSlots}</p>
                                <p>{t.tipCreateAlternatives}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-auto p-3 md:p-4 print-area">
                    <div className="lg:hidden no-print mb-3">
                        <button
                            type="button"
                            onClick={() => setShowCourseDrawer(true)}
                            className="btn-secondary w-full !justify-between"
                        >
                            <span className="inline-flex items-center gap-2">
                                <BookOpen className="w-4 h-4" />
                                {t.schedulerOpenCourseDrawer}
                            </span>
                            <span className="text-xs text-slate-400">
                                {selectedCount} {t.coursesSelected}
                            </span>
                        </button>
                    </div>
                    <div className="glass-panel overflow-hidden min-h-full">
                        <div className="px-4 py-3 border-b border-white/5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                            <div>
                                <h3 className="text-sm font-semibold text-white">
                                    {schedules.length > 0 ? `${t.program} #${currentScheduleIdx + 1}` : t.weeklySchedule}
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    {selectedCount === 0
                                        ? t.pickCoursesHint
                                        : schedules.length > 0
                                            ? `${schedules.length} ${t.generatedOptions}`
                                            : t.manualDraft}
                                </p>
                            </div>

                            <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
                                <ScheduleTypeLegend
                                    lectureLabel={t.lecture}
                                    labLabel={t.lab}
                                    problemSessionLabel={t.problemSession}
                                />

                                {schedules.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowResults(true)}
                                        className="magnetic inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-isik-blue to-isik-blue-lighter px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/20"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        {t.resultsViewAll}
                                        <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] tabular-nums">{schedules.length}</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {sourceMissing && allCourses.length === 0 ? (
                            <div className="min-h-[360px] flex items-center justify-center px-6 py-12">
                                <div className="text-center max-w-md">
                                    <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                    <h2 className="text-lg font-semibold text-white mb-2">{t.schedulerNoActiveTitle}</h2>
                                    <p className="text-sm text-slate-400 leading-relaxed mb-5">{t.schedulerNoActiveDescription}</p>
                                    <button type="button" onClick={() => setShowUploadModal(true)} className="btn-primary">
                                        <UploadIcon className="w-4 h-4" />
                                        {t.uploadFile}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="hidden lg:block">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="p-2 text-left text-[11px] font-medium tracking-wider uppercase text-slate-400 w-16 border-b border-white/5">
                                                    {t.time}
                                                </th>
                                                {DAYS.map((day) => (
                                                    <th key={day} className="p-2 text-center text-[11px] font-medium tracking-wider uppercase text-slate-400 border-b border-white/5">
                                                        {DAY_ABBR[day]}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {PERIODS.map((period, index) => (
                                                <tr key={period} className="border-b border-white/[0.03]">
                                                    <td className="p-1.5 text-xs text-slate-400 tabular-nums border-r border-white/5 font-medium">
                                                        {PERIOD_TIMES[index]}
                                                    </td>
                                                    {DAYS.map((day) => {
                                                        const courses = grid[day]?.[period] || [];
                                                        const hasConflict = courses.length > 1;
                                                        const occupied = courses.length > 0;
                                                        const isLocked = isSlotPreviewLocked(day, period);

                                                        return (
                                                            <td
                                                                key={`${day}-${period}`}
                                                                onPointerDown={(event) => handlePaintStart(event, day, period, occupied)}
                                                                onPointerEnter={() => handlePaintEnter(day, period)}
                                                                className={`p-0.5 border-r border-white/[0.03] relative group select-none ${occupied ? '' : 'cursor-cell'} ${isLocked ? 'bg-red-500/5' : ''}`}
                                                                style={{ height: '52px' }}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleLock(day, period)}
                                                                    aria-label={isLocked ? t.unlock : t.lock}
                                                                    className={`absolute top-0.5 right-0.5 z-10 p-0.5 rounded transition-all ${
                                                                        isLocked
                                                                            ? 'text-red-400 opacity-100'
                                                                            : 'text-slate-400 opacity-60 lg:opacity-0 lg:group-hover:opacity-100 hover:text-slate-300'
                                                                    }`}
                                                                    title={isLocked ? t.unlock : t.lock}
                                                                >
                                                                    {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                                                </button>

                                                                {isLocked ? (
                                                                    <div className="h-full flex items-center justify-center">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-400/40" />
                                                                    </div>
                                                                ) : (
                                                                    courses.map((course) => {
                                                                        const style = TYPE_STYLES[course.type] || TYPE_STYLES.lecture;
                                                                        return (
                                                                            <button
                                                                                type="button"
                                                                                key={course.code}
                                                                                onClick={() => setSelectedCourse(course)}
                                                                                className={`cell-enter block w-full text-left p-1 rounded-md text-[10px] cursor-pointer transition-all hover:brightness-110 border ${hasConflict ? 'border-red-500/50' : style.border} ${style.bg} mb-0.5`}
                                                                            >
                                                                                <span className="flex items-center gap-1 font-semibold text-white truncate">
                                                                                    {style.icon}
                                                                                    <span className="truncate">{course.code}</span>
                                                                                    {hasConflict && <AlertTriangle className="ml-auto h-3 w-3 shrink-0 text-red-100" aria-hidden="true" />}
                                                                                </span>
                                                                            </button>
                                                                        );
                                                                    })
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="lg:hidden p-3 space-y-3">
                                    <div className="grid grid-cols-5 gap-1 rounded-lg bg-surface-900/60 border border-white/5 p-1">
                                        {DAYS.map((day) => (
                                            <button
                                                type="button"
                                                key={day}
                                                onClick={() => setActiveMobileDay(day)}
                                                className={`h-10 rounded-md text-xs font-semibold transition-colors ${
                                                    activeMobileDay === day
                                                        ? 'bg-isik-blue-lighter/20 text-isik-blue-lighter'
                                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                                }`}
                                            >
                                                {DAY_ABBR[day]}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-between px-1">
                                        <h4 className="text-sm font-semibold text-white">{t.schedulerMobileDaySchedule}</h4>
                                        <span className="text-xs text-slate-400">{DAY_ABBR[activeMobileDay]}</span>
                                    </div>

                                    <div className="space-y-2">
                                        {PERIODS.map((period, index) => {
                                            const courses = grid[activeMobileDay]?.[period] || [];
                                            const isLocked = lockedSlots.has(getSlotKey(activeMobileDay, period));

                                            return (
                                                <div
                                                    key={period}
                                                    className={`min-h-[72px] rounded-lg border p-3 ${
                                                        isLocked
                                                            ? 'border-red-500/20 bg-red-500/5'
                                                            : 'border-white/5 bg-surface-900/35'
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-14 shrink-0 text-xs tabular-nums text-slate-400 pt-1">
                                                            {PERIOD_TIMES[index]}
                                                        </div>
                                                        <div className="min-w-0 flex-1 space-y-2">
                                                            {isLocked ? (
                                                                <div className="text-xs text-red-300">{t.locked}</div>
                                                            ) : courses.length > 0 ? (
                                                                courses.map((course) => {
                                                                    const style = TYPE_STYLES[course.type] || TYPE_STYLES.lecture;
                                                                    return (
                                                                        <button
                                                                            type="button"
                                                                            key={course.code}
                                                                            onClick={() => setSelectedCourse(course)}
                                                                            className={`cell-enter w-full text-left rounded-md border ${style.border} ${style.bg} p-2`}
                                                                        >
                                                                            <span className="flex items-center gap-1.5 text-sm font-semibold text-white truncate">
                                                                                {style.icon}
                                                                                <span className="truncate">{course.code}</span>
                                                                                <span className="ml-auto shrink-0 text-[9px] font-medium uppercase text-white/75">
                                                                                    {getCourseTypeLabel(course.type)}
                                                                                </span>
                                                                            </span>
                                                                            <span className="block text-[11px] text-white/80 truncate">{course.name}</span>
                                                                        </button>
                                                                    );
                                                                })
                                                            ) : (
                                                                <div className="text-xs text-slate-400">{t.schedulerEmptySlot}</div>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleLock(activeMobileDay, period)}
                                                            aria-label={isLocked ? t.unlock : t.lock}
                                                            title={isLocked ? t.unlock : t.lock}
                                                            className={`shrink-0 p-2 rounded-md transition-colors ${
                                                                isLocked
                                                                    ? 'text-red-300 bg-red-500/10'
                                                                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                                            }`}
                                                        >
                                                            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                    <ScheduleHealthBar
                        stats={stats}
                        conflicts={draftConflicts}
                        totalEcts={totalEcts}
                        selectedCount={selectedCount}
                        days={DAYS}
                        dayAbbr={DAY_ABBR}
                        periodTimes={PERIOD_TIMES}
                        active={activeCourses.length > 0}
                    />
                </div>
                <BuildPanel
                    selectedItems={selectedItems}
                    onRemove={toggleCourse}
                    selectedCount={selectedCount}
                    totalEcts={totalEcts}
                    maxEcts={maxEcts}
                    setMaxEcts={setMaxEcts}
                    maxConflicts={maxConflicts}
                    setMaxConflicts={setMaxConflicts}
                    onGenerate={generateSchedules}
                    isGenerating={isGenerating}
                    canGenerate={activeCourses.length > 0}
                />
            </div>

            {showCourseDrawer && (
                <div className="fixed inset-0 z-50 bg-surface-900 lg:hidden no-print">
                    <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-surface-800/80">
                            <div>
                                <h2 className="text-base font-semibold text-white">{t.schedulerCoursesDrawerTitle}</h2>
                                <p className="text-xs text-slate-400">{selectedCount} {t.coursesSelected} · {totalEcts} {t.ects}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCourseDrawer(false)}
                                aria-label={t.close}
                                title={t.close}
                                className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-3 border-b border-white/5 space-y-3 bg-surface-800/45">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    aria-label={t.searchCourse}
                                    placeholder={t.searchCourse}
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    className="input-field !pl-9 !pr-9 !py-2 !text-sm"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
                                        aria-label={t.clearSearch}
                                        title={t.clearSearch}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { key: 'all', label: t.allCoursesLabel },
                                    { key: 'selected', label: t.selectedOnly },
                                    { key: 'blocked', label: t.blockedOnly },
                                ].map((filter) => (
                                    <button
                                        type="button"
                                        key={filter.key}
                                        onClick={() => setCourseFilter(filter.key as CourseFilter)}
                                        className={`h-9 rounded-md text-xs font-medium transition-colors ${
                                            courseFilter === filter.key
                                                ? 'bg-isik-blue-lighter/15 text-isik-blue-lighter border border-isik-blue-lighter/30'
                                                : 'bg-surface-700/40 text-slate-400 border border-white/5'
                                        }`}
                                    >
                                        {filter.label}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                <select
                                    value={selectedAcademicUnit}
                                    onChange={(event) => setSelectedAcademicUnit(event.target.value)}
                                    className="input-field !py-2 !text-sm"
                                    aria-label={t.academicUnit}
                                >
                                    <option value="all">{t.allAcademicUnits}</option>
                                    {academicUnitOptions.map((option) => (
                                        <option key={option.academicUnit} value={option.academicUnit}>
                                            {option.academicUnit} ({option.totalCount})
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={selectedPrefix}
                                    onChange={(event) => setSelectedPrefix(event.target.value)}
                                    className="input-field !py-2 !text-sm"
                                    aria-label={t.codeGroup}
                                >
                                    <option value="all">{t.allCodeGroups}</option>
                                    {prefixOptions.map((option) => (
                                        <option key={option.prefix} value={option.prefix}>
                                            {option.prefix} ({option.totalCount})
                                        </option>
                                    ))}
                                </select>
                                {instructorOptions.length > 0 && (
                                    <select
                                        value={selectedInstructor}
                                        onChange={(event) => setSelectedInstructor(event.target.value)}
                                        className="input-field !py-2 !text-sm"
                                        aria-label={t.instructor}
                                    >
                                        <option value="all">{t.allInstructors}</option>
                                        {instructorOptions.map((option) => (
                                            <option key={option.teacher} value={option.teacher}>
                                                {option.teacher} ({option.count})
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            {allCourses.length === 0 ? (
                                <div className="text-center py-12 px-4">
                                    <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                                    <p className="text-sm text-slate-400 mb-3">{t.noFileUploaded}</p>
                                    <button type="button" onClick={() => setShowUploadModal(true)} className="text-sm text-isik-blue-lighter hover:text-blue-300 transition-colors">
                                        {t.uploadFile}
                                    </button>
                                </div>
                            ) : courseListItems.length === 0 ? (
                                <div className="text-center py-12 px-4">
                                    <p className="text-sm text-slate-400 mb-3">{t.noSearchResults}</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setCourseFilter('all');
                                            setSelectedAcademicUnit('all');
                                            setSelectedPrefix('all');
                                            setSelectedInstructor('all');
                                        }}
                                        className="text-sm text-isik-blue-lighter hover:text-blue-300 transition-colors"
                                    >
                                        {t.resetFilters}
                                    </button>
                                </div>
                            ) : (
                                Array.from(groupedCourses.entries()).map(([prefix, items]) => (
                                    <div key={prefix} className="space-y-1.5">
                                        <div className="flex items-center justify-between px-1 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                            <span className="font-semibold">{prefix}</span>
                                            <span className="tracking-normal text-slate-400">
                                                {items.filter((item) => item.isSelected).length}/{items.length}
                                            </span>
                                        </div>

                                        {items.map((item) => {
                                            const { course, academicUnit, isSelected, isBlocked } = item;
                                            const types = getTypeBadges(course.main_code);

                                            return (
                                                <button
                                                    type="button"
                                                    key={course.main_code}
                                                    onClick={() => toggleCourse(course.main_code)}
                                                    className={`w-full text-left p-3 rounded-lg transition-all duration-150 ${
                                                        isSelected
                                                            ? 'bg-isik-blue-lighter/10 border border-isik-blue-lighter/30'
                                                            : isBlocked
                                                                ? 'bg-red-500/5 border border-red-500/20 opacity-70'
                                                                : 'border border-white/5 bg-surface-800/40'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1 gap-3">
                                                        <span className="font-semibold text-sm text-white">{course.main_code}</span>
                                                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                                            {isBlocked && <Lock className="w-3 h-3 text-red-400" />}
                                                            {types.hasLab && <span className="badge badge-purple">Lab</span>}
                                                            {types.hasPs && <span className="badge badge-green">PS</span>}
                                                            <span className="text-[11px] text-slate-400">{course.ects} ECTS</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-slate-400 leading-relaxed">{course.name}</p>
                                                    {academicUnit && selectedAcademicUnit === 'all' && (
                                                        <p className="text-[10px] text-slate-400 mt-1 truncate">{academicUnit}</p>
                                                    )}
                                                    {isBlocked && <p className="text-[10px] text-red-400/80 mt-1.5">{t.allSectionsLocked}</p>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            <Modal
                isOpen={showUploadModal}
                onClose={() => {
                    setShowUploadModal(false);
                }}
                title={t.uploadTitle}
                closeLabel={t.closeDialog}
            >
                <UploadDropzone
                    inputId="scheduler-course-file"
                    title={t.uploadDropTitle}
                    helperText={t.uploadSubtitle}
                    selectLabel={t.selectFile}
                    invalidFileMessage={t.uploadInvalidFile}
                    onFileSelect={handleUpload}
                    onInvalidFile={() => toastError(t.uploadInvalidFile)}
                    isLoading={isUploading}
                    loadingLabel={t.uploading}
                    variant="compact"
                />

                {fileId && (
                    <button type="button" onClick={() => setShowUploadModal(false)} className="w-full mt-4 text-sm text-slate-400 hover:text-white transition-colors">
                        {t.continue}
                    </button>
                )}
            </Modal>

            <Modal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                title={t.schedulerShareSchedule}
                closeLabel={t.closeDialog}
            >
                <div className="flex flex-col items-center justify-center p-6 space-y-6">
                    {shareCode ? (
                        <>
                            <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-200">
                                <QRCodeSVG 
                                    value={`${window.location.origin}/shared/${shareCode}`} 
                                    size={200}
                                    level="M"
                                    includeMargin
                                />
                            </div>
                            
                            <div className="w-full text-center space-y-2">
                                <p className="text-sm text-slate-300">
                                    {t.schedulerShareDescription}
                                </p>
                                <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 rounded-lg p-1.5 w-full">
                                    <input 
                                        type="text" 
                                        readOnly 
                                        value={`${window.location.origin}/shared/${shareCode}`}
                                        className="bg-transparent border-none outline-none flex-1 text-xs text-slate-300 px-2 py-1"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}/shared/${shareCode}`);
                                            toastSuccess(t.schedulerShareCopied);
                                        }}
                                        className="px-3 py-1.5 bg-isik-blue-lighter/20 hover:bg-isik-blue-lighter/30 text-isik-blue-lighter rounded text-xs font-medium transition-colors"
                                    >
                                        {t.schedulerCopyLink}
                                    </button>
                                </div>
                            </div>
                            
                            <button type="button" onClick={() => setShowShareModal(false)} className="w-full mt-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                                {t.close}
                            </button>
                        </>
                    ) : (
                        <div className="text-slate-400">{t.schedulerShareCodeFailed}</div>
                    )}
                </div>
            </Modal>

            {showSettings && (
                <div className="fixed top-16 left-3 right-3 sm:left-auto sm:right-4 sm:w-72 glass-panel p-4 shadow-2xl shadow-black/40 z-40 animate-fade-in no-print">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-white">{t.settingsTitle}</h3>
                        <button type="button" onClick={() => setShowSettings(false)} aria-label={t.close} title={t.close} className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="scheduler-max-ects" className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block mb-1.5">
                                {t.maxEcts}: <span className="text-white">{maxEcts}</span>
                            </label>
                            <input
                                id="scheduler-max-ects"
                                name="maxEcts"
                                type="range"
                                min="0"
                                max="60"
                                value={maxEcts}
                                onChange={(event) => setMaxEcts(+event.target.value)}
                                className="w-full accent-isik-blue-lighter h-1.5 rounded-full"
                            />
                        </div>
                        <div>
                            <label htmlFor="scheduler-conflict-tolerance" className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block mb-1.5">
                                {t.conflictTolerance}: <span className="text-isik-gold">{maxConflicts}</span>
                            </label>
                            <input
                                id="scheduler-conflict-tolerance"
                                name="maxConflicts"
                                type="range"
                                min="0"
                                max="5"
                                value={maxConflicts}
                                onChange={(event) => setMaxConflicts(+event.target.value)}
                                className="w-full accent-isik-gold h-1.5 rounded-full"
                            />
                        </div>
                    </div>
                </div>
            )}

            {showStats && (
                <div className="fixed top-16 left-3 right-3 sm:left-auto sm:right-4 sm:w-80 glass-panel p-4 shadow-2xl shadow-black/40 z-40 animate-fade-in no-print">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-isik-blue-lighter" />
                            <h3 className="text-sm font-semibold text-white">{t.stats}</h3>
                        </div>
                        <button type="button" onClick={() => setShowStats(false)} aria-label={t.close} title={t.close} className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {activeCourses.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6">{t.statsNoClass}</p>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <StatTile label={t.statsTotalHours} value={`${stats.totalHours}h`} accent="text-isik-blue-lighter" />
                                <StatTile label={t.statsGaps} value={`${stats.totalGaps}h`} accent={stats.totalGaps > 0 ? 'text-amber-300' : 'text-emerald-400'} />
                                <StatTile
                                    label={t.statsFirstClass}
                                    value={stats.earliestPeriod ? PERIOD_TIMES[stats.earliestPeriod - 1] : '—'}
                                    accent="text-white"
                                />
                                <StatTile
                                    label={t.statsLastClass}
                                    value={stats.latestPeriod ? PERIOD_TIMES[stats.latestPeriod - 1] : '—'}
                                    accent="text-white"
                                />
                            </div>

                            <div>
                                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-2">
                                    {t.statsFreeDays} ({stats.freeDays.length})
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {DAYS.map((day) => {
                                        const isFree = stats.freeDays.includes(day);
                                        const hourCount = stats.dayHourCounts[day] || 0;
                                        return (
                                            <span
                                                key={day}
                                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] ${
                                                    isFree
                                                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                                                        : 'bg-surface-700/50 text-slate-300 border border-white/5'
                                                }`}
                                            >
                                                {DAY_ABBR[day]}
                                                {!isFree && <span className="text-slate-400">· {hourCount}h</span>}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <Modal
                isOpen={showShortcuts}
                onClose={() => setShowShortcuts(false)}
                title={t.keyboardShortcuts}
                maxWidth="max-w-md"
            >
                <div className="space-y-2 text-sm">
                    <ShortcutRow keys={['Ctrl', 'Z']} label={t.shortcutUndo} />
                    <ShortcutRow keys={['Ctrl', 'Y']} label={t.shortcutRedo} />
                    <ShortcutRow keys={['←']} label={t.shortcutPrevSchedule} />
                    <ShortcutRow keys={['→']} label={t.shortcutNextSchedule} />
                    <ShortcutRow keys={['G']} label={t.shortcutGenerate} />
                    <ShortcutRow keys={['E']} label={t.shortcutExport} />
                    <ShortcutRow keys={['/']} label={t.shortcutFocusSearch} />
                    <ShortcutRow keys={['?']} label={t.shortcutToggleHelp} />
                    <ShortcutRow keys={['Esc']} label={t.shortcutCloseModal} />
                </div>
            </Modal>

            <ConfirmDialog
                isOpen={confirmKind === 'selection'}
                title={t.confirmClearSelectionTitle}
                description={t.confirmClearSelectionMessage}
                confirmLabel={t.confirmYes}
                cancelLabel={t.confirmCancel}
                tone="danger"
                onConfirm={() => {
                    performClearSelection();
                    setConfirmKind(null);
                }}
                onCancel={() => setConfirmKind(null)}
            />

            <ConfirmDialog
                isOpen={confirmKind === 'locks'}
                title={t.confirmClearLocksTitle}
                description={t.confirmClearLocksMessage}
                confirmLabel={t.confirmYes}
                cancelLabel={t.confirmCancel}
                tone="warning"
                onConfirm={() => {
                    performClearLocks();
                    setConfirmKind(null);
                }}
                onCancel={() => setConfirmKind(null)}
            />

            <Modal isOpen={!!selectedCourse} onClose={() => setSelectedCourse(null)} title={selectedCourse?.code} maxWidth="max-w-lg">
                {selectedCourse && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            {(() => {
                                const style = TYPE_STYLES[selectedCourse.type] || TYPE_STYLES.lecture;
                                return (
                                    <span className={`badge ${style.bg} text-white flex items-center gap-1`}>
                                        {style.icon} {getCourseTypeLabel(selectedCourse.type)}
                                    </span>
                                );
                            })()}
                            <span className="text-sm text-slate-400">{selectedCourse.name}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-surface-700/30 rounded-xl p-3">
                                <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">{t.ects}</p>
                                <p className="text-xl font-bold text-white">{selectedCourse.ects}</p>
                            </div>
                            <div className="bg-surface-700/30 rounded-xl p-3">
                                <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">{t.teacher}</p>
                                <div className="flex items-center gap-2">
                                    <UserIcon className="w-4 h-4 text-slate-400" />
                                    <TeacherLink teacher={selectedCourse.teacher} className="text-sm text-white truncate" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-surface-700/30 rounded-xl p-3">
                            <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-2">{t.schedule}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {selectedCourse.schedule?.map((slot, index) => (
                                    <span key={index} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-700/50 text-xs text-slate-300">
                                        <Clock className="w-3 h-3 text-slate-500" />
                                        {DAY_ABBR[slot[0]]} {PERIOD_TIMES[slot[1] - 1]}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {(() => {
                            const missingPrereqs = (selectedCourse.prerequisites || []).filter(
                                (req) => !activeCourses.some((c) => c.main_code === req)
                            );
                            const missingCoreqs = (selectedCourse.corequisites || []).filter(
                                (req) => !activeCourses.some((c) => c.main_code === req)
                            );

                            if (missingPrereqs.length === 0 && missingCoreqs.length === 0) return null;

                            return (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                    <div className="flex items-center gap-2 text-red-400 mb-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        <p className="text-sm font-medium">{t.missingPreCoWarning}</p>
                                    </div>
                                    {missingPrereqs.length > 0 && (
                                        <p className="text-xs text-red-300 ml-6 list-item">
                                            {t.prerequisiteWarning} {missingPrereqs.join(', ')}
                                        </p>
                                    )}
                                    {missingCoreqs.length > 0 && (
                                        <p className="text-xs text-red-300 ml-6 list-item">
                                            {t.corequisiteWarning} {missingCoreqs.join(', ')}
                                        </p>
                                    )}
                                </div>
                            );
                        })()}

                        {(() => {
                            const alternatives = allCourses.filter((course) =>
                                course.main_code === selectedCourse.main_code &&
                                course.type === selectedCourse.type
                            );

                            if (alternatives.length <= 1) return null;

                            return (
                                <div>
                                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-2">{t.switchSection}</p>
                                    <div className="space-y-1 max-h-36 overflow-y-auto">
                                        {alternatives.map((alternative) => {
                                            const isActive = alternative.code === selectedCourse.code;
                                            const hasConflict = sectionHasLockConflict(alternative);

                                            return (
                                                <button
                                                    type="button"
                                                    key={alternative.code}
                                                    onClick={() => !hasConflict && switchSection(selectedCourse, alternative)}
                                                    disabled={hasConflict}
                                                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-all ${
                                                        isActive ? 'bg-isik-blue-lighter/10 border border-isik-blue-lighter/30' : 'hover:bg-white/5 border border-transparent'
                                                    } ${hasConflict ? 'opacity-40 cursor-not-allowed' : ''}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-white">{alternative.code}</span>
                                                        {hasConflict && <Lock className="w-3 h-3 text-red-400" />}
                                                        {isActive && <span className="text-emerald-400 text-[10px]">{t.schedulerSelectedAlternative}</span>}
                                                    </div>
                                                    <p className="text-slate-400 mt-0.5">
                                                        {alternative.schedule?.map((slot) => `${DAY_ABBR[slot[0]]} ${PERIOD_TIMES[slot[1] - 1]}`).join(', ')}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}

                        <button
                            type="button"
                            onClick={() => {
                                updateDraft(activeCourses.filter((course) => course.main_code !== selectedCourse.main_code));
                                setSelectedCourse(null);
                            }}
                            className="btn-danger w-full"
                        >
                            {t.removeCourse}
                        </button>
                    </div>
                )}
            </Modal>
        </div>
    );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
    return (
        <div className="bg-surface-700/40 rounded-lg p-2.5 border border-white/5">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">{label}</p>
            <p className={`text-base font-semibold ${accent}`}>{value}</p>
        </div>
    );
}

function ToolMenuButton({
    icon,
    label,
    onClick,
    disabled = false,
    fullWidth = false,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    fullWidth?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35 ${fullWidth ? 'w-full' : ''}`}
        >
            <span className="shrink-0">{icon}</span>
            <span className="min-w-0 truncate">{label}</span>
        </button>
    );
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
    return (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface-700/30 border border-white/5">
            <span className="text-slate-300">{label}</span>
            <div className="flex items-center gap-1">
                {keys.map((key, index) => (
                    <span key={index} className="inline-flex items-center justify-center min-w-[1.5rem] px-2 py-0.5 rounded-md bg-surface-800 border border-white/10 text-[11px] font-mono text-slate-200">
                        {key}
                    </span>
                ))}
            </div>
        </div>
    );
}
