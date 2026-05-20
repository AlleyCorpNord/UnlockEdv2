import { toast } from 'sonner';

declare global {
    interface Window {
        figma?: {
            captureForDesign: (opts: {
                captureId: string;
                endpoint: string;
                selector: string;
            }) => void;
        };
    }
}

export function isFigmaCaptureEnabled(): boolean {
    return import.meta.env.VITE_ENABLE_FIGMA_CAPTURE === 'true';
}

export function capturePageToFigma(): void {
    const captureId = import.meta.env.VITE_FIGMA_CAPTURE_ID as string | undefined;
    const endpoint =
        (import.meta.env.VITE_FIGMA_CAPTURE_ENDPOINT as string | undefined) ||
        (captureId ? `https://mcp.figma.com/mcp/capture/${captureId}/submit` : undefined);
    const selector =
        (import.meta.env.VITE_FIGMA_CAPTURE_SELECTOR as string | undefined) || 'body';

    if (!window.figma?.captureForDesign) {
        toast.error('Open this app in Cursor’s browser with Figma MCP connected.');
        return;
    }
    if (!captureId || !endpoint) {
        toast.error(
            'Set VITE_FIGMA_CAPTURE_ID (and optionally VITE_FIGMA_CAPTURE_ENDPOINT) in .env.local.'
        );
        return;
    }
    window.figma.captureForDesign({ captureId, endpoint, selector });
    toast.success('Sent capture to Figma.');
}
