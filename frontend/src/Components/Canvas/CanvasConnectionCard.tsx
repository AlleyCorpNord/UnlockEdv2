import { CanvasConnection } from '@/common';
import ULIComponent from '@/Components/ULIComponent';
import { TrashIcon } from '@heroicons/react/24/outline';

interface CanvasConnectionCardProps {
    connection: CanvasConnection;
    onDisconnect: (connectionId: string) => void;
    isLoading?: boolean;
}

export default function CanvasConnectionCard({
    connection,
    onDisconnect,
    isLoading = false
}: CanvasConnectionCardProps) {
    const createdDate = new Date(connection.created_at);
    const formattedDate = createdDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    return (
        <tr className="bg-base-teal card p-4 w-full grid-cols-3 justify-items-center">
            <td className="justify-self-start">
                <div className="flex flex-col gap-1">
                    <span className="font-medium">{connection.canvas_url}</span>
                    <span className="text-sm text-gray-500">Connected {formattedDate}</span>
                </div>
            </td>
            <td className="text-center">
                <span className="badge badge-success">Connected</span>
            </td>
            <td className="flex flex-row gap-3 justify-self-end cursor-pointer">
                <ULIComponent
                    dataTip={isLoading ? 'Disconnecting...' : 'Disconnect Canvas'}
                    icon={TrashIcon}
                    onClick={() => onDisconnect(connection.id)}
                    className={isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                />
            </td>
        </tr>
    );
}
