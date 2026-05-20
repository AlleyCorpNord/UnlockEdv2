import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TranscriptEntry } from '@/types/digital-transcript';
import { cn } from '@/lib/utils';

interface AchievementFormMetadataProps {
    entry: TranscriptEntry;
    onChange: (patch: Partial<TranscriptEntry>) => void;
    showDoneErrors: boolean;
    /** When true, adds a bottom border to separate metadata from reflection sections. */
    showSectionDivider?: boolean;
}

export function AchievementFormMetadata({
    entry,
    onChange,
    showDoneErrors,
    showSectionDivider = false
}: AchievementFormMetadataProps) {
    const programOk = Boolean(entry.programName.trim());
    const dateOk = Boolean(entry.completionDate.trim());

    return (
        <div
            data-slot="achievement-form-metadata"
            className={cn('space-y-4', showSectionDivider && 'border-b border-border/70 pb-6')}
        >
            <div className="space-y-2">
                <Label htmlFor={`ach-program-${entry.id}`}>Program name</Label>
                <Input
                    id={`ach-program-${entry.id}`}
                    data-slot="transcript-program-name"
                    value={entry.programName}
                    onChange={(e) => onChange({ programName: e.target.value })}
                    placeholder="e.g. GED prep, welding fundamentals"
                    aria-invalid={showDoneErrors && !programOk}
                    className="h-10 border-border/80 bg-muted/40"
                />
                {showDoneErrors && !programOk ? (
                    <p className="text-sm text-destructive" role="alert">
                        Add a program or course name to continue.
                    </p>
                ) : null}
            </div>

            <div className="space-y-2">
                <Label htmlFor={`ach-date-${entry.id}`}>Completion date</Label>
                <Input
                    id={`ach-date-${entry.id}`}
                    type="date"
                    data-slot="transcript-completion-date"
                    value={entry.completionDate}
                    onChange={(e) => onChange({ completionDate: e.target.value })}
                    aria-invalid={showDoneErrors && !dateOk}
                    className="h-10 border-border/80 bg-muted/40"
                />
                {showDoneErrors && !dateOk ? (
                    <p className="text-sm text-destructive" role="alert">
                        Add a completion date to continue.
                    </p>
                ) : null}
            </div>
        </div>
    );
}
