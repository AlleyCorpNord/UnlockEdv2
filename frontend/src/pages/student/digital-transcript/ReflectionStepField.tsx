import type { TranscriptEntry } from '@/types/digital-transcript';
import { ConfidenceSegmentedControl } from './ConfidenceSegmentedControl';
import { ReflectionTextField } from './ReflectionTextField';
import {
    reflectionStepByKey,
    type ReflectionAnswerKey,
    type ReflectionTextFieldKey
} from './transcriptReflectionConfig';
import { TopSkillsTagField } from './TopSkillsTagField';

interface ReflectionStepFieldProps {
    entry: TranscriptEntry;
    stepKey: ReflectionAnswerKey;
    onChange: (patch: Partial<TranscriptEntry>) => void;
}

function textFieldKey(key: ReflectionAnswerKey): ReflectionTextFieldKey | null {
    if (key === 'topSkills' || key === 'confidence') return null;
    return key;
}

export function ReflectionStepField({ entry, stepKey, onChange }: ReflectionStepFieldProps) {
    const step = reflectionStepByKey(stepKey);
    if (!step) return null;

    const idPrefix = `ach-${stepKey}-${entry.id}`;

    if (step.kind === 'tags') {
        return (
            <TopSkillsTagField
                id={idPrefix}
                label={step.editorLabel}
                subtitle={step.editorSubtitle ?? 'Choose up to 5.'}
                value={entry.topSkills}
                onChange={(topSkills) => onChange({ topSkills })}
            />
        );
    }

    if (step.kind === 'confidence') {
        return (
            <section className="space-y-3" aria-labelledby={idPrefix}>
                <div id={idPrefix} className="text-sm font-medium leading-snug text-foreground">
                    {step.editorLabel}
                </div>
                <ConfidenceSegmentedControl
                    value={entry.confidence}
                    onChange={(v) => onChange({ confidence: v })}
                    labelledBy={idPrefix}
                />
            </section>
        );
    }

    const fieldKey = textFieldKey(stepKey);
    if (!fieldKey) return null;

    const value = entry[fieldKey];
    return (
        <ReflectionTextField
            id={idPrefix}
            label={step.editorLabel}
            value={value}
            onChange={(v) => onChange({ [fieldKey]: v })}
            fieldKey={fieldKey}
        />
    );
}
