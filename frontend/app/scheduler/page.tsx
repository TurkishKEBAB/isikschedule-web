'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
    GraduationCap, Search, FolderOpen, Settings, Rocket, Loader2,
    Lock, Unlock, ChevronLeft, ChevronRight, X, RefreshCw,
    BookOpen, FlaskConical, PenTool, User as UserIcon, Clock,
    Upload as UploadIcon, FileSpreadsheet, Undo2, Redo2, Download,
    Printer, CalendarDays, Keyboard, BarChart3, Sparkles, Share2, AlertTriangle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage, LanguageSwitcher } from '../context/LanguageContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import TeacherLink from '../components/TeacherLink';
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

const TYPE_STYLES: Record<string, { bg: string; border: string; label: string; icon: React.ReactNode }> = {
    lecture: { bg: 'bg-lecture/90', border: 'border-lecture/30', label: 'Ders', icon: <BookOpen className="w-3 h-3" /> },
    lab: { bg: 'bg-lab/90', border: 'border-lab/30', label: 'Lab', icon: <FlaskConical className="w-3 h-3" /> },
    ps: { bg: 'bg-ps/90', border: 'border-ps/30', label: 'PS', icon: <PenTool className="w-3 h-3" /> },
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
    if (targetFileId === 'global') {
        const response = await fetch(`${API_BASE_URL}/api/courses/global`);
        if (!response.ok) return null;

        const data = await response.json();
        return {
            fileId: 'global',
            sourceLabel: data.semester ? `Global: ${data.semester}` : 'Global semester',
            courses: data.courses || [],
        };
    }

    const response = await fetch(`${API_BASE_URL}/api/upload/${targetFileId}/courses`);
    if (!response.ok) return null;

    const data = await response.json();
    return {
        fileId: targetFileId,
        sourceLabel: uploadLabel || `Upload ${targetFileId.slice(0, 8)}`,
        courses: data.courses || [],
    };
}

export default function SchedulerPage() {
    const searchParams = useSearchParams();
    const requestedFileId = searchParams.get('file_id');
    const requestedSourceLabel = searchParams.get('source');

    const { t, lang } = useLanguage();
    const { toastSuccess, toastError, toastWarning, toastInfo } = useToast();

    const DAY_ABBR: Record<string, string> = {
        Monday: t.mon,
        Tuesday: t.tue,
        Wednesday: t.wed,
        Thursday: t.thu,
        Friday: t.fri,
    };

    const [allCourses, setAllCourses] = useState<Course[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
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

    const [algorithm, setAlgorithm] = useState(DEFAULT_ALGORITHM);
    const [maxEcts, setMaxEcts] = useState(DEFAULT_MAX_ECTS);
    const [maxConflicts, setMaxConflicts] = useState(DEFAULT_MAX_CONFLICTS);

    const [selectedInstructor, setSelectedInstructor] = useState('all');
    const [history, setHistory] = useState<{ courses: Course[]; lockedSlots: string[] }[]>([]);
    const [historyIdx, setHistoryIdx] = useState(-1);
    const [confirmKind, setConfirmKind] = useState<null | 'selection' | 'locks'>(null);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareCode, setShareCode] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const exportMenuRef = useRef<HTMLDivElement | null>(null);

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

            setAlgorithm(savedSnapshot?.algorithm || DEFAULT_ALGORITHM);
            setMaxEcts(savedSnapshot?.maxEcts || DEFAULT_MAX_ECTS);
            setMaxConflicts(savedSnapshot?.maxConflicts || DEFAULT_MAX_CONFLICTS);

            if (!source) {
                setAllCourses([]);
                setFileId(null);
                setSourceLabel(null);
                setActiveCourses([]);
                setLockedSlots(new Set());
                setShowUploadModal(true);
                setIsLoading(false);
                setHasInitialized(true);
                return;
            }

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
            algorithm,
            maxEcts,
            maxConflicts,
        });
    }, [hasInitialized, fileId, sourceLabel, activeCourses, lockedSlots, algorithm, maxEcts, maxConflicts]);

    useEffect(() => {
        if (!selectedCourse) return;

        const stillExists = activeCourses.some((course) => course.code === selectedCourse.code);
        if (!stillExists) {
            setSelectedCourse(null);
        }
    }, [activeCourses, selectedCourse]);

    const handleUpload = async (file: File) => {
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            toastError('Lutfen Excel dosyasi (.xlsx) yukleyin.');
            return;
        }

        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body: formData });
            if (!response.ok) {
                throw new Error(await parseErrorMessage(response, 'Dosya yuklenemedi.'));
            }

            const result = await response.json();
            const source = await loadCourseSource(result.file_id, result.filename);

            if (!source) {
                throw new Error('Dosya yuklendi ama dersler okunamadi.');
            }

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
            toastSuccess('Dosya basariyla yuklendi.');
        } catch (error) {
            toastError((error as Error).message || 'Yukleme hatasi olustu.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) handleUpload(file);
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
            { termLabel: sourceLabel || 'IsikSchedule' }
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
                throw new Error("Sharing failed");
            }
            const data = await response.json();
            setShareCode(data.share_code);
            setShowShareModal(true);
        } catch (error) {
            console.error(error);
            toastError("Failed to share schedule.");
        } finally {
            setIsSharing(false);
        }
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
                    algorithm,
                    params: {
                        max_ects: maxEcts,
                        max_conflicts: maxConflicts,
                        locked_slots: lockedSlotsArray,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(await parseErrorMessage(response, 'Program olusturulamadi.'));
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
                            toastSuccess(`${validSchedules.length} program olusturuldu.`);
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
                setShowExportMenu((prev) => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [undo, redo, schedules.length, currentScheduleIdx, activeCourses.length, isGenerating]);

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
            <div className="min-h-screen bg-surface-900 flex items-center justify-center px-6">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-full border-2 border-isik-blue-lighter/20 border-t-isik-blue-lighter animate-spin mx-auto mb-4" />
                    <p className="text-sm text-slate-400">{t.loadingCourses}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-surface-900">
            <header className="flex-shrink-0 bg-surface-800/80 backdrop-blur-xl border-b border-white/5 px-4 py-2.5 no-print">
                <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-3">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-isik-blue to-isik-blue-lighter flex items-center justify-center">
                            <GraduationCap className="w-4 h-4 text-white" />
                        </div>
                        <div className="hidden sm:block">
                            <span className="block text-base font-bold text-white">IsikSchedule</span>
                            {sourceLabel && (
                                <span className="block text-[11px] text-slate-500">
                                    {t.activeSource}: {sourceLabel}
                                </span>
                            )}
                        </div>
                    </Link>

                    <div className="flex items-center gap-2 flex-wrap justify-end no-print">
                        <LanguageSwitcher />

                        <div className="flex items-center gap-0.5 bg-surface-700/40 rounded-lg border border-white/5 p-0.5">
                            <button
                                onClick={undo}
                                disabled={!canUndo}
                                className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title={`${t.undo} (Ctrl+Z)`}
                            >
                                <Undo2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={redo}
                                disabled={!canRedo}
                                className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title={`${t.redo} (Ctrl+Y)`}
                            >
                                <Redo2 className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <button onClick={() => setShowUploadModal(true)} className="btn-ghost !py-1.5 !text-xs">
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t.changeFile}</span>
                        </button>

                        <button onClick={clearLocks} disabled={!lockedSlots.size} className="btn-ghost !py-1.5 !text-xs">
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t.clearLocks}</span>
                        </button>

                        <button onClick={clearSelection} disabled={!activeCourses.length} className="btn-ghost !py-1.5 !text-xs">
                            <X className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t.clearSelection}</span>
                        </button>

                        <div className="relative" ref={exportMenuRef}>
                            <button
                                onClick={() => setShowExportMenu((prev) => !prev)}
                                disabled={!activeCourses.length}
                                className={`btn-ghost !py-1.5 !text-xs ${showExportMenu ? '!bg-isik-blue-lighter/10 !text-isik-blue-lighter' : ''}`}
                                title={`${t.exportMenu} (E)`}
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{t.exportMenu}</span>
                            </button>

                            {showExportMenu && (
                                <div className="absolute right-0 top-full mt-2 w-60 glass-panel p-1 shadow-2xl shadow-black/40 z-40 animate-fade-in">
                                    <button
                                        onClick={handleExportIcs}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-white/5 transition-colors"
                                    >
                                        <CalendarDays className="w-3.5 h-3.5 text-isik-blue-lighter" />
                                        {t.exportIcal}
                                    </button>
                                    <button
                                        onClick={handlePrint}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-white/5 transition-colors"
                                    >
                                        <Printer className="w-3.5 h-3.5 text-emerald-400" />
                                        {t.exportPrint}
                                    </button>
                                    <button
                                        onClick={handleShareSchedule}
                                        disabled={isSharing}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-white/5 transition-colors"
                                    >
                                        {isSharing ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                                        ) : (
                                            <Share2 className="w-3.5 h-3.5 text-blue-400" />
                                        )}
                                        {lang === 'tr' ? 'Programı Paylaş (Link & QR)' : 'Share Schedule (Link & QR)'}
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setShowStats((prev) => !prev)}
                            className={`btn-ghost !py-1.5 !text-xs ${showStats ? '!bg-isik-blue-lighter/10 !text-isik-blue-lighter' : ''}`}
                            title={t.stats}
                        >
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t.stats}</span>
                        </button>

                        <button
                            onClick={() => setShowShortcuts(true)}
                            className="btn-ghost !py-1.5 !text-xs"
                            title={`${t.keyboardShortcuts} (?)`}
                        >
                            <Keyboard className="w-3.5 h-3.5" />
                        </button>

                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`btn-ghost !py-1.5 !text-xs ${showSettings ? '!bg-isik-gold/10 !text-isik-gold' : ''}`}
                        >
                            <Settings className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t.settings}</span>
                        </button>

                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700/50 border border-white/5 text-xs">
                            <span className="font-bold text-white">{selectedCount}</span>
                            <span className="text-slate-400">{t.courses}</span>
                            <span className="text-slate-600 mx-0.5">·</span>
                            <span className="font-bold text-white">{totalEcts}</span>
                            <span className="text-slate-400">{t.ects}</span>
                        </div>

                        <button
                            onClick={generateSchedules}
                            disabled={isGenerating || activeCourses.length === 0}
                            className="btn-primary !py-1.5 !text-xs"
                        >
                            {isGenerating ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t.creating}</>
                            ) : (
                                <><Rocket className="w-3.5 h-3.5" />{t.createSchedule}</>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-80 flex-shrink-0 bg-surface-800/50 border-r border-white/5 flex flex-col no-print">
                    <div className="p-3 border-b border-white/5 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                ref={searchInputRef}
                                type="text"
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
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors"
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
                            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                                {t.academicUnit}
                            </label>
                            <select
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
                            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                                {t.codeGroup}
                            </label>
                            <select
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
                                <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                                    {t.instructor}
                                </label>
                                <select
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

                        <div className="flex justify-between text-[11px] text-slate-500 px-1">
                            <span>{selectedCount} {t.coursesSelected}</span>
                            <span>{totalEcts} {t.ects}</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {allCourses.length === 0 ? (
                            <div className="text-center py-12 px-4">
                                <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                <p className="text-sm text-slate-500 mb-2">{t.noFileUploaded}</p>
                                <button onClick={() => setShowUploadModal(true)} className="text-sm text-isik-blue-lighter hover:text-blue-300 transition-colors">
                                    {t.uploadFile}
                                </button>
                            </div>
                        ) : courseListItems.length === 0 ? (
                            <div className="text-center py-12 px-4">
                                <p className="text-sm text-slate-400 mb-3">{t.noSearchResults}</p>
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setCourseFilter('all');
                                        setSelectedAcademicUnit('all');
                                        setSelectedPrefix('all');
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
                                        <div className="flex items-center justify-between px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                                            <span className="font-semibold">{prefix}</span>
                                            <span className="tracking-normal text-slate-600">
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
                                                            <span className="text-[11px] text-slate-500">{course.ects} ECTS</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-slate-400 leading-relaxed">{course.name}</p>
                                                    {academicUnit && selectedAcademicUnit === 'all' && (
                                                        <p className="text-[10px] text-slate-500 mt-1 truncate">{academicUnit}</p>
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
                            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-3">{t.quickTips}</p>
                            <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
                                <p>{t.tipSelectCourses}</p>
                                <p>{t.tipLockSlots}</p>
                                <p>{t.tipCreateAlternatives}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 p-4 overflow-auto print-area">
                    <div className="glass-panel overflow-hidden min-h-full">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-semibold text-white">
                                    {schedules.length > 0 ? `${t.program} #${currentScheduleIdx + 1}` : t.weeklySchedule}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    {selectedCount === 0
                                        ? t.pickCoursesHint
                                        : schedules.length > 0
                                            ? `${schedules.length} ${t.generatedOptions}`
                                            : t.manualDraft}
                                </p>
                            </div>

                            {schedules.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={prevSchedule}
                                        disabled={currentScheduleIdx === 0}
                                        className="p-1 rounded-md bg-surface-700/50 hover:bg-surface-600/50 disabled:opacity-30 transition-all"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs text-slate-400 tabular-nums min-w-[50px] text-center">
                                        {currentScheduleIdx + 1} / {schedules.length}
                                    </span>
                                    <button
                                        onClick={nextSchedule}
                                        disabled={currentScheduleIdx === schedules.length - 1}
                                        className="p-1 rounded-md bg-surface-700/50 hover:bg-surface-600/50 disabled:opacity-30 transition-all"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className="p-2 text-left text-[11px] font-medium tracking-wider uppercase text-slate-500 w-16 border-b border-white/5">
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
                                        <td className="p-1.5 text-xs text-slate-500 tabular-nums border-r border-white/5 font-medium">
                                            {PERIOD_TIMES[index]}
                                        </td>
                                        {DAYS.map((day) => {
                                            const courses = grid[day]?.[period] || [];
                                            const hasConflict = courses.length > 1;
                                            const isLocked = lockedSlots.has(getSlotKey(day, period));

                                            return (
                                                <td
                                                    key={`${day}-${period}`}
                                                    className={`p-0.5 border-r border-white/[0.03] relative group ${isLocked ? 'bg-red-500/5' : ''}`}
                                                    style={{ height: '52px' }}
                                                >
                                                    <button
                                                        onClick={() => toggleLock(day, period)}
                                                        className={`absolute top-0.5 right-0.5 z-10 p-0.5 rounded transition-all ${
                                                            isLocked
                                                                ? 'text-red-400 opacity-100'
                                                                : 'text-slate-600 opacity-60 md:opacity-0 md:group-hover:opacity-100 hover:text-slate-300'
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
                                                                <div
                                                                    key={course.code}
                                                                    onClick={() => setSelectedCourse(course)}
                                                                    className={`p-1 rounded-md text-[10px] cursor-pointer transition-all hover:brightness-110 border ${hasConflict ? 'border-red-500/50' : style.border} ${style.bg} mb-0.5`}
                                                                >
                                                                    <div className="font-semibold text-white truncate">{course.code}</div>
                                                                </div>
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
                </div>
            </div>

            <Modal
                isOpen={showUploadModal}
                onClose={() => {
                    if (fileId) setShowUploadModal(false);
                }}
                title={t.uploadTitle}
            >
                <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${isDragging ? 'border-isik-blue-lighter bg-isik-blue-lighter/5' : 'border-white/10'}`}
                    onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                >
                    <UploadIcon className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 mb-4">{t.uploadSubtitle}</p>

                    {isUploading ? (
                        <div className="flex items-center justify-center gap-2 text-isik-blue-lighter">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">{t.uploading}</span>
                        </div>
                    ) : (
                        <label className="cursor-pointer">
                            <span className="btn-primary !px-6">{t.selectFile}</span>
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) handleUpload(file);
                                }}
                                className="hidden"
                            />
                        </label>
                    )}
                </div>

                {fileId && (
                    <button onClick={() => setShowUploadModal(false)} className="w-full mt-4 text-sm text-slate-400 hover:text-white transition-colors">
                        {t.continue}
                    </button>
                )}
            </Modal>

            <Modal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                title={lang === 'tr' ? 'Programı Paylaş' : 'Share Schedule'}
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
                                    {lang === 'tr' ? 'Bu QR kodu okutarak veya aşağıdaki linki kullanarak paylaştığınız programa erişebilirsiniz.' : 'Scan this QR code or use the link below to access your shared schedule.'}
                                </p>
                                <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 rounded-lg p-1.5 w-full">
                                    <input 
                                        type="text" 
                                        readOnly 
                                        value={`${window.location.origin}/shared/${shareCode}`}
                                        className="bg-transparent border-none outline-none flex-1 text-xs text-slate-300 px-2 py-1"
                                    />
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}/shared/${shareCode}`);
                                            toastSuccess(lang === 'tr' ? 'Kopyalandı' : 'Copied');
                                        }}
                                        className="px-3 py-1.5 bg-isik-blue-lighter/20 hover:bg-isik-blue-lighter/30 text-isik-blue-lighter rounded text-xs font-medium transition-colors"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                            
                            <button onClick={() => setShowShareModal(false)} className="w-full mt-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                                {lang === 'tr' ? 'Kapat' : 'Close'}
                            </button>
                        </>
                    ) : (
                        <div className="text-slate-400">{lang === 'tr' ? 'Kod oluşturulamadı...' : 'Failed to generate code...'}</div>
                    )}
                </div>
            </Modal>

            {showSettings && (
                <div className="fixed top-14 right-4 glass-panel p-4 w-72 shadow-2xl shadow-black/40 z-40 animate-fade-in no-print">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-white">{t.settingsTitle}</h3>
                        <button onClick={() => setShowSettings(false)} className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block mb-1.5">{t.algorithm}</label>
                            <select value={algorithm} onChange={(event) => setAlgorithm(event.target.value)} className="input-field !py-2 !text-sm">
                                <option value="dfs">{t.dfs}</option>
                                <option value="genetic">{t.genetic}</option>
                                <option value="astar">{t.astar}</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                                {t.maxEcts}: <span className="text-white">{maxEcts}</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="60"
                                value={maxEcts}
                                onChange={(event) => setMaxEcts(+event.target.value)}
                                className="w-full accent-isik-blue-lighter h-1.5 rounded-full"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                                {t.conflictTolerance}: <span className="text-isik-gold">{maxConflicts}</span>
                            </label>
                            <input
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
                <div className="fixed top-14 right-4 glass-panel p-4 w-80 shadow-2xl shadow-black/40 z-40 animate-fade-in no-print">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-isik-blue-lighter" />
                            <h3 className="text-sm font-semibold text-white">{t.stats}</h3>
                        </div>
                        <button onClick={() => setShowStats(false)} className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
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
                                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">
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
                                                {!isFree && <span className="text-slate-500">· {hourCount}h</span>}
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
                                        {style.icon} {style.label}
                                    </span>
                                );
                            })()}
                            <span className="text-sm text-slate-400">{selectedCourse.name}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-surface-700/30 rounded-xl p-3">
                                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{t.ects}</p>
                                <p className="text-xl font-bold text-white">{selectedCourse.ects}</p>
                            </div>
                            <div className="bg-surface-700/30 rounded-xl p-3">
                                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{t.teacher}</p>
                                <div className="flex items-center gap-2">
                                    <UserIcon className="w-4 h-4 text-slate-400" />
                                    <TeacherLink teacher={selectedCourse.teacher} className="text-sm text-white truncate" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-surface-700/30 rounded-xl p-3">
                            <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">{t.schedule}</p>
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
                                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">{t.switchSection}</p>
                                    <div className="space-y-1 max-h-36 overflow-y-auto">
                                        {alternatives.map((alternative) => {
                                            const isActive = alternative.code === selectedCourse.code;
                                            const hasConflict = sectionHasLockConflict(alternative);

                                            return (
                                                <button
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
                                                        {isActive && <span className="text-emerald-400 text-[10px]">Secili</span>}
                                                    </div>
                                                    <p className="text-slate-500 mt-0.5">
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
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</p>
            <p className={`text-base font-semibold ${accent}`}>{value}</p>
        </div>
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
