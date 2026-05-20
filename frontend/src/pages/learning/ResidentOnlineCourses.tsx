import { Navigate } from 'react-router-dom';
import { useAuth, hasFeature } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import MyCourses from '@/pages/learning/MyCourses';

export default function ResidentOnlineCourses() {
    const { user } = useAuth();

    if (!user) return null;

    if (!hasFeature(user, FeatureAccess.ProviderAccess)) {
        return <Navigate to="/resident-programs" replace />;
    }

    return <MyCourses embedded />;
}
