import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator
} from '@/components/ui/command';
import {
    APP_COMPONENT_SECTIONS,
    ATOMIC_COMPONENTS,
    PRIMITIVE_COMPONENTS,
    type ComponentLibraryEntry
} from '@/components/dev/componentLibraryCatalog';
import { LEARNING_RECORD_PROTOTYPES } from '@/pages/student/digital-transcript/learningRecordPrototypes';
import { getDigitalTranscriptBasePath } from '@/pages/student/digital-transcript/digitalTranscriptRoutes';
import { capturePageToFigma, isFigmaCaptureEnabled } from '@/utils/capturePageToFigma';
import { cn } from '@/lib/utils';

function isDevCommandMenuEnabled(): boolean {
    return import.meta.env.DEV || isFigmaCaptureEnabled();
}

function CommandMenuRow({
    title,
    subtitle,
    selected
}: {
    title: string;
    subtitle: string;
    selected?: boolean;
}) {
    return (
        <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{title}</span>
                <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
            </span>
            {selected ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
        </span>
    );
}

function copyImportPath(entry: ComponentLibraryEntry) {
    const snippet =
        entry.importPath === '@/components/shared'
            ? `import { ${entry.name} } from '@/components/shared'`
            : `import { /* … */ } from '${entry.importPath}'`;
    void navigator.clipboard.writeText(snippet);
    toast.success('Import path copied', { description: snippet });
}

function ComponentLibraryItems({
    items,
    onSelect
}: {
    items: ComponentLibraryEntry[];
    onSelect: (entry: ComponentLibraryEntry) => void;
}) {
    return items.map((entry) => (
        <CommandItem
            key={entry.id}
            value={`${entry.name} ${entry.importPath} component library`}
            onSelect={() => onSelect(entry)}
        >
            <CommandMenuRow title={entry.name} subtitle={entry.importPath} />
        </CommandItem>
    ));
}

export default function DevCommandMenu() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const figmaEnabled = isFigmaCaptureEnabled();
    const enabled = isDevCommandMenuEnabled();
    const currentBase = getDigitalTranscriptBasePath(pathname);

    const logPrototypes = useCallback(() => {
        if (!import.meta.env.DEV) return;
        console.info(
            '[LearningRecord prototypes]',
            LEARNING_RECORD_PROTOTYPES.map((p) => p.id)
        );
    }, []);

    useEffect(() => {
        if (!enabled) return;
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen((v) => {
                    const next = !v;
                    if (next) logPrototypes();
                    return next;
                });
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [enabled, logPrototypes]);

    if (!enabled) return null;

    return (
        <CommandDialog
            open={open}
            onOpenChange={(next) => {
                if (next) logPrototypes();
                setOpen(next);
            }}
            title="Developer menu"
            description="Learning Record prototypes, component library, and dev tools."
        >
            <CommandInput placeholder="Search prototypes, components, tools…" />
            <CommandList className="max-h-[min(70vh,28rem)]">
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup heading="Learning Record">
                    {LEARNING_RECORD_PROTOTYPES.map((prototype) => {
                        const selected = currentBase === prototype.basePath;
                        return (
                            <CommandItem
                                key={prototype.id}
                                value={`${prototype.label} ${prototype.basePath}`}
                                onSelect={() => {
                                    navigate(prototype.basePath);
                                    setOpen(false);
                                }}
                                className={cn(selected && 'aria-selected:bg-accent')}
                                aria-current={selected ? 'page' : undefined}
                            >
                                <CommandMenuRow
                                    title={prototype.label}
                                    subtitle={prototype.basePath}
                                    selected={selected}
                                />
                            </CommandItem>
                        );
                    })}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Primitives">
                    <ComponentLibraryItems
                        items={PRIMITIVE_COMPONENTS}
                        onSelect={(entry) => {
                            copyImportPath(entry);
                            setOpen(false);
                        }}
                    />
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Atomic">
                    <ComponentLibraryItems
                        items={ATOMIC_COMPONENTS}
                        onSelect={(entry) => {
                            copyImportPath(entry);
                            setOpen(false);
                        }}
                    />
                </CommandGroup>
                {APP_COMPONENT_SECTIONS.map((section) => (
                    <CommandGroup key={section.heading} heading={section.heading}>
                        <ComponentLibraryItems
                            items={section.items}
                            onSelect={(entry) => {
                                copyImportPath(entry);
                                setOpen(false);
                            }}
                        />
                    </CommandGroup>
                ))}
                {figmaEnabled ? (
                    <>
                        <CommandSeparator />
                        <CommandGroup heading="Tools">
                            <CommandItem
                                value="Capture to Figma Send current page to Figma MCP"
                                onSelect={() => {
                                    capturePageToFigma();
                                    setOpen(false);
                                }}
                            >
                                <CommandMenuRow
                                    title="Capture to Figma"
                                    subtitle="Send current page to Figma MCP"
                                />
                            </CommandItem>
                        </CommandGroup>
                    </>
                ) : null}
            </CommandList>
            <p className="border-t px-3 py-2 text-center text-xs text-muted-foreground">
                Press <kbd className="rounded border bg-muted px-1 font-sans">⌘K</kbd> to toggle
            </p>
        </CommandDialog>
    );
}
