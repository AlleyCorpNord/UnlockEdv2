import { NavLink, Outlet } from 'react-router-dom';
import { useAuth, hasFeature } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import { PageHeader } from '@/components/shared';
import { cn } from '@/lib/utils';

function programsTabClassName(isActive: boolean) {
    return cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isActive
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
    );
}

export default function ResidentProgramsLayout() {
    const { user } = useAuth();

    if (!user) return null;

    const hasProgram = hasFeature(user, FeatureAccess.ProgramAccess);
    const hasProvider = hasFeature(user, FeatureAccess.ProviderAccess);
    const showTabs = hasProgram && hasProvider;

    const subtitle = hasProgram
        ? hasProvider
            ? 'Upcoming class sessions and enrollments, plus your online courses.'
            : 'Upcoming class sessions, enrollments, and attendance for your programs.'
        : 'Your online course enrollments and progress.';

    return (
        <div className="bg-canvas min-h-screen p-6">
            <div className="mx-auto max-w-7xl space-y-6">
                <PageHeader title="Programs" subtitle={subtitle} />

                {showTabs && (
                    <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
                        <NavLink
                            to="/resident-programs"
                            end
                            className={({ isActive }) =>
                                programsTabClassName(isActive)
                            }
                        >
                            Programs & schedule
                        </NavLink>
                        <NavLink
                            to="/resident-programs/online-courses"
                            className={({ isActive }) =>
                                programsTabClassName(isActive)
                            }
                        >
                            Online courses
                        </NavLink>
                    </div>
                )}

                <Outlet />
            </div>
        </div>
    );
}
