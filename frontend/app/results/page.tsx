'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

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
}

interface Schedule {
    id: string;
    score: number;
    total_ects: number;
    conflict_count: number;
    course_count: number;
    courses: Course[];
}

interface HistoryState {
    courses: Course[];
    lockedSlots: string[];
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PERIOD_TIMES = ['08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:30'];
const DAY_ABBR: Record<string, string> = { Monday: 'Pzt', Tuesday: 'Sal', Wednesday: 'Çar', Thursday: 'Per', Friday: 'Cum' };

const TYPE_COLORS: Record<string, string> = {
    lecture: 'bg-blue-500/90',
    lab: 'bg-purple-500/90',
    ps: 'bg-green-500/90',
};

export default function ResultsPage() {
    const searchParams = useSearchParams();
    const jobId = searchParams.get('job_id');
    const fileId = searchParams.get('file_id');

    // State
    const [status, setStatus] = useState<string>('loading');
    const [progress, setProgress] = useState<number>(0);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [currentScheduleIdx, setCurrentScheduleIdx] = useState<number>(0);
    const [activeCourses, setActiveCourses] = useState<Course[]>([]);
    const [allCourses, setAllCourses] = useState<Course[]>([]); // All courses from file
    const [lockedSlots, setLockedSlots] = useState<Set<string>>(new Set());
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [showSectionPicker, setShowSectionPicker] = useState<string | null>(null);
    const [showAddCourse, setShowAddCourse] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [compareMode, setCompareMode] = useState(false);
    const [compareScheduleIdx, setCompareScheduleIdx] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Config state
    const [algorithm, setAlgorithm] = useState('dfs');
    const [maxEcts, setMaxEcts] = useState(30);
    const [maxConflicts, setMaxConflicts] = useState(0);
    const [isRegenerating, setIsRegenerating] = useState(false);

    // Undo/Redo
    const [history, setHistory] = useState<HistoryState[]>([]);
    const [historyIdx, setHistoryIdx] = useState(-1);

    // Save state to history
    const saveToHistory = useCallback((courses: Course[], locked: Set<string>) => {
        const newState = { courses: [...courses], lockedSlots: Array.from(locked) };
        setHistory(prev => [...prev.slice(0, historyIdx + 1), newState].slice(-20));
        setHistoryIdx(prev => Math.min(prev + 1, 19));
    }, [historyIdx]);

    // Undo
    const undo = useCallback(() => {
        if (historyIdx > 0) {
            const prevState = history[historyIdx - 1];
            setActiveCourses(prevState.courses);
            setLockedSlots(new Set(prevState.lockedSlots));
            setHistoryIdx(prev => prev - 1);
        }
    }, [history, historyIdx]);

    // Redo
    const redo = useCallback(() => {
        if (historyIdx < history.length - 1) {
            const nextState = history[historyIdx + 1];
            setActiveCourses(nextState.courses);
            setLockedSlots(new Set(nextState.lockedSlots));
            setHistoryIdx(prev => prev + 1);
        }
    }, [history, historyIdx]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
            if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
            if (e.key === 'ArrowLeft') prevSchedule();
            if (e.key === 'ArrowRight') nextSchedule();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    // Fetch job status (only if job_id exists)
    useEffect(() => {
        // If no job_id, start as empty playground
        if (!jobId) {
            setStatus('ready'); // New status for empty playground
            return;
        }

        const pollStatus = async () => {
            try {
                const res = await fetch(`http://localhost:8000/api/jobs/${jobId}`);
                if (!res.ok) throw new Error('Job not found');

                const data = await res.json();
                setStatus(data.status);
                setProgress(data.progress || 0);

                if (data.status === 'completed' && data.result) {
                    const scheds = data.result.schedules || [];
                    setSchedules(scheds);
                    if (scheds.length > 0) {
                        setActiveCourses(scheds[0].courses || []);
                        saveToHistory(scheds[0].courses || [], new Set());
                    }
                    setStatus('ready');
                } else if (data.status === 'failed') {
                    setError(data.message || 'Oluşturma başarısız');
                } else if (['processing', 'queued'].includes(data.status)) {
                    setTimeout(pollStatus, 1000);
                }
            } catch {
                setError('Bağlantı hatası');
                setStatus('error');
            }
        };

        pollStatus();
    }, [jobId]);

    // Fetch all courses for section switching
    useEffect(() => {
        if (fileId) {
            fetch(`http://localhost:8000/api/upload/${fileId}/courses`)
                .then(res => res.json())
                .then(data => setAllCourses(data.courses || []))
                .catch(() => { });
        }
    }, [fileId]);

    // Navigation
    const prevSchedule = () => {
        if (currentScheduleIdx > 0) {
            const newIdx = currentScheduleIdx - 1;
            setCurrentScheduleIdx(newIdx);
            setActiveCourses(schedules[newIdx]?.courses || []);
        }
    };

    const nextSchedule = () => {
        if (currentScheduleIdx < schedules.length - 1) {
            const newIdx = currentScheduleIdx + 1;
            setCurrentScheduleIdx(newIdx);
            setActiveCourses(schedules[newIdx]?.courses || []);
        }
    };

    // Toggle lock - Smart version
    const toggleLock = (day: string, period: number) => {
        const key = `${day}-${period}`;

        // If unlocking, just remove the lock
        if (lockedSlots.has(key)) {
            setLockedSlots(prev => {
                const next = new Set(prev);
                next.delete(key);
                saveToHistory(activeCourses, next);
                return next;
            });
            return;
        }

        // Locking - check if any course uses this slot
        const coursesInSlot = activeCourses.filter(course =>
            course.schedule?.some(slot => {
                const [d, p] = Array.isArray(slot) ? slot : [slot, 0];
                return d === day && p === period;
            })
        );

        // Add the lock first
        const newLocked = new Set(lockedSlots);
        newLocked.add(key);

        if (coursesInSlot.length === 0) {
            // No course in this slot, just lock it
            setLockedSlots(newLocked);
            saveToHistory(activeCourses, newLocked);
            return;
        }

        // There are courses in this slot - try to find alternatives
        let newCourses = [...activeCourses];
        const removedCourses: string[] = [];
        const switchedCourses: string[] = [];

        coursesInSlot.forEach(course => {
            // Find alternative section that doesn't conflict with any locked slot (including new one)
            const alternatives = allCourses.filter(alt =>
                alt.main_code === course.main_code &&
                alt.code !== course.code &&
                !alt.schedule?.some(slot => {
                    const [d, p] = Array.isArray(slot) ? slot : [slot, 0];
                    return newLocked.has(`${d}-${p}`);
                })
            );

            if (alternatives.length > 0) {
                // Switch to first valid alternative
                const newSection = alternatives[0];
                newCourses = newCourses.filter(c => c.main_code !== course.main_code);
                newCourses.push(newSection);
                switchedCourses.push(`${course.code} → ${newSection.code}`);
            } else {
                // No alternative, remove the course
                newCourses = newCourses.filter(c => c.main_code !== course.main_code);
                removedCourses.push(course.code);
            }
        });

        // Show feedback
        if (removedCourses.length > 0 || switchedCourses.length > 0) {
            let message = '';
            if (switchedCourses.length > 0) {
                message += `Section değişti: ${switchedCourses.join(', ')}\n`;
            }
            if (removedCourses.length > 0) {
                message += `Kaldırıldı (alternatif yok): ${removedCourses.join(', ')}`;
            }
            // Use timeout to not block state update
            setTimeout(() => alert(message.trim()), 100);
        }

        setLockedSlots(newLocked);
        setActiveCourses(newCourses);
        saveToHistory(newCourses, newLocked);
    };

    // Remove course
    const removeCourse = (code: string) => {
        const course = activeCourses.find(c => c.code === code);
        const mainCode = course?.main_code;
        // Remove all sections of this main_code
        const newCourses = activeCourses.filter(c => c.main_code !== mainCode);
        setActiveCourses(newCourses);
        saveToHistory(newCourses, lockedSlots);
        setSelectedCourse(null);
    };

    // Switch section
    const switchSection = (mainCode: string, newCourse: Course) => {
        // Check if new section conflicts with locked slots
        const hasConflict = newCourse.schedule?.some(slot => {
            const [d, p] = Array.isArray(slot) ? slot : [slot, 0];
            return lockedSlots.has(`${d}-${p}`);
        });

        if (hasConflict) {
            alert('Bu section kilitli saatlerle çakışıyor!');
            return;
        }

        // Remove old sections of this main_code
        const filtered = activeCourses.filter(c => c.main_code !== mainCode);
        const newCourses = [...filtered, newCourse];
        setActiveCourses(newCourses);
        saveToHistory(newCourses, lockedSlots);
        setShowSectionPicker(null);
    };

    // Get alternative sections for a course (excluding those conflicting with locks)
    const getAlternativeSections = (mainCode: string): Course[] => {
        return allCourses.filter(c => c.main_code === mainCode);
    };

    // Check if a section has conflict with locked slots
    const sectionHasLockConflict = (course: Course): boolean => {
        return course.schedule?.some(slot => {
            const [d, p] = Array.isArray(slot) ? slot : [slot, 0];
            return lockedSlots.has(`${d}-${p}`);
        }) || false;
    };

    // Add a course (find best section avoiding conflicts)
    const addCourse = (mainCode: string) => {
        // Check if already added
        if (activeCourses.some(c => c.main_code === mainCode)) {
            alert('Bu ders zaten eklendi!');
            return;
        }

        // Find best section (no lock conflict, no time conflict with existing)
        const sections = allCourses.filter(c => c.main_code === mainCode);
        const validSection = sections.find(section => {
            // Check lock conflicts
            if (sectionHasLockConflict(section)) return false;
            // Check time conflicts with existing courses
            const hasTimeConflict = activeCourses.some(existing =>
                existing.schedule?.some(eSlot => {
                    const [ed, ep] = Array.isArray(eSlot) ? eSlot : [eSlot, 0];
                    return section.schedule?.some(sSlot => {
                        const [sd, sp] = Array.isArray(sSlot) ? sSlot : [sSlot, 0];
                        return ed === sd && ep === sp;
                    });
                })
            );
            return !hasTimeConflict;
        });

        if (validSection) {
            const newCourses = [...activeCourses, validSection];
            setActiveCourses(newCourses);
            saveToHistory(newCourses, lockedSlots);
        } else if (sections.length > 0) {
            // No conflict-free section, add first one (user can switch)
            const newCourses = [...activeCourses, sections[0]];
            setActiveCourses(newCourses);
            saveToHistory(newCourses, lockedSlots);
            alert('Uygun section bulunamadı, çakışmalı olabilir.');
        }
        setShowAddCourse(false);
        setSearchQuery('');
    };

    // Regenerate schedules with current config
    const regenerateSchedules = async () => {
        if (!fileId) return;

        const selectedMainCodes = Array.from(new Set(activeCourses.map(c => c.main_code)));
        if (selectedMainCodes.length === 0) {
            alert('En az bir ders seçin!');
            return;
        }

        setIsRegenerating(true);

        try {
            const response = await fetch('http://localhost:8000/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_id: fileId,
                    selected_main_codes: selectedMainCodes,
                    algorithm: algorithm,
                    params: { max_ects: maxEcts, max_conflicts: maxConflicts }
                }),
            });

            if (!response.ok) throw new Error('Generation failed');

            const result = await response.json();

            // Poll for result
            const pollResult = async () => {
                const res = await fetch(`http://localhost:8000/api/jobs/${result.job_id}`);
                const data = await res.json();

                if (data.status === 'completed' && data.result) {
                    const scheds = data.result.schedules || [];
                    setSchedules(scheds);
                    setCurrentScheduleIdx(0);
                    if (scheds.length > 0) {
                        setActiveCourses(scheds[0].courses || []);
                    }
                    setIsRegenerating(false);
                    setShowSettings(false);
                } else if (data.status === 'failed') {
                    alert('Oluşturma başarısız: ' + data.message);
                    setIsRegenerating(false);
                } else {
                    setTimeout(pollResult, 500);
                }
            };

            pollResult();
        } catch (err) {
            alert('Hata oluştu');
            setIsRegenerating(false);
        }
    };

    // Get available courses for adding (not already in active)
    const getAvailableCourses = () => {
        const activeMainCodes = new Set(activeCourses.map(c => c.main_code));
        const uniqueMainCodes = new Map<string, Course>();
        allCourses.forEach(c => {
            if (!activeMainCodes.has(c.main_code) && !uniqueMainCodes.has(c.main_code)) {
                uniqueMainCodes.set(c.main_code, c);
            }
        });
        return Array.from(uniqueMainCodes.values())
            .filter(c =>
                c.main_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
    };

    // Build grid
    const buildGrid = (courses: Course[]) => {
        const grid: Record<string, Record<number, Course[]>> = {};
        DAYS.forEach(day => { grid[day] = {}; });

        courses.forEach(course => {
            (course.schedule || []).forEach(slot => {
                const [day, period] = Array.isArray(slot) ? slot : [slot, 0];
                if (grid[day]) {
                    if (!grid[day][period]) grid[day][period] = [];
                    // Don't show in locked slots
                    if (!lockedSlots.has(`${day}-${period}`)) {
                        grid[day][period].push(course);
                    }
                }
            });
        });

        return grid;
    };

    const grid = buildGrid(activeCourses);
    const compareGrid = compareScheduleIdx !== null ? buildGrid(schedules[compareScheduleIdx]?.courses || []) : null;

    // Stats
    const totalEcts = activeCourses.reduce((sum, c) => sum + (c.ects || 0), 0);
    const conflictCount = Object.values(grid).reduce((count, daySlots) =>
        count + Object.values(daySlots).filter(courses => courses.length > 1).length, 0
    );

    // Share link
    const shareLink = typeof window !== 'undefined' ? `${window.location.origin}/share/${jobId}` : '';

    const copyShareLink = () => {
        navigator.clipboard.writeText(shareLink);
        alert('Link kopyalandı!');
    };

    // Loading
    if (['loading', 'processing', 'queued'].includes(status)) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-6 animate-bounce">🔄</div>
                    <h2 className="text-2xl font-bold text-white mb-4">Program Oluşturuluyor...</h2>
                    <div className="w-full bg-slate-700 rounded-full h-3 mb-4">
                        <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-slate-400">%{progress} tamamlandı</p>
                </div>
            </div>
        );
    }

    // Error
    if (error || status === 'error') {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-6">❌</div>
                    <h2 className="text-2xl font-bold text-white mb-4">Hata</h2>
                    <p className="text-slate-400 mb-6">{error}</p>
                    <button onClick={() => window.history.back()} className="bg-blue-600 text-white px-6 py-3 rounded-lg">
                        ← Geri Dön
                    </button>
                </div>
            </div>
        );
    }

    // Note: We no longer block on empty schedules - allow empty playground mode

    // Render schedule grid
    const renderGrid = (gridData: typeof grid, isCompare = false) => (
        <table className="w-full border-collapse text-sm">
            <thead>
                <tr className="bg-slate-700/50">
                    <th className="p-2 text-left text-xs font-medium text-slate-400 w-16 border-b border-slate-600">Saat</th>
                    {DAYS.map(day => (
                        <th key={day} className="p-2 text-center text-xs font-medium text-slate-300 border-b border-slate-600">
                            {DAY_ABBR[day]}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {PERIODS.map((period, idx) => (
                    <tr key={period} className="border-b border-slate-700/30">
                        <td className="p-1 text-xs text-slate-500 border-r border-slate-700">{PERIOD_TIMES[idx]}</td>
                        {DAYS.map(day => {
                            const courses = gridData[day]?.[period] || [];
                            const locked = lockedSlots.has(`${day}-${period}`);
                            const hasConflict = courses.length > 1;

                            return (
                                <td key={`${day}-${period}`} className="p-0.5 border-r border-slate-700/30 relative group" style={{ height: '50px' }}>
                                    {/* Lock button */}
                                    {!isCompare && (
                                        <button
                                            onClick={() => toggleLock(day, period)}
                                            className={`absolute top-0.5 right-0.5 z-20 text-[10px] transition
                        ${locked ? 'text-red-400 opacity-100' : 'text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-400'}`}
                                            title={locked ? 'Bu saatte ders olabilir' : 'Bu saati engelle'}
                                        >
                                            {locked ? '🔒' : '🔓'}
                                        </button>
                                    )}

                                    {locked ? (
                                        <div className="h-full flex items-center justify-center bg-red-900/20 border border-red-500/30 rounded text-red-400 text-xs">
                                            🚫
                                        </div>
                                    ) : (
                                        <div className={`h-full ${hasConflict ? 'space-y-0.5' : ''}`}>
                                            {courses.map((course, cidx) => (
                                                <div
                                                    key={course.code}
                                                    onClick={() => !isCompare && setSelectedCourse(course)}
                                                    className={`p-1 rounded text-[10px] cursor-pointer transition hover:opacity-80 border
                            ${hasConflict ? 'border-red-500/50' : 'border-transparent'}
                            ${TYPE_COLORS[course.type] || 'bg-slate-600'}`}
                                                >
                                                    <div className="font-bold text-white truncate">{course.code}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            {/* Header */}
            <header className="bg-slate-800 border-b border-slate-700 py-3 px-4">
                <div className="max-w-[1800px] mx-auto flex justify-between items-center">
                    <Link href="/" className="text-xl font-bold">🎓 IşıkSchedule</Link>

                    <div className="flex items-center gap-3">
                        {/* Add Course */}
                        <button
                            onClick={() => setShowAddCourse(true)}
                            className="px-3 py-2 bg-emerald-600 rounded text-sm hover:bg-emerald-700 font-medium"
                        >
                            ➕ Ders Ekle
                        </button>

                        {/* Settings */}
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`px-3 py-2 rounded text-sm ${showSettings ? 'bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                        >
                            ⚙️ Ayarlar
                        </button>

                        {/* Undo/Redo */}
                        <div className="flex gap-1">
                            <button onClick={undo} disabled={historyIdx <= 0} className="p-2 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30" title="Geri Al (Ctrl+Z)">↩️</button>
                            <button onClick={redo} disabled={historyIdx >= history.length - 1} className="p-2 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30" title="Yinele (Ctrl+Y)">↪️</button>
                        </div>

                        {/* Stats */}
                        <div className="text-sm px-3 py-1 bg-slate-700 rounded">
                            <span className="font-bold">{totalEcts}</span> ECTS
                            {conflictCount > 0 && <span className="ml-2 text-orange-400">⚠️ {conflictCount}</span>}
                        </div>

                        {/* Compare toggle */}
                        <button
                            onClick={() => setCompareMode(!compareMode)}
                            className={`px-3 py-2 rounded text-sm ${compareMode ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                        >
                            ⚖️ Karşılaştır
                        </button>

                        {/* Share */}
                        <button onClick={copyShareLink} className="px-3 py-2 bg-green-600 rounded text-sm hover:bg-green-700">
                            🔗 Paylaş
                        </button>

                        {/* Export */}
                        <button className="px-3 py-2 bg-blue-600 rounded text-sm hover:bg-blue-700">📥 PDF</button>
                    </div>
                </div>
            </header>

            <div className="max-w-[1800px] mx-auto p-4 flex gap-4">
                {/* Left Sidebar - Active Courses */}
                <div className="w-64 flex-shrink-0 space-y-4">
                    <h3 className="font-bold text-slate-400 text-xs uppercase tracking-wide">
                        Aktif Dersler ({activeCourses.length})
                    </h3>

                    <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                        {/* Empty state */}
                        {activeCourses.length === 0 && (
                            <div className="bg-slate-800 rounded-lg p-4 text-center">
                                <div className="text-4xl mb-3">📚</div>
                                <p className="text-sm text-slate-400 mb-3">Henüz ders eklenmedi</p>
                                <button
                                    onClick={() => setShowAddCourse(true)}
                                    className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
                                >
                                    ➕ Ders Ekle
                                </button>
                            </div>
                        )}

                        {/* Group by main_code */}
                        {Array.from(new Set(activeCourses.map(c => c.main_code))).map(mainCode => {
                            const course = activeCourses.find(c => c.main_code === mainCode)!;
                            const alternatives = getAlternativeSections(mainCode);
                            const isExpanded = showSectionPicker === mainCode;

                            return (
                                <div key={mainCode} className="bg-slate-800 rounded-lg overflow-hidden">
                                    {/* Main course info */}
                                    <div
                                        className="p-3 cursor-pointer hover:bg-slate-700/50"
                                        onClick={() => setShowSectionPicker(isExpanded ? null : mainCode)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={`px-2 py-0.5 rounded text-xs ${TYPE_COLORS[course.type] || 'bg-slate-600'}`}>
                                                {course.type === 'lab' ? 'LAB' : course.type === 'ps' ? 'PS' : 'LEC'}
                                            </span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeCourse(course.code); }}
                                                className="text-red-400 hover:text-red-300 text-xs"
                                            >✕</button>
                                        </div>
                                        <div className="font-bold mt-1">{course.code}</div>
                                        <div className="text-xs text-slate-400 truncate">{course.name}</div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            👨‍🏫 {course.teacher || 'Belirtilmemiş'}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            📅 {course.schedule_str || course.schedule?.map(s => `${String(s[0]).slice(0, 3)}${s[1]}`).join(', ')}
                                        </div>
                                        {alternatives.length > 1 && (
                                            <div className="text-xs text-blue-400 mt-1">
                                                {isExpanded ? '▲' : '▼'} {alternatives.length} section mevcut
                                            </div>
                                        )}
                                    </div>

                                    {/* Section picker */}
                                    {isExpanded && alternatives.length > 1 && (
                                        <div className="border-t border-slate-700 bg-slate-850">
                                            <div className="p-2 text-xs text-slate-400">
                                                <div className="mb-2 text-slate-500">Neden section değiştirmek istersin?</div>
                                                <div className="text-[10px] text-slate-600 mb-2">• Farklı gün/saat • Farklı hoca • Arkadaşınla aynı section</div>
                                            </div>
                                            {alternatives.map(alt => {
                                                const hasLockConflict = sectionHasLockConflict(alt);
                                                const isCurrent = alt.code === course.code;
                                                return (
                                                    <button
                                                        key={alt.code}
                                                        onClick={() => !hasLockConflict && switchSection(mainCode, alt)}
                                                        disabled={hasLockConflict}
                                                        className={`w-full text-left p-2 text-xs border-t border-slate-700 
                                                      ${hasLockConflict ? 'opacity-50 cursor-not-allowed bg-red-900/10' : 'hover:bg-slate-700/50'}
                                                      ${isCurrent ? 'bg-blue-500/20' : ''}`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-medium">{alt.code}</span>
                                                            {hasLockConflict && <span className="text-red-400">🔒 Kilitli saatle çakışıyor</span>}
                                                            {isCurrent && !hasLockConflict && <span className="text-green-400">✓ Seçili</span>}
                                                        </div>
                                                        <div className="text-slate-400">
                                                            {alt.schedule_str || alt.schedule?.map(s => `${String(s[0]).slice(0, 3)}${s[1]}`).join(', ')}
                                                        </div>
                                                        <div className="text-slate-500">{alt.teacher || 'Hoca belirtilmemiş'}</div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex gap-4">
                    {/* Primary Schedule */}
                    <div className={`${compareMode && compareScheduleIdx !== null ? 'flex-1' : 'flex-1'} bg-slate-800 rounded-xl border border-slate-700 overflow-hidden`}>
                        <div className="p-3 bg-slate-700/50 border-b border-slate-600 flex justify-between items-center">
                            <h3 className="font-bold">Program #{currentScheduleIdx + 1}</h3>
                            <span className="text-xs text-slate-400">{totalEcts} ECTS</span>
                        </div>
                        <div className="overflow-x-auto">{renderGrid(grid)}</div>
                    </div>

                    {/* Compare Schedule */}
                    {compareMode && (
                        <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                            <div className="p-3 bg-slate-700/50 border-b border-slate-600">
                                {compareScheduleIdx === null ? (
                                    <select
                                        onChange={(e) => setCompareScheduleIdx(parseInt(e.target.value))}
                                        className="w-full bg-slate-600 rounded p-2 text-sm"
                                    >
                                        <option value="">Karşılaştırılacak programı seç...</option>
                                        {schedules.map((s, idx) => idx !== currentScheduleIdx && (
                                            <option key={idx} value={idx}>Program #{idx + 1} ({s.total_ects} ECTS)</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold">Program #{compareScheduleIdx + 1}</h3>
                                        <button onClick={() => setCompareScheduleIdx(null)} className="text-xs text-slate-400 hover:text-white">
                                            ✕ Kapat
                                        </button>
                                    </div>
                                )}
                            </div>
                            {compareGrid && <div className="overflow-x-auto">{renderGrid(compareGrid, true)}</div>}
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation Arrows - only show when schedules exist */}
            {schedules.length > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-slate-800/90 backdrop-blur px-6 py-3 rounded-full border border-slate-700 shadow-xl">
                    <button
                        onClick={prevSchedule}
                        disabled={currentScheduleIdx === 0}
                        className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        ◀
                    </button>
                    <span className="text-sm font-medium min-w-[60px] text-center">
                        {currentScheduleIdx + 1} / {schedules.length}
                    </span>
                    <button
                        onClick={nextSchedule}
                        disabled={currentScheduleIdx === schedules.length - 1}
                        className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        ▶
                    </button>
                </div>
            )}

            {/* Course Detail Modal */}
            {selectedCourse && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setSelectedCourse(null)}>
                    <div className="bg-slate-800 rounded-xl border border-slate-600 p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <span className={`px-3 py-1 rounded text-sm ${TYPE_COLORS[selectedCourse.type] || 'bg-slate-600'}`}>
                                    {selectedCourse.type === 'lab' ? 'Laboratory' : selectedCourse.type === 'ps' ? 'Problem Session' : 'Lecture'}
                                </span>
                                <h2 className="text-2xl font-bold mt-2">{selectedCourse.code}</h2>
                                <p className="text-slate-400">{selectedCourse.name}</p>
                            </div>
                            <button onClick={() => setSelectedCourse(null)} className="text-slate-400 hover:text-white text-2xl">×</button>
                        </div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-700/50 rounded-lg p-3">
                                    <div className="text-xs text-slate-400">ECTS</div>
                                    <div className="text-xl font-bold">{selectedCourse.ects}</div>
                                </div>
                                <div className="bg-slate-700/50 rounded-lg p-3">
                                    <div className="text-xs text-slate-400">Fakülte</div>
                                    <div className="text-sm truncate">{selectedCourse.faculty || 'Belirtilmemiş'}</div>
                                </div>
                            </div>

                            <div className="bg-slate-700/50 rounded-lg p-3">
                                <div className="text-xs text-slate-400 mb-2">Eğitmen</div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center font-bold">
                                        {selectedCourse.teacher?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <div className="font-medium">{selectedCourse.teacher || 'Belirtilmemiş'}</div>
                                        <div className="text-xs text-slate-400">Öğretim Üyesi</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-700/50 rounded-lg p-3">
                                <div className="text-xs text-slate-400 mb-2">Ders Saatleri</div>
                                <div className="flex flex-wrap gap-2">
                                    {selectedCourse.schedule?.map((slot, idx) => (
                                        <span key={idx} className="bg-slate-600 px-2 py-1 rounded text-sm">
                                            {DAY_ABBR[slot[0]] || slot[0]} {slot[1]}. ders
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Syllabus Placeholder */}
                            <div className="bg-slate-700/50 rounded-lg p-3">
                                <div className="text-xs text-slate-400 mb-2">📚 Syllabus & Dökümanlar</div>
                                <div className="text-sm text-slate-500 italic">
                                    <p>Haftalık konular ve kaynaklar yakında eklenecek...</p>
                                    <div className="mt-2 space-y-1 text-xs">
                                        <div className="flex justify-between"><span>Hafta 1:</span><span className="text-slate-600">Giriş</span></div>
                                        <div className="flex justify-between"><span>Hafta 2-4:</span><span className="text-slate-600">Temel Kavramlar</span></div>
                                        <div className="flex justify-between"><span>Vize:</span><span className="text-slate-600">Hafta 8</span></div>
                                        <div className="flex justify-between"><span>Final:</span><span className="text-slate-600">Dönem Sonu</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => { removeCourse(selectedCourse.code); }}
                                    className="flex-1 bg-red-600/20 text-red-400 py-2 rounded-lg hover:bg-red-600/30"
                                >
                                    🗑️ Kaldır
                                </button>
                                <button
                                    onClick={() => setSelectedCourse(null)}
                                    className="flex-1 bg-slate-700 py-2 rounded-lg hover:bg-slate-600"
                                >
                                    Kapat
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Course Modal */}
            {showAddCourse && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => { setShowAddCourse(false); setSearchQuery(''); }}>
                    <div className="bg-slate-800 rounded-xl border border-slate-600 p-6 max-w-md w-full mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">➕ Ders Ekle</h2>
                            <button onClick={() => { setShowAddCourse(false); setSearchQuery(''); }} className="text-slate-400 hover:text-white text-2xl">×</button>
                        </div>

                        <input
                            type="text"
                            placeholder="🔍 Ders ara... (kod veya isim)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full p-3 bg-slate-700 rounded-lg border border-slate-600 mb-4 focus:border-blue-500 outline-none"
                            autoFocus
                        />

                        <div className="flex-1 overflow-y-auto space-y-2">
                            {getAvailableCourses().slice(0, 20).map(course => (
                                <button
                                    key={course.main_code}
                                    onClick={() => addCourse(course.main_code)}
                                    className="w-full text-left p-3 bg-slate-700 rounded-lg hover:bg-slate-600 transition"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold">{course.main_code}</span>
                                        <span className="text-xs text-slate-400">{course.ects} ECTS</span>
                                    </div>
                                    <div className="text-sm text-slate-400 truncate">{course.name}</div>
                                </button>
                            ))}
                            {getAvailableCourses().length === 0 && (
                                <div className="text-center text-slate-500 py-8">
                                    {searchQuery ? 'Sonuç bulunamadı' : 'Eklenebilecek ders yok'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Panel */}
            {showSettings && (
                <div className="fixed top-16 right-4 bg-slate-800 rounded-xl border border-slate-600 p-4 w-80 shadow-2xl z-40">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold">⚙️ Ayarlar</h3>
                        <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">×</button>
                    </div>

                    {/* Algorithm */}
                    <div className="mb-4">
                        <label className="text-xs text-slate-400 uppercase mb-2 block">Algoritma</label>
                        <select
                            value={algorithm}
                            onChange={(e) => setAlgorithm(e.target.value)}
                            className="w-full p-2 bg-slate-700 rounded border border-slate-600"
                        >
                            <option value="dfs">🔄 DFS (Hızlı)</option>
                            <option value="genetic">🧬 Genetik (Akıllı)</option>
                            <option value="astar">⭐ A* (Optimal)</option>
                        </select>
                    </div>

                    {/* Max ECTS */}
                    <div className="mb-4">
                        <label className="text-xs text-slate-400 uppercase mb-2 block">
                            Maksimum ECTS: <span className="text-white font-bold">{maxEcts}</span>
                        </label>
                        <input
                            type="range"
                            min="15"
                            max="45"
                            value={maxEcts}
                            onChange={(e) => setMaxEcts(parseInt(e.target.value))}
                            className="w-full accent-blue-500"
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>15</span>
                            <span>30</span>
                            <span>45</span>
                        </div>
                    </div>

                    {/* Max Conflicts */}
                    <div className="mb-4">
                        <label className="text-xs text-slate-400 uppercase mb-2 block">
                            Çakışma Toleransı: <span className="text-orange-400 font-bold">{maxConflicts}</span>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="3"
                            value={maxConflicts}
                            onChange={(e) => setMaxConflicts(parseInt(e.target.value))}
                            className="w-full accent-orange-500"
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>0 (Yok)</span>
                            <span>1</span>
                            <span>2</span>
                            <span>3</span>
                        </div>
                    </div>

                    {/* Regenerate Button */}
                    <button
                        onClick={regenerateSchedules}
                        disabled={isRegenerating || activeCourses.length === 0}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-bold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isRegenerating ? '⏳ Oluşturuluyor...' : '🔄 Yeniden Oluştur'}
                    </button>

                    <p className="text-xs text-slate-500 mt-2 text-center">
                        Mevcut derslerle yeni programlar oluşturur
                    </p>
                </div>
            )}
        </div>
    );
}
