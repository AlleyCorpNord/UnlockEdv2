import type { RouteObject } from 'react-router-dom';
import { declareAuthenticatedRoutes } from '@/auth/RouteGuard';
import { AdminRoles, AllRoles } from '@/auth/useAuth';
import { FeatureAccess, UserRole } from '@/types';
import { getStudentLayer2Data } from '@/loaders/routeLoaders';
import Error from '@/pages/Error';
import StudentDashboard from '@/pages/student/ResidentHome';
import MyCourses from '@/pages/learning/ResidentOverview';
import LearningInsights from '@/pages/insights/OperationalInsights';
import ProviderUserManagement from '@/pages/admin/ProviderUserManagement';
import ProviderPlatformManagement from '@/pages/admin/ProviderPlatformManagement';
import ProviderPlatformDetail from '@/pages/admin/ProviderPlatformDetail';

const routes: RouteObject = declareAuthenticatedRoutes(
    [
        {
            path: 'learning-path',
            element: <StudentDashboard />,
            loader: getStudentLayer2Data,
            handle: { title: 'Learning Path' }
        },
        {
            path: 'my-courses',
            element: <MyCourses />,
            handle: { title: 'My Courses' }
        },
    ],
    AllRoles,
    [FeatureAccess.ProviderAccess]
);

const adminRoutes: RouteObject = declareAuthenticatedRoutes(
    [
        {
            path: 'learning-insights',
            element: <LearningInsights />,
            errorElement: <Error />,
            handle: { title: 'Learning Insights' }
        },
        {
            path: 'provider-users/:id',
            element: <ProviderUserManagement />,
            handle: { title: 'Learning Platforms User Management' }
        },
    ],
    AdminRoles,
    [FeatureAccess.ProviderAccess]
);

const deptAdminRoutes: RouteObject = declareAuthenticatedRoutes(
    [
        {
            path: 'learning-platforms',
            handle: { title: 'Learning Platforms' },
            element: <ProviderPlatformManagement />,
            errorElement: <Error />
        },
        {
            path: 'learning-platforms/:id',
            handle: { title: 'Learning Platform' },
            element: <ProviderPlatformDetail />,
            errorElement: <Error />
        }
    ],
    [UserRole.DepartmentAdmin, UserRole.SystemAdmin],
    [FeatureAccess.ProviderAccess]
);

export const ProviderPlatformRoutes: RouteObject = {
    children: [routes, adminRoutes, deptAdminRoutes]
};
