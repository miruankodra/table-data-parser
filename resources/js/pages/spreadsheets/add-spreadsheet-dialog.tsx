import { router, useForm } from '@inertiajs/react';
import { Copy, Plus, RefreshCw } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { store } from '@/routes/spreadsheets';

interface DriveFile {
    id: string;
    name: string;
    modified: string | null;
}

interface Props {
    serviceAccountEmail: string | null;
    available?: { files: DriveFile[]; error: string | null };
    addedIds: string[];
}

export function AddSpreadsheetDialog({ serviceAccountEmail, available, addedIds }: Props) {
    const [open, setOpen] = useState(false);
    const form = useForm({ name: '', google_spreadsheet_id: '' });

    const loadList = () => router.reload({ only: ['available'] });

    const onOpenChange = (value: boolean) => {
        setOpen(value);
        if (value) loadList(); // ask Google only when the dialog opens
    };

    const addDiscovered = (f: DriveFile) =>
        router.post(
            store.url(),
            { name: f.name, google_spreadsheet_id: f.id },
            {
                preserveScroll: true,
                onSuccess: loadList, // a normal visit drops optional props, so request it again
                onError: (errors) => alert(Object.values(errors).join('\n')),
            },
        );

    const submitManual = (e: FormEvent) => {
        e.preventDefault();
        form.post(store.url(), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setOpen(false);
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="size-4" /> Add spreadsheet
                </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Add spreadsheet</DialogTitle>
                    <DialogDescription>
                        Share a Google Sheet with the service account and it shows up below.
                    </DialogDescription>
                </DialogHeader>

                {serviceAccountEmail ? (
                    <Alert>
                        <AlertTitle>Share with this email (Viewer)</AlertTitle>
                        <AlertDescription className="flex items-center gap-2">
                            <code className="rounded bg-muted px-2 py-1 text-xs break-all">
                                {serviceAccountEmail}
                            </code>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => navigator.clipboard.writeText(serviceAccountEmail)}
                            >
                                <Copy className="size-4" />
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : (
                    <Alert variant="destructive">
                        <AlertTitle>No service account key found</AlertTitle>
                        <AlertDescription>Follow the Google setup guide first.</AlertDescription>
                    </Alert>
                )}

                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Shared with the service account</h3>
                    <Button variant="ghost" size="sm" onClick={loadList}>
                        <RefreshCw className="size-4" /> Refresh
                    </Button>
                </div>

                {!available ? (
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : available.error ? (
                    <Alert variant="destructive">
                        <AlertTitle>Could not list spreadsheets</AlertTitle>
                        <AlertDescription>{available.error}</AlertDescription>
                    </Alert>
                ) : available.files.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Nothing shared yet. Share a sheet, then press Refresh.
                    </p>
                ) : (
                    <ul className="divide-y rounded-md border">
                        {available.files.map((f) => (
                            <li key={f.id} className="flex items-center justify-between gap-4 p-3">
                                <div className="min-w-0">
                                    <p className="truncate font-medium">{f.name}</p>
                                    {f.modified && (
                                        <p className="text-xs text-muted-foreground">
                                            Modified {new Date(f.modified).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                                {addedIds.includes(f.id) ? (
                                    <Badge variant="secondary">Added</Badge>
                                ) : (
                                    <Button size="sm" onClick={() => addDiscovered(f)}>
                                        Add
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                <form onSubmit={submitManual} className="flex flex-col gap-3 border-t pt-4">
                    <h3 className="text-sm font-medium">Or paste a URL</h3>

                    <div className="grid gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                            placeholder="Q3 Sales"
                        />
                        {form.errors.name && <p className="text-sm text-destructive">{form.errors.name}</p>}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="google_spreadsheet_id">Spreadsheet URL or ID</Label>
                        <Input
                            id="google_spreadsheet_id"
                            value={form.data.google_spreadsheet_id}
                            onChange={(e) => form.setData('google_spreadsheet_id', e.target.value)}
                            placeholder="https://docs.google.com/spreadsheets/d/…"
                        />
                        {form.errors.google_spreadsheet_id && (
                            <p className="text-sm text-destructive">{form.errors.google_spreadsheet_id}</p>
                        )}
                    </div>

                    <Button type="submit" disabled={form.processing} className="w-fit">
                        {form.processing ? 'Checking access…' : 'Add by URL'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}