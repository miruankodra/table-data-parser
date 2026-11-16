import { Head, Link, router } from '@inertiajs/react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { index, show } from '@/routes/data';

interface Column {
    name: string;
    kind: 'number' | 'date' | 'boolean' | 'text';
}

interface Props {
    table: string;
    tables: string[];
    sources: { spreadsheet: string; tab: string }[];
    exists: boolean;
    columns: Column[];
    rows: {
        data: Record<string, string | number | null>[];
        total: number;
        from: number | null;
        to: number | null;
        last_page: number;
        prev_page_url: string | null;
        next_page_url: string | null;
    } | null;
    filters: { search: string; sort: string | null; direction: 'asc' | 'desc' };
}

function Cell({ value, kind }: { value: string | number | null; kind: Column['kind'] }) {
    if (value === null || value === undefined) {
        return <span className="text-xs text-muted-foreground">NULL</span>;
    }
    if (kind === 'boolean') {
        return <span>{Number(value) ? '✓' : '✗'}</span>;
    }
    return (
        <span className="block max-w-xs truncate" title={String(value)}>
            {String(value)}
        </span>
    );
}

export default function DataShow({ table, tables, sources, exists, columns, rows, filters }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');

    const visit = (params: { search?: string; sort?: string | null; direction?: string }) => {
        const query = Object.fromEntries(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
        );
        router.get(show.url(table), query, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        visit({ search, sort: filters.sort, direction: filters.direction });
    };

    const toggleSort = (name: string) => {
        const direction = filters.sort === name && filters.direction === 'asc' ? 'desc' : 'asc';
        visit({ search: filters.search, sort: name, direction });
    };

    return (
        <>
            <Head title={`Data: ${table}`} />
            <div className="flex flex-col gap-4 p-4">
                <Card>
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                        <div className="flex flex-col gap-1">
                            <Select value={table} onValueChange={(name) => router.get(show.url(name))}>
                                <SelectTrigger className="w-64 font-mono">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {tables.map((name) => (
                                        <SelectItem key={name} value={name} className="font-mono">
                                            {name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Fed by {sources.map((s) => `${s.spreadsheet} / ${s.tab}`).join(', ')}
                                {sources.length > 1 && ' (rows from all sources are shown together)'}
                            </p>
                        </div>

                        {exists && (
                            <form onSubmit={submitSearch} className="flex items-center gap-2">
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search all columns…"
                                    className="w-64"
                                />
                                <Button type="submit" size="sm" variant="outline">
                                    <Search className="size-4" />
                                </Button>
                            </form>
                        )}
                    </CardHeader>

                    <CardContent>
                        {!exists || !rows ? (
                            <p className="text-sm text-muted-foreground">
                                This table hasn't been created yet. Run an import for its target first.
                            </p>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                {columns.map((c) => {
                                                    const active = filters.sort === c.name;
                                                    const Icon = !active
                                                        ? ArrowUpDown
                                                        : filters.direction === 'asc'
                                                          ? ArrowUp
                                                          : ArrowDown;

                                                    return (
                                                        <TableHead
                                                            key={c.name}
                                                            className={c.kind === 'number' ? 'text-right' : ''}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleSort(c.name)}
                                                                className="inline-flex items-center gap-1 font-mono text-xs hover:text-foreground"
                                                            >
                                                                {c.name}
                                                                <Icon className="size-3 opacity-60" />
                                                            </button>
                                                        </TableHead>
                                                    );
                                                })}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rows.data.length === 0 && (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={Math.max(columns.length, 1)}
                                                        className="text-center text-muted-foreground"
                                                    >
                                                        {filters.search ? 'No rows match your search.' : 'The table is empty.'}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {rows.data.map((row, i) => (
                                                <TableRow key={i}>
                                                    {columns.map((c) => (
                                                        <TableCell
                                                            key={c.name}
                                                            className={c.kind === 'number' ? 'text-right tabular-nums' : ''}
                                                        >
                                                            <Cell value={row[c.name]} kind={c.kind} />
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                                    <span>{rows.total === 0 ? '0 rows' : `${rows.from}–${rows.to} of ${rows.total}`}</span>
                                    {rows.last_page > 1 && (
                                        <div className="flex gap-2">
                                            <Button asChild variant="outline" size="sm" disabled={!rows.prev_page_url}>
                                                <Link href={rows.prev_page_url ?? '#'} preserveScroll>
                                                    Previous
                                                </Link>
                                            </Button>
                                            <Button asChild variant="outline" size="sm" disabled={!rows.next_page_url}>
                                                <Link href={rows.next_page_url ?? '#'} preserveScroll>
                                                    Next
                                                </Link>
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

DataShow.layout = {
    breadcrumbs: [
        { title: 'Data', href: index() },
        { title: 'Table', href: '#' },
    ],
};