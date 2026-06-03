import { toast } from 'sonner';
import {
    downloadLearningRecordPdf,
    learningRecordPdfFilename
} from '@/utils/downloadLearningRecordPdf';

export const learningRecordPdfCaptureClassName =
    'pointer-events-none fixed top-0 left-0 w-[8in] max-w-[768px] overflow-visible bg-background';

export const learningRecordPdfCaptureStyle = {
    zIndex: -1,
    clipPath: 'inset(50%)'
} as const;

export async function waitForExportPaint(): Promise<void> {
    await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
}

export async function downloadLearningRecordPdfFromRoot(
    root: HTMLElement | null,
    residentName: string
): Promise<void> {
    await waitForExportPaint();

    if (!root) {
        throw new Error('Export content not ready');
    }

    await downloadLearningRecordPdf(root, learningRecordPdfFilename(residentName));
    toast.success('Learning record downloaded');
}

export function showLearningRecordPdfExportError(): void {
    toast.error('Could not download PDF. Please try again.');
}
