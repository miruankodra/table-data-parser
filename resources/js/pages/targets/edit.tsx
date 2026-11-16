import { Head, Link, useForm } from '@inertiajs/react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { FormEvent } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { index, show } from '@/routes/spreadsheets';
import { update } from '@/routes/targets';

interface Mapping {
    source_column: string;
    db_column: string;
    data_type: string;
    is_key: boolean;
}

interface Props {
    target: {
        id: string;
        table_name: string;
        write_mode: 'upsert' | 'replace' | 'append';
        auto_create_table: boolean;
        add_primary_key: boolean;
        mappings: Mapping[];
    };
    context: { spreadsheet_id: string; spreadsheet_name: string; tab_name: string };
    types: string[];
    keyTypes: string[];
    headers?: { names: string[]; error: string | null };
}

/** "Product Name" -> "product_name" (accents stripped, safe for SQL identifiers) */
const slug = (h: string) =>
    h
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/^(\d)/, '_$1')
        .slice(0, 64);

const emptyRow = (): Mapping => ({ source_column: '', db_column: '', data_type: 'text', is_key: false });

export default function TargetEdit({ target, context, types, keyTypes, headers }: Props) {
    const form = useForm({
        table_name: target.table_name,
        write_mode: target.write_mode as string,
        auto_create_table: target.auto_create_table,
        add_primary_key: target.add_primary_key,
        mappings: target.mappings.length ? target.mappings : [emptyRow()],
    });

    const err = form.errors as Record<string, string | undefined>;
    const headersReady = !!headers && !headers.error;
    const headerNames = headers?.names ?? [];

    const setRows = (rows: Mapping[]) => form.setData('mappings', rows);

    const patchRow = (i: number, patch: Partial<Mapping>) =>
        setRows(form.data.mappings.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

    const changeSource = (i: number, value: string) => {
        const row = form.data.mappings[i];
        // keep the DB column in sync with the header only while the user hasn't customized it
        const followSource = row.db_column === '' || row.db_column === slug(row.source_column);
        patchRow(i, { source_column: value, ...(followSource ? { db_column: slug(value) } : {}) });
    };

    const toggleKey = (i: number, checked: boolean) => {
        const row = form.data.mappings[i];
        // text can't be a unique key, so upgrade it automatically
        const needsType = checked && !keyTypes.includes(row.data_type);
        patchRow(i, { is_key: checked, ...(needsType ? { data_type: 'string' } : {}) });
    };

    const changeType = (i: number, value: string) => {
        const row = form.data.mappings[i];
        patchRow(i, { data_type: value, ...(row.is_key && !keyTypes.includes(value) ? { is_key: false } : {}) });
    };

    const removeRow = (i: number) => setRows(form.data.mappings.filter((_, idx) => idx !== i));

    const autoFill = () => {
        const used = new Set(form.data.mappings.map((r) => r.source_column));
        const extra = headerNames
            .filter((h) => !used.has(h))
            .map((h): Mapping => ({ source_column: h, db_column: slug(h), data_type: 'text', is_key: false }));
        const kept = form.data.mappings.filter((r) => r.source_column !== '' || r.db_column !== '');
        setRows([...kept, ...extra]);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.put(update.url(target.id));
    };

    const upsertWithoutKey = form.data.write_mode === 'upsert' && !form.data.mappings.some((r) => r.is_key);

    return (
        <>
            <Head title={`Map columns: ${context.tab_name}`} />
            <form onSubmit={submit} className="flex flex-col gap-4 p-4">
                <div>
                    <h1 className="text-xl font-semibold">Column mapping</h1>
                    <p className="text-sm text-muted-foreground">
                        {context.spreadsheet_name} / {context.tab_name}
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Destination</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                        <div className="grid gap-2">
                            <Label htmlFor="table_name">Table name</Label>
                            <Input
                                id="table_name"
                                value={form.data.table_name}
                                onChange={(e) => form.setData('table_name', e.target.value)}
                                className="font-mono"
                            />
                            {err.table_name && <p className="text-sm text-destructive">{err.table_name}</p>}
                        </div>

                        <div className="grid gap-2">
                            <Label>Write mode</Label>
                            <Select value={form.data.write_mode} onValueChange={(v) => form.setData('write_mode', v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="upsert">Upsert (update by key, insert new)</SelectItem>
                                    <SelectItem value="replace">Replace (delete all, then insert)</SelectItem>
                                    <SelectItem value="append">Append (always insert)</SelectItem>
                                </SelectContent>
                            </Select>
                            {err.write_mode && <p className="text-sm text-destructive">{err.write_mode}</p>}
                        </div>
                        <div className="flex flex-col gap-3 self-end pb-2">
                            <label className="flex items-center gap-3 self-end pb-2 text-sm">
                            <Switch
                                checked={form.data.auto_create_table}
                                onCheckedChange={(v) => form.setData('auto_create_table', v)}
                            />
                            Create the table if it doesn't exist
                        </label>
                        <label className="flex items-center gap-3 text-sm">
                            <Switch
                                checked={form.data.add_primary_key}
                                onCheckedChange={(v) => form.setData('add_primary_key', v)}
                            />
                            <span>
                                Add a generated <code className="font-mono">internal_id</code> (UUID) primary key when the table is created
                            </span>
                        </label>
                        </div>
                    </CardContent>
                </Card>

                {headers?.error && (
                    <Alert variant="destructive">
                        <AlertTitle>Could not read the sheet's headers</AlertTitle>
                        <AlertDescription>
                            {headers.error} You can still type the header names by hand.
                        </AlertDescription>
                    </Alert>
                )}

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Columns</CardTitle>
                        <Button type="button" variant="outline" size="sm" onClick={autoFill} disabled={!headersReady}>
                            <Wand2 className="size-4" /> Auto-fill from headers
                        </Button>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        {!headers && <Skeleton className="h-10 w-full" />}

                        <div className="hidden grid-cols-[1.4fr_1.4fr_1fr_auto_auto] gap-2 px-1 text-xs text-muted-foreground md:grid">
                            <span>Sheet header</span>
                            <span>Database column</span>
                            <span>Type</span>
                            <span title="Identifies a row on re-import (upsert)">Key</span>
                            <span />
                        </div>

                        {form.data.mappings.map((row, i) => {
                            const options = headerNames.includes(row.source_column) || row.source_column === ''
                                ? headerNames
                                : [row.source_column, ...headerNames]; // keep a header that vanished from the sheet visible
                            const missing = headersReady && row.source_column !== '' && !headerNames.includes(row.source_column);

                            return (
                                <div key={i} className="flex flex-col gap-1">
                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.4fr_1.4fr_1fr_auto_auto] md:items-center">
                                        {headersReady ? (
                                            <Select value={row.source_column} onValueChange={(v) => changeSource(i, v)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Choose a header" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {options.map((h) => (
                                                        <SelectItem key={h} value={h}>
                                                            {h}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input
                                                value={row.source_column}
                                                onChange={(e) => changeSource(i, e.target.value)}
                                                placeholder="Header text"
                                            />
                                        )}

                                        <Input
                                            value={row.db_column}
                                            onChange={(e) => patchRow(i, { db_column: e.target.value })}
                                            placeholder="column_name"
                                            className="font-mono"
                                        />

                                        <Select value={row.data_type} onValueChange={(v) => changeType(i, v)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {types.map((t) => (
                                                    <SelectItem key={t} value={t}>
                                                        {t}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <div className="flex justify-center">
                                            <Checkbox
                                                checked={row.is_key}
                                                onCheckedChange={(v) => toggleKey(i, v === true)}
                                                aria-label="Key column"
                                            />
                                        </div>

                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(i)}>
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>

                                    {missing && (
                                        <p className="text-xs text-yellow-500">
                                            "{row.source_column}" is no longer a header in the sheet. It will be skipped on import.
                                        </p>
                                    )}
                                    {err[`mappings.${i}.source_column`] && (
                                        <p className="text-sm text-destructive">{err[`mappings.${i}.source_column`]}</p>
                                    )}
                                    {err[`mappings.${i}.db_column`] && (
                                        <p className="text-sm text-destructive">{err[`mappings.${i}.db_column`]}</p>
                                    )}
                                    {err[`mappings.${i}.data_type`] && (
                                        <p className="text-sm text-destructive">{err[`mappings.${i}.data_type`]}</p>
                                    )}
                                </div>
                            );
                        })}

                        {err.mappings && <p className="text-sm text-destructive">{err.mappings}</p>}
                        {upsertWithoutKey && (
                            <p className="text-sm text-yellow-500">
                                Upsert needs at least one Key column. If no column in this sheet is unique, use Replace or Append instead.
                            </p>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-fit"
                            onClick={() => setRows([...form.data.mappings, emptyRow()])}
                        >
                            <Plus className="size-4" /> Add column
                        </Button>
                    </CardContent>
                </Card>

                <div className="flex gap-2">
                    <Button type="submit" disabled={form.processing}>
                        {form.processing ? 'Saving…' : 'Save mapping'}
                    </Button>
                    <Button asChild type="button" variant="ghost">
                        <Link href={show(context.spreadsheet_id)}>Cancel</Link>
                    </Button>
                </div>
            </form>
        </>
    );
}

TargetEdit.layout = {
    breadcrumbs: [
        { title: 'Spreadsheets', href: index() },
        { title: 'Column mapping', href: '#' },
    ],
};