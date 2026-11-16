import { Link, router } from '@inertiajs/react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { show } from '@/routes/data';

export interface PreviewTable {
    name: string;
    exists: boolean;
    shared: boolean;
    total: number;
    columns: string[];
    rows: Record<string, string | number | null>[];
}

export function DataPreview({ tables }: { tables?: PreviewTable[] }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Imported data</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => router.reload({ only: ['dataPreview'] })}>
                    <RefreshCw className="size-4" /> Refresh
                </Button>
            </CardHeader>

            <CardContent>
                {!tables ? (
                    <Skeleton className="h-32 w-full" />
                ) : tables.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tables yet. Add a target to a tab and run an import.</p>
                ) : (
                    <Tabs defaultValue={tables[0].name}>
                        <TabsList className="h-auto flex-wrap">
                            {tables.map((t) => (
                                <TabsTrigger key={t.name} value={t.name} className="font-mono text-xs">
                                    {t.name}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {tables.map((t) => (
                            <TabsContent key={t.name} value={t.name} className="flex flex-col gap-3">
                                {!t.exists ? (
                                    <p className="text-sm text-muted-foreground">
                                        This table hasn't been created yet. Run an import for its target first.
                                    </p>
                                ) : (
                                    <>
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        {t.columns.map((c) => (
                                                            <TableHead key={c} className="font-mono text-xs">
                                                                {c}
                                                            </TableHead>
                                                        ))}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {t.rows.length === 0 && (
                                                        <TableRow>
                                                            <TableCell
                                                                colSpan={Math.max(t.columns.length, 1)}
                                                                className="text-center text-muted-foreground"
                                                            >
                                                                The table is empty.
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                    {t.rows.map((row, i) => (
                                                        <TableRow key={i}>
                                                            {t.columns.map((c) => (
                                                                <TableCell key={c}>
                                                                    {row[c] === null || row[c] === undefined ? (
                                                                        <span className="text-xs text-muted-foreground">NULL</span>
                                                                    ) : (
                                                                        <span className="block max-w-xs truncate" title={String(row[c])}>
                                                                            {String(row[c])}
                                                                        </span>
                                                                    )}
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>

                                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                                            <span className="flex items-center gap-2">
                                                Showing {t.rows.length} of {t.total} rows
                                                {t.shared && (
                                                    <Badge variant="outline" title="Another spreadsheet also writes to this table">
                                                        Shared table
                                                    </Badge>
                                                )}
                                            </span>
                                            <Button asChild variant="outline" size="sm">
                                                <Link href={show(t.name)}>View all</Link>
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </TabsContent>
                        ))}
                    </Tabs>
                )}
            </CardContent>
        </Card>
    );
}