import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    deleteTranscriptEntryById,
    dispatchEntrySessionUpdated,
    entrySessionIsDirty,
    readEntrySessionFromStorage,
    readTranscriptDraftFromStorage,
    readTranscriptEntriesFromStorage,
    writeTranscriptEntriesToStorage
} from '@/pages/student/digital-transcript/transcriptEntrySessionStorage';
import {
    migrateDigitalTranscriptLegacyStorage,
    type TranscriptDraft,
    type TranscriptEntry,
    type TranscriptEntrySession
} from '@/types/digital-transcript';

const ENTRY_SESSION_EVENT = 'transcript-entry-session-updated';

export function useTranscriptDraft() {
    const [legacyDraft, setLegacyDraft] = useState<TranscriptDraft | null>(null);
    const [entries, setEntries] = useState<TranscriptEntry[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const [entrySessionEpoch, setEntrySessionEpoch] = useState(0);
    const skipPersistRef = useRef(true);

    useEffect(() => {
        migrateDigitalTranscriptLegacyStorage();
        setLegacyDraft(readTranscriptDraftFromStorage());
        setEntries(readTranscriptEntriesFromStorage());
        setHydrated(true);
        skipPersistRef.current = true;
    }, []);

    useEffect(() => {
        const bump = () => setEntrySessionEpoch((n) => n + 1);
        window.addEventListener(ENTRY_SESSION_EVENT, bump);
        return () => window.removeEventListener(ENTRY_SESSION_EVENT, bump);
    }, []);

    const upsertCommittedEntry = useCallback((entry: TranscriptEntry) => {
        const existing = readTranscriptEntriesFromStorage();
        const idx = existing.findIndex((e) => e.id === entry.id);
        let list: TranscriptEntry[];
        if (idx >= 0) {
            list = [...existing];
            list[idx] = entry;
        } else {
            list = [...existing, entry];
        }
        writeTranscriptEntriesToStorage(list);
        setEntries(list);
        dispatchEntrySessionUpdated();
    }, []);

    const deleteCommittedEntry = useCallback((id: string): TranscriptEntrySession | null => {
        const nextSession = deleteTranscriptEntryById(id);
        setEntries(readTranscriptEntriesFromStorage());
        skipPersistRef.current = true;
        return nextSession;
    }, []);

    const hasDraft = useMemo(() => {
        void entrySessionEpoch;
        if (legacyDraft) return true;
        return entrySessionIsDirty(readEntrySessionFromStorage(), readTranscriptEntriesFromStorage());
    }, [legacyDraft, entrySessionEpoch]);

    return {
        entries,
        hydrated,
        hasDraft,
        upsertCommittedEntry,
        deleteCommittedEntry
    };
}
