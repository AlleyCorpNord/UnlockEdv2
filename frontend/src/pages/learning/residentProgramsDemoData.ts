/**
 * Sample resident programs + calendar rows (legacy UnlockEd “My Programs”
 * reference) used only when the API returns no enrollments so the UI can
 * be reviewed before real data exists.
 */
import {
    type FacilityProgramClassEvent,
    type ResidentProgramOverview,
    EnrollmentStatus,
    ProgClassStatus,
    SelectedClassStatus
} from '@/types';

export const DEMO_RESIDENT_PROGRAM_ROWS: ResidentProgramOverview[] = [
    {
        program_name: 'Adult Basic Education (ABE)',
        class_name: 'Basic Math',
        status: ProgClassStatus.ACTIVE,
        enrollment_status: EnrollmentStatus.Enrolled,
        credit_types: '',
        program_id: 9001,
        class_id: 9101,
        enrollment_id: 92001,
        updated_at: new Date().toISOString(),
        start_date: '2025-10-01',
        end_date: '2026-03-31',
        attendance_percentage: 88,
        schedule: 'Mon / Wed / Fri'
    },
    {
        program_name: 'Adult Basic Education (ABE)',
        class_name: 'Basic English',
        status: ProgClassStatus.ACTIVE,
        enrollment_status: EnrollmentStatus.Enrolled,
        credit_types: '',
        program_id: 9001,
        class_id: 9102,
        enrollment_id: 92002,
        updated_at: new Date().toISOString(),
        start_date: '2025-10-01',
        end_date: '2026-03-31',
        attendance_percentage: 94,
        schedule: 'Mon / Wed / Fri'
    },
    {
        program_name: 'A Culinary Basics Program',
        class_name: 'Intro To Culinary Arts',
        status: ProgClassStatus.ACTIVE,
        enrollment_status: EnrollmentStatus.Enrolled,
        credit_types: '',
        program_id: 9002,
        class_id: 9103,
        enrollment_id: 92003,
        updated_at: new Date().toISOString(),
        start_date: '2025-10-01',
        end_date: '2026-03-31',
        schedule: 'Tue / Thu',
        attendance_percentage: undefined
    }
];

type SessionSpec = {
    daysFromNow: number;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    classId: number;
    programId: number;
    programName: string;
    title: string;
    room: string;
    frequency: string;
    eventId: number;
};

function session(
    spec: SessionSpec,
    anchor: Date
): FacilityProgramClassEvent {
    const start = new Date(anchor);
    start.setDate(start.getDate() + spec.daysFromNow);
    start.setHours(spec.startHour, spec.startMinute, 0, 0);

    const end = new Date(start);
    end.setHours(spec.endHour, spec.endMinute, 0, 0);

    return {
        id: spec.eventId,
        class_id: spec.classId,
        duration: '',
        room_id: 0,
        recurrence_rule: '',
        is_cancelled: false,
        instructor_id: null,
        overrides: [],
        room: spec.room,
        instructor_name: 'Instructor',
        program_id: spec.programId,
        program_name: spec.programName,
        title: spec.title,
        is_override: false,
        enrolled_users: '',
        start,
        end,
        frequency: spec.frequency,
        override_id: 0,
        linked_override_event: null as unknown as FacilityProgramClassEvent,
        credit_types: '',
        class_status: SelectedClassStatus.Active
    } as FacilityProgramClassEvent;
}

/** A few near-future sessions tied to the demo class IDs above. */
export function getDemoCalendarEvents(): FacilityProgramClassEvent[] {
    const anchor = new Date();
    anchor.setHours(0, 0, 0, 0);

    const specs: SessionSpec[] = [
        {
            eventId: 88001,
            daysFromNow: 1,
            startHour: 9,
            startMinute: 30,
            endHour: 11,
            endMinute: 0,
            classId: 9101,
            programId: 9001,
            programName: 'Adult Basic Education (ABE)',
            title: 'Basic Math',
            room: 'Room 12',
            frequency: 'Weekly · Mon / Wed / Fri'
        },
        {
            eventId: 88002,
            daysFromNow: 1,
            startHour: 13,
            startMinute: 0,
            endHour: 14,
            endMinute: 30,
            classId: 9102,
            programId: 9001,
            programName: 'Adult Basic Education (ABE)',
            title: 'Basic English',
            room: 'Room 12',
            frequency: 'Weekly · Mon / Wed / Fri'
        },
        {
            eventId: 88003,
            daysFromNow: 3,
            startHour: 10,
            startMinute: 0,
            endHour: 12,
            endMinute: 30,
            classId: 9103,
            programId: 9002,
            programName: 'A Culinary Basics Program',
            title: 'Intro To Culinary Arts',
            room: 'Kitchen Lab',
            frequency: 'Weekly · Tue / Thu'
        },
        {
            eventId: 88004,
            daysFromNow: 5,
            startHour: 9,
            startMinute: 30,
            endHour: 11,
            endMinute: 0,
            classId: 9101,
            programId: 9001,
            programName: 'Adult Basic Education (ABE)',
            title: 'Basic Math',
            room: 'Room 12',
            frequency: 'Weekly · Mon / Wed / Fri'
        }
    ];

    return specs.map((s) => session(s, anchor));
}
