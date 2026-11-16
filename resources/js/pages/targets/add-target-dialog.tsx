import { useForm } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { FormEvent, useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { store } from '@/routes/targets';

const modes = [
    { value: 'upsert', label: 'Upsert', hint: 'Update existing rows by key, insert new ones' },
    { value: 'replace', label: 'Replace', hint: 'Delete all rows, then insert the sheet' },
    { value: 'append', label: 'Append', hint: 'Always insert (can create duplicates)' },
];

export function AddTargetDialog({ tabId, tabName }: { tabId: string; tabName: string }) {
    const [open, setOpen] = useState(false);
    const form = useForm({ table_name: '', write_mode: 'upsert' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(store.url(tabId), {
            preserveScroll: true,
            only: ['spreadsheet'],
            onSuccess: () => {
                form.reset();
                setOpen(false);
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Plus className="size-4" /> Add target
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add target for “{tabName}”</DialogTitle>
                    <DialogDescription>
                        Choose the database table this tab feeds. Columns are mapped in the next step.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={submit} className="flex flex-col gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="table_name">Table name</Label>
                        <Input
                            id="table_name"
                            value={form.data.table_name}
                            onChange={(e) => form.setData('table_name', e.target.value)}
                            placeholder="sales"
                            className="font-mono"
                        />
                        {form.errors.table_name && (
                            <p className="text-sm text-destructive">{form.errors.table_name}</p>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label>Write mode</Label>
                        <Select value={form.data.write_mode} onValueChange={(v) => form.setData('write_mode', v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {modes.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>
                                        {m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {modes.find((m) => m.value === form.data.write_mode)?.hint}
                        </p>
                        {form.errors.write_mode && (
                            <p className="text-sm text-destructive">{form.errors.write_mode}</p>
                        )}
                    </div>

                    <Button type="submit" disabled={form.processing} className="w-fit">
                        Add target
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}