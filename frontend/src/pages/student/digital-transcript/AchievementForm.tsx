import type { TranscriptEntry } from '@/types/digital-transcript';
import { AchievementFormActions } from './AchievementFormActions';
import { AchievementFormMetadata } from './AchievementFormMetadata';
import { ReflectionStepField } from './ReflectionStepField';
import { REFLECTION_STEPS_FUNNEL_ORDER } from './transcriptReflectionConfig';

interface AchievementFormProps {
    entry: TranscriptEntry;
    onChange: (patch: Partial<TranscriptEntry>) => void;
    onCancel: () => void;
    onDone: () => void;
    showDoneErrors: boolean;
    showDelete?: boolean;
    onDeleteRequest?: () => void;
}

export function AchievementForm({
    entry,
    onChange,
    onCancel,
    onDone,
    showDoneErrors,
    showDelete,
    onDeleteRequest
}: AchievementFormProps) {
    return (
        <div data-slot="achievement-form" className="space-y-5 pt-4">
            <AchievementFormMetadata
                entry={entry}
                onChange={onChange}
                showDoneErrors={showDoneErrors}
            />

            {REFLECTION_STEPS_FUNNEL_ORDER.map((stepKey) => (
                <ReflectionStepField
                    key={stepKey}
                    entry={entry}
                    stepKey={stepKey}
                    onChange={onChange}
                />
            ))}

            <AchievementFormActions
                onCancel={onCancel}
                onDone={onDone}
                showDelete={showDelete}
                onDeleteRequest={onDeleteRequest}
            />
        </div>
    );
}
