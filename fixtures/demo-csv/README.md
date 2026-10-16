# Fake demo CSV datasets

All data here is **invented** for screenshots and manual testing: names, ICE,
phone numbers, e-mails (reserved `example.com`) and amounts. Do not add real
client or employee data to this folder.

| Folder | Profile |
| --- | --- |
| `big-company-casablanca/` | Large company: 100 employees, 50 SaaS tools, 12 months of large invoices (≈ 600) and expenses (≈ 940), 100 contacts |
| `small-ecommerce-maroc/` | Small online shop: 3 staff, 6 tools, 12 months of orders (≈ 420), ad/shipping expenses, 105 contacts |

Files per folder:

- `contacts.csv` — 7 columns `Nom, Type, ICE, Téléphone, Email, Ville, Solde`.
  This is the format the app's **Contacts → CSV import** accepts (≤ 2 MB, ≤ 10,000 rows).
- `employees.csv`, `tools.csv`, `revenue.csv` / `orders.csv`, `expenses.csv` —
  reference datasets. The app has no import path for these yet; they are
  for demos, spreadsheets, or a future importer.

Regenerate (deterministic, seed 2026):

```sh
python3 fixtures/demo-csv/generate.py
```
