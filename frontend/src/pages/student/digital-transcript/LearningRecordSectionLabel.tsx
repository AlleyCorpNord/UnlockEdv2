import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Scan and narrative section labels — 11px sentence case, document rhythm. */
export function LearningRecordSectionLabel({
    id,
    children,
    className
}: {
    id: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <h3
            id={id}
            data-section-label
            className={cn(
                'text-[11px] font-semibold tracking-[0.08em] text-muted-foreground',
                className
            )}
        >
            {children}
        </h3>
    );
}
