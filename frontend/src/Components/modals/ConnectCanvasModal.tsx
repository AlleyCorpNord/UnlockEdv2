import { forwardRef } from 'react';
import { CRUDModalProps, FormModal, FormInputTypes } from '.';
import API from '@/api/api';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import { ServerResponseOne } from '@/common';

interface CanvasAPIKeyResponse {
    id: string;
    canvas_url: string;
    created_at: string;
}

export const ConnectCanvasModal = forwardRef(function (
    { mutate }: CRUDModalProps<CanvasAPIKeyResponse>,
    modalRef: React.ForwardedRef<HTMLDialogElement>
) {
    const checkResponse = useCheckResponse<CanvasAPIKeyResponse>({
        mutate,
        refModal: modalRef
    });

    const handleConnect: SubmitHandler<FieldValues> = async (data) => {
        const canvasUrl = data.canvas_url as string;
        const apiKey = data.api_key as string;

        try {
            const testResponse = (await API.post<
                unknown,
                { canvas_url: string; api_key: string }
            >('canvas/test-connection', {
                canvas_url: canvasUrl,
                api_key: apiKey
            })) as ServerResponseOne<unknown>;

            if (!testResponse.success) {
                checkResponse(
                    false,
                    testResponse.message ??
                        'Failed to connect to Canvas. Please verify your URL and API key.',
                    ''
                );
                return;
            }

            const response = (await API.post<
                CanvasAPIKeyResponse,
                { canvas_url: string; api_key: string }
            >('canvas/api-keys', {
                canvas_url: canvasUrl,
                api_key: apiKey
            })) as ServerResponseOne<CanvasAPIKeyResponse>;

            if (response.success) {
                checkResponse(
                    true,
                    '',
                    'Canvas instance connected successfully'
                );
            } else {
                checkResponse(
                    false,
                    response.message ?? 'Failed to save Canvas API key',
                    ''
                );
            }
        } catch (err) {
            checkResponse(
                false,
                err instanceof Error ? err.message : 'An error occurred',
                ''
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
                },
                {
                    type: FormInputTypes.Text,
                    label: 'Canvas API Key',
                    interfaceRef: 'api_key',
                    required: true,
                    placeholder: 'Your Canvas API token'
                }
            ]}
            onSubmit={handleConnect}
            ref={modalRef}
            showCancel={true}
        />
    );
});
