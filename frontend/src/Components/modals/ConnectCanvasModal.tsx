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
            const response = await API.post<CanvasAuthResponse>(
                'canvas/connect',
                {
                    facility_id: user.facility.id.toString(),
                    canvas_url: data.canvas_url
                }
            ) as ServerResponseOne<CanvasAuthResponse>;

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
