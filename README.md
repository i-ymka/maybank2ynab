# Maybank → YNAB

> Browser-based tool to import Maybank PDF statements directly into [YNAB](https://ynab.com). No server, no uploads — everything runs in your browser.

![Maybank to YNAB](assets/screenshot.png)

**[→ Open the app](https://i-ymka.github.io/maybank2ynab/)**

---

## Why this exists

If you use YNAB manually with a Maybank account, you've probably noticed that your YNAB balance and your actual bank balance don't always match — even when you're careful. Transactions slip through, especially QR code payments.

When you pay via QR code in Malaysia, Maybank doesn't record the merchant name — just a string of random characters. A week later, you have no idea what that MYR 42.50 was for. This tool lets you import your full PDF statement, see every transaction at once, and label the mystery ones before they disappear from memory.

It also checks your existing YNAB entries and skips duplicates, so you can safely import even if you've already entered some transactions manually.

---

## How it works

1. **Get your YNAB API token**
   - Go to [YNAB Developer Settings](https://app.ynab.com/settings/developer)
   - Create a Personal Access Token
   - Copy it

2. **Open the app** → paste your token → click Save
   - The app connects to your YNAB account and loads your budgets

3. **Download your Maybank statement**
   - Log into [Maybank2U](https://www.maybank2u.com.my)
   - Download PDF statement (use the web portal — email PDFs are encrypted and won't work)

4. **Drag & drop the PDF** into the upload area
   - The app parses transactions directly in your browser
   - Multiple PDFs supported at once

5. **Review transactions**
   - Payees and categories are suggested automatically for common Malaysian merchants
   - Fix anything that's wrong — the app **learns your corrections** and applies them to similar transactions next time
   - Transactions already in YNAB are marked as duplicates and skipped automatically

6. **Click "Import to YNAB"**

---

## Features

- Parses Maybank PDF statements in-browser (no server)
- Auto-suggests payees and categories for common Malaysian merchants
- **Self-learning** — correcting a payee/category saves it to your browser and applies it to similar transactions automatically next time
- **Duplicate detection** — checks against existing YNAB entries so you can safely import even if you've already added some transactions manually
- Supports multiple statements at once
- Works on mobile (iPhone Safari)
- Free — hosted on GitHub Pages

---

## Privacy & Security

- Your YNAB token is stored only in your browser's `localStorage`
- PDFs never leave your device
- No data is sent anywhere except YNAB's official API
- Learned mappings are stored locally in your browser

---

## Supported Transaction Types

| Type | Imported as |
|------|------------|
| SALE DEBIT | Outflow |
| PAYMENT FR A/C | Outflow |
| TRANSFER FR A/C | Outflow |
| TRANSFER TO A/C | Inflow |
| FPX REFUND BUYER | Inflow |
| DIVIDEND PAID | Inflow |
| PRE-AUTH DEBIT | Skipped |
| PRE-AUTH REFUND | Skipped |

---

## Local Development

No build step — just open `index.html` in your browser.

```bash
python -m http.server 8000
# open http://localhost:8000
```

---

## Stack

Pure JavaScript · [PDF.js](https://mozilla.github.io/pdf.js/) · [YNAB API](https://api.ynab.com/) · GitHub Pages

---

MIT License
