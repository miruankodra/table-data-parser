export interface ImportRunRow {
    id: string;
    status: 'running' | 'success' | 'partial' | 'failed';
    spreadsheet: string | null;
    tab: string | null;
    table: string | null;
    rows_read: number;
    rows_written: number;
    message: string | null;
    started_at: string | null;
}