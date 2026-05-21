import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    /** Merged onto the outer row (e.g. `mb-8` to match Knowledge Center hero rhythm). */
    className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
    return (
        <div className={cn('flex items-center justify-between', className)}>
            <div>
                <h1 className="text-[#203622] mb-2 dark:text-foreground">{title}</h1>
                {subtitle && (
                    <p className="text-gray-600 dark:text-muted-foreground mt-1">
                        {subtitle}
                    </p>
                )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    );
}
