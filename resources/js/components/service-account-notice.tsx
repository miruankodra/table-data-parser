import { usePage } from '@inertiajs/react';
import { Check, Copy, Share2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function ServiceAccountNotice({ compact = false }: { compact?: boolean }) {
    const { googleServiceAccountEmail: email } = usePage<{
        googleServiceAccountEmail: string | null;
    }>().props;
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        if (!email) return;
        await navigator.clipboard.writeText(email);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    if (!email) {
        return (
            <Alert variant="destructive">
                <TriangleAlert className="size-4" />
                <AlertTitle>Google service account not configured</AlertTitle>
                <AlertDescription>
                    Spreadsheets can't be discovered until the service account key is installed. Follow the
                    Google setup guide.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <Alert>
            <Share2 className="size-4" />
            <AlertTitle>Share your sheets to make them discoverable</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
                <span>
                    {compact
                        ? 'Share a Google Sheet with this email as Viewer and it appears in the list below.'
                        : 'To discover spreadsheets automatically, share each Google Sheet with this service account email as Viewer. Shared sheets then appear under "Add spreadsheet".'}
                </span>

                <span className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 text-xs break-all">{email}</code>
                    <Button type="button" variant="outline" size="sm" onClick={copy}>
                        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                        {copied ? 'Copied' : 'Copy'}
                    </Button>
                </span>

                {!compact && (
                    <ol className="list-inside list-decimal text-xs text-muted-foreground">
                        <li>Open the sheet in Google Sheets and click Share.</li>
                        <li>Paste the email above and choose the Viewer role.</li>
                        <li>Come back here and click Add spreadsheet.</li>
                    </ol>
                )}
            </AlertDescription>
        </Alert>
    );
}