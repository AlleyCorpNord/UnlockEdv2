import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
    ProviderPlatform,
    ProviderPlatformState,
    ProviderPlatformType,
    ProviderResponse,
    ServerResponseMany
} from '@/types';
import { useAuth, hasFeature } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import API from '@/api/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { FormModal } from '@/components/shared/FormModal';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
    PlusIcon,
    ServerStackIcon,
    GlobeAltIcon
} from '@heroicons/react/24/outline';

const providerTypeLabels: Record<ProviderPlatformType, string> = {
    [ProviderPlatformType.CANVAS_CLOUD]: 'Canvas Cloud',
    [ProviderPlatformType.CANVAS_OSS]: 'Canvas OSS',
    [ProviderPlatformType.KOLIBRI]: 'Kolibri',
    [ProviderPlatformType.BRIGHTSPACE]: 'Brightspace'
};

const providerStateStyles: Record<ProviderPlatformState, string> = {
    [ProviderPlatformState.ENABLED]:
        'bg-green-50 text-green-700 border-green-200',
    [ProviderPlatformState.DISABLED]: 'bg-muted text-foreground border-border',
    [ProviderPlatformState.ARCHIVED]: 'bg-red-50 text-red-700 border-red-200'
};

export default function ProviderPlatformManagement() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [showAddModal, setShowAddModal] = useState(false);

    const {
        data: providers,
        mutate,
        error,
        isLoading
    } = useSWR<ServerResponseMany<ProviderPlatform>>(`/api/provider-platforms`);

    if (!user || !hasFeature(user, FeatureAccess.ProviderAccess)) return null;

    const providerData = providers?.data ?? [];

    const columns: Column<ProviderPlatform>[] = [
        {
            key: 'name',
            header: 'Name',
            render: (p) => (
                <div className="flex items-center gap-3">
                    <div className="rounded-lg p-2 bg-muted">
                        <GlobeAltIcon className="size-4 text-foreground" />
                    </div>
                    <span className="font-medium text-foreground">
                        {p.name}
                    </span>
                </div>
            )
        },
        {
            key: 'type',
            header: 'Type',
            render: (p) => (
                <span className="text-sm text-muted-foreground">
                    {providerTypeLabels[p.type] ?? p.type}
                </span>
            )
        },
        {
            key: 'state',
            header: 'Status',
            render: (p) => (
                <span
                    className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${providerStateStyles[p.state]}`}
                >
                    {p.state}
                </span>
            )
        },
        {
            key: 'base_url',
            header: 'Base URL',
            render: (p) => (
                <span className="text-sm text-muted-foreground">
                    {p.base_url}
                </span>
            )
        }
    ];

    return (
        <div className="bg-[#E2E7EA] min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <PageHeader
                    title="Learning Platforms"
                    subtitle="Manage connected learning management systems"
                    actions={
                        <Button
                            onClick={() => setShowAddModal(true)}
                            className="bg-[#203622] text-white hover:bg-[#203622]/90"
                        >
                            <PlusIcon className="size-4 mr-1" />
                            Add Learning Platform
                        </Button>
                    }
                />

                {error ? (
                    <div className="bg-card rounded-lg border border-border p-8 text-center">
                        <p className="text-red-600">
                            Error loading provider platforms.
                        </p>
                    </div>
                ) : !isLoading && providerData.length === 0 ? (
                    <EmptyState
                        icon={
                            <ServerStackIcon className="size-6 text-foreground" />
                        }
                        title="No learning platforms"
                        description="Connect your first learning management system to get started."
                        action={
                            <Button
                                onClick={() => setShowAddModal(true)}
                                className="bg-[#203622] text-white hover:bg-[#203622]/90"
                            >
                                <PlusIcon className="size-4 mr-1" />
                                Add Learning Platform
                            </Button>
                        }
                    />
                ) : (
                    <DataTable
                        columns={columns}
                        data={providerData}
                        keyExtractor={(p) => p.id}
                        isLoading={isLoading}
                        emptyMessage="No learning platforms found."
                        onRowClick={(p) =>
                            navigate(`/learning-platforms/${p.id}`)
                        }
                    />
                )}
            </div>

            <AddProviderModal
                open={showAddModal}
                onOpenChange={setShowAddModal}
                onSuccess={() => void mutate()}
            />
        </div>
    );
}

function AddProviderModal({
    open,
    onOpenChange,
    onSuccess
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}) {
    const [name, setName] = useState('');
    const [type, setType] = useState<ProviderPlatformType>(
        ProviderPlatformType.CANVAS_CLOUD
    );
    const [baseUrl, setBaseUrl] = useState('');
    const [accountId, setAccountId] = useState('');
    const [accessKey, setAccessKey] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const resetForm = () => {
        setName('');
        setType(ProviderPlatformType.CANVAS_CLOUD);
        setBaseUrl('');
        setAccountId('');
        setAccessKey('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const resp = await API.post<ProviderResponse, object>(
            'provider-platforms',
            {
                name,
                type,
                base_url: baseUrl,
                account_id: accountId,
                access_key: accessKey,
                state: 'enabled'
            }
        );
        setSubmitting(false);
        if (resp.success) {
            const data = resp.data as ProviderResponse;
            if (data.oauth2Url) {
                window.location.href = data.oauth2Url;
                return;
            }
            toast.success('Provider platform added successfully.');
            resetForm();
            onOpenChange(false);
            onSuccess();
        } else {
            toast.error('Failed to add provider platform.');
        }
    };

    return (
        <FormModal
            open={open}
            onOpenChange={(v) => {
                onOpenChange(v);
                if (!v) resetForm();
            }}
            title="Add Learning Platform"
            description="Connect a new learning management system."
        >
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-foreground">
                        Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-foreground">
                        Platform Type
                    </label>
                    <select
                        value={type}
                        onChange={(e) =>
                            setType(e.target.value as ProviderPlatformType)
                        }
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                    >
                        {Object.entries(providerTypeLabels).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium text-foreground">
                        Base URL
                    </label>
                    <input
                        type="url"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        required
                        placeholder="https://your-lms.example.com"
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-foreground">
                        Account ID
                    </label>
                    <input
                        type="text"
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        required
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-foreground">
                        Access Key
                    </label>
                    <input
                        type="password"
                        value={accessKey}
                        onChange={(e) => setAccessKey(e.target.value)}
                        required
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                    />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            resetForm();
                            onOpenChange(false);
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={submitting}
                        className="bg-[#203622] text-white hover:bg-[#203622]/90"
                    >
                        {submitting ? 'Adding...' : 'Add Platform'}
                    </Button>
                </div>
            </form>
        </FormModal>
    );
}
