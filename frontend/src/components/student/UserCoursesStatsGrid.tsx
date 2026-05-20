import type { ReactNode } from 'react';
import type { UserCoursesInfo } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, CheckCircle, Clock } from 'lucide-react';

function StatCard({
    icon,
    title,
    value,
    label
}: {
    icon: ReactNode;
    title: string;
    value: string;
    label: string;
}) {
    return (
        <Card>
            <CardContent className="flex items-start gap-4 p-5">
                <div className="shrink-0 rounded-lg bg-muted p-2.5">{icon}</div>
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {title}
                    </p>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                </div>
            </CardContent>
        </Card>
    );
}

/** Total time, completed count, and in-progress count. */
export function UserCoursesStatsGrid({ summary }: { summary: UserCoursesInfo }) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
                icon={<Clock className="size-5 text-[#556830]" />}
                title="Total Time"
                value={Math.floor(summary.total_time / 3600).toString()}
                label="hours"
            />
            <StatCard
                icon={<CheckCircle className="size-5 text-[#556830]" />}
                title="Completed"
                value={summary.num_completed.toString()}
                label="courses"
            />
            <StatCard
                icon={<BookOpen className="size-5 text-[#556830]" />}
                title="In Progress"
                value={summary.num_in_progress.toString()}
                label="courses"
            />
        </div>
    );
}
