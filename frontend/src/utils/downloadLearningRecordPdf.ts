import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const CAPTURE_STYLE_PROPS = [
    'overflow',
    'height',
    'maxHeight',
    'minHeight'
] as const;

type CaptureStyleProp = (typeof CAPTURE_STYLE_PROPS)[number];

const MARGIN_X_IN = 0.25;
const MARGIN_Y_IN = 0.35;
const PAGE_WIDTH_IN = 8.5;
const PAGE_HEIGHT_IN = 11;
const CONTENT_WIDTH_IN = PAGE_WIDTH_IN - MARGIN_X_IN * 2;
const CONTENT_HEIGHT_IN = PAGE_HEIGHT_IN - MARGIN_Y_IN * 2;

function camelToKebab(value: string): string {
    return value.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function collectElementsForCapture(root: HTMLElement): HTMLElement[] {
    const elements = [root];
    let parent = root.parentElement;
    while (parent && parent !== document.body) {
        elements.push(parent);
        parent = parent.parentElement;
    }
    return elements;
}

function applyCaptureStyles(elements: HTMLElement[]): Map<HTMLElement, Partial<Record<CaptureStyleProp, string>>> {
    const previous = new Map<HTMLElement, Partial<Record<CaptureStyleProp, string>>>();

    for (const el of elements) {
        const saved: Partial<Record<CaptureStyleProp, string>> = {};
        for (const prop of CAPTURE_STYLE_PROPS) {
            saved[prop] = el.style[prop];
        }
        previous.set(el, saved);

        el.style.overflow = 'visible';
        el.style.height = 'auto';
        el.style.maxHeight = 'none';
        el.style.minHeight = '0';
    }

    return previous;
}

function restoreCaptureStyles(previous: Map<HTMLElement, Partial<Record<CaptureStyleProp, string>>>) {
    for (const [el, saved] of previous) {
        for (const prop of CAPTURE_STYLE_PROPS) {
            const value = saved[prop];
            const kebab = camelToKebab(prop);
            if (value === undefined || value === '') {
                el.style.removeProperty(kebab);
            } else {
                el.style.setProperty(kebab, value);
            }
        }
    }
}

const COLOR_STYLE_PROPS = [
    'color',
    'backgroundColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'outlineColor',
    'textDecorationColor'
] as const;

const UNSUPPORTED_COLOR_RE = /oklab|oklch|color-mix|lab\(|lch\(/i;

const PDF_BORDER = 'rgba(0, 0, 0, 0.1)';
const PDF_MUTED_FILL = 'rgba(236, 236, 240, 0.45)';
/** Matches --muted-foreground in globals.css / injectPdfSafeThemeVariables */
const PDF_MUTED_FOREGROUND = '#717182';

const PDF_MUTED_SURFACE_SELECTOR =
    '[data-slot="funnel-achievement-header"], [data-pdf-muted-surface]';

function isTransparentBackground(color: string): boolean {
    const trimmed = color.trim();
    return (
        !trimmed ||
        trimmed === 'transparent' ||
        trimmed === 'none' ||
        trimmed === 'rgba(0, 0, 0, 0)' ||
        trimmed === 'rgba(0,0,0,0)'
    );
}

function elementHasMutedSurfaceClass(el: HTMLElement): boolean {
    return /\bbg-muted(?:\/|\b)/.test(el.className);
}

function elementHasMutedForegroundClass(el: HTMLElement): boolean {
    return /\btext-muted-foreground(?:\/|\b)/.test(el.className);
}

function clearDescendantBackgrounds(container: HTMLElement): void {
    for (const child of container.querySelectorAll<HTMLElement>('*')) {
        child.style.setProperty('background-color', 'transparent', 'important');
    }
}

/** html2canvas cannot parse Tailwind v4 oklab/oklch; the canvas API returns rgb/hex. */
function cssColorToRgb(color: string): string | null {
    const trimmed = color.trim();
    if (isTransparentBackground(trimmed)) {
        return 'transparent';
    }

    try {
        const ctx = document.createElement('canvas').getContext('2d');
        if (!ctx) return null;
        ctx.fillStyle = '#000000';
        ctx.fillStyle = trimmed;
        const resolved = ctx.fillStyle;
        if (UNSUPPORTED_COLOR_RE.test(resolved) || UNSUPPORTED_COLOR_RE.test(trimmed)) {
            return null;
        }
        return resolved;
    } catch {
        return null;
    }
}

function fallbackColorForProp(
    prop: (typeof COLOR_STYLE_PROPS)[number],
    el?: HTMLElement
): string {
    if (prop === 'color') {
        if (el && elementHasMutedForegroundClass(el)) {
            return PDF_MUTED_FOREGROUND;
        }
        return '#0a0a0a';
    }
    if (prop === 'backgroundColor') return 'transparent';
    return 'transparent';
}

function resolveSanitizedBackground(el: HTMLElement, computed: CSSStyleDeclaration): string {
    const raw = computed.backgroundColor;
    const rgb = cssColorToRgb(raw);

    if (rgb === 'transparent' || isTransparentBackground(raw)) {
        return 'transparent';
    }

    if (rgb) {
        return rgb;
    }

    if (
        UNSUPPORTED_COLOR_RE.test(raw) &&
        (el.matches(PDF_MUTED_SURFACE_SELECTOR) || elementHasMutedSurfaceClass(el))
    ) {
        return PDF_MUTED_FILL;
    }

    if (el.matches('[data-achievement-block]') || el.classList.contains('learning-record-pdf-export')) {
        return '#ffffff';
    }

    return 'transparent';
}

function logSectionDividerLayout(
    el: HTMLElement,
    view: Window,
    source: 'live' | 'clone',
    hypothesisId: string,
    runId = 'pre-fix'
): void {
    const cs = view.getComputedStyle(el);
    const elRect = el.getBoundingClientRect();
    const textCenterY = elRect.top + elRect.height / 2;
    const paddingTop = Number.parseFloat(cs.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(cs.paddingBottom) || 0;
    const contentHeight = elRect.height - paddingTop - paddingBottom;
    const contentCenterY = elRect.top + paddingTop + contentHeight / 2;
    // #region agent log
    fetch('http://127.0.0.1:7522/ingest/1f926cf6-0018-4209-a608-d137d75a2924',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'703a1d'},body:JSON.stringify({sessionId:'703a1d',location:'downloadLearningRecordPdf.ts:logSectionDividerLayout',message:'section divider layout',data:{source,hypothesisId,runId,sectionTitle:el.textContent?.trim(),display:cs.display,width:cs.width,lineHeight:cs.lineHeight,paddingTop:cs.paddingTop,paddingBottom:cs.paddingBottom,offsetHeight:el.offsetHeight,clientHeight:el.clientHeight,elRectH:elRect.height,elRectW:elRect.width,centerOffsetPx:textCenterY-contentCenterY,topGapPx:paddingTop,bottomGapPx:paddingBottom},timestamp:Date.now(),hypothesisId:'H9'})}).catch(()=>{});
    // #endregion
}

function debugLogSectionDividers(
    root: HTMLElement,
    view: Window,
    source: 'live' | 'clone',
    hypothesisId: string,
    runId = 'pre-fix'
): void {
    root.querySelectorAll<HTMLElement>('[data-section-divider]').forEach((el, index) => {
        logSectionDividerLayout(el, view, source, `${hypothesisId}-${index}`, runId);
    });
}

/** Bottom-border section divider for html2canvas capture. */
function applyPdfSectionDividerLayout(el: HTMLElement): void {
    el.style.setProperty('display', 'block', 'important');
    el.style.setProperty('box-sizing', 'border-box', 'important');
    el.style.setProperty('break-inside', 'auto', 'important');
    el.style.setProperty('page-break-inside', 'auto', 'important');
    el.style.setProperty('width', '100%', 'important');
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('line-height', 'normal', 'important');
    el.style.setProperty('border', 'none', 'important');
    el.style.setProperty('border-bottom', `1px solid ${PDF_BORDER}`, 'important');
    el.style.setProperty('border-radius', '0', 'important');
    el.style.setProperty('background-color', 'transparent', 'important');
    el.style.setProperty('text-align', 'left', 'important');
}

function logDividerCanvasPaint(
    root: HTMLElement,
    canvas: HTMLCanvasElement,
    scale: number,
    runId: string
): void {
    const rootRect = root.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    root.querySelectorAll<HTMLElement>('[data-section-divider]').forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const x0 = Math.max(0, Math.round((rect.left - rootRect.left) * scale));
        const y0 = Math.max(0, Math.round((rect.top - rootRect.top) * scale));
        const w = Math.max(1, Math.round(rect.width * scale));
        const h = Math.max(1, Math.round(rect.height * scale));

        const isInk = (r: number, g: number, b: number) => r < 80 && g < 80 && b < 80;
        const isMutedFill = (r: number, g: number, b: number) =>
            r > 210 && r < 245 && g > 210 && g < 245 && b > 220 && b < 255;

        const sampleBand = (yStart: number, yEnd: number) => {
            let ink = 0;
            let muted = 0;
            let samples = 0;
            for (let y = yStart; y < yEnd; y += Math.max(1, Math.floor(h / 8))) {
                for (
                    let x = x0 + Math.floor(w * 0.25);
                    x < x0 + Math.floor(w * 0.75);
                    x += Math.max(1, Math.floor(w / 6))
                ) {
                    if (x >= canvas.width || y >= canvas.height) continue;
                    const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
                    samples++;
                    if (isInk(r, g, b)) ink++;
                    if (isMutedFill(r, g, b)) muted++;
                }
            }
            return { ink, muted, samples };
        };

        const third = Math.max(1, Math.floor(h / 3));
        const top = sampleBand(y0, y0 + third);
        const mid = sampleBand(y0 + third, y0 + 2 * third);
        const bot = sampleBand(y0 + 2 * third, y0 + h);

        let inkMassY = 0;
        let inkCount = 0;
        for (let y = y0; y < y0 + h; y++) {
            for (let x = x0 + Math.floor(w * 0.2); x < x0 + Math.floor(w * 0.8); x++) {
                if (x >= canvas.width || y >= canvas.height) continue;
                const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
                if (isInk(r, g, b)) {
                    inkMassY += y;
                    inkCount++;
                }
            }
        }

        const inkCenterY = inkCount > 0 ? inkMassY / inkCount : null;
        const boxCenterY = y0 + h / 2;
        const inkCenterOffsetPx = inkCenterY !== null ? (inkCenterY - boxCenterY) / scale : null;

        // #region agent log
        fetch('http://127.0.0.1:7522/ingest/1f926cf6-0018-4209-a608-d137d75a2924',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'703a1d'},body:JSON.stringify({sessionId:'703a1d',location:'downloadLearningRecordPdf.ts:logDividerCanvasPaint',message:'canvas divider paint',data:{runId,index,sectionTitle:el.textContent?.trim(),domRectH:rect.height,domRectW:rect.width,canvasRectH:h/scale,canvasRectW:w/scale,inkCenterOffsetPx,topInk:top.ink,midInk:mid.ink,botInk:bot.ink,topMuted:top.muted,midMuted:mid.muted,botMuted:bot.muted},timestamp:Date.now(),hypothesisId:'H8'})}).catch(()=>{});
        // #endregion
    });
}

/** html2canvas can ignore small heading font sizes from Tailwind; mirror live computed styles. */
function syncSectionLabelTypographyForPdf(
    originalRoot: HTMLElement,
    clonedRoot: HTMLElement
): void {
    const originals = originalRoot.querySelectorAll<HTMLElement>('[data-section-label]');
    const clones = clonedRoot.querySelectorAll<HTMLElement>('[data-section-label]');

    clones.forEach((clone, index) => {
        const original = originals[index];
        if (!original) return;

        const cs = window.getComputedStyle(original);
        clone.style.setProperty('font-size', cs.fontSize, 'important');
        clone.style.setProperty('font-weight', cs.fontWeight, 'important');
        clone.style.setProperty('letter-spacing', cs.letterSpacing, 'important');
        clone.style.setProperty('line-height', cs.lineHeight, 'important');
        clone.style.setProperty('margin', '0', 'important');
    });
}

function restorePdfTargetedStyles(cloneNodes: HTMLElement[], view: Window): void {
    for (const el of cloneNodes) {
        if (el.matches('[data-section-divider]')) {
            applyPdfSectionDividerLayout(el);
            continue;
        }

        if (el.matches('[data-achievement-block]')) {
            const radius = view.getComputedStyle(el).borderRadius || '8px';
            el.style.setProperty('border', 'none', 'important');
            el.style.setProperty('border-width', '0', 'important');
            el.style.setProperty('border-radius', radius, 'important');
            el.style.setProperty('background-color', '#ffffff', 'important');
            continue;
        }

        if (el.matches('[data-slot="funnel-achievement-header"]')) {
            el.style.setProperty('background-color', PDF_MUTED_FILL, 'important');
            el.style.setProperty('border-bottom', `1px solid ${PDF_BORDER}`, 'important');
            clearDescendantBackgrounds(el);
            continue;
        }

        if (el.matches('[data-pdf-muted-surface]')) {
            el.style.setProperty('background-color', PDF_MUTED_FILL, 'important');
            clearDescendantBackgrounds(el);
        }
    }
}

function injectPdfSafeThemeVariables(clonedDoc: Document): void {
    const styleEl = clonedDoc.createElement('style');
    styleEl.setAttribute('data-pdf-safe-theme', 'true');
    styleEl.textContent = `
      :root, .learning-record-pdf-export, .learning-record-pdf-export * {
        --background: #ffffff !important;
        --foreground: #0a0a0a !important;
        --card: #ffffff !important;
        --card-foreground: #0a0a0a !important;
        --popover: #ffffff !important;
        --popover-foreground: #0a0a0a !important;
        --primary: #030213 !important;
        --primary-foreground: #ffffff !important;
        --secondary: #ececf0 !important;
        --secondary-foreground: #030213 !important;
        --muted: #ececf0 !important;
        --muted-foreground: ${PDF_MUTED_FOREGROUND} !important;
        --accent: #e9ebef !important;
        --accent-foreground: #030213 !important;
        --border: rgba(0, 0, 0, 0.1) !important;
        --input-background: #f3f3f5 !important;
        --ring: #b3b3b3 !important;
        color: #0a0a0a !important;
        border-color: transparent !important;
        box-shadow: none !important;
        text-shadow: none !important;
        outline: none !important;
        background-image: none !important;
      }
      .learning-record-pdf-export {
        background-color: #ffffff !important;
      }
      .learning-record-pdf-export .text-muted-foreground,
      .learning-record-pdf-export [class*="text-muted-foreground"] {
        color: ${PDF_MUTED_FOREGROUND} !important;
      }
      .learning-record-pdf-export [data-section-label] {
        margin: 0 !important;
      }
    `;
    clonedDoc.head.appendChild(styleEl);
}

function sanitizeCloneElement(el: HTMLElement, view: Window): void {
    const computed = view.getComputedStyle(el);

    el.style.setProperty('opacity', '1', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
    el.style.setProperty('text-shadow', 'none', 'important');
    el.style.setProperty('outline', 'none', 'important');
    el.style.setProperty('border-color', 'transparent', 'important');
    el.style.setProperty('background-image', 'none', 'important');

    for (const prop of COLOR_STYLE_PROPS) {
        if (prop === 'backgroundColor') continue;
        const kebab = camelToKebab(prop);
        const value = computed[prop];
        const rgb = cssColorToRgb(value);
        let safe =
            rgb ?? (UNSUPPORTED_COLOR_RE.test(value) ? fallbackColorForProp(prop, el) : value);
        if (prop === 'color' && elementHasMutedForegroundClass(el)) {
            safe = PDF_MUTED_FOREGROUND;
        }
        el.style.setProperty(kebab, safe, 'important');
    }

    el.style.setProperty('background-color', resolveSanitizedBackground(el, computed), 'important');
}

function countOklabInClone(cloneNodes: HTMLElement[], view: Window): number {
    let n = 0;
    for (const el of cloneNodes) {
        const cs = view.getComputedStyle(el);
        for (const prop of COLOR_STYLE_PROPS) {
            if (UNSUPPORTED_COLOR_RE.test(cs[prop])) n++;
        }
        if (UNSUPPORTED_COLOR_RE.test(cs.borderTopColor)) n++;
    }
    return n;
}

function prepareCloneForCapture(
    originalRoot: HTMLElement,
    clonedRoot: HTMLElement,
    clonedDoc: Document
): { oklabAfterPrep: number; cloneNodeCount: number; bruteForcePass: boolean } {
    const view = clonedDoc.defaultView;
    if (!view) {
        return { oklabAfterPrep: -1, cloneNodeCount: 0, bruteForcePass: false };
    }

    clonedRoot.style.setProperty('clip-path', 'none', 'important');
    clonedRoot.style.setProperty('opacity', '1', 'important');
    clonedRoot.style.setProperty('visibility', 'visible', 'important');

    injectPdfSafeThemeVariables(clonedDoc);

    const cloneNodes: HTMLElement[] = [
        clonedRoot,
        ...clonedRoot.querySelectorAll<HTMLElement>('*')
    ];

    for (const el of cloneNodes) {
        sanitizeCloneElement(el, view);
    }

    let oklabAfterPrep = countOklabInClone(cloneNodes, view);
    let bruteForcePass = false;

    if (oklabAfterPrep > 0) {
        bruteForcePass = true;
        for (const el of cloneNodes) {
            el.style.setProperty(
                'color',
                elementHasMutedForegroundClass(el) ? PDF_MUTED_FOREGROUND : '#0a0a0a',
                'important'
            );
            el.style.setProperty('border-color', 'transparent', 'important');
            el.style.setProperty('outline-color', 'transparent', 'important');
            el.style.setProperty('text-decoration-color', '#0a0a0a', 'important');
            if (!el.matches(PDF_MUTED_SURFACE_SELECTOR) && !elementHasMutedSurfaceClass(el)) {
                if (!el.matches('[data-achievement-block]') && !el.classList.contains('learning-record-pdf-export')) {
                    el.style.setProperty('background-color', 'transparent', 'important');
                }
            }
        }
        oklabAfterPrep = countOklabInClone(cloneNodes, view);
    }

    restorePdfTargetedStyles(cloneNodes, view);
    syncSectionLabelTypographyForPdf(originalRoot, clonedRoot);

    debugLogSectionDividers(originalRoot, window, 'live', 'H9-live', 'post-fix-v4');
    debugLogSectionDividers(clonedRoot, view, 'clone', 'H9-clone', 'post-fix-v4');
    // #region agent log
    fetch('http://127.0.0.1:7522/ingest/1f926cf6-0018-4209-a608-d137d75a2924',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'703a1d'},body:JSON.stringify({sessionId:'703a1d',location:'downloadLearningRecordPdf.ts:prepareCloneForCapture',message:'clone prep summary',data:{bruteForcePass,oklabAfterPrep,cloneDividerCount:clonedRoot.querySelectorAll('[data-section-divider]').length,liveDividerCount:originalRoot.querySelectorAll('[data-section-divider]').length,pdfLayoutMode:'full-width-line-height',sectionTitles:[...originalRoot.querySelectorAll('[data-section-divider]')].map((n)=>n.textContent?.trim())},timestamp:Date.now(),runId:'post-fix-v4',hypothesisId:'H9'})}).catch(()=>{});
    // #endregion

    return { oklabAfterPrep, cloneNodeCount: cloneNodes.length, bruteForcePass };
}

function pickCanvasScale(element: HTMLElement): number {
    const maxSide = 8192;
    const height = element.scrollHeight || element.offsetHeight;
    const width = element.scrollWidth || element.offsetWidth;
    let scale = 2;
    while (Math.max(width, height) * scale > maxSide && scale > 1) {
        scale -= 0.25;
    }
    return scale;
}

function addCanvasToPdf(pdf: jsPDF, canvas: HTMLCanvasElement, imgData: string) {
    const imgWidth = CONTENT_WIDTH_IN;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let offsetY = MARGIN_Y_IN;

    pdf.addImage(imgData, 'JPEG', MARGIN_X_IN, offsetY, imgWidth, imgHeight);
    heightLeft -= CONTENT_HEIGHT_IN;

    while (heightLeft > 0) {
        offsetY = MARGIN_Y_IN - (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', MARGIN_X_IN, offsetY, imgWidth, imgHeight);
        heightLeft -= CONTENT_HEIGHT_IN;
    }
}

function addCanvasAsSinglePdfPage(
    pdf: jsPDF,
    canvas: HTMLCanvasElement,
    imgData: string,
    isFirstPage: boolean
) {
    if (!isFirstPage) {
        pdf.addPage();
    }

    const naturalWidth = CONTENT_WIDTH_IN;
    const naturalHeight = (canvas.height * naturalWidth) / canvas.width;
    let drawWidth = naturalWidth;
    let drawHeight = naturalHeight;

    if (drawHeight > CONTENT_HEIGHT_IN) {
        drawHeight = CONTENT_HEIGHT_IN;
        drawWidth = (canvas.width * drawHeight) / canvas.height;
    }

    const offsetX = MARGIN_X_IN + (CONTENT_WIDTH_IN - drawWidth) / 2;
    pdf.addImage(imgData, 'JPEG', offsetX, MARGIN_Y_IN, drawWidth, drawHeight);
}

export interface LearningRecordCanvasCapture {
    canvas: HTMLCanvasElement;
    imgData: string;
}

export async function captureLearningRecordCanvas(
    root: HTMLElement
): Promise<LearningRecordCanvasCapture> {
    await document.fonts.ready;

    const elements = collectElementsForCapture(root);
    const previousStyles = applyCaptureStyles(elements);
    const scale = pickCanvasScale(root);

    debugLogSectionDividers(root, window, 'live', 'H9-capture-live', 'post-fix-v4');

    try {
        const canvas = await html2canvas(root, {
            scale,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            scrollX: 0,
            scrollY: -window.scrollY,
            windowWidth: root.scrollWidth,
            onclone: (clonedDoc, clonedRoot) => {
                prepareCloneForCapture(root, clonedRoot, clonedDoc);
            }
        });

        if (canvas.width === 0 || canvas.height === 0) {
            throw new Error('PDF capture produced an empty canvas');
        }

        logDividerCanvasPaint(root, canvas, scale, 'post-fix-v4');

        return {
            canvas,
            imgData: canvas.toDataURL('image/jpeg', 0.92)
        };
    } finally {
        restoreCaptureStyles(previousStyles);
    }
}

export function slugifyLearningRecordFilenamePart(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

export function learningRecordPdfFilename(residentName: string, date = new Date()): string {
    const slug = slugifyLearningRecordFilenamePart(residentName) || 'resident';
    const iso = date.toISOString().slice(0, 10);
    return `learning-record-${slug}-${iso}.pdf`;
}

export async function downloadLearningRecordPdf(
    root: HTMLElement,
    filename: string
): Promise<void> {
    const { canvas, imgData } = await captureLearningRecordCanvas(root);
    const pdf = new jsPDF({
        unit: 'in',
        format: 'letter',
        orientation: 'portrait',
        compress: true
    });

    addCanvasToPdf(pdf, canvas, imgData);
    pdf.save(filename);
}

export async function downloadAllLearningRecordAchievementsPdf(
    captureEntryRoot: () => Promise<HTMLElement>,
    entryCount: number,
    filename: string
): Promise<void> {
    if (entryCount === 0) {
        return;
    }

    const pdf = new jsPDF({
        unit: 'in',
        format: 'letter',
        orientation: 'portrait',
        compress: true
    });

    for (let i = 0; i < entryCount; i++) {
        const root = await captureEntryRoot();
        const { canvas, imgData } = await captureLearningRecordCanvas(root);
        addCanvasAsSinglePdfPage(pdf, canvas, imgData, i === 0);
    }

    pdf.save(filename);
}
