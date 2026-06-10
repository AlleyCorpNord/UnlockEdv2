import { Navigate } from 'react-router-dom';
import { useAuth, hasFeature } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import ResidentOverview from '@/pages/learning/ResidentOverview';

export default function ResidentProgramsIndex() {
    const { user } = useAuth();

    if (!user) return null;

    const hasProgram = hasFeature(user, FeatureAccess.ProgramAccess);
    const hasProvider = hasFeature(user, FeatureAccess.ProviderAccess);

    if (!hasProgram && hasProvider) {
        return <Navigate to="/resident-programs/online-courses" replace />;
    }

    return <ResidentOverview embedded />;
}
