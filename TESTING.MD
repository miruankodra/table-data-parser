# Testing

This file maps each requirement of the task to a way of verifying it, with the evidence behind it. The check marks show what has been verified so far. The remaining boxes are filled in as the checks are run.

Legend: ✅ verified, ☐ not yet verified.

## Environment

- Laravel 13, PHP 8.3+, MariaDB (MySQL-compatible) for development, MySQL 8 installed by `scripts/setup-ubuntu.sh`.
- Real Google Sheets, read through a service account (see [GOOGLE_SETUP.md](GOOGLE_SETUP.md)).
- Sheets must use the **United States locale** (File → Settings → Locale), so that numbers read as `1.10`.

## Test data

The spreadsheets are generated as `.xlsx` files in `docs/fixtures/`. To use them: upload to Google Drive, open each one, choose **File → Save as Google Sheets**, then share the result with the service account.

| File | Tabs | Purpose |
|---|---|---|
| `sales-january.xlsx` | `Sales` | The task's example: `Date, Product Name, Price, Amount` (5 rows) |
| `sales-february.xlsx` | `Sales` | Different column order, plus an extra `Notes` column (5 rows) |
| `sales-partner.xlsx` | `Sales`, `Inventory` | Messy headers (` product name`, `PRICE `), and a second tab feeding a different table |
| `edge-cases.xlsx` | `Data` | Blank header, duplicate header, empty row, empty key, impossible date, non-numeric price, `1,200.50` |

Mapping used for `sales` (upsert, keys `date` and `name`):

| Sheet header | Database column | Type | Key |
|---|---|---|---|
| Date | `date` | date | yes |
| Product Name | `name` | string | yes |
| Price | `product_price` | decimal | |
| Amount | `amount` | integer | |

## Requirement checklist

| # | Requirement from the task | How to verify | Result |
|---|---|---|---|
| 1 | Sheets with similar structures, extra columns, different column positions | Import January, February, and Partner into `sales`. Values land in the right columns and `Notes` doesn't leak into unmapped tables | ✅ January and February (`docs/screenshots/data-sales.png`) |
| 2 | Takes a list of files, extracts from each, saves daily | **Run all** imports every active target. `php artisan schedule:list` shows `sheets:import` at 02:00. For a live check, temporarily use `->everyMinute()` with `php artisan schedule:work` | ☐ |
| 3 | Configuration for files, tabs, and columns | Spreadsheets page, spreadsheet page (tabs), mapping editor (columns) | ✅ |
| 4 | Matching between file and database table | Each target names its table, and the mapping editor sets the column pairs | ✅ |
| 5 | Different column names, and one file saved into multiple tables | Map `price => product_price`. Add a second target on the same tab for table `products`, and a second tab for table `inventory`. Both tables are created from one file | ☐ |
| 6 | New config column triggers `ALTER TABLE` and is filled | Add `Notes => notes` to a target of an existing table and run. The run shows `info: Added columns to sales: notes` and the column is filled | ✅ (`notes` filled for February rows) |
| 7 | Instructions for Google API tokens | Follow [GOOGLE_SETUP.md](GOOGLE_SETUP.md) from nothing | ☐ |
| 8 | Repository with setup instructions | Clone into a new folder and follow [README.md](README.md) | ☐ |
| 9 | Laravel and MySQL | `php artisan db:show` | ✅ MariaDB. ☐ MySQL 8 via the setup script |
| 10 | Ubuntu setup script | Run `scripts/setup-ubuntu.sh` in a clean Ubuntu container (below) | ☐ |
| 11 | UI that manages the functionality | Items 3 to 6 are done through the UI only, without tinker or SQL | ✅ |

## Behaviors the task implies

| Scenario | Expected | Result |
|---|---|---|
| Run the same import twice | Same row count, same `internal_id` values | ✅ |
| Change a price in the sheet, run | The row is updated in place, with no duplicate | ☐ |
| Add a row to the sheet, run | One new row | ☐ |
| Re-run with a table shared by several sources | No key collisions between sources | ✅ (January, February, and edge cases share `sales`) |
| Change the key columns of an existing target, run | The unique index is replaced, with `info: Created unique index ...` | ☐ |
| Rename a mapped header in the sheet | Run is `partial` with a warning, and other columns still import | ☐ |
| Unshare the sheet, run | Run is `failed` with a "Share the spreadsheet with ..." message, and other targets still run | ☐ |
| Point a target at `users` | Run is `failed` with `Unsafe table name`, and `users` is untouched. The table never shows in the Data pages | ☐ |

## Dirty data (`edge-cases.xlsx`)

Imported into `sales` with the same mapping. Result: status `partial`, 6 rows read, 3 written, and these warnings (`docs/screenshots/import-runs.png`):

```
warning: Duplicate header `Price` in column 6 ignored; the first one is used.
warning: 1 value(s) in `price` could not be converted and were stored as NULL.
warning: 1 value(s) in `date` could not be converted and were stored as NULL.
warning: 2 row(s) skipped because a key column was empty or invalid.
```

| Input | Outcome |
|---|---|
| Duplicate `Price` header, blank-header column | Ignored, with a warning for the duplicate |
| `abc` in a decimal column | `NULL`, counted in a warning (never silently `0`) |
| `31/02/2026` in a date column | `NULL`, not rolled over to March |
| Empty product name (a key column) | Row skipped, counted in a warning |
| Fully empty row | Skipped |
| `1,200.50` | Stored as `1200.5` |

Status: ✅

## Fresh-install test (items 7, 8, 10)

Run the setup script in a clean Ubuntu container, from a fresh `git clone`, using only the README:

```bash
podman run --rm -it -p 8000:8000 docker.io/library/ubuntu:24.04 bash

# inside the container
apt-get update && apt-get install -y git
git clone <repository-url> /app && cd /app
# copy the service account key into the container, then:
./scripts/setup-ubuntu.sh /path/to/key.json
php artisan serve --host=0.0.0.0 --port=8000
```

Then open <http://localhost:8000>, log in, add one sheet, map it, and import it. Check `git status` and `git check-ignore -v storage/app/google/service-account.json` before pushing: the key must be ignored.

Result: ☐

## Screenshots

Place the images in `docs/screenshots/`:

- `data-sales.png`: the `sales` table with rows from several sources and the filled `notes` column
- `import-runs.png`: the Import runs page with a `partial` run expanded to show its warnings
- `mapping-editor.png`: the column mapping editor with header dropdowns