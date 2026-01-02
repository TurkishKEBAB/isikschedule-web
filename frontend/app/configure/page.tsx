'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface Course {
    code: string;
    main_code: string;
    name: string;
    ects: number;
    type: string;
    teacher: string | null;
    faculty: string;
    schedule_str: string;
}

interface CourseGroup {
    main_code: string;
    name: string;
    ects: number;
    faculty: string;
    section_count: number;
    has_lab: boolean;
    has_ps: boolean;
}

const ALGORITHMS = [
    { id: 'dfs', name: 'DFS (Depth-First Search)', description: 'Hızlı, basit arama' },
    { id: 'bfs', name: 'BFS (Breadth-First Search)', description: 'Kapsamlı arama' },
    { id: 'genetic', name: 'Genetic Algorithm', description: 'Evrimsel optimizasyon' },
    { id: 'astar', name: 'A* Search', description: 'Akıllı buluşsal arama' },
];

export default function ConfigurePage() {
    const searchParams = useSearchParams();
    const fileId = searchParams.get('file_id');

    const [courses, setCourses] = useState<Course[]>([]);
    const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([]);
    const [selectedMainCodes, setSelectedMainCodes] = useState<Set<string>>(new Set());
    const [algorithm, setAlgorithm] = useState('dfs');
    const [maxEcts, setMaxEcts] = useState(30);
    const [maxConflicts, setMaxConflicts] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch courses on mount
    useEffect(() => {
        if (!fileId) {
            setError('Dosya ID bulunamadı. Lütfen önce bir dosya yükleyin.');
            setIsLoading(false);
            return;
        }

        fetch(`http://localhost:8000/api/upload/${fileId}/courses`)
            .then(res => res.json())
            .then(data => {
                const allCourses = data.courses || [];
                setCourses(allCourses);

                // Group courses by main_code
                const groups: Record<string, CourseGroup> = {};
                allCourses.forEach((course: Course) => {
                    if (!groups[course.main_code]) {
                        groups[course.main_code] = {
                            main_code: course.main_code,
                            name: course.name,
                            ects: course.ects,
                            faculty: course.faculty,
                            section_count: 0,
                            has_lab: false,
                            has_ps: false,
                        };
                    }
                    groups[course.main_code].section_count++;
                    if (course.type === 'lab') groups[course.main_code].has_lab = true;
                    if (course.type === 'ps') groups[course.main_code].has_ps = true;
                });

                setCourseGroups(Object.values(groups));
                setIsLoading(false);
            })
            .catch(err => {
                setError('Dersler yüklenemedi. Backend çalışıyor mu?');
                setIsLoading(false);
            });
    }, [fileId]);

    const toggleCourse = (mainCode: string) => {
        const newSelected = new Set(selectedMainCodes);
        if (newSelected.has(mainCode)) {
            newSelected.delete(mainCode);
        } else {
            newSelected.add(mainCode);
        }
        setSelectedMainCodes(newSelected);
    };

    const selectAll = () => {
        setSelectedMainCodes(new Set(courseGroups.map(g => g.main_code)));
    };

    const deselectAll = () => {
        setSelectedMainCodes(new Set());
    };

    // Calculate selected ECTS
    const selectedEcts = courseGroups
        .filter(g => selectedMainCodes.has(g.main_code))
        .reduce((sum, g) => sum + g.ects, 0);

    // Filter courses by search
    const filteredGroups = courseGroups.filter(g =>
        g.main_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleGenerate = async () => {
        if (selectedMainCodes.size === 0) {
            setError('En az bir ders seçmelisiniz');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const response = await fetch('http://localhost:8000/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_id: fileId,
                    selected_main_codes: Array.from(selectedMainCodes),
                    algorithm: algorithm,
                    params: { max_ects: maxEcts, max_conflicts: maxConflicts }
                }),
            });

            if (!response.ok) throw new Error('Generation failed');

            const result = await response.json();
            window.location.href = `/results?job_id=${result.job_id}&file_id=${fileId}`;
        } catch (err) {
            setError('Program oluşturulurken bir hata oluştu');
            setIsGenerating(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin text-4xl mb-4">⏳</div>
                    <p className="text-gray-600">Dersler yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-isik-blue text-white py-4 px-6 shadow-lg">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <Link href="/" className="text-2xl font-bold">🎓 IşıkSchedule</Link>
                </div>
            </header>

            <div className="max-w-6xl mx-auto py-8 px-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">⚙️ Ders Seçimi</h1>
                <p className="text-gray-600 mb-8">
                    Almak istediğiniz dersleri seçin. Algoritma otomatik olarak en uygun section'ları bulacak.
                </p>

                {error && (
                    <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                        ⚠️ {error}
                    </div>
                )}

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Course Selection */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            {/* Header with stats */}
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">
                                        📚 Dersler
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {selectedMainCodes.size} ders seçildi | {selectedEcts} ECTS
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={selectAll} className="text-sm text-isik-blue hover:underline">
                                        Tümünü Seç
                                    </button>
                                    <span className="text-gray-400">|</span>
                                    <button onClick={deselectAll} className="text-sm text-red-500 hover:underline">
                                        Tümünü Kaldır
                                    </button>
                                </div>
                            </div>

                            {/* Search */}
                            <input
                                type="text"
                                placeholder="🔍 Ders ara (kod veya isim)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full p-3 border rounded-lg mb-4 focus:ring-2 focus:ring-isik-blue focus:border-transparent"
                            />

                            {/* Course List */}
                            <div className="max-h-[500px] overflow-y-auto space-y-2">
                                {filteredGroups.map(group => (
                                    <label
                                        key={group.main_code}
                                        className={`
                      flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition
                      ${selectedMainCodes.has(group.main_code)
                                                ? 'bg-blue-50 border-isik-blue'
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }
                    `}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedMainCodes.has(group.main_code)}
                                            onChange={() => toggleCourse(group.main_code)}
                                            className="w-5 h-5 text-isik-blue rounded"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-800">{group.main_code}</span>
                                                <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                                                    {group.ects} ECTS
                                                </span>
                                                {group.has_lab && (
                                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                                        Lab
                                                    </span>
                                                )}
                                                {group.has_ps && (
                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                                        PS
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 truncate">{group.name}</p>
                                            <p className="text-xs text-gray-400">
                                                {group.section_count} section • {group.faculty}
                                            </p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Algorithm Settings */}
                    <div className="space-y-6">
                        {/* Selected Summary */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">📊 Özet</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Seçilen Ders</span>
                                    <span className="font-bold">{selectedMainCodes.size}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Toplam ECTS</span>
                                    <span className={`font-bold ${selectedEcts > maxEcts ? 'text-red-500' : 'text-green-600'}`}>
                                        {selectedEcts}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">ECTS Limiti</span>
                                    <span className="font-bold">{maxEcts}</span>
                                </div>
                            </div>
                            {selectedEcts > maxEcts && (
                                <div className="mt-3 text-xs text-red-500">
                                    ⚠️ Seçilen ECTS limiti aşıyor. Algoritma alt kümeler oluşturacak.
                                </div>
                            )}
                        </div>

                        {/* Algorithm Selection */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">🧠 Algoritma</h2>
                            <div className="space-y-2">
                                {ALGORITHMS.map(algo => (
                                    <label
                                        key={algo.id}
                                        className={`
                      block p-3 rounded-lg border cursor-pointer transition
                      ${algorithm === algo.id
                                                ? 'border-isik-blue bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }
                    `}
                                    >
                                        <input
                                            type="radio"
                                            name="algorithm"
                                            value={algo.id}
                                            checked={algorithm === algo.id}
                                            onChange={(e) => setAlgorithm(e.target.value)}
                                            className="hidden"
                                        />
                                        <div className="font-medium">{algo.name}</div>
                                        <div className="text-xs text-gray-500">{algo.description}</div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Parameters */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">⚡ ECTS Limiti</h2>
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm text-gray-600">Maksimum ECTS</span>
                                    <span className="font-bold text-isik-blue">{maxEcts}</span>
                                </div>
                                <input
                                    type="range"
                                    min="15"
                                    max="45"
                                    value={maxEcts}
                                    onChange={(e) => setMaxEcts(parseInt(e.target.value))}
                                    className="w-full accent-isik-blue"
                                />
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>15</span>
                                    <span>30</span>
                                    <span>45</span>
                                </div>
                            </div>
                        </div>

                        {/* Conflict Tolerance */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">⚠️ Çakışma Toleransı</h2>
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm text-gray-600">İzin Verilen Çakışma</span>
                                    <span className="font-bold text-orange-500">{maxConflicts}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="3"
                                    value={maxConflicts}
                                    onChange={(e) => setMaxConflicts(parseInt(e.target.value))}
                                    className="w-full accent-orange-500"
                                />
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>0 (Hiç)</span>
                                    <span>1</span>
                                    <span>2</span>
                                    <span>3</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    {maxConflicts === 0 ? '🟢 Çakışma yok' :
                                        maxConflicts === 1 ? '🟡 Normal dönem için' :
                                            '🔴 Yaz okulu için'}
                                </p>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || selectedMainCodes.size === 0}
                            className={`
                w-full py-4 rounded-xl text-lg font-bold transition shadow-lg
                ${isGenerating || selectedMainCodes.size === 0
                                    ? 'bg-gray-400 cursor-not-allowed text-white'
                                    : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
                                }
              `}
                        >
                            {isGenerating ? '⏳ Oluşturuluyor...' : '🚀 Program Oluştur'}
                        </button>

                        <p className="text-xs text-center text-gray-500">
                            Algoritma seçtiğiniz derslerin tüm section'larını değerlendirecek
                            ve en uygun kombinasyonları bulacak.
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
