# Maybank to YNAB

A simple web app to import Maybank PDF statements directly into YNAB (You Need A Budget).

## Features

- Parse Maybank PDF statements in your browser (no server upload)
- Auto-detect payees and categories based on transaction descriptions
- Bulk import to YNAB via API
- Duplicate detection using YNAB's import_id
- Mobile-friendly (works on iPhone Safari)
- Completely free (hosted on GitHub Pages)

## Usage

1. **Get your YNAB API token**
   - Go to [YNAB Developer Settings](https://app.ynab.com/settings/developer)
   - Create a new Personal Access Token
   - Copy the token

2. **Open the app**
   - Visit [https://i-ymka.github.io/maybank2ynab/](https://i-ymka.github.io/maybank2ynab/)

3. **Enter your token**
   - Paste your YNAB API token and click Save
   - The app will connect to your YNAB account

4. **Upload statements**
   - Download PDF statements from Maybank2U (not from email - encrypted PDFs don't work)
   - Drag & drop the PDF files into the upload area

5. **Review and import**
   - Preview the parsed transactions
   - Click "Import to YNAB" to send them to your budget

## Privacy & Security

- Your YNAB token is stored only in your browser's localStorage
- PDF files are processed entirely in your browser
- No data is ever sent to any server (except YNAB's official API)
- All code is open source

## Supported Transaction Types

| Bank Transaction Type | Action |
|----------------------|--------|
| SALE DEBIT | Import as outflow |
| PAYMENT FR A/C | Import as outflow |
| TRANSFER FR A/C | Import as outflow |
| TRANSFER TO A/C | Import as inflow |
| FPX REFUND BUYER | Import as inflow |
| DIVIDEND PAID | Import as inflow |
| PRE-AUTH DEBIT | Skipped |
| PRE-AUTH REFUND | Skipped |

## Tech Stack

- Pure JavaScript (no framework)
- [PDF.js](https://mozilla.github.io/pdf.js/) for PDF parsing
- [YNAB API](https://api.ynab.com/) for transaction import
- GitHub Pages for hosting

## Local Development

Just open `index.html` in your browser. No build step required.

```bash
# Or use a local server
python -m http.server 8000
# Then open http://localhost:8000
```

## License

MIT
