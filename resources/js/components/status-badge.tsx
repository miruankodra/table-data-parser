import { Badge } from '@/components/ui/badge';

const styles: Record<string, string> = {
    success: 'bg-green-600/15 text-green-500 border-green-600/30',
    partial: 'bg-yellow-600/15 text-yellow-500 border-yellow-600/30',
    failed: 'bg-red-600/15 text-red-500 border-red-600/30',
    running: 'bg-blue-600/15 text-blue-500 border-blue-600/30',
};

export function StatusBadge({ status }: { status: string }) {
    return (
        <Badge variant="outline" className={styles[status] ?? ''}>
            {status}
        </Badge>
    );
}