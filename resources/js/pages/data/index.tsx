import { Head, Link } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { index, show } from '@/routes/data';

interface TableInfo {
    name: string;
    exists: boolean;
    rows: number | null;
    columns: number | null;
}

export default function DataIndex({ tables }: { tables: TableInfo[] }) {
    return (
        <>
            <Head title="Data" />
            <div className="flex flex-col gap-4 p-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Imported tables</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Table</TableHead>
                                    <TableHead className="text-right">Rows</TableHead>
                                    <TableHead className="text-right">Columns</TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tables.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                                            No tables yet. Add a target to a spreadsheet tab first.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {tables.map((t) => (
                                    <TableRow key={t.name}>
                                        <TableCell className="font-mono text-sm">
                                            <Link href={show(t.name)} className="hover:underline">
                                                {t.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-right">{t.rows ?? '-'}</TableCell>
                                        <TableCell className="text-right">{t.columns ?? '-'}</TableCell>
                                        <TableCell>
                                            {!t.exists && <Badge variant="secondary">Not created yet</Badge>}
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

DataIndex.layout = {
    breadcrumbs: [{ title: 'Data', href: index() }],
};