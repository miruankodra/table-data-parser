import { Head, Link, router } from '@inertiajs/react';
import { ExternalLink, Pencil, Trash2, Play } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { index } from '@/routes/spreadsheets';
import { destroy as destroyTab, store as storeTab, update as updateTab } from '@/routes/tabs';
import { destroy as destroyTarget, edit as editTarget } from '@/routes/targets';
import { store as startRun } from '@/routes/import-runs';
import { AddTargetDialog } from '../targets/add-target-dialog';
import { DataPreview, PreviewTable } from '@/components/spreadsheets/data-preview';

interface TargetRow {
    id: string;
    table_name: string;
    write_mode: 'upsert' | 'replace' | 'append';
    is_active: boolean;
    mappings_count: number;
}

interface TabRow {
    id: string;
    name: string;
    header_row: number;
    is_active: boolean;
    targets: TargetRow[];
}

interface Props {
    spreadsheet: {
        id: string;
        name: string;
        google_spreadsheet_id: string;
        is_active: boolean;
        tabs: TabRow[];
    };
    googleTabs?: { names: string[]; error: string | null };
    dataPreview?: PreviewTable[];
}

// Mutations only refresh `spreadsheet`, so the Google tab list isn't re-fetched every click
const opts = { preserveScroll: true, only: ['spreadsheet'] };

export default function SpreadsheetShow({ spreadsheet, googleTabs, dataPreview }: Props) {
    const knownNames = spreadsheet.tabs.map((t) => t.name);
    const googleNames = googleTabs?.names ?? [];
    const notYetAdded = googleNames.filter((n) => !knownNames.includes(n));
    const googleLoaded = !!googleTabs && !googleTabs.error;

    const addTab = (name: string) => router.post(storeTab.url(spreadsheet.id), { name }, opts);
    const toggleTab = (t: TabRow, v: boolean) => router.patch(updateTab.url(t.id), { is_active: v }, opts);
    const setHeaderRow = (t: TabRow, value: string) => {
        const n = parseInt(value, 10);
        if (n >= 1 && n !== t.header_row) router.patch(updateTab.url(t.id), { header_row: n }, opts);
    };
    const removeTab = (t: TabRow) => {
        if (confirm(`Remove tab "${t.name}" and its targets? Imported data stays in the database.`)) {
            router.delete(destroyTab.url(t.id), opts);
        }
    };
    const removeTarget = (g: TargetRow) => {
        if (confirm(`Remove the target "${g.table_name}"? The table and its data stay in the database.`)) {
            router.delete(destroyTarget.url(g.id), opts);
        }
    };

    return (
        <>
            <Head title={spreadsheet.name} />
            <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold">{spreadsheet.name}</h1>
                        <a
                            href={`https://docs.google.com/spreadsheets/d/${spreadsheet.google_spreadsheet_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
                        >
                            Open in Google Sheets <ExternalLink className="size-3" />
                        </a>
                    </div>
                </div>

                {googleTabs?.error && (
                    <Alert variant="destructive">
                        <AlertTitle>Could not read this spreadsheet from Google</AlertTitle>
                        <AlertDescription>{googleTabs.error}</AlertDescription>
                    </Alert>
                )}

                <h2 className="text-sm font-medium text-muted-foreground">Tabs to import</h2>

                {spreadsheet.tabs.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        No tabs added yet. Add one from the list below.
                    </p>
                )}

                {spreadsheet.tabs.map((t) => (
                    <Card key={t.id} className={t.is_active ? '' : 'opacity-60'}>
                        <CardHeader className="flex flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <CardTitle>{t.name}</CardTitle>
                                {googleLoaded && !googleNames.includes(t.name) && (
                                    <Badge variant="destructive">Not found in Google</Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                    Header row
                                    <Input
                                        type="number"
                                        min={1}
                                        defaultValue={t.header_row}
                                        onBlur={(e) => setHeaderRow(t, e.target.value)}
                                        className="h-8 w-16"
                                    />
                                </label>
                                <Switch checked={t.is_active} onCheckedChange={(v) => toggleTab(t, v)} />
                                <Button variant="ghost" size="icon" onClick={() => removeTab(t)}>
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="flex flex-col gap-3">
                            {t.targets.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    No targets yet. A target says which table this tab feeds.
                                </p>
                            )}

                            {t.targets.map((g) => (
                                <div key={g.id} className="flex items-center justify-between rounded-md border p-3">
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-sm">{g.table_name}</span>
                                        <Badge variant="secondary">{g.write_mode}</Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {g.mappings_count === 0 ? 'No columns mapped' : `${g.mappings_count} columns`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={g.mappings_count === 0}
                                            onClick={() =>
                                                router.post(startRun.url(), { target_id: g.id }, { preserveScroll: true, only: ['spreadsheet', 'flash', 'dataPreview'] })
                                            }
                                        >
                                            <Play className="size-4" /> Run now
                                        </Button>
                                        <Button asChild variant="outline" size="sm">
                                            <Link href={editTarget(g.id)}>
                                                <Pencil className="size-4" /> Edit mapping
                                            </Link>
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => removeTarget(g)}>
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            <div>
                                <AddTargetDialog tabId={t.id} tabName={t.name} />
                            </div>
                        </CardContent>
                    </Card>
                ))}

                <DataPreview tables={dataPreview} />

                <h2 className="mt-2 text-sm font-medium text-muted-foreground">Available in Google</h2>

                {!googleTabs ? (
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : googleTabs.error ? null : notYetAdded.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Every tab in this spreadsheet has been added.</p>
                ) : (
                    <ul className="divide-y rounded-md border">
                        {notYetAdded.map((name) => (
                            <li key={name} className="flex items-center justify-between p-3">
                                <span className="font-medium">{name}</span>
                                <Button size="sm" onClick={() => addTab(name)}>
                                    Add
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
}

SpreadsheetShow.layout = {
    breadcrumbs: [
        { title: 'Spreadsheets', href: index() },
        { title: 'Configure', href: '#' },
    ],
};