import { Head, Link, router } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { destroy, index, update, show } from '@/routes/spreadsheets';
import { ServiceAccountNotice } from '@/components/service-account-notice';
import { AddSpreadsheetDialog } from './add-spreadsheet-dialog';

interface SpreadsheetRow {
    id: string;
    name: string;
    google_spreadsheet_id: string;
    is_active: boolean;
    tabs_count: number;
}

interface Props {
    spreadsheets: SpreadsheetRow[];
    serviceAccountEmail: string | null;
    available?: { files: { id: string; name: string; modified: string | null }[]; error: string | null };
}

export default function SpreadsheetsIndex({ spreadsheets, serviceAccountEmail, available }: Props) {
    const toggle = (s: SpreadsheetRow, value: boolean) =>
        router.patch(update.url(s.id), { is_active: value }, { preserveScroll: true });

    const remove = (s: SpreadsheetRow) => {
        if (confirm(`Delete "${s.name}" and its configuration? Imported data stays in the database.`)) {
            router.delete(destroy.url(s.id), { preserveScroll: true });
        }
    };

    return (
        <>
            <Head title="Spreadsheets" />
            <div className="flex flex-col gap-4 p-4">
                <ServiceAccountNotice />
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Spreadsheets</CardTitle>
                        <AddSpreadsheetDialog
                            serviceAccountEmail={serviceAccountEmail}
                            available={available}
                            addedIds={spreadsheets.map((s) => s.google_spreadsheet_id)}
                        />
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Spreadsheet ID</TableHead>
                                    <TableHead className="text-right">Tabs</TableHead>
                                    <TableHead>Active</TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {spreadsheets.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                                            No spreadsheets yet. Add your first one.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {spreadsheets.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell className="font-medium">
                                            <Link href={show(s.id)} className="hover:underline">{s.name}</Link>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {s.google_spreadsheet_id.slice(0, 12)}…
                                        </TableCell>
                                        <TableCell className="text-right">{s.tabs_count}</TableCell>
                                        <TableCell>
                                            <Switch
                                                checked={s.is_active}
                                                onCheckedChange={(v) => toggle(s, v)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => remove(s)}>
                                                <Trash2 className="size-4" />
                                            </Button>
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

SpreadsheetsIndex.layout = {
    breadcrumbs: [{ title: 'Spreadsheets', href: index() }],
};