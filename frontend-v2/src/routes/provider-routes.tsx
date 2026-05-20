import { type RouteObject, Navigate } from 'react-router-dom';
import { declareAuthenticatedRoutes } from '@/auth/RouteGuard';
import { AdminRoles, AllRoles } from '@/auth/useAuth';
import { FeatureAccess, UserRole } from '@/types';
import Error from '@/pages/Error';
import CourseCatalog from '@/pages/learning/CourseCatalog';
import LearningInsights from '@/pages/insights/LearningInsights';
import ProviderUserManagement from '@/pages/admin/ProviderUserManagement';
import ProviderPlatformManagement from '@/pages/admin/ProviderPlatformManagement';

const routes: RouteObject = declareAuthenticatedRoutes(
    [
        {
            path: 'my-courses',
            element: (
                <Navigate to="/resident-programs/online-courses" replace />
            )
        },
        {
            path: 'course-catalog',
            element: <CourseCatalog />,
            handle: { title: 'Course Catalog' }
        }
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
        {
            path: 'course-catalog-admin',
            element: <CourseCatalog />,
            handle: { title: 'Course Catalog' }
        }
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
        }
    ],
    [UserRole.DepartmentAdmin, UserRole.SystemAdmin],
    [FeatureAccess.ProviderAccess]
);

export const ProviderPlatformRoutes: RouteObject = {
    children: [routes, adminRoutes, deptAdminRoutes]
};
