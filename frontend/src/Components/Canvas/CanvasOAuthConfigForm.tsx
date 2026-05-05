import { useState, useEffect } from 'react';
import API from '@/api/api';
import { useAuth } from '@/useAuth';
import { useToast } from '@/Context/ToastCtx';
import { ToastState, ServerResponseOne } from '@/common';

interface CanvasConfig {
    facility_id: string;
    client_id: string;
    configured?: boolean;
    updated_at?: string;
}

export default function CanvasOAuthConfigForm() {
    const { user } = useAuth();
    const { toaster } = useToast();
    const [clientID, setClientID] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingConfig, setIsCheckingConfig] = useState(true);
    const [hasConfig, setHasConfig] = useState(false);

    // Load existing config on mount
    useEffect(() => {
        if (!user) return;

        const fetchConfig = async () => {
            try {
                const response = (await API.get<CanvasConfig>(
                    'canvas/config'
                )) as ServerResponseOne<CanvasConfig>;
                if (response.success && response.data?.configured) {
                    setHasConfig(true);
                }
            } catch (err) {
                console.error('Error fetching config:', err);
            } finally {
                setIsCheckingConfig(false);
            }
        };

        void fetchConfig();
    }, [user]);

    const handleSaveConfig = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();

        if (!clientID.trim() || !clientSecret.trim()) {
            toaster('Client ID and Secret are required', ToastState.error);
            return;
        }

        setIsLoading(true);
        try {
            const response = (await API.post('canvas/config', {
                client_id: clientID,
                client_secret: clientSecret
            })) as ServerResponseOne<CanvasConfig>;

            if (response.success) {
                toaster(
                    'Canvas OAuth credentials configured successfully',
                    ToastState.success
                );
                setClientID('');
                setClientSecret('');
                setHasConfig(true);
            } else {
                toaster(
                    response.message ?? 'Failed to save Canvas credentials',
                    ToastState.error
                );
            }
        } catch (err) {
            toaster(
                err instanceof Error
                    ? err.message
                    : 'Error saving Canvas credentials',
                ToastState.error
            );
        } finally {
            setIsLoading(false);
        }
    };

    if (isCheckingConfig) {
        return <div className="text-center py-4">Loading configuration...</div>;
    }

    return (
        <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
            <h3 className="text-lg font-semibold mb-4">
                Canvas OAuth Configuration
            </h3>

            {hasConfig && (
                <div className="alert alert-success mb-4">
                    <div>
                        <h4 className="font-semibold">Configured</h4>
                        <p>
                            Your Canvas OAuth credentials are configured. You
                            can update them using the form below.
                        </p>
                    </div>
                </div>
            )}

            <form
                onSubmit={(e) => void handleSaveConfig(e)}
                className="space-y-4"
            >
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Canvas Client ID
                    </label>
                    <input
                        type="text"
                        value={clientID}
                        onChange={(e) => setClientID(e.target.value)}
                        placeholder="Enter your Canvas OAuth Client ID"
                        className="input input-bordered w-full"
                        disabled={isLoading}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        From Canvas Settings → Developer Keys
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">
                        Canvas Client Secret
                    </label>
                    <input
                        type="password"
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                        placeholder="Enter your Canvas OAuth Client Secret"
                        className="input input-bordered w-full"
                        disabled={isLoading}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        Keep this secret! Never share it publicly.
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="btn btn-primary w-full"
                >
                    {isLoading ? 'Saving...' : 'Save Configuration'}
                </button>
            </form>
        </div>
    );
}
