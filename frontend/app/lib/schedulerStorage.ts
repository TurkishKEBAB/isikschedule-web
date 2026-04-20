export interface SchedulerSnapshot {
    fileId: string | null;
    sourceLabel?: string | null;
    selectedCourseCodes: string[];
    selectedMainCodes: string[];
    lockedSlots: string[];
    algorithm: string;
    maxEcts: number;
    maxConflicts: number;
}

export const SCHEDULER_STORAGE_KEY = 'isikschedule:scheduler:v1';

export function readSchedulerSnapshot(): SchedulerSnapshot | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(SCHEDULER_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as SchedulerSnapshot;
    } catch {
        return null;
    }
}

export function writeSchedulerSnapshot(snapshot: SchedulerSnapshot) {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(SCHEDULER_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
        // Ignore storage errors so the scheduler keeps working.
    }
}

export function clearSchedulerSnapshot() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(SCHEDULER_STORAGE_KEY);
}
