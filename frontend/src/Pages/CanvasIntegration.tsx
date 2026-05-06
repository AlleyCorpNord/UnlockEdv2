import { useRef, useState } from 'react';
import useSWR from 'swr';
import API from '@/api/api';
import { useAuth, hasFeature } from '@/useAuth';
import { useToast } from '@/Context/ToastCtx';
import { ConnectCanvasModal, showModal } from '@/Components/modals';
import { AddButton } from '@/Components/inputs';
import CanvasConnectionCard from '@/Components/Canvas/CanvasConnectionCard';
import {
    CanvasConnection,
    ToastState,
    ServerResponseMany,
    FeatureAccess
} from '@/common';

export default function CanvasIntegration() {
    const { user } = useAuth();
    const { toaster } = useToast();
    const connectModalRef = useRef<HTMLDialogElement>(null);
    const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

    // Check if user has provider access
    if (!user || !hasFeature(user, FeatureAccess.ProviderAccess)) {
        return (
            <div className="container">
                <div className="alert alert-warning">
                    You don't have permission to access Canvas integration
                    settings.
                </div>
            </div>
        );
    }

    const {
        data: connectionsResponse,
        mutate,
        error,
        isLoading
    } = useSWR<ServerResponseMany<CanvasConnection>, Error>(
        `/api/canvas/api-keys`,
        {
            revalidateOnFocus: false,
            dedupingInterval: 10000
        }
    );

    const connections = connectionsResponse?.data ?? [];

    const handleDisconnect = async (connectionId: string) => {
        if (
            !confirm(
                'Are you sure you want to disconnect this Canvas instance? This cannot be undone.'
            )
        ) {
            return;
        }

        setDisconnectingId(connectionId);
        try {
            const response = await API.delete(
                `canvas/api-keys/${connectionId}`
            );
            if (response.success) {
                toaster(
                    'Canvas instance disconnected successfully',
                    ToastState.success
                );
                void mutate(); // Refresh list
            } else {
                toaster(
                    response.message || 'Failed to disconnect Canvas',
                    ToastState.error
                );
            }
        } catch (err) {
            toaster(
                err instanceof Error
                    ? err.message
                    : 'Error disconnecting Canvas',
                ToastState.error
            );
        } finally {
            setDisconnectingId(null);
        }
    };

    const handleOpenConnectModal = (): void => {
        showModal(connectModalRef);
    };

    return (
        <div className="px-5 py-4 flex flex-col justify-center gap-4">
            <div className="flex flex-row justify-between items-center">
                <AddButton
                    label="Connect Canvas Instance"
                    onClick={handleOpenConnectModal}
                />
            </div>

            {error && (
                <div className="alert alert-error">
                    Failed to load Canvas connections: {error.message}
                </div>
            )}

            {isLoading ? (
                <div className="text-center py-8">
                    <p>Loading Canvas connections...</p>
                </div>
            ) : connections.length === 0 ? (
                <div className="alert alert-info">
                    <div>
                        <h3>No Canvas Instances Connected</h3>
                        <p>Click "Connect Canvas Instance" to get started.</p>
                    </div>
                </div>
            ) : (
                <table className="table-2">
                    <thead>
                        <tr className="grid-cols-3 px-3">
                            <th className="justify-self-start">Canvas URL</th>
                            <th className="text-center">Status</th>
                            <th className="justify-self-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {connections.map((connection) => (
                            <CanvasConnectionCard
                                key={connection.id}
                                connection={connection}
                                onDisconnect={(id) => {
                                    void handleDisconnect(id);
                                }}
                                isLoading={disconnectingId === connection.id}
                            />
                        ))}
                    </tbody>
                </table>
            )}

            <div className="grid grid-cols-2 gap-8 mt-8">
                <div>
                    <h3 className="text-lg font-semibold mb-4">
                        Generate Canvas API Key (Admin Only)
                    </h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li>Log in to Canvas as an administrator</li>
                        <li>Click your profile icon in the top right corner</li>
                        <li>Select "Settings"</li>
                        <li>Click "Approved Integrations"</li>
                        <li>Click "+ New Access Token"</li>
                        <li>
                            Fill in:
                            <ul className="list-disc list-inside ml-4 mt-1">
                                <li>Purpose: "UnlockEd"</li>
                                <li>
                                    Expires: Select an appropriate expiration
                                    date or leave blank for no expiration
                                </li>
                            </ul>
                        </li>
                        <li>Click "Generate Token"</li>
                        <li>
                            Copy the token (you won't be able to see it again)
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-4">
                        Connect Your Canvas Instance
                    </h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li>Click "Connect Canvas Instance" above</li>
                        <li>
                            Enter your Canvas instance URL (e.g.,
                            https://your-institution.instructure.com)
                        </li>
                        <li>
                            Enter your Canvas API token (generated from Canvas
                            Settings → Approved Integrations)
                        </li>
                        <li>
                            Click submit and your Canvas instance will be
                            connected to UnlockEd
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-4">
                        What UnlockEd Can Access
                    </h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Course information and enrollment data</li>
                        <li>User profiles and email addresses</li>
                        <li>Assignment details and submissions</li>
                        <li>Grades and completion status</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-4">Security</h3>
                    <p className="text-sm">
                        All Canvas API tokens are encrypted and stored securely.
                        You can disconnect at any time, and UnlockEd will no
                        longer have access to your Canvas data.
                    </p>
                </div>
            </div>

            <ConnectCanvasModal ref={connectModalRef} mutate={mutate} />
        </div>
    );
}
