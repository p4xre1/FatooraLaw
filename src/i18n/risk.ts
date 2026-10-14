import type { Language } from "../lib/language/store.ts"

/** Stable IDs for the static examples; visible labels live in this dictionary. */
export type RiskId = "vat" | "corporateTax" | "contract" | "registry" | "insurance" | "social" | "privacy"
export type RiskLevel = "high" | "medium" | "ok"
export type RiskCategory = "tax" | "contracts" | "registry" | "social" | "privacy"

/**
 * Static risk examples.
 *
 * The risk register is a fixed array in the component, not an assessment of the
 * account's own documents or filings (`docs/FEATURES_AND_TOOLS.md §3.7`). Some
 * of the original descriptions said that a filing *had been made*, a register
 * was *being kept*, or an obligation was *non-compliant* — none of that is
 * checked by code. This copy deliberately narrows those statements to examples
 * and tells the reader what has not been verified. The visible notice says the
 * entire list is fictional, no status has been assessed, and official sources
 * must be consulted.
 *
 * The article 264 DOC / DGI / TGR / DAMANCOM / CNDP references are retained as
 * examples, not as legal advice. The 15% / 0.5% figures are explicitly
 * attributed to the example and should be checked against current official
 * guidance before anyone relies on them.
 */
const en = {
  subtitle: "Example points to review — verify legal obligations with official sources",
  demoNotice:
    "Fictional demo list: these examples are not based on your records. No risk, filing or compliance status has been assessed. Verify every obligation with the relevant official authority.",
  count: {
    high: "High-risk examples",
    medium: "Warning examples",
    ok: "Examples marked non-critical",
  },
  levels: {
    high: "High",
    medium: "Medium",
    ok: "Non-critical",
  },
  filters: {
    all: "All",
    high: "High",
    medium: "Medium",
    ok: "Non-critical",
  },
  searchPlaceholder: "Search examples…",
  searchLabel: "Search risk examples",
  dueLabel: "Example date:",
  empty: "No examples match this search or filter.",
  categories: {
    tax: "Tax",
    contracts: "Contracts",
    registry: "Commercial register",
    social: "Social security",
    privacy: "Personal data",
  } as Record<RiskCategory, string>,
  items: {
    vat: {
      label: "VAT return — Q3 2026",
      desc: "Example deadline: file with the DGI by 30/09. This example cites a 15% surcharge plus 0.5% per month of delay; verify the current rules with the DGI.",
    },
    corporateTax: {
      label: "Corporate income-tax instalment — first payment",
      desc: "Example: a first instalment of corporate income tax (IS), based on the previous financial year's taxable result, is payable to the Treasury General of the Kingdom (TGR).",
    },
    contract: {
      label: "Client contract — local SME",
      desc: "Example only. Review late-payment penalty clauses (article 264 of the Code of Obligations and Contracts, DOC) with a qualified adviser before renewal; this screen has not reviewed a contract.",
    },
    registry: {
      label: "Commercial register — Model J",
      desc: "Example only: a Model J extract may be requested from the commercial court. This screen does not check whether your extract is current.",
    },
    insurance: {
      label: "Professional liability insurance",
      desc: "Example quarterly premium date. Compare coverage limits with current work through your insurer; this screen has not checked a policy.",
    },
    social: {
      label: "CNSS — monthly declaration",
      desc: "Example: social declarations can be submitted through the DAMANCOM portal. This list does not confirm that a declaration was filed or that an account is up to date.",
    },
    privacy: {
      label: "Personal-data obligations — Law 09-08",
      desc: "Example only. Check the controller's filing obligations with the CNDP and maintain any required processing records; this screen does not verify a declaration or a register.",
    },
  } as Record<RiskId, { label: string; desc: string }>,
}

type RiskCopy = typeof en

const fr: RiskCopy = {
  subtitle: "Exemples de points à examiner — vérifiez les obligations auprès des sources officielles",
  demoNotice:
    "Liste de démonstration fictive : ces exemples ne viennent pas de vos dossiers. Aucun risque, dépôt ni état de conformité n'a été évalué. Vérifiez chaque obligation auprès de l'autorité officielle concernée.",
  count: {
    high: "Exemples à risque élevé",
    medium: "Exemples d'avertissement",
    ok: "Exemples classés non critiques",
  },
  levels: {
    high: "Élevé",
    medium: "Moyen",
    ok: "Non critique",
  },
  filters: {
    all: "Tout",
    high: "Élevé",
    medium: "Moyen",
    ok: "Non critique",
  },
  searchPlaceholder: "Rechercher dans les exemples…",
  searchLabel: "Rechercher dans les exemples de risques",
  dueLabel: "Date de l'exemple :",
  empty: "Aucun exemple ne correspond à cette recherche ou à ce filtre.",
  categories: {
    tax: "Fiscalité",
    contracts: "Contrats",
    registry: "Registre commercial",
    social: "Protection sociale",
    privacy: "Données personnelles",
  },
  items: {
    vat: {
      label: "Déclaration TVA — T3 2026",
      desc: "Échéance d'exemple : dépôt auprès de la DGI avant le 30/09. Cet exemple cite une majoration de 15 % plus 0,5 % par mois de retard ; vérifiez les règles en vigueur auprès de la DGI.",
    },
    corporateTax: {
      label: "Acompte IS — 1er versement",
      desc: "Exemple : un premier acompte d'impôt sur les sociétés (IS), calculé sur le résultat fiscal de l'exercice précédent, est à régler auprès de la Trésorerie générale du Royaume (TGR).",
    },
    contract: {
      label: "Contrat client — PME locale",
      desc: "Exemple uniquement. Faites examiner les clauses de pénalité de retard (article 264 du Dahir formant Code des obligations et contrats, DOC) par un conseil qualifié avant reconduction ; aucun contrat n'a été vérifié ici.",
    },
    registry: {
      label: "Registre du commerce — Modèle J",
      desc: "Exemple uniquement : un extrait Modèle J peut être demandé au tribunal de commerce. Cet écran ne vérifie pas si votre extrait est à jour.",
    },
    insurance: {
      label: "Assurance responsabilité civile professionnelle",
      desc: "Date d'échéance trimestrielle donnée en exemple. Vérifiez les plafonds de garantie avec votre assureur selon vos activités ; aucune police n'a été examinée ici.",
    },
    social: {
      label: "CNSS — déclaration mensuelle",
      desc: "Exemple : les déclarations sociales peuvent être déposées via le portail DAMANCOM. Cette liste ne confirme ni un dépôt ni la mise à jour d'un compte.",
    },
    privacy: {
      label: "Obligations relatives aux données — Loi 09-08",
      desc: "Exemple uniquement. Vérifiez les formalités du responsable de traitement auprès de la CNDP et tenez les registres requis ; cet écran ne vérifie ni une déclaration ni un registre.",
    },
  },
}

const ar: RiskCopy = {
  subtitle: "أمثلة على نقاط للمراجعة — تحقق من الالتزامات لدى المصادر الرسمية",
  demoNotice:
    "قائمة تجريبية افتراضية: هذه الأمثلة لا تستند إلى سجلاتك. لم يتم تقييم أي مخاطر أو إقرارات أو حالة امتثال. تحقق من كل التزام لدى الجهة الرسمية المختصة.",
  count: {
    high: "أمثلة لمخاطر مرتفعة",
    medium: "أمثلة لتنبيهات",
    ok: "أمثلة مصنفة غير حرجة",
  },
  levels: {
    high: "مرتفع",
    medium: "متوسط",
    ok: "غير حرج",
  },
  filters: {
    all: "الكل",
    high: "مرتفع",
    medium: "متوسط",
    ok: "غير حرج",
  },
  searchPlaceholder: "ابحث في الأمثلة…",
  searchLabel: "البحث في أمثلة المخاطر",
  dueLabel: "تاريخ المثال:",
  empty: "لا توجد أمثلة تطابق البحث أو عامل التصفية.",
  categories: {
    tax: "الضرائب",
    contracts: "العقود",
    registry: "السجل التجاري",
    social: "الضمان الاجتماعي",
    privacy: "البيانات الشخصية",
  },
  items: {
    vat: {
      label: "إقرار الضريبة على القيمة المضافة — الربع الثالث 2026",
      desc: "موعد توضيحي: الإيداع لدى المديرية العامة للضرائب (DGI) قبل 30/09. يذكر هذا المثال زيادة بنسبة 15٪ إضافة إلى 0.5٪ عن كل شهر تأخير؛ تحقق من القواعد السارية لدى DGI.",
    },
    corporateTax: {
      label: "دفعة الضريبة على الشركات — الدفعة الأولى",
      desc: "مثال: تُسدّد الدفعة الأولى من الضريبة على الشركات (IS)، المحسوبة على أساس النتيجة الضريبية للسنة المالية السابقة، لدى الخزينة العامة للمملكة (TGR).",
    },
    contract: {
      label: "عقد عميل — مقاولة محلية صغيرة ومتوسطة",
      desc: "مثال فقط. راجع بنود غرامات التأخير (المادة 264 من قانون الالتزامات والعقود، DOC) مع مستشار مؤهل قبل التجديد؛ لم تتم مراجعة أي عقد في هذه الشاشة.",
    },
    registry: {
      label: "السجل التجاري — نموذج J",
      desc: "مثال فقط: يمكن طلب مستخرج نموذج J من المحكمة التجارية. لا تتحقق هذه الشاشة مما إذا كان مستخرجك محيّناً.",
    },
    insurance: {
      label: "تأمين المسؤولية المدنية المهنية",
      desc: "موعد توضيحي لقسط فصلي. تحقق من حدود التغطية مع شركة التأمين وفقاً لأنشطتك؛ لم تتم مراجعة أي وثيقة تأمين هنا.",
    },
    social: {
      label: "الصندوق الوطني للضمان الاجتماعي (CNSS) — إقرار شهري",
      desc: "مثال: يمكن إيداع التصريحات الاجتماعية عبر بوابة DAMANCOM. لا تؤكد هذه القائمة إيداع تصريح أو تحديث حساب.",
    },
    privacy: {
      label: "التزامات حماية البيانات الشخصية — القانون 09-08",
      desc: "مثال فقط. تحقق من إجراءات المسؤول عن المعالجة لدى اللجنة الوطنية لمراقبة حماية المعطيات ذات الطابع الشخصي (CNDP)، واحتفظ بالسجلات المطلوبة؛ لا تتحقق هذه الشاشة من أي تصريح أو سجل.",
    },
  },
}

export const risk: Record<Language, RiskCopy> = { ar, en, fr }
