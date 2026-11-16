import { Head, Link, router, usePoll } from '@inertiajs/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { index } from '@/routes/import-runs';

interface Run {
    id: string;
    status: 'running' | 'success' | 'partial' | 'failed';
    spreadsheet: string | null;
    tab: string | null;
    table: string | null;
    rows_read: number;
    rows_written: number;
    message: string | null;
    started_at: string | null;
    seconds: number | null;
}

interface Props {
    runs: {
        data: Run[];
        current_page: number;
        last_page: number;
        total: number;
        prev_page_url: string | null;
        next_page_url: string | null;
    };
    status: string | null;
}

const lineClass = (line: string) =>
    line.startsWith('error:')
        ? 'text-red-500'
        : line.startsWith('warning:')
          ? 'text-yellow-500'
          : 'text-muted-foreground';

export default function ImportRunsIndex({ runs, status }: Props) {
    const [open, setOpen] = useState<Set<string>>(new Set());

    // Poll only while something is running
    const { start, stop } = usePoll(3000, { only: ['runs'] }, { autoStart: false });
    const anyRunning = runs.data.some((r) => r.status === 'running');
    useEffect(() => {
        if (anyRunning) start();
        else stop();
        return stop;
    }, [anyRunning]);

    const toggle = (id: string) =>
        setOpen((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    const filter = (value: string) =>
        router.get(index.url(), value === 'all' ? {} : { status: value }, { preserveState: true, replace: true });

    return (
        <>
            <Head title="Import runs" />
            <div className="flex flex-col gap-4 p-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Import runs ({runs.total})</CardTitle>
                        <Select value={status ?? 'all'} onValueChange={filter}>
                            <SelectTrigger className="w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="success">Success</SelectItem>
                                <SelectItem value="partial">Partial</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                                <SelectItem value="running">Running</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardHeader>

                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8" />
                                    <TableHead>Status</TableHead>
                                    <TableHead>Spreadsheet / tab</TableHead>
                                    <TableHead>Table</TableHead>
                                    <TableHead className="text-right">Read</TableHead>
                                    <TableHead className="text-right">Written</TableHead>
                                    <TableHead className="text-right">Time</TableHead>
                                    <TableHead>Started</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {runs.data.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                                            No runs found.
                                        </TableCell>
                                    </TableRow>
                                )}

                                {runs.data.map((r) => {
                                    const isOpen = open.has(r.id);
                                    const lines = r.message ? r.message.split('\n') : [];

                                    return (
                                        <Fragment key={r.id}>
                                            <TableRow
                                                className={lines.length ? 'cursor-pointer' : ''}
                                                onClick={() => lines.length && toggle(r.id)}
                                            >
                                                <TableCell>
                                                    {lines.length > 0 &&
                                                        (isOpen ? (
                                                            <ChevronDown className="size-4" />
                                                        ) : (
                                                            <ChevronRight className="size-4" />
                                                        ))}
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge status={r.status} />
                                                </TableCell>
                                                <TableCell>
                                                    {r.spreadsheet ?? '(deleted)'} / {r.tab ?? '-'}
                                                </TableCell>
                                                <TableCell className="font-mono text-sm">{r.table ?? '-'}</TableCell>
                                                <TableCell className="text-right">{r.rows_read}</TableCell>
                                                <TableCell className="text-right">{r.rows_written}</TableCell>
                                                <TableCell className="text-right">
                                                    {r.seconds !== null ? `${r.seconds}s` : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {r.started_at ? new Date(r.started_at).toLocaleString() : '-'}
                                                </TableCell>
                                            </TableRow>

                                            {isOpen && (
                                                <TableRow>
                                                    <TableCell />
                                                    <TableCell colSpan={7}>
                                                        <ul className="space-y-1 font-mono text-xs">
                                                            {lines.map((l, i) => (
                                                                <li key={i} className={lineClass(l)}>
                                                                    {l}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>

                        {runs.last_page > 1 && (
                            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                                <span>
                                    Page {runs.current_page} of {runs.last_page}
                                </span>
                                <div className="flex gap-2">
                                    <Button asChild variant="outline" size="sm" disabled={!runs.prev_page_url}>
                                        <Link href={runs.prev_page_url ?? '#'} preserveScroll>
                                            Previous
                                        </Link>
                                    </Button>
                                    <Button asChild variant="outline" size="sm" disabled={!runs.next_page_url}>
                                        <Link href={runs.next_page_url ?? '#'} preserveScroll>
                                            Next
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

ImportRunsIndex.layout = {
    breadcrumbs: [{ title: 'Import runs', href: index() }],
};