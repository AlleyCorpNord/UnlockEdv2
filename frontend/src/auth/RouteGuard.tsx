import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { AUTHCALLBACK, hasFeature, useAuth } from '@/auth/useAuth';
import { FeatureAccess, INIT_KRATOS_LOGIN_FLOW, UserRole } from '@/types';
import { AuthProvider } from '@/auth/AuthProvider';
import { PageTitleProvider } from '@/contexts/PageTitleContext';
import { BreadcrumbProvider } from '@/contexts/BreadcrumbContext';
import { ToastProvider } from '@/contexts/ToastContext';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import type { RouteObject } from 'react-router-dom';
import Error from '@/pages/Error';

function RouteGuard({
    allowedRoles,
    features,
    featuresAny
}: {
    allowedRoles?: UserRole[];
    features?: FeatureAccess[];
    /** User must have at least one of these features (OR). */
    featuresAny?: FeatureAccess[];
}) {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) {
            window.location.href = INIT_KRATOS_LOGIN_FLOW;
        }
    }, [user]);

    if (!user) {
        return null;
    }
    const hasAnyRequiredFeature =
        !featuresAny ||
        featuresAny.some((f) => user.feature_access.includes(f));
    if (
        (allowedRoles && !allowedRoles.includes(user.role)) ||
        (features && !hasFeature(user, ...features)) ||
        !hasAnyRequiredFeature
    ) {
        return <Navigate to={AUTHCALLBACK} />;
    }
    return (
        <ToastProvider>
            <PageTitleProvider>
                <BreadcrumbProvider>
                    <AuthenticatedLayout />
                </BreadcrumbProvider>
            </PageTitleProvider>
        </ToastProvider>
    );
}

export function declareAuthenticatedRoutes(
    routes: RouteObject[],
    roles?: UserRole[],
    features?: FeatureAccess[],
    featuresAny?: FeatureAccess[]
): RouteObject {
    return {
        element: (
            <AuthProvider>
                <RouteGuard
                    allowedRoles={roles}
                    features={features}
                    featuresAny={featuresAny}
                />
            </AuthProvider>
        ),
        errorElement: <Error />,
        children: routes
    };
}
