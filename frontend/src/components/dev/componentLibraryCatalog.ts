/**
 * Inventory of frontend-v2/src/components/ for the dev command menu.
 * Primitives = ui/ · Atomic = shared/ · App = domain + top-level.
 */

export type ComponentLibraryEntry = {
    id: string;
    name: string;
    importPath: string;
};

export type ComponentLibrarySection = {
    heading: string;
    items: ComponentLibraryEntry[];
};

function primitive(fileStem: string, exportName?: string): ComponentLibraryEntry {
    const name =
        exportName ??
        fileStem
            .split('-')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
    return {
        id: `ui-${fileStem}`,
        name,
        importPath: `@/components/ui/${fileStem}`
    };
}

function atomic(name: string): ComponentLibraryEntry {
    return {
        id: `shared-${name}`,
        name,
        importPath: `@/components/shared`
    };
}

function app(relativePath: string, name: string): ComponentLibraryEntry {
    return {
        id: `app-${relativePath.replace(/\//g, '-')}-${name}`,
        name,
        importPath: `@/components/${relativePath}`
    };
}

const PRIMITIVE_STEMS = [
    'accordion',
    'alert-dialog',
    'alert',
    'aspect-ratio',
    'avatar',
    'badge',
    'breadcrumb',
    'button',
    'calendar',
    'card',
    'carousel',
    'chart',
    'checkbox',
    'collapsible',
    'command',
    'context-menu',
    'dialog',
    'drawer',
    'dropdown-menu',
    'form',
    'hover-card',
    'input-otp',
    'input',
    'label',
    'menubar',
    'navigation-menu',
    'pagination',
    'popover',
    'progress',
    'radio-group',
    'resizable',
    'scroll-area',
    'select',
    'separator',
    'sheet',
    'sidebar',
    'skeleton',
    'slider',
    'sonner',
    'switch',
    'table',
    'tabs',
    'textarea',
    'toggle-group',
    'toggle',
    'tooltip'
] as const;

/** shadcn primitives in `src/components/ui/` */
export const PRIMITIVE_COMPONENTS: ComponentLibraryEntry[] = PRIMITIVE_STEMS.map((stem) =>
    primitive(stem)
);

/** Generic reusable pieces in `src/components/shared/` */
export const ATOMIC_COMPONENTS: ComponentLibraryEntry[] = [
    atomic('ConfirmDialog'),
    atomic('DataTable'),
    atomic('EmptyState'),
    atomic('FormModal'),
    atomic('PageHeader'),
    atomic('Pagination'),
    atomic('SearchInput'),
    atomic('StatusBadge')
];

/** Feature and cross-cutting components outside ui/ and shared/ */
export const APP_COMPONENT_SECTIONS: ComponentLibrarySection[] = [
    {
        heading: 'App · Top-level',
        items: [
            app('Brand', 'Brand'),
            app('BulkCancelClassesModal', 'BulkCancelClassesModal'),
            app('Loading', 'Loading'),
            app('Pagination', 'Pagination'),
            app('TitleManager', 'TitleManager'),
            app('Tour', 'Tour'),
            app('UnlockEdTour', 'UnlockEdTour')
        ]
    },
    {
        heading: 'App · Charts',
        items: [
            app('charts/EngagementRateGraph', 'EngagementRateGraph'),
            app('charts/OperationalInsightsCharts', 'OperationalInsightsCharts')
        ]
    },
    {
        heading: 'App · Dashboard',
        items: [
            app('dashboard/RecentCoursesTable', 'RecentCoursesTable'),
            app('dashboard/TopContentList', 'TopContentList'),
            app('dashboard/WeeklyActivity', 'WeeklyActivity')
        ]
    },
    {
        heading: 'App · Forms',
        items: [
            app('forms/ChangePasswordForm', 'ChangePasswordForm'),
            app('forms/ConsentForm', 'ConsentForm'),
            app('forms/LoginForm', 'LoginForm')
        ]
    },
    {
        heading: 'App · Knowledge center',
        items: [
            app('knowledge-center/FavoriteCard', 'FavoriteCard'),
            app('knowledge-center/HelpfulLinkCard', 'HelpfulLinkCard'),
            app('knowledge-center/LibraryCard', 'LibraryCard'),
            app('knowledge-center/OpenContentItemAccordion', 'OpenContentItemAccordion'),
            app('knowledge-center/VideoCard', 'VideoCard')
        ]
    },
    {
        heading: 'App · Navigation',
        items: [
            app('navigation/Breadcrumbs', 'Breadcrumbs'),
            app('navigation/MobileNav', 'MobileNav'),
            app('navigation/Sidebar', 'Sidebar'),
            app('navigation/TopNav', 'TopNav')
        ]
    },
    {
        heading: 'App · Programs',
        items: [app('programs/ProgramDialogs', 'ProgramDialogs')]
    },
    {
        heading: 'App · Residents',
        items: [
            app('residents/BulkActionDialogs', 'BulkActionDialogs'),
            app('residents/BulkImportDialog', 'BulkImportDialog'),
            app('residents/ResidentModals', 'ResidentModals')
        ]
    },
    {
        heading: 'App · Schedule',
        items: [
            app('schedule/CancelEventModal', 'CancelEventModal'),
            app('schedule/ChangeInstructorModal', 'ChangeInstructorModal'),
            app('schedule/ChangeRoomModal', 'ChangeRoomModal'),
            app('schedule/RescheduleEventModal', 'RescheduleEventModal'),
            app('schedule/RescheduleSeriesModal', 'RescheduleSeriesModal'),
            app('schedule/RescheduleSessionModal', 'RescheduleSessionModal'),
            app('schedule/RestoreEventModal', 'RestoreEventModal'),
            app('schedule/RoomConflictModal', 'RoomConflictModal'),
            app('schedule/RRuleControl', 'RRuleControl')
        ]
    },
    {
        heading: 'App · Student',
        items: [
            app('student/ActivityHistoryCard', 'ActivityHistoryCard'),
            app('student/CatalogCourseCard', 'CatalogCourseCard'),
            app('student/EnrolledCourseCard', 'EnrolledCourseCard'),
            app('student/ResidentComingUp', 'ResidentComingUp'),
            app('student/UserCoursesStatsGrid', 'UserCoursesStatsGrid')
        ]
    }
];
