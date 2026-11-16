# Table Data Parser

Imports data from several Google Sheets files with similar (but not identical) structures into MySQL tables, once a day, driven entirely by configuration that you manage in a web UI. Adding a file, a tab, a column, or a destination table never requires a code change.

Built with **Laravel 13**, **MySQL**, and the Laravel React starter kit (Inertia + shadcn/ui).

> Developed and tested on MariaDB (MySQL-compatible). The Ubuntu setup script installs MySQL 8. See [TESTING.md](TESTING.md) for what was verified, and [GOOGLE_SETUP.md](GOOGLE_SETUP.md) for the Google API credentials.

## What it does

| Need | How it is handled |
|---|---|
| Files with similar structures, extra columns, different column positions | Columns are matched **by header name** (trimmed, case-insensitive), never by position. Unmapped columns are ignored |
| A list of files, tabs, and columns to extract | Stored in the database and edited in the UI |
| Sheet columns and DB columns can be named differently | Each mapping is `sheet header => database column`, for example `price => product_price` |
| One file feeds multiple tables | A tab can have several **targets**, each with its own table and mapping. Different tabs can feed different tables, and several tabs can share one table |
| New column in the config but not in the table | The table is altered (`ALTER TABLE ... ADD COLUMN`) and the column is filled |
| Daily run | Laravel scheduler runs `sheets:import` at 02:00. A **Run now** button and `php artisan sheets:import` do the same on demand |
| Google API credentials | [GOOGLE_SETUP.md](GOOGLE_SETUP.md) |
| Full Ubuntu setup | `scripts/setup-ubuntu.sh` |
| UI to manage everything | Spreadsheets, tabs, targets, column mappings, import logs, and imported data viewers |

The example from the task works exactly as written. A tab with `[date, product_name, price, amount]` is stored in `sales` with `date=>date`, `product_name=>name`, `price=>product_price`, `amount=>amount`.

## Quick start (Ubuntu 22.04 / 24.04)

```bash
git clone <repository-url> table-data-parser
cd table-data-parser
./scripts/setup-ubuntu.sh /path/to/google-service-account.json
php artisan serve --host=0.0.0.0 --port=8000
```

The script is safe to run more than once. It installs PHP, Composer, Node.js, and MySQL, creates the database and a user with a generated password, writes `.env`, installs dependencies, builds the frontend, runs migrations, seeds the admin user, registers the scheduler's cron entry, and prints the service account email to share your sheets with.

Don't have a key yet? Run it without the argument, follow [GOOGLE_SETUP.md](GOOGLE_SETUP.md), then copy the key to `storage/app/google/service-account.json`.

Useful overrides:

```bash
PHP_VERSION=8.4 NODE_MAJOR=22 DB_NAME=parser APP_URL=http://my-server:8000 ./scripts/setup-ubuntu.sh key.json
```

**Login (testing credentials):** `admin@example.com` / `password`. Override with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before running the script, and change them for any real deployment. Public registration is disabled.

## Manual setup (any OS)

Requirements: PHP 8.3+ (with `mbstring`, `xml`, `curl`, `mysql`, `zip`, `bcmath`), Composer 2, Node.js 22+, MySQL 8 or MariaDB 10.6+.

```bash
composer install
cp .env.example .env
php artisan key:generate
```

Create the database and a user that may create and alter tables in it (the app runs DDL at runtime, not just in migrations):

```sql
CREATE DATABASE table_data_parser CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'parser'@'localhost' IDENTIFIED BY 'choose-a-password';
GRANT ALL PRIVILEGES ON table_data_parser.* TO 'parser'@'localhost';
```

Edit `.env` (`DB_*` values and the Google key path, see below), then:

```bash
npm install && npm run build
php artisan migrate --seed
php artisan serve
```

For frontend development use `npm run dev` instead of `npm run build`.

## Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | | MySQL connection. Use `127.0.0.1`, not `localhost` |
| `GOOGLE_APPLICATION_CREDENTIALS` | `storage/app/google/service-account.json` | Path to the service account key, relative to the project root |
| `SHEETS_DATE_FORMAT` | `d/m/Y` | How dates are written in your sheets (a PHP date format) |
| `SHEETS_DATETIME_FORMAT` | empty | Optional format for date-time cells, for example `d/m/Y H:i:s` |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | `admin@example.com`, `password` | Credentials created by the seeder |

After changing `.env`, run `php artisan config:clear`.

## Using the app

1. **Share a Google Sheet** with the service account email (shown at the top of the Spreadsheets page) as *Viewer*.
2. **Spreadsheets → Add spreadsheet.** Every sheet shared with the service account is listed. Click *Add*, or paste a URL or ID.
3. Open the spreadsheet. Under **Available in Google**, add the tabs you want to import. Each tab has a switch and a *Header row* setting.
4. Under a tab, click **Add target**, then choose the destination table name and a write mode. You land in the mapping editor.
5. In the **mapping editor**, choose the sheet headers (a dropdown filled from the live sheet), the database column names, the types, and the key columns. *Auto-fill from headers* adds every header that isn't mapped yet.
6. Click **Run now** on the target. Follow the result in **Import runs**, and see the rows in **Data** or in the *Imported data* section of the spreadsheet page.

To add a column later, add a row to the mapping and save. The next import adds the column to the table and fills it.

### Write modes

| Mode | Behavior | Use for |
|---|---|---|
| `upsert` | Updates the row that has the same **key**, inserts new rows. Needs at least one key column | Sales, orders, anything with a natural identifier |
| `replace` | Deletes every row and reloads the sheet in one transaction | Small lookup sheets where the sheet is the full truth |
| `append` | Always inserts | Log-style data where duplicates are acceptable |

### Column types

`text`, `string` (varchar 191), `integer`, `decimal` (15,4), `date`, `datetime`, `boolean`. The type is used when a column is **created**. Key columns must be `string`, `integer`, `date`, or `datetime`, because MySQL can't build a unique index on `text`.

### Command line

```bash
php artisan sheets:import                       # every active target
php artisan sheets:import --target=<target-id>  # one target
php artisan schedule:list                       # shows the daily 02:00 job
```

The scheduler needs one cron entry (the setup script installs it):

```
* * * * * cd /path/to/project && php artisan schedule:run >> /dev/null 2>&1
```

The job runs at 02:00 in the application time zone (`APP_TIMEZONE`).

## How it works

```
spreadsheets 1──* sheet_tabs 1──* targets 1──* column_mappings
                                     └──* import_runs
```

| Table | Holds |
|---|---|
| `spreadsheets` | One row per Google file |
| `sheet_tabs` | The tabs to read, and the header row of each |
| `targets` | A destination table and write mode for a tab. A tab may have several |
| `column_mappings` | `source_column => db_column`, type, and whether it is a key |
| `import_runs` | One log row per target per run: status, counts, and messages |

The imported data tables (`sales`, ...) are created by the app at runtime. They are not part of the migrations.

For every active target, the import:

1. Reads the tab **once** from Google, then reuses it for every target of that tab.
2. Creates the table, or adds missing columns, so it matches the mapping (existing tables are never dropped or retyped).
3. Matches each mapping to the live header row by name. A missing header is skipped with a warning.
4. Converts each value to its column type. Unreadable values become `NULL` and are counted in a warning.
5. Writes in chunks of 500 using the write mode.
6. Records the result: `success`, `partial` (completed with warnings), or `failed`.

One broken target never stops the others. Each target is isolated.

## Design decisions

- **Config in the database, not a file.** It is editable through the UI and can be validated. Names are never derived from sheet names, because tabs get renamed.
- **Service account, not OAuth.** The daily job runs unattended, and a user's refresh token would expire. The account has read-only scopes (`spreadsheets.readonly`, `drive.metadata.readonly`).
- **Header matching ignores case and extra spaces.** Blank headers are ignored, and for duplicate headers the first one wins, with a warning.
- **Duplicates on re-import are prevented with upsert** and a unique index on the key columns, created automatically. The index name is generated per table.
- **Generated tables get an `internal_id` UUID primary key** (ordered UUIDs). It is an internal row identity and is hidden in the UI. It is never used to match rows, because the key columns do that. It can be turned off per target, and it is only ever added to tables the app creates.
- **Safety around DDL.** Table and column names must match `^[a-z_][a-z0-9_]{0,63}$`. The app's own tables (`users`, `migrations`, the config tables, and so on) can't be targets, are checked before every `CREATE`, `ALTER`, and write, and are never shown by the data viewers. Values are written with parameter binding.
- **Imports started from the UI run after the response** (no queue worker needed). A run stuck in `running` for more than 15 minutes is treated as crashed.

## Limitations

- **Numbers are read as displayed in the sheet.** The importer assumes `1,234.56` formatting, with a comma for thousands. Set each sheet's locale (File → Settings → Locale) to a one that uses a decimal point, such as United States. A locale with decimal commas turns `1,10` into `110`.
- **Dates use one global format** (`SHEETS_DATE_FORMAT`). Impossible dates (`31/02/2026`) become `NULL`.
- **Existing columns are never changed.** Only missing columns are added. Changing a column's type, or renaming `db_column`, doesn't alter the existing column (a rename creates a new column and leaves the old one).
- **Upsert never deletes.** Rows removed from the sheet stay in the table. Use `replace` to mirror deletions.
- **A whole tab is loaded into memory.** Fine for tens of thousands of rows, not for millions.
- **Only native Google Sheets are discovered.** An `.xlsx` stored in Drive must be opened and saved as a Google Sheet.
- **Several tabs can feed one table**, and then the rows are shown together. The row doesn't record its source.
- **Hidden rows and columns** are still returned by the Google API, and merged cells only carry their value in the top-left cell.
- **Under `php artisan serve`**, which is single-threaded, the UI waits while a long import runs. Under PHP-FPM, or with a queue worker, this doesn't occur.

## Project layout

```
app/Services/GoogleSheetsService.php   Google Sheets and Drive access, header parsing
app/Services/SchemaManager.php         CREATE / ALTER TABLE, unique index, safety checks
app/Services/ImportService.php         the import pipeline and run logging
app/Services/ValueCaster.php           value conversion per column type
app/Console/Commands/ImportSheets.php  php artisan sheets:import
app/Http/Controllers/                  Spreadsheet, SheetTab, Target, ImportRun, Data
resources/js/pages/                    spreadsheets/, targets/, import-runs/, data/
scripts/setup-ubuntu.sh                one-shot Ubuntu installer
```

## Security notes

- The service account key is a secret. It is git-ignored, so never commit it. If it leaks, delete the key in Google Cloud and create a new one.
- Every page requires login. Change the seeded credentials, and keep `APP_ENV=production` and `APP_DEBUG=false` on a real server.