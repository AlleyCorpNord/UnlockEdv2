import { Button } from '@/components/ui/button';

interface AchievementFormActionsProps {
    onCancel: () => void;
    onDone: () => void;
    showDelete?: boolean;
    onDeleteRequest?: () => void;
}

export function AchievementFormActions({
    onCancel,
    onDone,
    showDelete,
    onDeleteRequest
}: AchievementFormActionsProps) {
    return (
        <div className="-mx-3 flex flex-col-reverse gap-2 border-t border-border bg-background px-3 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="bg-background" onClick={onCancel}>
                Cancel
            </Button>
            {showDelete && onDeleteRequest ? (
                <Button
                    type="button"
                    variant="outline"
                    className="bg-background text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={onDeleteRequest}
                >
                    Delete
                </Button>
            ) : null}
            <Button
                type="button"
                data-slot="transcript-done"
                className="bg-[#556830] text-white hover:bg-[#203622]"
                onClick={onDone}
            >
                Done
            </Button>
        </div>
    );
}
