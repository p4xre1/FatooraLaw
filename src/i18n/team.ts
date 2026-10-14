import type { Language } from "../lib/language/store.ts"

/**
 * Team and roles.
 *
 * Two strings here are not translations of what they replace. The invite dialog
 * promised "Une invitation sera envoyée à cette adresse" and its button read
 * "Envoyer l'invitation", but `inviteMember()` appends the member to the
 * account's own record in localStorage — nothing is sent, and no mail transport
 * exists anywhere in the app (docs/FEATURES_AND_TOOLS.md lists this among the
 * strings that overstate what the app does). The copy now says what happens: the
 * member is added on this device.
 *
 * The email placeholder stays in Latin script in all three languages because
 * email addresses are ASCII; an Arabic-localised placeholder would suggest a
 * mailbox format that cannot exist.
 */
const en = {
  title: "Team & roles",
  subtitle: (active: number) => `${active} active member${active === 1 ? "" : "s"} · permissions per module`,
  invite: "Invite a member",
  deactivated: "Deactivated",
  deactivate: "Deactivate",
  reactivate: "Reactivate",
  accessByModule: "Access by module",
  fullName: "Full name",
  email: "Email",
  emailHint: "Used to identify the member. No email is sent from this device.",
  emailPlaceholder: "name@company.ma",
  role: "Role",
  roleDefaults: "Default permissions applied for the role.",
  addMember: "Add the member",
}

type TeamCopy = typeof en

const fr: TeamCopy = {
  title: "Équipe & rôles",
  subtitle: (active: number) => `${active} membres actifs · permissions par module`,
  invite: "Inviter un membre",
  deactivated: "Désactivé",
  deactivate: "Désactiver",
  reactivate: "Réactiver",
  accessByModule: "Accès par module",
  fullName: "Nom complet",
  email: "Email",
  emailHint: "Sert à identifier le membre. Aucun e-mail n'est envoyé depuis cet appareil.",
  emailPlaceholder: "nom@entreprise.ma",
  role: "Rôle",
  roleDefaults: "Permissions par défaut appliquées selon le rôle.",
  addMember: "Ajouter le membre",
}

const ar: TeamCopy = {
  title: "الفريق والأدوار",
  subtitle: (active: number) => `${active} أعضاء نشطون · صلاحيات حسب الوحدة`,
  invite: "دعوة عضو",
  deactivated: "معطّل",
  deactivate: "تعطيل",
  reactivate: "إعادة التفعيل",
  accessByModule: "الوصول حسب الوحدة",
  fullName: "الاسم الكامل",
  email: "البريد الإلكتروني",
  emailHint: "يُستخدم للتعريف بالعضو. لا يتم إرسال أي بريد من هذا الجهاز.",
  emailPlaceholder: "name@company.ma",
  role: "الدور",
  roleDefaults: "يتم تطبيق الصلاحيات الافتراضية حسب الدور.",
  addMember: "إضافة العضو",
}

export const team: Record<Language, TeamCopy> = { ar, en, fr }
