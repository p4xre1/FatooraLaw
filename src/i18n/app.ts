import type { Language } from "../lib/language/store.ts"

/** Signed-in shell messages that are not owned by a particular module. */
const en = {
  noAccess: {
    pageTitle: "No access | Fatorati",
    title: "No access available",
    body: "This account is inactive or has no modules assigned. Contact your workspace owner.",
  },
}

type AppCopy = typeof en

const fr: AppCopy = {
  noAccess: {
    pageTitle: "Aucun accès | Fatorati",
    title: "Aucun accès disponible",
    body: "Ce compte est désactivé ou aucun module ne lui est attribué. Contactez le propriétaire de votre espace.",
  },
}

const ar: AppCopy = {
  noAccess: {
    pageTitle: "لا يوجد وصول | فاطوراتي",
    title: "لا توجد صلاحية للوصول",
    body: "هذا الحساب معطّل أو لم تُسند إليه أي وحدات. تواصل مع مالك مساحة العمل.",
  },
}

export const app: Record<Language, AppCopy> = { ar, en, fr }
