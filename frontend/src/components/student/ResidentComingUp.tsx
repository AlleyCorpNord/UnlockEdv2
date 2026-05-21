import { useMemo } from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { FacilityProgramClassEvent } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const UPCOMING_HORIZON_DAYS = 56;

function sessionTimeRange(start: Date, end: Date) {
    const opts: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit'
    };
    return `${start.toLocaleTimeString(undefined, opts)} – ${end.toLocaleTimeString(undefined, opts)}`;
}

function dayParts(zoned: Date) {
    return {
        dayNum: format(zoned, 'd'),
        month: format(zoned, 'MMM'),
        weekday: format(zoned, 'EEE')
    };
}

export function ResidentComingUp({
    events,
    timezone,
    isLoading,
    emptyHint,
    subtitle
}: {
    events: FacilityProgramClassEvent[];
    timezone: string;
    isLoading: boolean;
    /** Shown when there are no upcoming sessions (after loading). */
    emptyHint?: string;
    /** Card subtitle under "Coming up". */
    subtitle?: string;
}) {
    const groupedDays = useMemo(() => {
        const now = new Date();
        const horizon = new Date(now);
        horizon.setDate(horizon.getDate() + UPCOMING_HORIZON_DAYS);

        const upcoming = events.filter((e) => {
            const start = new Date(e.start);
            const end = new Date(e.end);
            if (end < now) return false;
            if (start > horizon) return false;
            return true;
        });

        upcoming.sort(
            (a, b) =>
                new Date(a.start).getTime() - new Date(b.start).getTime()
        );

        const dayMap = new Map<string, FacilityProgramClassEvent[]>();
        for (const e of upcoming) {
            const zoned = toZonedTime(new Date(e.start), timezone);
            const key = format(zoned, 'yyyy-MM-dd');
            const list = dayMap.get(key) ?? [];
            list.push(e);
            dayMap.set(key, list);
        }

        const sortedKeys = Array.from(dayMap.keys()).sort();
        return sortedKeys.map((key) => ({
            key,
            zoned: toZonedTime(new Date(dayMap.get(key)![0].start), timezone),
            events: dayMap.get(key)!
        }));
    }, [events, timezone]);

    const todayKey = format(toZonedTime(new Date(), timezone), 'yyyy-MM-dd');

    if (isLoading) {
        return (
            <Card className="overflow-hidden border-border bg-card p-0 shadow-none">
                <CardHeader className="border-b border-border pb-4">
                    <CardTitle className="font-serif text-xl text-foreground">
                        Coming up
                    </CardTitle>
                    <CardDescription>
                        {subtitle ??
                            'Scheduled sessions from your program classes'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (groupedDays.length === 0) {
        return (
            <Card className="overflow-hidden border-border bg-card p-0 shadow-none">
                <CardHeader className="border-b border-border pb-4">
                    <CardTitle className="font-serif text-xl text-foreground">
                        Coming up
                    </CardTitle>
                    <CardDescription>
                        {subtitle ??
                            'Scheduled sessions from your program classes'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">
                        {emptyHint ??
                            'No upcoming sessions in the next few weeks. When your facility schedules classes, they will appear here.'}
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden border-border bg-card p-0 shadow-none">
            <CardHeader className="border-b border-border pb-4">
                <CardTitle className="font-serif text-xl text-foreground">
                    Coming up
                </CardTitle>
                <CardDescription>
                    {subtitle ??
                        'Scheduled sessions from your program classes'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 pt-2">
                {groupedDays.map(({ key, zoned, events: dayEvents }, idx) => {
                    const { dayNum, month, weekday } = dayParts(zoned);
                    const isToday = key === todayKey;

                    return (
                        <div key={key}>
                            {idx > 0 && (
                                <div
                                    className="my-6 border-t border-dashed border-border"
                                    aria-hidden
                                />
                            )}
                            <div className="flex gap-6 py-2">
                                <div className="flex w-[4.5rem] shrink-0 flex-col items-end text-right">
                                    <span className="text-2xl font-semibold leading-none text-foreground tabular-nums">
                                        {dayNum}
                                    </span>
                                    <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                        {isToday && (
                                            <span
                                                className="inline-block size-1.5 rounded-full bg-destructive"
                                                title="Today"
                                            />
                                        )}
                                        <span>{month}</span>
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {weekday}
                                    </span>
                                </div>
                                <div className="min-w-0 flex-1 space-y-4">
                                    {dayEvents.map((ev) => {
                                        const start = toZonedTime(
                                            new Date(ev.start),
                                            timezone
                                        );
                                        const end = toZonedTime(
                                            new Date(ev.end),
                                            timezone
                                        );
                                        const clock = new Date();
                                        const inProgress =
                                            clock >= new Date(ev.start) &&
                                            clock <= new Date(ev.end);

                                        return (
                                            <div
                                                key={`${ev.id}-${String(ev.start)}`}
                                                className="flex gap-3"
                                            >
                                                <div
                                                    className={cn(
                                                        'w-1 shrink-0 rounded-full',
                                                        ev.is_cancelled
                                                            ? 'bg-muted-foreground/40'
                                                            : 'bg-[#556830]'
                                                    )}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div
                                                        className={cn(
                                                            'font-medium text-foreground',
                                                            ev.is_cancelled &&
                                                                'text-muted-foreground line-through'
                                                        )}
                                                    >
                                                        {ev.title}
                                                    </div>
                                                    <div className="mt-0.5 text-sm text-muted-foreground">
                                                        <span className="text-foreground/80">
                                                            {ev.program_name}
                                                        </span>
                                                        {ev.frequency ? (
                                                            <span>
                                                                {' '}
                                                                · {ev.frequency}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="mt-1 text-sm text-muted-foreground">
                                                        {inProgress && (
                                                            <span className="font-medium text-[#556830]">
                                                                Now ·{' '}
                                                            </span>
                                                        )}
                                                        {sessionTimeRange(
                                                            start,
                                                            end
                                                        )}
                                                        {ev.room ? (
                                                            <span>
                                                                {' '}
                                                                · {ev.room}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {ev.is_cancelled && (
                                                        <span className="mt-1 inline-block text-xs font-medium text-muted-foreground">
                                                            Cancelled
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
