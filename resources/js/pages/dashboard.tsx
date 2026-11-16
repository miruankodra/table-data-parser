import { Head, router } from '@inertiajs/react';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { dashboard } from '@/routes';
import { ServiceAccountNotice } from '@/components/service-account-notice';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import { store as startRun } from '@/routes/import-runs';

interface ImportRunRow {
    id: string;
    status: 'running' | 'success' | 'partial' | 'failed';
    spreadsheet: string | null;
    tab: string | null;
    table: string | null;
    rows_read: number;
    rows_written: number;
    message: string | null;
    started_at: string | null;
}

interface Props {
    stats: { spreadsheets: number; targets: number; failed_24h: number };
    recentRuns: ImportRunRow[];
}

export default function Dashboard({ stats, recentRuns }: Props) {
    const cards = [
        { label: 'Active spreadsheets', value: stats.spreadsheets },
        { label: 'Active targets', value: stats.targets },
        { label: 'Failed runs (24h)', value: stats.failed_24h },
    ];

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <ServiceAccountNotice />
                <div className="flex items-center justify-between mx-1">
                    <h1 className="text-xl font-semibold">Dashboard</h1>
                    <Button
                        size="sm"
                        onClick={() =>
                            router.post(startRun.url(), {}, { preserveScroll: true, only: ['stats', 'recentRuns', 'flash'] })
                        }
                    >
                        <Play className="size-4" /> Run all imports
                    </Button>
                </div>
                <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                    {cards.map((c) => (
                        <Card key={c.label}>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    {c.label}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-3xl font-semibold">
                                {c.value}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card className="flex-1">
                    <CardHeader>
                        <CardTitle>Recent imports</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Spreadsheet / tab</TableHead>
                                    <TableHead>Table</TableHead>
                                    <TableHead className="text-right">Read</TableHead>
                                    <TableHead className="text-right">Written</TableHead>
                                    <TableHead>Started</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentRuns.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="text-center text-muted-foreground"
                                        >
                                            No imports yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {recentRuns.map((r) => (
                                    <TableRow key={r.id}>
                                        <TableCell>
                                            <StatusBadge status={r.status} />
                                        </TableCell>
                                        <TableCell>
                                            {r.spreadsheet ?? '(deleted)'} / {r.tab ?? '-'}
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                            {r.table ?? '-'}
                                        </TableCell>
                                        <TableCell className="text-right">{r.rows_read}</TableCell>
                                        <TableCell className="text-right">{r.rows_written}</TableCell>
                                        <TableCell>
                                            {r.started_at ? new Date(r.started_at).toLocaleString() : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};