#!/usr/bin/env python3
"""Generate FAKE demo CSV datasets for screenshots and manual testing.

Every name, ICE, phone number, e-mail and amount is invented. Emails use the
reserved example.com domain, phones use random numbers, and company names are
fictional. Do not replace them with real data.

Usage:  python3 fixtures/demo-csv/generate.py
Output: fixtures/demo-csv/<profile>/*.csv (deterministic, seed 2026)
"""
import csv
import datetime as dt
import os
import random

ROOT = os.path.dirname(os.path.abspath(__file__))
random.seed(2026)
TODAY = dt.date(2026, 10, 16)


def write(profile, name, header, rows):
    d = os.path.join(ROOT, profile)
    os.makedirs(d, exist_ok=True)
    # utf-8-sig adds a BOM so Excel reads accents correctly.
    with open(os.path.join(d, name), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def phone(prefix="6"):
    return "+212 %s%02d-%06d" % (prefix, random.randint(0, 99), random.randint(0, 999999))


_used_ice = set()


def ice():
    while True:
        n = "00" + "".join(random.choice("0123456789") for _ in range(13))
        if n not in _used_ice:
            _used_ice.add(n)
            return n


def month_starts(n):
    """First day of each of the last n months, oldest first."""
    out = []
    y, m = TODAY.year, TODAY.month
    for _ in range(n):
        out.append(dt.date(y, m, 1))
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    return list(reversed(out))


def rand_day(month_start):
    nxt = dt.date(month_start.year + (month_start.month // 12), month_start.month % 12 + 1, 1)
    last = min(nxt - dt.timedelta(days=1), TODAY)
    span = (last - month_start).days
    return month_start + dt.timedelta(days=random.randint(0, max(span, 0)))


# ---------------------------------------------------------------------------
# Profile 1: large company, ~100 employees, 50 tools, large revenue
# ---------------------------------------------------------------------------
def big_company():
    p = "big-company-casablanca"
    first = ["Karim", "Amina", "Hicham", "Salma", "Rachid", "Nadia", "Omar", "Leila", "Mehdi", "Soukaina",
             "Adil", "Imane", "Yassine", "Zineb", "Anas", "Hajar", "Tarik", "Meryem", "Ilyas", "Kenza",
             "Othmane", "Sanaa", "Reda", "Ghita", "Walid", "Dounia", "Bilal", "Asmae", "Nabil", "Btissam"]
    last = ["Benali", "Chraibi", "Idrissi", "Alaoui", "Berrada", "Tahiri", "Moussaoui", "Lahlou", "Sefrioui",
            "Kettani", "Bennani", "Faraj", "Haddad", "Ouazzani", "Rahmouni", "Zouaki", "Hassani", "Cherkaoui"]
    depts = ["Direction", "Finance", "Ventes", "Marketing", "IT", "RH", "Logistique", "Achats", "Support"]
    roles = ["owner", "accountant", "supervisor", "assistant"]
    cities = ["Casablanca", "Rabat", "Marrakech", "Tanger", "Fès", "Agadir"]

    # Contacts: 60 clients (large accounts), 40 suppliers, importer format.
    rows = []
    client_names = []
    for i in range(100):
        kind = "client" if i < 60 else "supplier"
        if kind == "client":
            name = f"Groupe {random.choice(['Horizon', 'Atlas', 'Nova', 'Oasis', 'Rif', 'Anfa'])} {random.choice(['Holding', 'Industries', 'Retail', 'Immobilier'])} {i + 1:03d}"
            bal = random.randint(50_000, 900_000)
        else:
            name = f"Fournisseur {random.choice(['Acier', 'Papier', 'Logiciel', 'Logistique', 'Énergie', 'Services'])} {random.choice(['SA', 'SARL', 'SARL AU'])} {i + 1:03d}"
            bal = -random.randint(20_000, 400_000)
        if kind == "client":
            client_names.append(name)
        rows.append([name, kind, ice(), phone(), f"contact{i + 1:03d}@example.com",
                     random.choice(cities), str(bal)])
    write(p, "contacts.csv", ["Nom", "Type", "ICE", "Téléphone", "Email", "Ville", "Solde"], rows)

    # Employees: exactly 100 people, one owner.
    rows = []
    for i in range(100):
        name = f"{random.choice(first)} {random.choice(last)}"
        role = "owner" if i == 0 else random.choices(roles, weights=[0, 5, 15, 80])[0]
        dept = random.choice(depts)
        active = "non" if random.random() < 0.05 else "oui"
        rows.append([f"EMP-{i + 1:03d}", name, f"employe{i + 1:03d}@example.com", dept, role, active])
    write(p, "employees.csv", ["Matricule", "Nom", "Email", "Département", "Rôle", "Actif"], rows)

    # Tools: exactly 50 SaaS subscriptions with planned monthly cost (MAD).
    tool_names = ["Slack", "Notion", "Jira", "Confluence", "Figma", "Google Workspace", "Microsoft 365", "Salesforce",
                  "HubSpot", "Zoho Books", "Odoo", "SAP Business One", "Trello", "Asana", "Monday.com", "Zendesk",
                  "Intercom", "Mailchimp", "Sendinblue", "Canva", "Adobe Creative Cloud", "Dropbox Business",
                  "GitHub Enterprise", "GitLab", "Docker Business", "Datadog", "Sentry", "New Relic", "Okta",
                  "1Password Business", "Bitwarden", "Zoom", "Microsoft Teams", "Calendly", "DocuSign", "Pipedrive",
                  "Lemlist", "Semrush", "Ahrefs", "Hotjar", "Mixpanel", "Amplitude", "Tableau", "Power BI",
                  "Looker", "AWS", "Google Cloud", "Azure", "Cloudflare", "Twilio"]
    assert len(tool_names) == 50
    rows = []
    for name in tool_names:
        cost = random.choice([500, 1200, 2500, 4800, 7900, 12_500, 18_000, 24_500])
        start = dt.date(2024, 1, 1) + dt.timedelta(days=random.randint(0, 700))
        expiry = "" if random.random() < 0.6 else (TODAY + dt.timedelta(days=random.randint(-30, 300))).isoformat()
        rows.append([name, cost, start.isoformat(), expiry])
    write(p, "tools.csv", ["Outil", "Coût mensuel (MAD)", "Début", "Expiration"], rows)

    # Revenue: 12 months of invoices, large volume, TTC amounts.
    rows = []
    for ms in month_starts(12):
        for _ in range(random.randint(40, 60)):
            client = random.choice(client_names)
            amt = random.randint(80_000, 2_400_000)
            rows.append([rand_day(ms).isoformat(), f"FAC-{len(rows) + 1:05d}", client, "Projet", amt, "payée"])
    write(p, "revenue.csv", ["Date", "N° facture", "Client", "Catégorie", "Montant TTC (MAD)", "Statut"], rows)

    # Expenses: 12 months of purchases and payroll.
    rows = []
    cats = ["Salaires", "Loyer", "Achats matières", "Logistique", "Abonnements SaaS", "Marketing", "Énergie", "Assurance"]
    for ms in month_starts(12):
        for _ in range(random.randint(60, 90)):
            vendor = f"Fournisseur {random.choice(['Acier', 'Papier', 'Logiciel', 'Logistique', 'Énergie', 'Services'])} {random.randint(1, 40):03d}"
            cat = random.choice(cats)
            amt = random.randint(5_000, 900_000)
            rows.append([rand_day(ms).isoformat(), vendor, cat,
                         random.choice(["virement", "chèque", "espèces"]), amt,
                         random.choice(["approuvée", "approuvée", "en attente"])])
    write(p, "expenses.csv", ["Date", "Fournisseur", "Catégorie", "Mode", "Montant TTC (MAD)", "Statut"], rows)


# ---------------------------------------------------------------------------
# Profile 2: small e-commerce shop, a few people, modest revenue
# ---------------------------------------------------------------------------
def small_ecommerce():
    p = "small-ecommerce-maroc"
    products = [("Savon noir artisanal 200g", 35), ("Huile d'argan bio 100ml", 120), ("Tapis berbère petit", 450),
                ("Bougie parfumée oud", 85), ("Thé à la menthe coffret", 60), ("Lampe en cuivre", 260),
                ("Sac en cuir cousu main", 390), ("Coussin brodé", 140)]
    names = ["Yassine Idrissi", "Hajar Benjelloun", "Mehdi Tazi", "Sara El Fassi", "Anas Lamrani",
             "Imane Ouahbi", "Reda Chafik", "Nisrine Boukhris", "Adil Sbai", "Kawtar Mansouri"]
    cities = ["Casablanca", "Rabat", "Tanger", "Marrakech", "Fès", "Agadir", "Meknès"]

    # Contacts: 100 customers and 5 suppliers, importer format.
    rows = []
    for i in range(100):
        name = random.choice(names) if i < 60 else f"{random.choice(names).split()[0]} {random.choice(['Benkirane', 'Ziani', 'Hamdaoui', 'Sefiani'])}"
        rows.append([f"{name} {i + 1:03d}", "client", "—", phone(), f"client{i + 1:03d}@example.com",
                     random.choice(cities), str(random.choice([0, 0, random.randint(20, 900)]))])
    for i in range(5):
        rows.append([f"Fournisseur Emballage {i + 1:02d}", "supplier", ice(), phone("5"),
                     f"pro{i + 1:02d}@example.com", "Casablanca", str(-random.randint(500, 9000))])
    write(p, "contacts.csv", ["Nom", "Type", "ICE", "Téléphone", "Email", "Ville", "Solde"], rows)

    # Employees: 3 people.
    write(p, "employees.csv", ["Matricule", "Nom", "Email", "Département", "Rôle", "Actif"], [
        ["EMP-001", "Yassine Idrissi", "owner@example.com", "Direction", "owner", "oui"],
        ["EMP-002", "Hajar Benjelloun", "compta@example.com", "Finance", "accountant", "oui"],
        ["EMP-003", "Mehdi Tazi", "logistique@example.com", "Logistique", "assistant", "oui"],
    ])

    # Tools: 6 small subscriptions.
    write(p, "tools.csv", ["Outil", "Coût mensuel (MAD)", "Début", "Expiration"], [
        ["Shopify Basic", 300, "2025-03-01", ""],
        ["Mailchimp Standard", 180, "2025-06-10", ""],
        ["Canva Pro", 120, "2025-01-15", ""],
        ["Google Workspace", 250, "2024-11-01", ""],
        ["Meta Business Suite", 0, "2024-09-01", ""],
        ["Sendcloud", 200, "2025-08-01", "2026-12-31"],
    ])

    # Sales: 12 months of orders, modest TTC amounts (order-level).
    rows = []
    for ms in month_starts(12):
        for _ in range(random.randint(25, 45)):
            prod, price = random.choice(products)
            qty = random.choice([1, 1, 1, 2, 3])
            total = price * qty
            rows.append([rand_day(ms).isoformat(), f"CMD-{len(rows) + 1:05d}",
                         f"client{random.randint(1, 100):03d}@example.com", prod, qty, price, total,
                         random.choice(["livrée", "livrée", "livrée", "retournée"])])
    write(p, "orders.csv", ["Date", "N° commande", "Client", "Produit", "Quantité", "Prix unitaire TTC (MAD)",
                             "Total TTC (MAD)", "Statut"], rows)

    # Expenses: 12 months of ad spend, shipping, packaging, rent.
    rows = []
    cats = ["Publicité Meta", "Publicité Google", "Livraison", "Emballage", "Hébergement", "Loyer entrepôt", "Logiciels"]
    for ms in month_starts(12):
        for _ in range(random.randint(10, 18)):
            cat = random.choice(cats)
            amt = {"Publicité Meta": random.randint(300, 2500), "Publicité Google": random.randint(200, 1800),
                   "Livraison": random.randint(150, 900), "Emballage": random.randint(80, 600),
                   "Hébergement": 300, "Loyer entrepôt": 2500, "Logiciels": random.randint(100, 500)}[cat]
            rows.append([rand_day(ms).isoformat(), f"Fournisseur {cat}", cat,
                         random.choice(["virement", "espèces"]), amt, "approuvée"])
    write(p, "expenses.csv", ["Date", "Fournisseur", "Catégorie", "Mode", "Montant TTC (MAD)", "Statut"], rows)


if __name__ == "__main__":
    big_company()
    small_ecommerce()
    print("done")
