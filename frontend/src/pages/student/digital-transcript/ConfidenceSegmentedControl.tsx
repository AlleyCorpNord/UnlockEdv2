import { useCallback, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { CONFIDENCE_RADIO_OPTIONS } from './transcriptReflectionConfig';

/** Visual tier per 1–5 scale (solid selected, muted unselected — same hue family). */
const LEVEL_VISUAL = [
    {
        solid: 'bg-red-600 dark:bg-red-500',
        muted: 'bg-red-500/20 dark:bg-red-500/15',
        label: 'text-red-700 dark:text-red-400'
    },
    {
        solid: 'bg-orange-600 dark:bg-orange-500',
        muted: 'bg-orange-500/25 dark:bg-orange-500/15',
        label: 'text-orange-800 dark:text-orange-400'
    },
    {
        solid: 'bg-amber-500 dark:bg-amber-400',
        muted: 'bg-amber-400/25 dark:bg-amber-400/15',
        label: 'text-amber-900 dark:text-amber-300'
    },
    {
        solid: 'bg-lime-600 dark:bg-lime-500',
        muted: 'bg-lime-500/25 dark:bg-lime-500/15',
        label: 'text-lime-900 dark:text-lime-400'
    },
    {
        solid: 'bg-emerald-600 dark:bg-emerald-500',
        muted: 'bg-emerald-500/20 dark:bg-emerald-500/15',
        label: 'text-emerald-900 dark:text-emerald-400'
    }
] as const;

interface ConfidenceSegmentedControlProps {
    value: string;
    onChange: (next: string) => void;
    /** Matches section `aria-labelledby` for the question text. */
    labelledBy: string;
}

export function ConfidenceSegmentedControl({ value, onChange, labelledBy }: ConfidenceSegmentedControlProps) {
    const selectedNum = /^[1-5]$/.test(value) ? Number(value) : 0;
    const palette = selectedNum > 0 ? LEVEL_VISUAL[selectedNum - 1] : null;
    const selectedLabel =
        selectedNum > 0 ? CONFIDENCE_RADIO_OPTIONS[selectedNum - 1][1] : 'Choose below';

    const move = useCallback(
        (delta: number) => {
            let next: number;
            if (!selectedNum) {
                next = delta > 0 ? 1 : 5;
            } else {
                next = Math.min(5, Math.max(1, selectedNum + delta));
            }
            onChange(String(next));
        },
        [onChange, selectedNum]
    );

    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            move(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            move(-1);
        } else if (e.key >= '1' && e.key <= '5') {
            e.preventDefault();
            onChange(e.key);
        }
    }

    return (
        <div
            data-slot="transcript-confidence-segments"
            role="radiogroup"
            aria-labelledby={labelledBy}
            className="space-y-2"
            onKeyDown={onKeyDown}
        >
            <p
                className={cn(
                    'text-sm font-semibold transition-colors',
                    palette ? palette.label : 'text-muted-foreground'
                )}
                aria-live="polite"
            >
                Confidence — {selectedLabel}
            </p>

            <div
                className={cn(
                    'flex h-11 w-full overflow-hidden rounded-lg border border-gray-200/90 shadow-inner',
                    'ring-1 ring-black/[0.04] dark:border-slate-600 dark:ring-white/[0.06]'
                )}
            >
                {CONFIDENCE_RADIO_OPTIONS.map(([val], index) => {
                    const n = index + 1;
                    const isSelected = value === val;
                    const bgClass =
                        palette === null
                            ? 'bg-muted/70 hover:bg-muted dark:bg-slate-800/80 dark:hover:bg-slate-700/80'
                            : isSelected
                              ? palette.solid
                              : palette.muted;

                    return (
                        <button
                            key={val}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            tabIndex={isSelected ? 0 : !value && n === 1 ? 0 : -1}
                            data-slot={`transcript-confidence-seg-${val}`}
                            className={cn(
                                'relative min-h-11 min-w-0 flex-1 cursor-pointer transition-colors',
                                'focus-visible:z-[2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                                'border-r border-black/10 last:border-r-0 dark:border-white/10',
                                bgClass
                            )}
                            onClick={() => onChange(val)}
                        >
                            <span className="sr-only">
                                {CONFIDENCE_RADIO_OPTIONS[index][1]}
                                {isSelected ? ', selected' : ''}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
