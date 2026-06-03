import type { TranscriptEntry } from '@/types/digital-transcript';

export function formatCompletionDateLong(dateStr: string): string | null {
    if (!dateStr.trim()) return null;
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

export function formatCompletionDateTable(dateStr: string): string {
    if (!dateStr.trim()) return '—';
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

export function completionDateSortKey(entry: TranscriptEntry): number | null {
    const raw = entry.completionDate.trim();
    if (!raw) return null;
    const time = new Date(`${raw}T12:00:00`).getTime();
    return Number.isNaN(time) ? null : time;
}
