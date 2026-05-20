import { ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddAchievementRowProps {
    onAdd: () => void;
}

export function AddAchievementRow({ onAdd }: AddAchievementRowProps) {
    return (
        <button
            type="button"
            data-slot="add-achievement-row"
            onClick={onAdd}
            className={cn(
                'flex w-full items-center gap-3 rounded-lg border border-dashed border-border bg-transparent px-3 py-3 text-left text-foreground outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring'
            )}
        >
            <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground"
                aria-hidden
            >
                <Plus className="size-4" />
            </span>
            <span className="min-w-0 flex-1 font-medium">Add another achievement</span>
            <ChevronDown className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
    );
}
