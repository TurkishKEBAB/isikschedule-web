'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PERIOD_TIMES = ['08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:30'];
const DAY_ABBR: Record<string, string> = { Monday: 'Pzt', Tuesday: 'Sal', Wednesday: 'Çar', Thursday: 'Per', Friday: 'Cum' };

const TYPE_COLORS: Record<string, string> = {
    lecture: 'bg-blue-500/90',
    lab: 'bg-purple-500/90',
    ps: 'bg-green-500/90',
};

export default function SchedulerPage() {
    // File & Courses
    const [fileId, setFileId] = useState<string | null>(null);
    const [allCourses, setAllCourses] = useState<Course[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(true); // Start with upload modal
    const [isDragging, setIsDragging] = useState(false);

    // Selected courses & schedules
    const [activeCourses, setActiveCourses] = useState<Course[]>([]);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [currentScheduleIdx, setCurrentScheduleIdx] = useState(0);
    const [lockedSlots, setLockedSlots] = useState<Set<string>>(new Set());

    // UI State
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [expandedCourse, setExpandedCourse] = useState<string | null>(null); // For section picker in sidebar

    // Config
    const [algorithm, setAlgorithm] = useState('dfs');
    const [maxEcts, setMaxEcts] = useState(30);
    const [maxConflicts, setMaxConflicts] = useState(0);

    // Handle file upload
    const handleUpload = async (file: File) => {
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            alert('Lütfen Excel dosyası (.xlsx) yükleyin');
            return;
        }

        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('http://localhost:8000/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Upload failed');

            const result = await response.json();
            setFileId(result.file_id);

            // Fetch courses
            const coursesRes = await fetch(`http://localhost:8000/api/upload/${result.file_id}/courses`);
            const coursesData = await coursesRes.json();
            setAllCourses(coursesData.courses || []);

            setShowUploadModal(false);
        } catch (err) {
            alert('Yükleme hatası. Backend çalışıyor mu?');
        } finally {
            setIsUploading(false);
        }
    };

    // Handle drag & drop
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleUpload(file);
    };

    // Get unique main courses for listing
    const getUniqueCourses = () => {
        const seen = new Set<string>();
        return allCourses.filter(c => {
            if (seen.has(c.main_code)) return false;
            seen.add(c.main_code);
            return true;
        }).filter(c =>
            c.main_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    };

    // Check if course is selected
    const isCourseSelected = (mainCode: string) =>
        activeCourses.some(c => c.main_code === mainCode);

    // Check if any section of a course has lock conflict
    const courseHasValidSection = (mainCode: string): Course | null => {
        const sections = allCourses.filter(c => c.main_code === mainCode);
        for (const section of sections) {
            const hasConflict = section.schedule?.some((slot: [string, number]) => {
                const [d, p] = slot;
                return lockedSlots.has(`${d}-${p}`);
            });
            if (!hasConflict) return section;
        }
        return null;
    };

    // Toggle course selection
    const toggleCourse = (mainCode: string) => {
        if (isCourseSelected(mainCode)) {
            // Remove course and all its related components (PS, Lab with same main_code)
            setActiveCourses(prev => prev.filter(c => c.main_code !== mainCode));
        } else {
            // Find best section that doesn't conflict with locks
            const validSection = courseHasValidSection(mainCode);

            if (validSection) {
                setActiveCourses(prev => [...prev, validSection]);
            } else {
                // No valid section - warn user
                const allSections = allCourses.filter(c => c.main_code === mainCode);
                const sectionCount = allSections.length;
                alert(
                    `⚠️ ${mainCode} eklenemiyor!\n\n` +
                    `Tüm section'lar (${sectionCount} adet) kilitli saatlerle çakışıyor.\n\n` +
                    `Çözüm: Bazı kilitleri kaldırın veya farklı bir ders seçin.`
                );
            }
        }
    };

    // Get alternative sections for a course
    const getAlternativeSections = (mainCode: string): Course[] => {
        return allCourses.filter(c => c.main_code === mainCode);
    };

    // Switch section
    const switchSection = (mainCode: string, newCourse: Course) => {
        // Check if conflicts with locked slots
        const hasLockConflict = newCourse.schedule?.some(slot => {
            const [d, p] = Array.isArray(slot) ? slot : [slot, 0];
            return lockedSlots.has(`${d}-${p}`);
        });

        if (hasLockConflict) {
            alert('Bu section kilitli saatlerle çakışıyor!');
            return;
        }

        const filtered = activeCourses.filter(c => c.main_code !== mainCode);
        setActiveCourses([...filtered, newCourse]);
        setSelectedCourse(null);
    };

    // Toggle lock on a slot
    const toggleLock = (day: string, period: number) => {
        const key = `${day}-${period}`;

        // Unlocking
        if (lockedSlots.has(key)) {
            const newLocked = new Set(lockedSlots);
            newLocked.delete(key);
            setLockedSlots(newLocked);
            return;
        }

        // Locking - find courses in this slot
        const coursesInSlot = activeCourses.filter(course =>
            course.schedule?.some(slot => {
                const [d, p] = Array.isArray(slot) ? slot : [slot, 0];
                return d === day && p === period;
            })
        );

        const newLocked = new Set(lockedSlots);
        newLocked.add(key);

        if (coursesInSlot.length === 0) {
            setLockedSlots(newLocked);
            return;
        }

        // Find alternatives for affected courses
        let newCourses = [...activeCourses];
        const messages: string[] = [];

        coursesInSlot.forEach(course => {
            const alternatives = allCourses.filter(alt =>
                alt.main_code === course.main_code &&
                alt.code !== course.code &&
                !alt.schedule?.some(slot => {
                    const [d, p] = Array.isArray(slot) ? slot : [slot, 0];
                    return newLocked.has(`${d}-${p}`);
                })
            );

            if (alternatives.length > 0) {
                newCourses = newCourses.filter(c => c.main_code !== course.main_code);
                newCourses.push(alternatives[0]);
                messages.push(`${course.code} → ${alternatives[0].code}`);
            } else {
                newCourses = newCourses.filter(c => c.main_code !== course.main_code);
                messages.push(`${course.code} kaldırıldı (alternatif yok)`);
            }
        });

        if (messages.length > 0) {
            setTimeout(() => alert(messages.join('\n')), 100);
        }

        setLockedSlots(newLocked);
        setActiveCourses(newCourses);
    };

    // Check if section has lock conflict
    const sectionHasLockConflict = (course: Course): boolean => {
        return course.schedule?.some(slot => {
            const [d, p] = Array.isArray(slot) ? slot : [slot, 0];
            return lockedSlots.has(`${d}-${p}`);
        }) || false;
    };

    // Generate schedules
    const generateSchedules = async () => {
        if (!fileId || activeCourses.length === 0) return;

        setIsGenerating(true);

        try {
            // Convert locked slots to format backend understands
            const lockedSlotsArray = Array.from(lockedSlots).map(key => {
                const [day, period] = key.split('-');
                return [day, parseInt(period)];
            });

            const response = await fetch('http://localhost:8000/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_id: fileId,
                    selected_main_codes: Array.from(new Set(activeCourses.map(c => c.main_code))),
                    algorithm,
                    params: {
                        max_ects: maxEcts,
                        max_conflicts: maxConflicts,
                        locked_slots: lockedSlotsArray
                    }
                }),
            });

            if (!response.ok) throw new Error('Generation failed');

            const result = await response.json();

            // Poll for result
            const poll = async () => {
                const res = await fetch(`http://localhost:8000/api/jobs/${result.job_id}`);
                const data = await res.json();

                if (data.status === 'completed' && data.result) {
                    const schedules = data.result.schedules || [];

                    // Filter schedules to only include those that don't violate locks
                    // (In case backend doesn't fully support locks yet)
                    const validSchedules = schedules.filter((sched: Schedule) => {
                        return sched.courses.every(course =>
                            !course.schedule?.some(slot => {
                                const [d, p] = Array.isArray(slot) ? slot : [slot, 0];
                                return lockedSlots.has(`${d}-${p}`);
                            })
                        );
                    });

                    // If no valid schedules, use originals but swap locked courses
                    if (validSchedules.length === 0 && schedules.length > 0) {
                        // Apply lock fixing to first schedule
                        let fixedCourses = [...schedules[0].courses];

                        lockedSlots.forEach(key => {
                            const [day, periodStr] = key.split('-');
                            const period = parseInt(periodStr);

                            const conflicting = fixedCourses.filter(c =>
                                c.schedule?.some((slot: [string, number]) => {
                                    const [d, p] = slot;
                                    return d === day && p === period;
                                })
                            );

                            conflicting.forEach(course => {
                                const alternatives = allCourses.filter(alt =>
                                    alt.main_code === course.main_code &&
                                    alt.code !== course.code &&
                                    !alt.schedule?.some(slot => {
                                        const [d, p] = Array.isArray(slot) ? slot : [slot, 0];
                                        return lockedSlots.has(`${d}-${p}`);
                                    })
                                );

                                if (alternatives.length > 0) {
                                    fixedCourses = fixedCourses.filter(c => c.main_code !== course.main_code);
                                    fixedCourses.push(alternatives[0]);
                                } else {
                                    fixedCourses = fixedCourses.filter(c => c.main_code !== course.main_code);
                                }
                            });
                        });

                        setActiveCourses(fixedCourses);
                        setSchedules([{ ...schedules[0], courses: fixedCourses }]);
                    } else if (validSchedules.length > 0) {
                        setSchedules(validSchedules);
                        setActiveCourses(validSchedules[0].courses);
                    } else {
                        setSchedules([]);
                        // Keep current courses
                    }

                    setCurrentScheduleIdx(0);
                    setIsGenerating(false);
                } else if (data.status === 'failed') {
                    alert('Oluşturma başarısız');
                    setIsGenerating(false);
                } else {
                    setTimeout(poll, 500);
                }
            };

            poll();
        } catch (err) {
            alert('Hata oluştu');
            setIsGenerating(false);
        }
    };

    // Build grid
    const buildGrid = () => {
        const grid: Record<string, Record<number, Course[]>> = {};
        DAYS.forEach(day => { grid[day] = {}; });

        activeCourses.forEach(course => {
            (course.schedule || []).forEach(slot => {
                const [day, period] = Array.isArray(slot) ? slot : [slot, 0];
                if (grid[day]) {
                    if (!grid[day][period]) grid[day][period] = [];
                    if (!lockedSlots.has(`${day}-${period}`)) {
                        grid[day][period].push(course);
                    }
                }
            });
        });

        return grid;
    };

    const grid = buildGrid();
    const totalEcts = activeCourses.reduce((sum, c) => sum + (c.ects || 0), 0);
    const selectedCount = new Set(activeCourses.map(c => c.main_code)).size;

    // Navigate schedules
    const prevSchedule = () => {
        if (currentScheduleIdx > 0) {
            setCurrentScheduleIdx(prev => prev - 1);
            setActiveCourses(schedules[currentScheduleIdx - 1]?.courses || []);
        }
    };

    const nextSchedule = () => {
        if (currentScheduleIdx < schedules.length - 1) {
            setCurrentScheduleIdx(prev => prev + 1);
            setActiveCourses(schedules[currentScheduleIdx + 1]?.courses || []);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col">
            {/* Header */}
            <header className="bg-slate-800 border-b border-slate-700 py-3 px-4 flex-shrink-0">
                <div className="max-w-[1800px] mx-auto flex justify-between items-center">
                    <Link href="/" className="text-xl font-bold">🎓 IşıkSchedule</Link>

                    <div className="flex items-center gap-3">
                        {/* Upload new file */}
                        <button
                            onClick={() => setShowUploadModal(true)}
                            className="px-3 py-2 bg-slate-700 rounded text-sm hover:bg-slate-600"
                        >
                            📁 Dosya Değiştir
                        </button>

                        {/* Settings */}
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`px-3 py-2 rounded text-sm ${showSettings ? 'bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                        >
                            ⚙️ Ayarlar
                        </button>

                        {/* Stats */}
                        <div className="text-sm px-3 py-1 bg-slate-700 rounded">
                            <span className="font-bold">{selectedCount}</span> ders |
                            <span className="font-bold ml-1">{totalEcts}</span> ECTS
                        </div>

                        {/* Generate */}
                        <button
                            onClick={generateSchedules}
                            disabled={isGenerating || activeCourses.length === 0}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded text-sm font-bold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
                        >
                            {isGenerating ? '⏳ Oluşturuluyor...' : '🚀 Program Oluştur'}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - Course Selection */}
                <div className="w-80 flex-shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
                    <div className="p-4 border-b border-slate-700">
                        <h2 className="font-bold text-lg mb-3">📚 Dersler</h2>
                        <input
                            type="text"
                            placeholder="🔍 Ders ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full p-2 bg-slate-700 rounded border border-slate-600 text-sm"
                        />
                        <div className="flex justify-between text-xs text-slate-400 mt-2">
                            <span>{selectedCount} ders seçildi</span>
                            <span>{totalEcts} ECTS</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {allCourses.length === 0 ? (
                            <div className="text-center text-slate-500 py-8">
                                <p>Henüz dosya yüklenmedi</p>
                                <button
                                    onClick={() => setShowUploadModal(true)}
                                    className="mt-2 text-blue-400 hover:text-blue-300"
                                >
                                    📁 Dosya Yükle
                                </button>
                            </div>
                        ) : (
                            getUniqueCourses().map(course => {
                                const isSelected = isCourseSelected(course.main_code);
                                const hasValidSection = courseHasValidSection(course.main_code);
                                const isBlocked = !isSelected && !hasValidSection && lockedSlots.size > 0;

                                return (
                                    <button
                                        key={course.main_code}
                                        onClick={() => toggleCourse(course.main_code)}
                                        className={`w-full text-left p-3 rounded-lg transition 
                                            ${isSelected
                                                ? 'bg-blue-600/30 border border-blue-500'
                                                : isBlocked
                                                    ? 'bg-red-900/20 border border-red-500/30 opacity-60'
                                                    : 'bg-slate-700/50 hover:bg-slate-700 border border-transparent'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold">{course.main_code}</span>
                                            <div className="flex items-center gap-2">
                                                {isBlocked && <span className="text-red-400 text-xs">🔒</span>}
                                                {course.type === 'lab' && <span className="text-xs bg-purple-500/50 px-1 rounded">Lab</span>}
                                                <span className="text-xs text-slate-400">{course.ects} ECTS</span>
                                            </div>
                                        </div>
                                        <div className="text-sm text-slate-400 truncate">{course.name}</div>
                                        {isBlocked && (
                                            <div className="text-xs text-red-400 mt-1">Tüm section'lar kilitli</div>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Main Grid */}
                <div className="flex-1 p-4 overflow-auto">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                        <div className="p-3 bg-slate-700/50 border-b border-slate-600 flex justify-between items-center">
                            <h3 className="font-bold">
                                {schedules.length > 0 ? `Program #${currentScheduleIdx + 1}` : 'Haftalık Program'}
                            </h3>
                            {schedules.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <button onClick={prevSchedule} disabled={currentScheduleIdx === 0} className="p-1 rounded bg-slate-600 disabled:opacity-30">◀</button>
                                    <span className="text-sm">{currentScheduleIdx + 1} / {schedules.length}</span>
                                    <button onClick={nextSchedule} disabled={currentScheduleIdx === schedules.length - 1} className="p-1 rounded bg-slate-600 disabled:opacity-30">▶</button>
                                </div>
                            )}
                        </div>

                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-700/30">
                                    <th className="p-2 text-left text-xs text-slate-400 w-16 border-b border-slate-600">Saat</th>
                                    {DAYS.map(day => (
                                        <th key={day} className="p-2 text-center text-xs text-slate-300 border-b border-slate-600">{DAY_ABBR[day]}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {PERIODS.map((period, idx) => (
                                    <tr key={period} className="border-b border-slate-700/30">
                                        <td className="p-1 text-xs text-slate-500 border-r border-slate-700">{PERIOD_TIMES[idx]}</td>
                                        {DAYS.map(day => {
                                            const courses = grid[day]?.[period] || [];
                                            const hasConflict = courses.length > 1;
                                            const isLocked = lockedSlots.has(`${day}-${period}`);

                                            return (
                                                <td
                                                    key={`${day}-${period}`}
                                                    className={`p-0.5 border-r border-slate-700/30 relative group ${isLocked ? 'bg-red-900/20' : ''}`}
                                                    style={{ height: '45px' }}
                                                >
                                                    {/* Lock button */}
                                                    <button
                                                        onClick={() => toggleLock(day, period)}
                                                        className={`absolute top-0 right-0 w-4 h-4 text-[8px] opacity-0 group-hover:opacity-100 transition z-10
                                                            ${isLocked ? 'text-red-400 opacity-100' : 'text-slate-400 hover:text-white'}`}
                                                        title={isLocked ? 'Kilidi Kaldır' : 'Kilitle'}
                                                    >
                                                        {isLocked ? '🔒' : '🔓'}
                                                    </button>

                                                    {isLocked ? (
                                                        <div className="h-full flex items-center justify-center text-red-400 text-xs">🚫</div>
                                                    ) : (
                                                        courses.map((course) => (
                                                            <div
                                                                key={course.code}
                                                                onClick={() => setSelectedCourse(course)}
                                                                className={`p-1 rounded text-[10px] cursor-pointer transition hover:opacity-80 border mb-0.5
                                                                    ${hasConflict ? 'border-red-500/50' : 'border-transparent'}
                                                                    ${TYPE_COLORS[course.type] || 'bg-slate-600'}`}
                                                            >
                                                                <div className="font-bold text-white truncate">{course.code}</div>
                                                            </div>
                                                        ))
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

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div
                        className={`bg-slate-800 rounded-xl border-2 border-dashed p-8 max-w-md w-full mx-4 text-center transition
              ${isDragging ? 'border-blue-500' : 'border-slate-600'}`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                    >
                        {fileId ? (
                            <button
                                onClick={() => setShowUploadModal(false)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-white"
                            >×</button>
                        ) : null}

                        <div className="text-5xl mb-4">📁</div>
                        <h2 className="text-xl font-bold mb-2">Ders Programını Yükle</h2>
                        <p className="text-slate-400 mb-6">Excel dosyasını sürükle veya seç</p>

                        {isUploading ? (
                            <div className="text-blue-400">⏳ Yükleniyor...</div>
                        ) : (
                            <label className="cursor-pointer">
                                <span className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 inline-block">
                                    📤 Dosya Seç
                                </span>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                                    className="hidden"
                                />
                            </label>
                        )}

                        {fileId && (
                            <button
                                onClick={() => setShowUploadModal(false)}
                                className="mt-4 block w-full text-slate-400 hover:text-white"
                            >
                                Devam Et →
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Settings Panel */}
            {showSettings && (
                <div className="fixed top-16 right-4 bg-slate-800 rounded-xl border border-slate-600 p-4 w-72 shadow-2xl z-40">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold">⚙️ Ayarlar</h3>
                        <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">×</button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Algoritma</label>
                            <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)} className="w-full p-2 bg-slate-700 rounded text-sm">
                                <option value="dfs">DFS (Hızlı)</option>
                                <option value="genetic">Genetik</option>
                                <option value="astar">A*</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Max ECTS: {maxEcts}</label>
                            <input type="range" min="15" max="45" value={maxEcts} onChange={(e) => setMaxEcts(+e.target.value)} className="w-full accent-blue-500" />
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Çakışma Toleransı: {maxConflicts}</label>
                            <input type="range" min="0" max="3" value={maxConflicts} onChange={(e) => setMaxConflicts(+e.target.value)} className="w-full accent-orange-500" />
                        </div>
                    </div>
                </div>
            )}

            {/* Course Detail Modal */}
            {selectedCourse && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setSelectedCourse(null)}>
                    <div className="bg-slate-800 rounded-xl border border-slate-600 p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <span className={`px-2 py-1 rounded text-xs ${TYPE_COLORS[selectedCourse.type]}`}>
                                    {selectedCourse.type === 'lab' ? 'Lab' : selectedCourse.type === 'ps' ? 'PS' : 'Lecture'}
                                </span>
                                <h2 className="text-xl font-bold mt-2">{selectedCourse.code}</h2>
                                <p className="text-slate-400 text-sm">{selectedCourse.name}</p>
                            </div>
                            <button onClick={() => setSelectedCourse(null)} className="text-slate-400 hover:text-white text-xl">×</button>
                        </div>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-slate-400">ECTS:</span><span>{selectedCourse.ects}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">Hoca:</span><span>{selectedCourse.teacher || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">Saatler:</span><span>{selectedCourse.schedule?.map(s => `${DAY_ABBR[s[0]]}${s[1]}`).join(', ')}</span></div>
                        </div>

                        {/* Section Switcher */}
                        {getAlternativeSections(selectedCourse.main_code).length > 1 && (
                            <div className="mt-4 pt-4 border-t border-slate-600">
                                <h4 className="text-xs text-slate-400 mb-2">🔄 Section Değiştir</h4>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {getAlternativeSections(selectedCourse.main_code).map(alt => {
                                        const isActive = alt.code === selectedCourse.code;
                                        const hasConflict = sectionHasLockConflict(alt);
                                        return (
                                            <button
                                                key={alt.code}
                                                onClick={() => !hasConflict && switchSection(selectedCourse.main_code, alt)}
                                                disabled={hasConflict}
                                                className={`w-full text-left p-2 rounded text-xs transition
                                                    ${isActive ? 'bg-blue-600/30 border border-blue-500' : ''}
                                                    ${hasConflict ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700'}`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium">{alt.code}</span>
                                                    {hasConflict && <span className="text-red-400">🔒</span>}
                                                    {isActive && <span className="text-green-400">✓</span>}
                                                </div>
                                                <div className="text-slate-400">
                                                    {alt.schedule?.map(s => `${DAY_ABBR[s[0]]} ${PERIOD_TIMES[s[1] - 1]}`).join(', ')}
                                                </div>
                                                <div className="text-slate-500">{alt.teacher || '-'}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Remove button */}
                        <button
                            onClick={() => { toggleCourse(selectedCourse.main_code); setSelectedCourse(null); }}
                            className="w-full mt-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30"
                        >
                            🗑️ Dersi Kaldır
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
