import { useMemo, useState, useEffect } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/auth/useAuth';
import {
    ServerResponseMany,
    ResidentProgramOverview,
    EnrollmentStatus,
    FacilityProgramClassEvent,
    ProgClassStatus
} from '@/types';
import { PageHeader, StatusBadge } from '@/components/shared';
import { formatDate } from '@/lib/formatters';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResidentComingUp } from '@/components/student/ResidentComingUp';
import {
    DEMO_RESIDENT_PROGRAM_ROWS,
    getDemoCalendarEvents
} from '@/pages/learning/residentProgramsDemoData';

function getEnrollmentStatusStyle(status?: EnrollmentStatus): string {
    switch (status) {
        case EnrollmentStatus.Enrolled:
            return 'bg-green-50 text-green-700 border-green-200';
        case EnrollmentStatus.Completed:
            return 'bg-blue-50 text-blue-700 border-blue-200';
        case EnrollmentStatus.Dropped:
            return 'bg-red-50 text-red-700 border-red-200';
        default:
            return 'bg-muted text-foreground border-border';
    }
}

function isActiveEnrollment(p: ResidentProgramOverview): boolean {
    if (
        p.status === ProgClassStatus.COMPLETED ||
        p.status === ProgClassStatus.CANCELLED
    ) {
        return false;
    }
    if (!p.enrollment_status) {
        return true;
    }
    return p.enrollment_status === EnrollmentStatus.Enrolled;
}

function groupByProgramId(rows: ResidentProgramOverview[]) {
    const map = new Map<number, ResidentProgramOverview[]>();
    for (const p of rows) {
        const list = map.get(p.program_id) ?? [];
        list.push(p);
        map.set(p.program_id, list);
    }
    return [...map.entries()].sort((a, b) =>
        (a[1][0]?.program_name ?? '').localeCompare(
            b[1][0]?.program_name ?? '',
            undefined,
            { sensitivity: 'base' }
        )
    );
}

export default function ResidentOverview({
    embedded = false
}: {
    embedded?: boolean;
}) {
    const { user } = useAuth();
    const [programTab, setProgramTab] = useState<'active' | 'archive'>(
        'active'
    );

    const startDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        d.setHours(0, 0, 0, 0);
        return d.toISOString();
    }, []);
    const endDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + 120);
        return d.toISOString();
    }, []);

    const timezone = user?.timezone ?? 'UTC';

    const { data: programsResp, isLoading: programsLoading } = useSWR<
        ServerResponseMany<ResidentProgramOverview>
    >(user ? `/api/users/${user.id}/programs` : null);

    const { data: eventsResp, isLoading: eventsLoading } = useSWR<
        ServerResponseMany<FacilityProgramClassEvent>
    >(
        user
            ? `/api/student-calendar?start_dt=${startDate}&end_dt=${endDate}`
            : null
    );

    const programs = programsResp?.data ?? [];
    const events = eventsResp?.data ?? [];

    const useDemoPrograms = !programsLoading && programs.length === 0;

    const programsForDisplay = useMemo(
        () => (useDemoPrograms ? DEMO_RESIDENT_PROGRAM_ROWS : programs),
        [useDemoPrograms, programs]
    );

    const eventsForDisplay = useMemo(
        () => (useDemoPrograms ? getDemoCalendarEvents() : events),
        [useDemoPrograms, events]
    );

    const activeRows = useMemo(
        () => programsForDisplay.filter(isActiveEnrollment),
        [programsForDisplay]
    );
    const archiveRows = useMemo(
        () => programsForDisplay.filter((p) => !isActiveEnrollment(p)),
        [programsForDisplay]
    );

    useEffect(() => {
        if (programsLoading || programs.length === 0) return;
        if (activeRows.length === 0 && archiveRows.length > 0) {
            setProgramTab('archive');
        }
    }, [programsLoading, programs.length, activeRows.length, archiveRows.length]);

    const calendarLoading = useDemoPrograms ? false : eventsLoading;

    const activeGroups = useMemo(
        () => groupByProgramId(activeRows),
        [activeRows]
    );
    const archiveGroups = useMemo(
        () => groupByProgramId(archiveRows),
        [archiveRows]
    );

    const activeClassIds = useMemo(
        () => new Set(activeRows.map((p) => p.class_id)),
        [activeRows]
    );

    const upcomingForActivePrograms = useMemo(() => {
        return eventsForDisplay.filter((e) => activeClassIds.has(e.class_id));
    }, [eventsForDisplay, activeClassIds]);

    if (!user) return null;

    const body = (
        <div className="space-y-6">
            {!embedded && (
                <PageHeader
                    title="My Programs"
                    subtitle="Active programs and classes first; open Archive for completed enrollments."
                />
            )}

            {programsLoading && (
                <p className="py-8 text-center text-muted-foreground">
                    Loading…
                </p>
            )}

            {!programsLoading && programsForDisplay.length > 0 && (
                <Tabs
                    value={programTab}
                    onValueChange={(v) =>
                        setProgramTab(v as 'active' | 'archive')
                    }
                    className="w-full gap-6"
                >
                    <TabsList className="w-fit">
                        <TabsTrigger value="active">Active</TabsTrigger>
                        <TabsTrigger value="archive">Archive</TabsTrigger>
                    </TabsList>

                    <TabsContent value="active" className="mt-0 space-y-8">
                        {activeRows.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                You have no active enrollments. Open{' '}
                                <button
                                    type="button"
                                    className="font-medium text-[#556830] underline-offset-2 hover:underline"
                                    onClick={() => setProgramTab('archive')}
                                >
                                    Archive
                                </button>{' '}
                                to see completed or past programs.
                            </p>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    {activeGroups.map(([programId, rows]) => (
                                        <Card
                                            key={programId}
                                            className="overflow-hidden border-border bg-card p-0 shadow-none"
                                        >
                                            <CardHeader className="border-b border-border pb-3">
                                                <CardTitle className="text-lg text-foreground">
                                                    {rows[0]?.program_name ??
                                                        'Program'}
                                                </CardTitle>
                                                <CardDescription>
                                                    Your classes and attendance
                                                    in this program.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="pt-4">
                                                <div className="overflow-x-auto rounded-lg border border-border">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="border-b border-border bg-muted/50">
                                                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                                                    Class
                                                                </th>
                                                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                                                    Schedule
                                                                </th>
                                                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                                                    Status
                                                                </th>
                                                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                                                    Attendance
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {rows.map(
                                                                (
                                                                    prog,
                                                                    idx
                                                                ) => (
                                                                    <tr
                                                                        key={`${prog.enrollment_id}-${idx}`}
                                                                        className="border-b border-border last:border-0 hover:bg-muted/40"
                                                                    >
                                                                        <td className="px-4 py-3 font-medium text-foreground">
                                                                            {
                                                                                prog.class_name
                                                                            }
                                                                        </td>
                                                                        <td className="px-4 py-3 text-muted-foreground">
                                                                            {prog.schedule?.trim()
                                                                                ? prog.schedule
                                                                                : '—'}
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <StatusBadge
                                                                                status={
                                                                                    prog.status
                                                                                }
                                                                                variant="progClass"
                                                                            />
                                                                        </td>
                                                                        <td className="px-4 py-3 text-muted-foreground">
                                                                            {prog.attendance_percentage !==
                                                                            undefined
                                                                                ? `${Math.round(prog.attendance_percentage)}%`
                                                                                : '—'}
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>

                                <ResidentComingUp
                                    events={upcomingForActivePrograms}
                                    timezone={timezone}
                                    isLoading={calendarLoading}
                                    subtitle="Upcoming class sessions for your active programs."
                                    emptyHint="No upcoming sessions on the schedule for your active classes in the next several weeks."
                                />
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="archive" className="mt-0 space-y-6">
                        {archiveRows.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No archived or completed enrollments.
                            </p>
                        ) : (
                            archiveGroups.map(([programId, rows]) => (
                                <Card
                                    key={programId}
                                    className="overflow-hidden border-border bg-card p-0 shadow-none"
                                >
                                    <CardHeader className="border-b border-border pb-3">
                                        <CardTitle className="text-lg text-foreground">
                                            {rows[0]?.program_name ?? 'Program'}
                                        </CardTitle>
                                        <CardDescription>
                                            Completed or inactive enrollment
                                            records.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        <div className="overflow-x-auto rounded-lg border border-border">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-border bg-muted/50">
                                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                                            Class
                                                        </th>
                                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                                            Enrollment
                                                        </th>
                                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                                            Start
                                                        </th>
                                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                                            End
                                                        </th>
                                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                                            Attendance
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rows.map((prog, idx) => (
                                                        <tr
                                                            key={`${prog.enrollment_id}-${idx}`}
                                                            className="border-b border-border last:border-0 hover:bg-muted/40"
                                                        >
                                                            <td className="px-4 py-3 font-medium text-foreground">
                                                                {prog.class_name}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {prog.enrollment_status && (
                                                                    <StatusBadge
                                                                        status={
                                                                            prog.enrollment_status
                                                                        }
                                                                        className={getEnrollmentStatusStyle(
                                                                            prog.enrollment_status
                                                                        )}
                                                                    />
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-muted-foreground">
                                                                {formatDate(
                                                                    prog.start_date
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-muted-foreground">
                                                                {prog.end_date
                                                                    ? formatDate(
                                                                          prog.end_date
                                                                      )
                                                                    : '—'}
                                                            </td>
                                                            <td className="px-4 py-3 text-muted-foreground">
                                                                {prog.attendance_percentage !==
                                                                undefined
                                                                    ? `${Math.round(prog.attendance_percentage)}%`
                                                                    : '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );

    if (embedded) {
        return body;
    }

    return (
        <div className="bg-muted min-h-screen p-6">
            <div className="mx-auto max-w-7xl space-y-6">{body}</div>
        </div>
    );
}
