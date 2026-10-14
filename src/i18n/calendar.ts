import type { Language } from "../lib/language/store.ts"

/**
 * Static calendar examples.
 *
 * `modules.calendar` supplies the title shared by the rail and page title; this
 * section owns the words and the sample data shown inside the calendar.
 *
 * The calendar is currently a fixed demo, not a view of the account's deadlines
 * (`docs/FEATURES_AND_TOOLS.md §3.6`): the month and seven entries are constants
 * in the component, the arrows do not navigate, and none of it reads local
 * records. The prominent note below is therefore part of the translation, not
 * optional fine print. Translating these into three languages without saying
 * they were fictional would make the demo easier to mistake for a real tax
 * reminder. A fake card suffix has been removed rather than localised.
 *
 * The deadlines and tax references are sample copy, not legal advice; the notice
 * directs the reader to official sources. The values here are translated as
 * written, not silently changed or certified.
 */
const en = {
  subtitle: "Legal deadlines, contract renewals and subscription payments",
  demoNotice:
    "Fictional demonstration data: these examples do not come from your records and are not real deadlines. Verify tax obligations and dates with official sources.",
  previousMonth: "Previous month",
  nextMonth: "Next month",
  upcomingTitle: "Sample deadlines",
  selectedDate: (day: string, month: string) => `${month} ${day}`,
  selectDay: (day: string, month: string) => `Show events for ${month} ${day}`,
  types: {
    renew: "Renewal",
    pay: "Payment",
    legal: "Legal deadline",
  },
  events: {
    ovh: {
      label: "OVH hosting",
      detail: "Monthly charge — 89 MAD.",
    },
    adobe: {
      label: "Adobe Creative Cloud",
      detail: "Recurring payment — 299 MAD. Automatic renewal.",
    },
    microsoft: {
      label: "Microsoft 365 Business",
      detail: "Period ended on 12/09 — 129 MAD/month if renewed.",
    },
    corporateTax: {
      label: "Corporate income-tax instalment — first payment",
      detail:
        "Payable to the General Tax Directorate (DGI). Based on the previous financial year's taxable result.",
    },
    insurance: {
      label: "Professional liability insurance",
      detail: "Quarterly due date — 640 MAD.",
    },
    vat: {
      label: "VAT return — Q3 2026",
      detail:
        "File by 30/09 (DGI). The example states a 15% late-filing surcharge.",
    },
    sage: {
      label: "Sage Compta",
      detail: "Annual subscription due — 450 MAD/month.",
    },
  },
}

type CalendarCopy = typeof en

const fr: CalendarCopy = {
  subtitle:
    "Échéances légales, renouvellements de contrats et paiements d'abonnements",
  demoNotice:
    "Données de démonstration fictives : ces exemples ne viennent pas de vos dossiers et ne sont pas de vraies échéances. Vérifiez les obligations fiscales et les dates auprès des sources officielles.",
  previousMonth: "Mois précédent",
  nextMonth: "Mois suivant",
  upcomingTitle: "Échéances de démonstration",
  selectedDate: (day: string, month: string) => `${day} ${month}`,
  selectDay: (day: string, month: string) =>
    `Afficher les événements du ${day} ${month}`,
  types: {
    renew: "Renouvellement",
    pay: "Paiement",
    legal: "Échéance légale",
  },
  events: {
    ovh: {
      label: "Hébergement OVH",
      detail: "Prélèvement mensuel — 89 MAD.",
    },
    adobe: {
      label: "Adobe Creative Cloud",
      detail: "Paiement récurrent — 299 MAD. Renouvellement automatique.",
    },
    microsoft: {
      label: "Microsoft 365 Business",
      detail: "Fin de période le 12/09 — 129 MAD/mois si reconduit.",
    },
    corporateTax: {
      label: "Acompte IS — 1er versement",
      detail:
        "À régler auprès de la Direction générale des impôts (DGI), sur la base du résultat fiscal de l'exercice précédent.",
    },
    insurance: {
      label: "Assurance responsabilité civile professionnelle",
      detail: "Échéance trimestrielle — 640 MAD.",
    },
    vat: {
      label: "Déclaration TVA — T3 2026",
      detail:
        "Dépôt avant le 30/09 (DGI). L'exemple mentionne une majoration de 15 % en cas de retard.",
    },
    sage: {
      label: "Sage Compta",
      detail: "Abonnement annuel à échéance — 450 MAD/mois.",
    },
  },
}

const ar: CalendarCopy = {
  subtitle: "الاستحقاقات القانونية وتجديد العقود ومدفوعات الاشتراكات",
  demoNotice:
    "بيانات تجريبية افتراضية: هذه الأمثلة ليست مستمدة من سجلاتك ولا تمثل مواعيد حقيقية. تحقق من الالتزامات الضريبية والتواريخ لدى المصادر الرسمية.",
  previousMonth: "الشهر السابق",
  nextMonth: "الشهر التالي",
  upcomingTitle: "مواعيد توضيحية",
  selectedDate: (day: string, month: string) => `${day} ${month}`,
  selectDay: (day: string, month: string) => `عرض أحداث ${day} ${month}`,
  types: {
    renew: "تجديد",
    pay: "دفع",
    legal: "استحقاق قانوني",
  },
  events: {
    ovh: {
      label: "استضافة OVH",
      detail: "اقتطاع شهري — 89 MAD.",
    },
    adobe: {
      label: "Adobe Creative Cloud",
      detail: "دفعة دورية — 299 MAD. تجديد تلقائي.",
    },
    microsoft: {
      label: "Microsoft 365 Business",
      detail: "انتهت الفترة في 12/09 — 129 MAD شهرياً عند التجديد.",
    },
    corporateTax: {
      label: "دفعة الضريبة على الشركات — الدفعة الأولى",
      detail:
        "تُسدّد لدى المديرية العامة للضرائب (DGI)، على أساس النتيجة الضريبية للسنة المالية السابقة.",
    },
    insurance: {
      label: "تأمين المسؤولية المدنية المهنية",
      detail: "استحقاق فصلي — 640 MAD.",
    },
    vat: {
      label: "إقرار الضريبة على القيمة المضافة — الربع الثالث 2026",
      detail:
        "يُودع قبل 30/09 (DGI). يذكر هذا المثال زيادة بنسبة 15٪ عند التأخير.",
    },
    sage: {
      label: "Sage Compta",
      detail: "موعد استحقاق الاشتراك السنوي — 450 MAD شهرياً.",
    },
  },
}

export const calendar: Record<Language, CalendarCopy> = { ar, en, fr }
