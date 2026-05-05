import { forwardRef } from 'react';
import { CRUDModalProps, FormModal, FormInputTypes } from '.';
import API from '@/api/api';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { useAuth } from '@/useAuth';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import { ServerResponseOne } from '@/common';

interface CanvasAuthResponse {
    auth_url: string;
    state: string;
}

export const ConnectCanvasModal = forwardRef(function (
    { mutate }: CRUDModalProps,
    modalRef: React.ForwardedRef<HTMLDialogElement>
) {
    const { user } = useAuth();
    const checkResponse = useCheckResponse({
        mutate,
        refModal: modalRef
    });

    const handleConnect: SubmitHandler<FieldValues> = async (data) => {
        if (!user) {
            checkResponse(false, 'User not authenticated');
            return;
        }

        try {
            // First, save Canvas OAuth config
            const configResponse = (await API.post('canvas/config', {
                client_id: data.client_id,
                client_secret: data.client_secret
            })) as ServerResponseOne<unknown>;

            if (!configResponse.success) {
                checkResponse(
                    false,
                    configResponse.message ||
                        'Failed to save Canvas credentials'
                );
                return;
            }

            // Then initiate Canvas connection
            const response = (await API.post<CanvasAuthResponse>(
                'canvas/connect',
                {
                    facility_id: user.facility.id.toString(),
                    canvas_url: data.canvas_url
                }
            )) as ServerResponseOne<CanvasAuthResponse>;

            if (response.success && response.data?.auth_url) {
                // Redirect to Canvas OAuth flow
                window.location.href = response.data.auth_url;
                return;
            } else {
                checkResponse(
                    false,
                    response.message || 'Failed to initiate Canvas connection'
                );
            }
        } catch (err) {
            checkResponse(
                false,
                err instanceof Error ? err.message : 'An error occurred'
            );
        }
    };

    return (
        <FormModal
            title="Connect Canvas Instance"
            inputs={[
                {
                    type: FormInputTypes.Text,
                    label: 'Canvas Client ID',
                    interfaceRef: 'client_id',
                    required: true,
                    placeholder: 'Your Canvas OAuth Client ID'
                },
                {
                    type: FormInputTypes.Text,
                    label: 'Canvas Client Secret',
                    interfaceRef: 'client_secret',
                    required: true,
                    placeholder: 'Your Canvas OAuth Client Secret'
                },
                {
                    type: FormInputTypes.Text,
                    label: 'Canvas URL',
                    interfaceRef: 'canvas_url',
                    required: true,
                    placeholder: 'https://your-canvas.instructure.com'
                }
            ]}
            onSubmit={handleConnect}
            ref={modalRef}
            showCancel={true}
        />
    );
});
