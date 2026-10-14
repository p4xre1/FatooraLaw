import type { Project } from "../store/types.ts"
import type { Language } from "../lib/language/store.ts"

/**
 * Projects, milestones and equipment assignment.
 *
 * Project names and milestone labels are user-entered data. Status values are
 * stable IDs and are translated only at the point where they are shown.
 */
const en = {
  subtitle: (count: number) => `${count} project${count === 1 ? "" : "s"} · budget tracking`,
  newProject: "New project",
  table: {
    project: "Project",
    client: "Client",
    budget: "Budget",
    paid: "Collected",
    receivable: "Receivables",
    margin: "Margin",
    progress: "Progress",
    status: "Status",
  },
  status: {
    planning: "Planning",
    active: "In progress",
    on_hold: "On hold",
    done: "Completed",
  } satisfies Record<Project["status"], string>,
  milestones: "Milestones",
  budget: "Budget",
  actualCost: "Actual cost",
  margin: "Margin",
  milestoneHeading: "Milestones — phase progress",
  assignEquipment: (name: string) => `Assign equipment to ${name}`,
  assignTitle: (name: string) => `Assign equipment — ${name}`,
  removeAssignment: "Unassign",
  assign: "Assign",
  emptyEquipment: "No equipment items are available.",
  create: {
    title: "New project",
    name: "Project name",
    namePlaceholder: "e.g. Villa R+2 — …",
    client: "Client",
    budget: (currency: string) => `Budget (${currency})`,
    cost: (currency: string) => `Estimated cost (${currency})`,
    optionalZero: "Optional: defaults to 0",
    marginAuto: "Automatic margin",
    amountError: "Amounts must be non-negative and within the allowed limit.",
    save: "Create project",
    error: "Could not create the project.",
    firstMilestone: "Kick-off",
  },
}

type ProjectsCopy = typeof en

const fr: ProjectsCopy = {
  subtitle: (count: number) => `${count} chantier${count === 1 ? "" : "s"} · suivi budgétaire`,
  newProject: "Nouveau projet",
  table: {
    project: "Projet",
    client: "Client",
    budget: "Budget",
    paid: "Encaissé",
    receivable: "Créances",
    margin: "Marge",
    progress: "Avancement",
    status: "Statut",
  },
  status: {
    planning: "Planification",
    active: "En cours",
    on_hold: "En pause",
    done: "Terminé",
  },
  milestones: "Jalons",
  budget: "Budget",
  actualCost: "Coût réel",
  margin: "Marge",
  milestoneHeading: "Jalons — exécution par phase",
  assignEquipment: (name: string) => `Affecter du matériel à ${name}`,
  assignTitle: (name: string) => `Affecter du matériel — ${name}`,
  removeAssignment: "Retirer",
  assign: "Affecter",
  emptyEquipment: "Aucun matériel disponible.",
  create: {
    title: "Nouveau projet",
    name: "Nom du projet",
    namePlaceholder: "Villa R+2 — …",
    client: "Client",
    budget: (currency: string) => `Budget (${currency})`,
    cost: (currency: string) => `Coût estimé (${currency})`,
    optionalZero: "Facultatif : 0 par défaut",
    marginAuto: "Marge automatique",
    amountError: "Les montants doivent être positifs ou nuls et dans la limite autorisée.",
    save: "Créer le projet",
    error: "Impossible de créer le projet.",
    firstMilestone: "Démarrage",
  },
}

const ar: ProjectsCopy = {
  subtitle: (count: number) => `${count} مشاريع · متابعة الميزانية`,
  newProject: "مشروع جديد",
  table: {
    project: "المشروع",
    client: "العميل",
    budget: "الميزانية",
    paid: "المبالغ المحصلة",
    receivable: "المستحقات",
    margin: "الهامش",
    progress: "التقدم",
    status: "الحالة",
  },
  status: {
    planning: "قيد التخطيط",
    active: "قيد التنفيذ",
    on_hold: "متوقف مؤقتاً",
    done: "مكتمل",
  },
  milestones: "المراحل الرئيسية",
  budget: "الميزانية",
  actualCost: "التكلفة الفعلية",
  margin: "الهامش",
  milestoneHeading: "المراحل — التقدم حسب المرحلة",
  assignEquipment: (name: string) => `تخصيص المعدات إلى ${name}`,
  assignTitle: (name: string) => `تخصيص المعدات — ${name}`,
  removeAssignment: "إلغاء التخصيص",
  assign: "تخصيص",
  emptyEquipment: "لا توجد معدات متاحة.",
  create: {
    title: "مشروع جديد",
    name: "اسم المشروع",
    namePlaceholder: "مثال: فيلا R+2 — …",
    client: "العميل",
    budget: (currency: string) => `الميزانية (${currency})`,
    cost: (currency: string) => `التكلفة التقديرية (${currency})`,
    optionalZero: "اختياري: القيمة الافتراضية 0",
    marginAuto: "الهامش التلقائي",
    amountError: "يجب أن تكون المبالغ غير سالبة وضمن الحد المسموح.",
    save: "إنشاء المشروع",
    error: "تعذر إنشاء المشروع.",
    firstMilestone: "الانطلاق",
  },
}

export const projects: Record<Language, ProjectsCopy> = { ar, en, fr }
