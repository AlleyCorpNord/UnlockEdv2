import { useLayoutEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/auth/useAuth';
import type { TranscriptEntry } from '@/types/digital-transcript';
import { sortEntriesNewestFirst } from './transcriptEntrySessionStorage';
import { LearningRecordExportContent } from './LearningRecordExportContent';
import { learningRecordResidentDisplayName } from './learningRecordResidentName';

interface AchievementsRecordPreviewProps {
    rows: TranscriptEntry[];
    anchorId: string | null;
}

export function AchievementsRecordPreview({ rows, anchorId }: AchievementsRecordPreviewProps) {
    const { user } = useAuth();
    const residentName = learningRecordResidentDisplayName(user);
    const docRows = useMemo(() => sortEntriesNewestFirst(rows), [rows]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!anchorId || !scrollRef.current) return;
        const block = scrollRef.current.querySelector<HTMLElement>(
            `[data-achievement-id="${anchorId}"]`
        );
        block?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [anchorId, docRows.length]);

    return (
        <div
            data-slot="achievements-record-preview"
            className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-muted/30"
        >
            <div
                ref={scrollRef}
                data-slot="achievements-record-preview-scroll"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
                <LearningRecordExportContent
                    rows={docRows}
                    residentName={residentName}
                    anchorId={anchorId}
                />
            </div>
        </div>
    );
}
