# Google API setup

The app reads spreadsheets through a **service account**: a robot identity with its own email address and a JSON key file. It can open only the spreadsheets that someone shares with that email, and it needs no human login, which makes it suitable for the unattended daily import.

Setup takes about 10 minutes and has four parts: create a project and enable two APIs, create a service account and key, install the key in the app, and share your sheets with the service account.

> **Which "token" is this?** The task asks for instructions on creating "Google API tokens". For a daily unattended job, the credential is the service account's JSON key (steps 1 to 4). No OAuth consent screen or user login is involved.

## 1. Create a Google Cloud project

1. Open <https://console.cloud.google.com> and sign in with any Google account.
2. Click the project selector at the top, then **New Project**.
3. Name it (for example `sheets-importer`) and click **Create**.
4. Make sure the new project is selected in the project selector.

## 2. Enable the two APIs

In **APIs & Services → Library**, search for each API and click **Enable**:

| API | Used for |
|---|---|
| **Google Sheets API** | Reading the tabs, headers, and rows |
| **Google Drive API** | Listing the spreadsheets shared with the service account (names and IDs only) |

If you skip the Drive API, reading a sheet by URL still works, but the "shared with the service account" list in the Add dialog shows an error.

## 3. Create the service account and its key

1. Go to **IAM & Admin → Service Accounts → Create service account**.
2. Enter a name (for example `sheets-reader`) and click **Create and continue**.
3. Skip the optional steps ("Grant this service account access" and "Grant users access") and click **Done**. It needs no project roles, because access is granted per sheet.
4. Click the new account, open the **Keys** tab, then **Add key → Create new key → JSON → Create**.
5. A `.json` file downloads. **Google can't show it again**, so keep it safe.

Note the account's email address, for example `sheets-reader@sheets-importer.iam.gserviceaccount.com`. It is on the account's *Details* tab, and also inside the key file as `client_email`. The app displays it for you as well.

> If **Create new key** is disabled, your Google Workspace administrator has blocked key creation (the `iam.disableServiceAccountKeyCreation` policy). Create the project under a personal Google account instead.

## 4. Install the key in the app

Copy the file to:

```
storage/app/google/service-account.json
```

```bash
mkdir -p storage/app/google
cp ~/Downloads/<your-key-file>.json storage/app/google/service-account.json
chmod 600 storage/app/google/service-account.json
```

Check that `.env` points to it, then clear the config cache:

```
GOOGLE_APPLICATION_CREDENTIALS=storage/app/google/service-account.json
```

```bash
php artisan config:clear
```

The setup script does all of this for you: `./scripts/setup-ubuntu.sh /path/to/key.json`.

The key file is a secret. It is git-ignored, so never commit it or paste it anywhere. If it leaks, delete it in **Service Accounts → Keys** and create a new one.

## 5. Share your Google Sheets with the service account

For each spreadsheet you want to import:

1. Open it in Google Sheets and click **Share**.
2. Paste the service account email.
3. Choose the **Viewer** role, which is all the app needs.
4. Click **Send**. If Google offers to notify the account, you can untick that.

You can also share a **folder** with the account, and every sheet in it becomes visible.

If the sheet belongs to someone else, such as a reviewer testing with their own files, ask them to share it with the same email, or to follow this guide to create their own service account and key.

## 6. Verify

```bash
php artisan tinker
```

```php
$g = app(App\Services\GoogleSheetsService::class);
$g->serviceAccountEmail();                    // prints the email address
$g->listSpreadsheets();                       // the sheets shared with it
$g->getTabs('<spreadsheet-id>');              // tab names
$g->readTab('<spreadsheet-id>', 'Sheet1');    // headers, rows, warnings
```

The spreadsheet ID is the long string in the URL: `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.

In the web UI, open **Spreadsheets → Add spreadsheet**. A shared sheet appears in the list within a few seconds (use **Refresh** if it doesn't).

## Troubleshooting

| Message or symptom | Cause and fix |
|---|---|
| `Service account key not found at ...` | The file isn't at the path in `.env`, or the config is cached. Run `php artisan config:clear` |
| `Access denied. Share the spreadsheet with ...` (403) | The sheet isn't shared with the service account, or the Sheets API or Drive API isn't enabled in the project |
| `Spreadsheet not found` (404) | Wrong URL or ID |
| `Tab not found or unreadable range` (400) | The tab name is wrong, or the tab was renamed. Add it again from the list |
| `Google rate limit reached` (429) | Too many requests. Try again in a minute |
| The shared list is empty but pasting a URL works | The Drive API isn't enabled, or the sheet was shared only as "anyone with the link". Share it directly with the email |
| A sheet is missing from the list | Only native Google Sheets are listed. If it's an `.xlsx` in Drive, open it and use **File → Save as Google Sheets** |
| Prices import as `110` instead of `1.10` | The sheet's locale uses decimal commas. Set **File → Settings → Locale** to a locale with a decimal point, such as United States |

## Revoking access

- **One sheet:** remove the service account from that sheet's sharing settings.
- **Everything:** delete the key in **Service Accounts → Keys**, or delete the service account. The next import then fails with a clear message, and no data is touched.