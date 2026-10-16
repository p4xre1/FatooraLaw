import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Check, CheckCircle2, Copy, Download, FileText, LockKeyhole,
  Palette, Plus, Printer, Save, Search, ShieldAlert, Trash2, Upload,
} from "lucide-react";
import { useMizan } from "../store/useMizan";
import { useTranslation } from "../lib/language/store";
import { validateLogoDataURL, validateLogoFile } from "../lib/logoValidation";
import type { Settings, Contact } from "../store/types";
import { localizedLandingPath } from "../lib/routes";
import {
  calculateInvoiceTotals, createInvoiceId, duplicateInvoiceAsDraft,
  invoicePaymentStatus, nextInvoiceNumber, validateInvoiceDraft,
  type InvoiceLine, type InvoiceParty, type InvoiceRecord, type InvoiceTemplate,
  type InvoiceTheme,
} from "../lib/invoiceEngine";

type Copy = {
  title: string; subtitle: string; newInvoice: string; allInvoices: string; draft: string; issued: string;
  unpaid: string; partial: string; paid: string; totalIssued: string; collected: string; outstanding: string;
  drafts: string; search: string; noInvoices: string; noInvoicesHint: string; createFirst: string;
  open: string; duplicate: string; deleteDraft: string; back: string; saveDraft: string; issue: string;
  exportPdf: string; preview: string; edit: string; seller: string; buyer: string; businessName: string;
  legalForm: string; address: string; city: string; country: string; phone: string; email: string;
  ice: string; taxId: string; rc: string; rcCity: string; patente: string; cnss: string;
  useContact: string; selectContact: string; invoiceDetails: string; issueDate: string; operationDate: string; dueDate: string;
  subject: string; reference: string; lineItems: string; description: string; unit: string; quantity: string;
  unitPriceHT: string; vatRate: string; lineTotal: string; addLine: string; totals: string; subtotalHT: string;
  tax: string; totalTTC: string; payment: string; amountPaid: string; balanceDue: string; method: string;
  transfer: string; cash: string; check: string; card: string; other: string; paymentReference: string;
  paidDate: string; paymentTerms: string; notes: string; taxNote: string; design: string; style: string;
  classic: string; modern: string; friendly: string; accent: string; logo: string; removeLogo: string;
  templates: string; chooseTemplate: string; saveTemplate: string; templateName: string; saveTemplateConfirm: string;
  applyTemplate: string; deleteTemplate: string; saved: string; issueConfirm: string; missing: string;
  missingSeller: string; missingAddress: string; missingDate: string; missingOperationDate: string; missingBuyer: string; missingLines: string;
  missingDescription: string; missingQuantity: string; missingPrice: string; missingVat: string; missingDueDate: string; missingDueBeforeIssue: string;
  draftSaved: string; issuedSuccess: string; paymentSaved: string; templateSaved: string; confirmDelete: string;
  localWarning: string; localDanger: string; corruptedWarning: string; readOnly: string; issueHelp: string;
  pdfHelp: string; legalNotice: string; disclaimer: string; localOnly: string; reviewTax: string;
  noLegalApproval: string; number: string; status: string; date: string; customer: string; amount: string;
  noTemplate: string; deleteTemplateConfirm: string; templateAlreadyExists: string; fillTemplateName: string;
  invalidLogo: string; markPaid: string; savePayment: string; selectTax: string; vatExemptNote: string;
  newLine: string; companyProfile: string; customRate: string; noCustomer: string; savingDisabled: string;
};
const COPY: Record<"en" | "fr" | "ar", Copy> = {
  en: {
    title:"Invoices", subtitle:"Create, customize, issue and print invoices for your business.",
    newInvoice:"New invoice", allInvoices:"All invoices", draft:"Draft", issued:"Issued", unpaid:"Unpaid", partial:"Partially paid", paid:"Paid",
    totalIssued:"Issued invoices", collected:"Recorded as collected", outstanding:"Outstanding", drafts:"Drafts", search:"Search number or customer…",
    noInvoices:"Your invoice list is empty", noInvoicesHint:"Create a draft, add your customer and items, then review the live preview.",
    createFirst:"Create your first invoice", open:"Open", duplicate:"Duplicate as draft", deleteDraft:"Delete draft", back:"Back to invoices",
    saveDraft:"Save draft", issue:"Issue invoice", exportPdf:"Export PDF / Print", preview:"Live preview", edit:"Edit invoice",
    seller:"Your business", buyer:"Bill to", businessName:"Business / legal name", legalForm:"Legal form (optional)", address:"Address",
    city:"City", country:"Country", phone:"Phone", email:"Email", ice:"ICE", taxId:"Tax ID (IF)", rc:"Commercial Register (RC)",
    rcCity:"RC registration city", patente:"Professional tax (TP / patente)", cnss:"CNSS (if applicable)", useContact:"Fill from saved contact",
    selectContact:"Choose a customer…", invoiceDetails:"Invoice details", issueDate:"Issue date", operationDate:"Transaction date", dueDate:"Due date", subject:"Subject / service",
    reference:"Order / project reference", lineItems:"Items and services", description:"Description", unit:"Unit", quantity:"Qty",
    unitPriceHT:"Unit price HT", vatRate:"VAT %", lineTotal:"Line total TTC", addLine:"Add line", totals:"Summary", subtotalHT:"Subtotal HT",
    tax:"VAT", totalTTC:"Total TTC", payment:"Payment tracking", amountPaid:"Amount paid", balanceDue:"Balance due",
    method:"Payment method", transfer:"Bank transfer", cash:"Cash", check:"Cheque", card:"Card", other:"Other",
    paymentReference:"Payment reference", paidDate:"Payment date", paymentTerms:"Payment terms", notes:"Notes / footer",
    taxNote:"Tax exemption / special regime note (only if applicable)", design:"Design & templates", style:"Layout",
    classic:"Standard", modern:"Modern", friendly:"Friendly", accent:"Brand color", logo:"Business logo", removeLogo:"Remove logo",
    templates:"Saved templates", chooseTemplate:"Choose a template…", saveTemplate:"Save as template", templateName:"Template name",
    saveTemplateConfirm:"Save template", applyTemplate:"Apply", deleteTemplate:"Delete", saved:"Saved", issueConfirm:"Issue this invoice and assign its final number?",
    missing:"Please correct these items before issuing:", missingSeller:"Add the seller's business name.", missingAddress:"Add the seller's address.",
    missingDate:"Enter a valid issue date.", missingOperationDate:"Enter a valid transaction date.", missingBuyer:"Add the customer's name.", missingLines:"Add at least one item.",
    missingDescription:"Enter a description for every line.", missingQuantity:"Each quantity must be greater than zero.",
    missingPrice:"Prices must be zero or greater.", missingVat:"VAT must be between 0 and 100.", missingDueDate:"Enter a valid due date.", missingDueBeforeIssue:"The due date cannot be earlier than the issue date.",
    draftSaved:"Draft saved in this browser.", issuedSuccess:"Invoice issued and saved in this browser.", paymentSaved:"Payment details saved.",
    templateSaved:"Template saved.", confirmDelete:"Delete this draft? This cannot be undone.", localWarning:"Invoices and templates are stored in this browser for this account only. They do not sync to other devices and may be lost if browser data is cleared.",
    localDanger:"Download and securely keep the PDF and any records you must legally retain. Fatorati does not provide a 10-year legal archive in this version.",
    corruptedWarning:"Saved invoice data could not be read. To protect it, editing and saving are disabled; do not clear this browser's data.",
    readOnly:"Issued invoice — details are locked. Record a payment or duplicate it as a new draft to make another document.",
    issueHelp:"A final number is assigned only when you issue the invoice. The current numbering is local to this browser, not a central tax sequence.",
    pdfHelp:"Your browser's print dialog opens. Select “Save as PDF” to download a PDF file.",
    legalNotice:"Important", disclaimer:"Fatorati creates a PDF from the details you enter. You are responsible for verifying the invoice, tax rate and legal particulars for your activity. This tool does not submit invoices to the DGI or certify compliance.",
    localOnly:"Local browser storage", reviewTax:"Choose the VAT rate that legally applies to this transaction. Rates and exemptions vary by activity and tax regime.",
    noLegalApproval:"Not DGI-certified", number:"Invoice no.", status:"Status", date:"Date", customer:"Customer", amount:"Amount",
    noTemplate:"No saved templates yet.", deleteTemplateConfirm:"Delete this template?", templateAlreadyExists:"A template with this name already exists.",
    fillTemplateName:"Enter a template name.", invalidLogo:"Choose a valid PNG, JPEG, WebP or GIF image up to 512 KB.",
    markPaid:"Mark as paid", savePayment:"Save payment", selectTax:"Select rate", vatExemptNote:"Do not use a 0% rate as an exemption reason without checking your tax regime.",
    newLine:"New item", companyProfile:"Business profile", customRate:"Custom %", noCustomer:"No saved customers found.", savingDisabled:"Saving is unavailable until the invoice data finishes loading.",
  },
  fr: {
    title:"Factures", subtitle:"Créez, personnalisez, émettez et imprimez vos factures.",
    newInvoice:"Nouvelle facture", allInvoices:"Toutes les factures", draft:"Brouillon", issued:"Émise", unpaid:"Impayée", partial:"Partiellement réglée", paid:"Payée",
    totalIssued:"Factures émises", collected:"Montant déclaré encaissé", outstanding:"Reste à encaisser", drafts:"Brouillons", search:"Rechercher un numéro ou un client…",
    noInvoices:"Votre liste de factures est vide", noInvoicesHint:"Créez un brouillon, renseignez le client et les lignes, puis vérifiez l’aperçu.",
    createFirst:"Créer ma première facture", open:"Ouvrir", duplicate:"Dupliquer en brouillon", deleteDraft:"Supprimer le brouillon", back:"Retour aux factures",
    saveDraft:"Enregistrer le brouillon", issue:"Émettre la facture", exportPdf:"Exporter en PDF / Imprimer", preview:"Aperçu en direct", edit:"Modifier la facture",
    seller:"Votre entreprise", buyer:"Facturer à", businessName:"Nom commercial / raison sociale", legalForm:"Forme juridique (facultatif)", address:"Adresse",
    city:"Ville", country:"Pays", phone:"Téléphone", email:"E-mail", ice:"ICE", taxId:"Identifiant fiscal (IF)", rc:"Registre du commerce (RC)",
    rcCity:"Ville d’immatriculation RC", patente:"Taxe professionnelle (TP / patente)", cnss:"CNSS (si applicable)", useContact:"Préremplir depuis un contact",
    selectContact:"Choisir un client…", invoiceDetails:"Détails de la facture", issueDate:"Date d’émission", operationDate:"Date de l’opération", dueDate:"Date d’échéance", subject:"Objet / prestation",
    reference:"Référence commande / projet", lineItems:"Articles et prestations", description:"Désignation", unit:"Unité", quantity:"Qté",
    unitPriceHT:"Prix unitaire HT", vatRate:"TVA %", lineTotal:"Total ligne TTC", addLine:"Ajouter une ligne", totals:"Récapitulatif", subtotalHT:"Sous-total HT",
    tax:"TVA", totalTTC:"Total TTC", payment:"Suivi du paiement", amountPaid:"Montant payé", balanceDue:"Solde restant",
    method:"Mode de paiement", transfer:"Virement bancaire", cash:"Espèces", check:"Chèque", card:"Carte", other:"Autre",
    paymentReference:"Référence du paiement", paidDate:"Date du paiement", paymentTerms:"Conditions de paiement", notes:"Notes / pied de page",
    taxNote:"Note d’exonération / régime spécial (si applicable)", design:"Design et modèles", style:"Mise en page",
    classic:"Standard", modern:"Moderne", friendly:"Conviviale", accent:"Couleur de marque", logo:"Logo de l’entreprise", removeLogo:"Retirer le logo",
    templates:"Modèles enregistrés", chooseTemplate:"Choisir un modèle…", saveTemplate:"Enregistrer comme modèle", templateName:"Nom du modèle",
    saveTemplateConfirm:"Enregistrer le modèle", applyTemplate:"Appliquer", deleteTemplate:"Supprimer", saved:"Enregistré", issueConfirm:"Émettre cette facture et lui attribuer son numéro définitif ?",
    missing:"Veuillez corriger les points suivants avant l’émission :", missingSeller:"Renseignez la raison sociale du vendeur.", missingAddress:"Renseignez l’adresse du vendeur.",
    missingDate:"Saisissez une date d’émission valide.", missingOperationDate:"Saisissez une date d’opération valide.", missingBuyer:"Renseignez le nom du client.", missingLines:"Ajoutez au moins une ligne.",
    missingDescription:"Renseignez la désignation de chaque ligne.", missingQuantity:"Chaque quantité doit être supérieure à zéro.",
    missingPrice:"Les prix doivent être positifs ou nuls.", missingVat:"La TVA doit être comprise entre 0 et 100.", missingDueDate:"Saisissez une échéance valide.", missingDueBeforeIssue:"La date d’échéance ne peut pas précéder la date d’émission.",
    draftSaved:"Brouillon enregistré dans ce navigateur.", issuedSuccess:"Facture émise et enregistrée dans ce navigateur.", paymentSaved:"Paiement enregistré.",
    templateSaved:"Modèle enregistré.", confirmDelete:"Supprimer ce brouillon ? Cette action est irréversible.", localWarning:"Les factures et modèles sont enregistrés dans ce navigateur, pour ce compte uniquement. Ils ne sont pas synchronisés entre appareils et peuvent être perdus si les données du navigateur sont effacées.",
    localDanger:"Téléchargez et conservez en sécurité les PDF et documents soumis à une obligation légale. Cette version de Fatorati ne fournit pas d’archive juridique de dix ans.",
    corruptedWarning:"Les données enregistrées n’ont pas pu être lues. Pour les protéger, la modification et l’enregistrement sont désactivés. N’effacez pas les données de ce navigateur.",
    readOnly:"Facture émise — les détails sont verrouillés. Enregistrez un paiement ou dupliquez-la en brouillon pour créer un autre document.",
    issueHelp:"Le numéro définitif est attribué à l’émission. La numérotation actuelle est locale à ce navigateur et n’est pas une séquence fiscale centralisée.",
    pdfHelp:"La fenêtre d’impression du navigateur s’ouvre. Choisissez « Enregistrer au format PDF ».",
    legalNotice:"Important", disclaimer:"Fatorati crée un PDF à partir des informations saisies. Vous devez vérifier la facture, le taux de TVA et les mentions applicables à votre activité. Cet outil ne transmet pas les factures à la DGI et ne certifie pas leur conformité.",
    localOnly:"Stockage local du navigateur", reviewTax:"Choisissez le taux de TVA applicable à l’opération. Les taux et exonérations dépendent de l’activité et du régime fiscal.",
    noLegalApproval:"Non certifié par la DGI", number:"N° facture", status:"Statut", date:"Date", customer:"Client", amount:"Montant",
    noTemplate:"Aucun modèle enregistré.", deleteTemplateConfirm:"Supprimer ce modèle ?", templateAlreadyExists:"Un modèle portant ce nom existe déjà.",
    fillTemplateName:"Saisissez le nom du modèle.", invalidLogo:"Choisissez une image PNG, JPEG, WebP ou GIF valide de 512 Ko maximum.",
    markPaid:"Marquer comme payée", savePayment:"Enregistrer le paiement", selectTax:"Choisir le taux", vatExemptNote:"Un taux à 0 % ne signifie pas automatiquement que l’opération est exonérée.",
    newLine:"Nouvelle ligne", companyProfile:"Profil de l’entreprise", customRate:"Taux personnalisé", noCustomer:"Aucun client enregistré.", savingDisabled:"L’enregistrement est désactivé pendant le chargement des données.",
  },
  ar: {
    title:"الفواتير", subtitle:"أنشئ فواتيرك وخصص تصميمها وأصدرها واطبعها.",
    newInvoice:"فاتورة جديدة", allInvoices:"جميع الفواتير", draft:"مسودة", issued:"صادرة", unpaid:"غير مؤداة", partial:"مؤداة جزئياً", paid:"مؤداة",
    totalIssued:"الفواتير الصادرة", collected:"المبلغ المسجل كمقبوض", outstanding:"المبلغ المتبقي", drafts:"المسودات", search:"ابحث برقم الفاتورة أو العميل…",
    noInvoices:"قائمة الفواتير فارغة", noInvoicesHint:"أنشئ مسودة وأدخل بيانات العميل والبنود ثم راجع المعاينة المباشرة.",
    createFirst:"إنشاء أول فاتورة", open:"فتح", duplicate:"نسخ كمسودة", deleteDraft:"حذف المسودة", back:"العودة إلى الفواتير",
    saveDraft:"حفظ المسودة", issue:"إصدار الفاتورة", exportPdf:"تصدير PDF / طباعة", preview:"معاينة مباشرة", edit:"تعديل الفاتورة",
    seller:"معلومات منشأتك", buyer:"الفاتورة إلى", businessName:"اسم المنشأة / الاسم القانوني", legalForm:"الشكل القانوني (اختياري)", address:"العنوان",
    city:"المدينة", country:"البلد", phone:"الهاتف", email:"البريد الإلكتروني", ice:"ICE", taxId:"المعرف الضريبي IF", rc:"السجل التجاري RC",
    rcCity:"مدينة تسجيل السجل التجاري", patente:"الضريبة المهنية TP / patente", cnss:"CNSS (عند الاقتضاء)", useContact:"ملء البيانات من جهة اتصال محفوظة",
    selectContact:"اختر عميلاً…", invoiceDetails:"تفاصيل الفاتورة", issueDate:"تاريخ الإصدار", operationDate:"تاريخ العملية", dueDate:"تاريخ الاستحقاق", subject:"الموضوع / الخدمة",
    reference:"مرجع الطلب / المشروع", lineItems:"السلع والخدمات", description:"البيان", unit:"الوحدة", quantity:"الكمية",
    unitPriceHT:"سعر الوحدة دون الضريبة", vatRate:"TVA %", lineTotal:"إجمالي البند مع الضريبة", addLine:"إضافة بند", totals:"الملخص", subtotalHT:"المجموع دون الضريبة",
    tax:"الضريبة على القيمة المضافة", totalTTC:"المجموع شامل الضريبة", payment:"تتبع الأداء", amountPaid:"المبلغ المؤدى", balanceDue:"المبلغ المتبقي",
    method:"طريقة الأداء", transfer:"تحويل بنكي", cash:"نقداً", check:"شيك", card:"بطاقة", other:"أخرى",
    paymentReference:"مرجع الأداء", paidDate:"تاريخ الأداء", paymentTerms:"شروط الأداء", notes:"ملاحظات / تذييل",
    taxNote:"ملاحظة الإعفاء / النظام الخاص (عند الاقتضاء)", design:"التصميم والقوالب", style:"التنسيق",
    classic:"قياسي", modern:"عصري", friendly:"ودّي", accent:"لون العلامة التجارية", logo:"شعار المنشأة", removeLogo:"إزالة الشعار",
    templates:"القوالب المحفوظة", chooseTemplate:"اختر قالباً…", saveTemplate:"حفظ كقالب", templateName:"اسم القالب",
    saveTemplateConfirm:"حفظ القالب", applyTemplate:"تطبيق", deleteTemplate:"حذف", saved:"محفوظ", issueConfirm:"هل تريد إصدار هذه الفاتورة وتخصيص رقمها النهائي؟",
    missing:"يرجى تصحيح ما يلي قبل الإصدار:", missingSeller:"أدخل الاسم القانوني للبائع.", missingAddress:"أدخل عنوان البائع.",
    missingDate:"أدخل تاريخ إصدار صحيحاً.", missingOperationDate:"أدخل تاريخاً صحيحاً للعملية.", missingBuyer:"أدخل اسم العميل.", missingLines:"أضف بنداً واحداً على الأقل.",
    missingDescription:"أدخل وصفاً لكل بند.", missingQuantity:"يجب أن تكون كل كمية أكبر من صفر.",
    missingPrice:"يجب أن تكون الأسعار صفراً أو أكثر.", missingVat:"يجب أن تكون الضريبة بين 0 و100.", missingDueDate:"أدخل تاريخ استحقاق صحيحاً.", missingDueBeforeIssue:"لا يمكن أن يكون تاريخ الاستحقاق قبل تاريخ الإصدار.",
    draftSaved:"تم حفظ المسودة في هذا المتصفح.", issuedSuccess:"تم إصدار الفاتورة وحفظها في هذا المتصفح.", paymentSaved:"تم حفظ بيانات الأداء.",
    templateSaved:"تم حفظ القالب.", confirmDelete:"هل تريد حذف هذه المسودة؟ لا يمكن التراجع عن ذلك.", localWarning:"تُحفظ الفواتير والقوالب في هذا المتصفح لهذا الحساب فقط. لا تتم مزامنتها بين الأجهزة وقد تضيع عند مسح بيانات المتصفح.",
    localDanger:"قم بتنزيل ملفات PDF والوثائق التي يجب الاحتفاظ بها قانونياً واحفظها بأمان. هذه النسخة من فاتورتي لا توفر أرشيفاً قانونياً لمدة عشر سنوات.",
    corruptedWarning:"تعذر قراءة بيانات الفواتير المحفوظة. لحمايتها تم تعطيل التعديل والحفظ؛ لا تمسح بيانات هذا المتصفح.",
    readOnly:"فاتورة صادرة — تم قفل التفاصيل. سجّل أداءً أو انسخها كمسودة لإنشاء مستند آخر.",
    issueHelp:"يُخصص الرقم النهائي عند إصدار الفاتورة فقط. الترقيم الحالي محلي في هذا المتصفح وليس تسلسلاً ضريبياً مركزياً.",
    pdfHelp:"ستفتح نافذة الطباعة في المتصفح. اختر «حفظ بتنسيق PDF».",
    legalNotice:"تنبيه مهم", disclaimer:"تنشئ فاتورتي ملف PDF من المعلومات التي تدخلها. أنت مسؤول عن التحقق من الفاتورة ومعدل الضريبة والبيانات القانونية المناسبة لنشاطك. لا يرسل هذا التطبيق الفواتير إلى الإدارة العامة للضرائب ولا يصادق على مطابقتها.",
    localOnly:"تخزين محلي في المتصفح", reviewTax:"اختر معدل الضريبة المطبق قانونياً على العملية. تختلف المعدلات والإعفاءات حسب النشاط والنظام الضريبي.",
    noLegalApproval:"غير معتمد من DGI", number:"رقم الفاتورة", status:"الحالة", date:"التاريخ", customer:"العميل", amount:"المبلغ",
    noTemplate:"لا توجد قوالب محفوظة.", deleteTemplateConfirm:"هل تريد حذف هذا القالب؟", templateAlreadyExists:"يوجد قالب بهذا الاسم بالفعل.",
    fillTemplateName:"أدخل اسم القالب.", invalidLogo:"اختر صورة PNG أو JPEG أو WebP أو GIF صالحة لا يتجاوز حجمها 512 كيلوبايت.",
    markPaid:"تحديد كمدفوعة", savePayment:"حفظ الأداء", selectTax:"اختر المعدل", vatExemptNote:"اختيار 0% لا يعني تلقائياً أن العملية معفاة من الضريبة.",
    newLine:"بند جديد", companyProfile:"ملف المنشأة", customRate:"معدل مخصص", noCustomer:"لا يوجد عملاء محفوظون.", savingDisabled:"الحفظ غير متاح حتى اكتمال تحميل البيانات.",
  },
};

type StoragePack = { version: 1; invoices: InvoiceRecord[]; templates: InvoiceTemplate[] };
const inputClass = "mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60";
const currencySummary = (rows: InvoiceRecord[], pick: (row: InvoiceRecord) => number, language: "en" | "fr" | "ar") => {
  const grouped = new Map<InvoiceRecord["currency"], number>();
  rows.forEach((row) => grouped.set(row.currency, (grouped.get(row.currency) || 0) + pick(row)));
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, value]) => amount(value, currency, language)).join(" · ") || "—";
};
const labelClass = "block min-w-0 text-xs font-semibold text-muted";
const panelClass = "rounded-2xl border border-line bg-surface p-4 sm:p-5";
const todayIso = () => {
  const d = new Date();
  return String(d.getFullYear()) + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const addDays = (date: string, days: number) => {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const blankParty = (): InvoiceParty => ({
  name: "", legalForm: "", address: "", city: "", country: "Morocco", phone: "", email: "",
  ice: "", taxId: "", rc: "", rcCity: "", patente: "", cnss: "",
});
function newDraft(settings: Settings): InvoiceRecord {
  const today = todayIso();
  return {
    id: createInvoiceId(), number: null, stage: "draft", createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), issueDate: today, operationDate: today, dueDate: addDays(today, 30),
    currency: settings.currency || "MAD", subject: "", reference: "",
    seller: {
      ...blankParty(), name: settings.company || "", address: settings.address || "", city: settings.city || "",
      ice: settings.ice || "", taxId: settings.taxId || "", rc: settings.rc || "",
    },
    buyer: blankParty(),
    lines: [{ id: createInvoiceId(), description: "", unit: "unit", quantity: 1, unitPriceHT: 0, vatRate: settings.taxRate ?? 20 }],
    taxNote: "", notes: settings.footerNote || "", paymentTerms: "Payable within 30 days",
    paymentMethod: "transfer", paymentReference: "", amountPaid: 0, paidAt: "",
    theme: "classic", accentColor: "#2563eb", logoDataUrl: settings.logo || null,
  };
}
function readStorage(key: string): { pack: StoragePack; corrupt: boolean } {
  const empty: StoragePack = { version: 1, invoices: [], templates: [] };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { pack: empty, corrupt: false };
    const parsed = JSON.parse(raw) as Partial<StoragePack>;
    if (parsed.version !== 1 || !Array.isArray(parsed.invoices) || !Array.isArray(parsed.templates)) return { pack: empty, corrupt: true };
    return { pack: { version: 1, invoices: parsed.invoices as InvoiceRecord[], templates: parsed.templates as InvoiceTemplate[] }, corrupt: false };
  } catch {
    return { pack: empty, corrupt: true };
  }
}

function Field(props: {
  label: string; value: string | number; onChange?: (value: string) => void;
  type?: string; disabled?: boolean; min?: number; max?: number; step?: number; placeholder?: string; required?: boolean;
}) {
  return <label className={labelClass}>
    <span>{props.label}{props.required ? " *" : ""}</span>
    <input className={inputClass} value={props.value} type={props.type || "text"} disabled={props.disabled}
      min={props.min} max={props.max} step={props.step} placeholder={props.placeholder}
      onChange={(e) => props.onChange?.(e.target.value)} />
  </label>;
}
function AreaField(props: { label: string; value: string; onChange?: (value: string) => void; disabled?: boolean; rows?: number }) {
  return <label className={labelClass}>
    <span>{props.label}</span>
    <textarea className={inputClass + " resize-y"} rows={props.rows || 3} value={props.value} disabled={props.disabled}
      onChange={(e) => props.onChange?.(e.target.value)} />
  </label>;
}
function PartyFields(props: {
  title: string; party: InvoiceParty; onChange: (patch: Partial<InvoiceParty>) => void; disabled: boolean; t: Copy; seller: boolean;
}) {
  const { party, onChange, disabled, t } = props;
  const fields: { key: keyof InvoiceParty; label: string; type?: string }[] = [
    { key: "name", label: t.businessName }, { key: "legalForm", label: t.legalForm },
    { key: "address", label: t.address }, { key: "city", label: t.city }, { key: "country", label: t.country },
    { key: "phone", label: t.phone, type: "tel" }, { key: "email", label: t.email, type: "email" },
    { key: "ice", label: t.ice }, { key: "taxId", label: t.taxId },
    { key: "rc", label: t.rc }, { key: "rcCity", label: t.rcCity },
    ...(props.seller ? [{ key: "patente" as const, label: t.patente }, { key: "cnss" as const, label: t.cnss }] : []),
  ];
  return <section className={panelClass}>
    <h3 className="mb-4 text-sm font-bold text-ink">{props.title}</h3>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map((f) => <Field key={f.key} label={f.label} value={party[f.key]} type={f.type} disabled={disabled}
        required={["name", "address"].includes(f.key)} onChange={(value) => onChange({ [f.key]: value })} />)}
    </div>
  </section>;
}
function formatDate(value: string, language: "en" | "fr" | "ar") {
  if (!value) return "—";
  const d = new Date(value + "T12:00:00");
  return new Intl.DateTimeFormat(language === "ar" ? "ar-MA" : language === "fr" ? "fr-MA" : "en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function amount(value: number, currency: InvoiceRecord["currency"], language: "en" | "fr" | "ar") {
  return new Intl.NumberFormat(language === "ar" ? "ar-MA" : language === "fr" ? "fr-MA" : "en-MA", {
    style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}
function StatusPill({ status, t }: { status: "draft" | "issued" | "unpaid" | "partial" | "paid"; t: Copy }) {
  const text = status === "draft" ? t.draft : status === "issued" ? t.issued : status === "unpaid" ? t.unpaid : status === "partial" ? t.partial : t.paid;
  const tone = status === "paid" ? "bg-emerald-50 text-emerald-700" : status === "unpaid" ? "bg-amber-50 text-amber-700" : status === "draft" ? "bg-slate-100 text-slate-700" : "bg-brand-50 text-brand-700";
  return <span className={"inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold " + tone}>{text}</span>;
}
function InvoicePreview({ invoice, t, language }: { invoice: InvoiceRecord; t: Copy; language: "en" | "fr" | "ar" }) {
  const totals = calculateInvoiceTotals(invoice.lines, invoice.amountPaid);
  const showTaxId = (party: InvoiceParty) => [
    party.ice ? t.ice + ": " + party.ice : "",
    party.taxId ? t.taxId + ": " + party.taxId : "",
    party.rc ? t.rc + ": " + party.rc + (party.rcCity ? " (" + party.rcCity + ")" : "") : "",
    party.patente ? t.patente + ": " + party.patente : "",
    party.cnss ? t.cnss + ": " + party.cnss : "",
  ].filter(Boolean);
  return <div className={"invoice-print-root invoice-theme-" + invoice.theme + " overflow-hidden rounded-xl border border-line bg-white text-slate-900 shadow-sm"} style={{ borderTop: "5px solid " + invoice.accentColor }}>
    <div className="p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex min-w-0 items-start gap-3">
          {invoice.logoDataUrl && <img src={invoice.logoDataUrl} alt="" className="max-h-16 max-w-24 object-contain" />}
          <div className="min-w-0">
            <h2 className="invoice-seller-name break-words text-xl font-extrabold" style={{ color: invoice.accentColor }}>{invoice.seller.name || t.seller}</h2>
            {invoice.seller.legalForm && <p className="mt-0.5 text-xs text-slate-600">{invoice.seller.legalForm}</p>}
            <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{[invoice.seller.address, invoice.seller.city, invoice.seller.country].filter(Boolean).join(", ")}</p>
            <p className="mt-1 text-xs text-slate-600">{[invoice.seller.phone, invoice.seller.email].filter(Boolean).join(" · ")}</p>
            {showTaxId(invoice.seller).map((v) => <p key={v} className="mt-0.5 break-words text-[10px] text-slate-600">{v}</p>)}
          </div>
        </div>
        <div className="ms-auto min-w-40 text-start sm:text-end">
          <p className="text-2xl font-black tracking-tight">{t.title.toUpperCase()}</p>
          <p className="mt-1 break-words font-mono text-sm font-bold" style={{ color: invoice.accentColor }}>{invoice.number || "DRAFT"}</p>
          <p className="mt-2 text-xs text-slate-600">{t.issueDate}: {formatDate(invoice.issueDate, language)}</p>
          <p className="mt-1 text-xs text-slate-600">{t.operationDate}: {formatDate(invoice.operationDate, language)}</p>
          <p className="mt-1 text-xs text-slate-600">{t.dueDate}: {formatDate(invoice.dueDate, language)}</p>
          {invoice.reference && <p className="mt-1 break-words text-xs text-slate-600">{t.reference}: {invoice.reference}</p>}
        </div>
      </div>
      <div className="mt-5 rounded-lg bg-slate-50 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.buyer}</p>
        <p className="mt-1 break-words font-bold">{invoice.buyer.name || "—"}</p>
        <p className="mt-0.5 whitespace-pre-line text-xs text-slate-600">{[invoice.buyer.address, invoice.buyer.city, invoice.buyer.country].filter(Boolean).join(", ") || "—"}</p>
        <p className="mt-1 text-xs text-slate-600">{[invoice.buyer.phone, invoice.buyer.email].filter(Boolean).join(" · ")}</p>
        {showTaxId(invoice.buyer).slice(0, 3).map((v) => <p key={v} className="mt-0.5 text-[10px] text-slate-600">{v}</p>)}
      </div>
      {invoice.subject && <p className="mt-4 text-sm font-semibold">{invoice.subject}</p>}
      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-start text-xs">
          <thead style={{ backgroundColor: invoice.accentColor, color: "#fff" }}>
            <tr>
              <th className="p-2 text-start font-semibold">{t.description}</th>
              <th className="p-2 text-end font-semibold">{t.quantity}</th>
              <th className="p-2 text-end font-semibold">{t.unitPriceHT}</th>
              <th className="p-2 text-end font-semibold">{t.vatRate}</th>
              <th className="p-2 text-end font-semibold">{t.lineTotal}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => {
              const totalsLine = calculateInvoiceTotals([line]);
              return <tr key={line.id} className="border-t border-slate-200">
                <td className="max-w-[180px] break-words p-2">{line.description || "—"}{line.unit && <span className="block text-[10px] text-slate-500">{line.unit}</span>}</td>
                <td className="p-2 text-end tabular-nums">{line.quantity}</td>
                <td className="p-2 text-end tabular-nums">{amount(line.unitPriceHT, invoice.currency, language)}</td>
                <td className="p-2 text-end tabular-nums">{line.vatRate}%</td>
                <td className="p-2 text-end font-semibold tabular-nums">{amount(totalsLine.totalTTC, invoice.currency, language)}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-5 flex justify-end">
        <div className="w-full max-w-xs space-y-2 text-xs">
          <div className="flex justify-between gap-3"><span>{t.subtotalHT}</span><span className="font-semibold tabular-nums">{amount(totals.subtotalHT, invoice.currency, language)}</span></div>
          {totals.taxBreakdown.map((tax) => <div key={tax.rate} className="flex justify-between gap-3">
            <span>{t.tax} ({tax.rate}%)</span><span className="font-semibold tabular-nums">{amount(tax.vat, invoice.currency, language)}</span>
          </div>)}
          <div className="flex justify-between gap-3 border-t border-slate-300 pt-2 text-sm font-extrabold" style={{ color: invoice.accentColor }}>
            <span>{t.totalTTC}</span><span className="tabular-nums">{amount(totals.totalTTC, invoice.currency, language)}</span>
          </div>
          {invoice.stage === "issued" && <div className="flex justify-between gap-3 text-slate-600"><span>{t.amountPaid}</span><span>{amount(invoice.amountPaid, invoice.currency, language)}</span></div>}
          {invoice.stage === "issued" && <div className="flex justify-between gap-3 font-bold"><span>{t.balanceDue}</span><span>{amount(totals.balanceDue, invoice.currency, language)}</span></div>}
        </div>
      </div>
      {invoice.paymentTerms && <div className="mt-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.paymentTerms}</p><p className="mt-1 whitespace-pre-line text-xs">{invoice.paymentTerms}</p></div>}
      {invoice.taxNote && <div className="mt-3"><p className="whitespace-pre-line text-xs text-slate-600">{invoice.taxNote}</p></div>}
      {invoice.notes && <div className="mt-3 border-t border-slate-200 pt-3"><p className="whitespace-pre-line text-xs text-slate-600">{invoice.notes}</p></div>}
      <div className="mt-7 border-t border-slate-200 pt-3 text-[9px] text-slate-400">
        {invoice.seller.name || "Fatorati"} · {invoice.number || t.draft} · {formatDate(invoice.issueDate, language)}
      </div>
    </div>
  </div>;
}

export default function Invoices() {
  const { auth, settings, contacts, log } = useMizan();
  const { language, dir } = useTranslation();
  const t = COPY[language];
  const storageKey = auth?.id ? "fatorati.invoices.v1." + encodeURIComponent(auth.id) : null;
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [corrupt, setCorrupt] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [editor, setEditor] = useState<InvoiceRecord | null>(null);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setEditor(null);
    setLoadedFor(null);
    setStorageError(false);
    setCorrupt(false);
    if (!storageKey) {
      setInvoices([]);
      setTemplates([]);
      return;
    }
    const result = readStorage(storageKey);
    setInvoices(result.pack.invoices);
    setTemplates(result.pack.templates);
    setCorrupt(result.corrupt);
    setLoadedFor(storageKey);
  }, [storageKey]);

  const ready = Boolean(storageKey && loadedFor === storageKey && !corrupt);
  const totalsFor = (invoice: InvoiceRecord) => calculateInvoiceTotals(invoice.lines, invoice.amountPaid);
  const persist = (nextInvoices: InvoiceRecord[], nextTemplates = templates) => {
    if (!storageKey || loadedFor !== storageKey || corrupt) {
      setStorageError(true);
      return false;
    }
    const pack: StoragePack = { version: 1, invoices: nextInvoices, templates: nextTemplates };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(pack));
      setInvoices(nextInvoices);
      setTemplates(nextTemplates);
      setStorageError(false);
      return true;
    } catch {
      setStorageError(true);
      return false;
    }
  };
  const updateEditor = (patch: Partial<InvoiceRecord>) => {
    if (!editor || editor.stage === "issued") return;
    setEditor({ ...editor, ...patch, updatedAt: new Date().toISOString() });
  };
  const updatePaymentEditor = (patch: Partial<InvoiceRecord>) => {
    if (!editor) return;
    if (editor.stage === "issued") setEditor({ ...editor, ...patch, updatedAt: new Date().toISOString() });
    else updateEditor(patch);
  };
  const updateParty = (kind: "seller" | "buyer", patch: Partial<InvoiceParty>) => {
    if (!editor || editor.stage === "issued") return;
    updateEditor({ [kind]: { ...editor[kind], ...patch } });
  };
  const updateLine = (id: string, patch: Partial<InvoiceLine>) => {
    if (!editor || editor.stage === "issued") return;
    updateEditor({ lines: editor.lines.map((line) => line.id === id ? { ...line, ...patch } : line) });
  };
  const editorTotals = editor ? calculateInvoiceTotals(editor.lines, editor.amountPaid) : null;
  const visibleInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...invoices]
      .filter((invoice) => !q || (invoice.number || "").toLowerCase().includes(q) || invoice.buyer.name.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [invoices, search]);

  const startDraft = (template?: InvoiceTemplate) => {
    let draft = newDraft(settings);
    if (template) draft = {
      ...draft, theme: template.theme, accentColor: template.accentColor,
      taxNote: "", notes: template.notes, paymentTerms: template.paymentTerms,
      logoDataUrl: template.logoDataUrl,
      lines: draft.lines.map((line) => ({ ...line, vatRate: template.defaultVatRate })),
    };
    setFeedback("");
    setTemplateEditorOpen(false);
    setEditor(draft);
  };
  const saveDraft = () => {
    if (!editor || !ready) return;
    if (editor.stage === "issued") return;
    const saved = { ...editor, stage: "draft" as const, number: null, updatedAt: new Date().toISOString() };
    const next = [saved, ...invoices.filter((x) => x.id !== saved.id)];
    if (persist(next)) {
      setEditor(saved);
      setFeedback(t.draftSaved);
    }
  };
  const issueInvoice = () => {
    if (!editor || !ready || editor.stage === "issued") return;
    const errors = validateInvoiceDraft(editor);
    const totals = calculateInvoiceTotals(editor.lines, editor.amountPaid);
    const localizedErrors = errors.map((key) => {
      if (key === "sellerName") return t.missingSeller;
      if (key === "sellerAddress") return t.missingAddress;
      if (key === "issueDate") return t.missingDate;
      if (key === "operationDate") return t.missingOperationDate;
      if (key === "buyerName") return t.missingBuyer;
      if (key === "lines") return t.missingLines;
      if (key.startsWith("lineDescription:")) return t.missingDescription;
      if (key.startsWith("lineQuantity:")) return t.missingQuantity;
      if (key.startsWith("linePrice:")) return t.missingPrice;
      if (key.startsWith("lineVat:")) return t.missingVat;
      if (key === "dueDate") return t.missingDueDate;
      if (key === "dueDateBeforeIssue") return t.missingDueBeforeIssue;
      return key;
    });
    if (editor.amountPaid > totals.totalTTC) localizedErrors.push(t.amountPaid + " — " + t.totalTTC);
    if (localizedErrors.length) {
      setFeedback(t.missing + "\n• " + [...new Set(localizedErrors)].join("\n• "));
      return;
    }
    if (!window.confirm(t.issueConfirm)) return;
    const fresh = storageKey ? readStorage(storageKey).pack.invoices : invoices;
    const issued: InvoiceRecord = { ...editor, number: nextInvoiceNumber(fresh, editor.issueDate), stage: "issued", updatedAt: new Date().toISOString() };
    const next = [issued, ...invoices.filter((x) => x.id !== issued.id)];
    if (persist(next)) {
      setEditor(issued);
      setFeedback(t.issuedSuccess);
      log("issued invoice", issued.number || "", "invoices", "info");
    }
  };
  const deleteDraft = (invoice: InvoiceRecord) => {
    if (invoice.stage !== "draft" || !window.confirm(t.confirmDelete)) return;
    const next = invoices.filter((x) => x.id !== invoice.id);
    if (persist(next)) {
      if (editor?.id === invoice.id) setEditor(null);
      setFeedback(t.saved);
    }
  };
  const duplicate = (invoice: InvoiceRecord) => {
    const copy = duplicateInvoiceAsDraft(invoice);
    setEditor(copy);
    setFeedback("");
  };
  const saveTemplate = () => {
    if (!editor || !ready) return;
    const name = templateName.trim();
    if (!name) { setFeedback(t.fillTemplateName); return; }
    if (templates.some((item) => item.name.trim().toLowerCase() === name.toLowerCase())) {
      setFeedback(t.templateAlreadyExists); return;
    }
    const template: InvoiceTemplate = {
      id: createInvoiceId(), name, theme: editor.theme, accentColor: editor.accentColor,
      defaultVatRate: editor.lines[0]?.vatRate ?? settings.taxRate ?? 20,
      notes: editor.notes, paymentTerms: editor.paymentTerms, logoDataUrl: editor.logoDataUrl,
      createdAt: new Date().toISOString(),
    };
    if (persist(invoices, [template, ...templates])) {
      setTemplateName("");
      setTemplateEditorOpen(false);
      setFeedback(t.templateSaved);
    }
  };
  const deleteTemplate = (template: InvoiceTemplate) => {
    if (!window.confirm(t.deleteTemplateConfirm)) return;
    persist(invoices, templates.filter((item) => item.id !== template.id));
  };
  const applyTemplate = (template: InvoiceTemplate) => {
    if (!editor || editor.stage === "issued") return;
    updateEditor({
      theme: template.theme, accentColor: template.accentColor, notes: template.notes,
      paymentTerms: template.paymentTerms, logoDataUrl: template.logoDataUrl,
      lines: editor.lines.map((line) => ({ ...line, vatRate: template.defaultVatRate })),
    });
  };
  const savePayment = () => {
    if (!editor || editor.stage !== "issued" || !ready || !editor.number) return;
    const total = calculateInvoiceTotals(editor.lines).totalTTC;
    const amountPaid = Math.min(total, Math.max(0, Number.isFinite(editor.amountPaid) ? editor.amountPaid : 0));
    const updated = { ...editor, amountPaid, paidAt: amountPaid >= total ? (editor.paidAt || todayIso()) : "", updatedAt: new Date().toISOString() };
    const next = invoices.map((invoice) => invoice.id === updated.id ? updated : invoice);
    if (persist(next)) {
      setEditor(updated);
      setFeedback(t.paymentSaved);
      log("updated invoice payment", updated.number, "invoices", "info");
    }
  };
  const setContact = (contactId: string) => {
    if (!editor || editor.stage === "issued") return;
    const contact = contacts.find((c: Contact) => c.id === contactId);
    if (!contact) return;
    updateEditor({ buyer: {
      ...editor.buyer, name: contact.name, ice: contact.ice || "", phone: contact.phone || "",
      email: contact.email || "", city: contact.city || "",
    } });
  };
  const handleLogo = (file?: File) => {
    setLogoError(false);
    if (!file || !editor) return;
    try {
      validateLogoFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const value = String(reader.result || "");
          validateLogoDataURL(value);
          updateEditor({ logoDataUrl: value });
        } catch { setLogoError(true); }
      };
      reader.onerror = () => setLogoError(true);
      reader.readAsDataURL(file);
    } catch { setLogoError(true); }
  };
  const printInvoice = () => window.print();

  const renderOptions = (party: InvoiceParty, kind: "seller" | "buyer", disabled: boolean) => <PartyFields
    title={kind === "seller" ? t.seller : t.buyer} party={party} disabled={disabled} t={t}
    seller={kind === "seller"} onChange={(patch) => updateParty(kind, patch)} />;

  return <div className="mz-view space-y-5" dir={dir}>
    <style>{".invoice-print-root{break-inside:avoid;color:#0f172a!important;background:#fff!important}.invoice-theme-modern .invoice-seller-name{letter-spacing:-.04em;text-transform:uppercase}.invoice-theme-modern{border-radius:2px!important}.invoice-theme-friendly .invoice-seller-name{letter-spacing:0}.invoice-print-root.invoice-theme-friendly{font-family:Inter,Tajawal,sans-serif;border-radius:14px!important}@media print{@page{size:A4;margin:11mm}body *{visibility:hidden!important}.invoice-print-root,.invoice-print-root *{visibility:visible!important}.invoice-print-root{position:absolute!important;inset:0 auto auto 0!important;width:100%!important;max-width:none!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}.no-print{display:none!important}body{background:white!important}.invoice-print-root table{font-size:9pt!important}.invoice-print-root th,.invoice-print-root td{padding:5pt!important;break-inside:avoid}.invoice-print-root img{max-height:18mm!important}.invoice-print-root *{print-color-adjust:exact;-webkit-print-color-adjust:exact}}"} </style>
    {!editor ? <>
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div><div className="text-xs font-bold uppercase tracking-widest text-brand">Fatorati · {t.localOnly}</div><h1 className="mt-1 text-2xl font-bold text-ink">{t.title}</h1><p className="mt-1 max-w-2xl text-sm text-muted">{t.subtitle}</p></div>
        <button onClick={() => startDraft()} disabled={!ready} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"><Plus className="h-4 w-4" />{t.newInvoice}</button>
      </div>
      {corrupt && <Notice text={t.corruptedWarning} danger />}
      {storageError && <Notice text={t.localDanger} danger />}
      <div className="no-print grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={t.totalIssued} value={String(invoices.filter((i) => i.stage === "issued").length)} />
        <Metric label={t.collected} value={currencySummary(invoices.filter((i) => i.stage === "issued"), (i) => i.amountPaid, language)} />
        <Metric label={t.outstanding} value={currencySummary(invoices.filter((i) => i.stage === "issued"), (i) => totalsFor(i).balanceDue, language)} />
        <Metric label={t.drafts} value={String(invoices.filter((i) => i.stage === "draft").length)} />
      </div>
      <div className="no-print flex flex-wrap gap-3 rounded-xl border border-line bg-brand-50 p-3 text-xs leading-5 text-brand-700">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><div><strong>{t.legalNotice}:</strong> {t.localWarning} {t.localDanger}</div>
      </div>
      <div className="no-print flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-transparent text-sm text-ink outline-none" placeholder={t.search} aria-label={t.search} />
      </div>
      {visibleInvoices.length === 0 ? <div className={panelClass + " no-print py-12 text-center"}>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand"><FileText className="h-6 w-6" /></div>
        <h2 className="mt-4 text-lg font-bold text-ink">{t.noInvoices}</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted">{t.noInvoicesHint}</p>
        <button onClick={() => startDraft()} disabled={!ready} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" />{t.createFirst}</button>
      </div> : <div className="no-print overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-4 py-3"><h2 className="font-bold text-ink">{t.allInvoices} <span className="ms-1 text-xs font-semibold text-muted">({visibleInvoices.length})</span></h2></div>
        <div className="divide-y divide-line">
          {visibleInvoices.map((invoice) => {
            const total = calculateInvoiceTotals(invoice.lines).totalTTC;
            const status = invoice.stage === "draft" ? "draft" : invoicePaymentStatus(invoice.amountPaid, total);
            return <div key={invoice.id} className="flex flex-col gap-3 p-4 transition hover:bg-canvas/50 sm:flex-row sm:items-center">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand"><FileText className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-ink">{invoice.number || t.draft}</p><StatusPill status={invoice.stage === "draft" ? "draft" : "issued"} t={t} />{invoice.stage === "issued" && <StatusPill status={status === "paid" ? "paid" : status === "partial" ? "partial" : "unpaid"} t={t} />}</div>
                <p className="mt-1 truncate text-xs text-muted">{invoice.buyer.name || "—"} · {formatDate(invoice.issueDate, language)}</p></div>
              <div className="text-start sm:min-w-32 sm:text-end"><p className="font-bold tabular-nums text-ink">{amount(total, invoice.currency, language)}</p>{invoice.stage === "issued" && <p className="mt-0.5 text-xs text-muted">{t.balanceDue}: {amount(calculateInvoiceTotals(invoice.lines, invoice.amountPaid).balanceDue, invoice.currency, language)}</p>}</div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink hover:bg-canvas" onClick={() => {setEditor(invoice);setFeedback("");}}>{t.open}</button>
                <button className="rounded-lg border border-line p-2 text-muted hover:bg-canvas hover:text-brand" aria-label={t.duplicate} title={t.duplicate} onClick={() => duplicate(invoice)}><Copy className="h-4 w-4" /></button>
                {invoice.stage === "draft" && <button className="rounded-lg border border-line p-2 text-muted hover:bg-red-50 hover:text-red-600" aria-label={t.deleteDraft} title={t.deleteDraft} onClick={() => deleteDraft(invoice)}><Trash2 className="h-4 w-4" /></button>}
                {invoice.stage === "issued" && <button className="rounded-lg border border-line p-2 text-muted hover:bg-canvas hover:text-brand" aria-label={t.exportPdf} title={t.exportPdf} onClick={() => {setEditor(invoice);window.setTimeout(printInvoice,150);}}><Printer className="h-4 w-4" /></button>}
              </div>
            </div>;
          })}
        </div>
      </div>}
    </> : <>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => {setEditor(null);setFeedback("");}} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-muted hover:bg-canvas hover:text-ink"><ArrowLeft className="h-4 w-4" />{t.back}</button>
        <div className="flex flex-wrap gap-2">
          {editor.stage === "draft" ? <>
            <button disabled={!ready} onClick={saveDraft} className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-canvas disabled:opacity-50"><Save className="h-4 w-4" />{t.saveDraft}</button>
            <button disabled={!ready} onClick={issueInvoice} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"><Check className="h-4 w-4" />{t.issue}</button>
          </> : <>
            <StatusPill status="issued" t={t} />
            <button onClick={duplicate.bind(null, editor)} className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-canvas"><Copy className="h-4 w-4" />{t.duplicate}</button>
          </>}
          <button onClick={printInvoice} className="inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-bold text-white hover:opacity-90"><Download className="h-4 w-4" />{t.exportPdf}</button>
        </div>
      </div>
      {editor.stage === "issued" && <div className="no-print flex gap-2 rounded-xl border border-line bg-slate-50 p-3 text-xs leading-5 text-slate-700"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /><span>{t.readOnly}</span></div>}
      {feedback && <Notice text={feedback} />}
      {storageError && <Notice text={t.localDanger} danger />}
      <div className="no-print rounded-xl border border-line bg-brand-50 p-3 text-xs leading-5 text-brand-700">
        <strong>{t.legalNotice}:</strong> {t.disclaimer} <span className="block mt-1">{t.issueHelp}</span>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.95fr)]">
        <div className="no-print min-w-0 space-y-4">
          <section className={panelClass}>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink"><FileText className="h-4 w-4 text-brand" />{t.invoiceDetails}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.issueDate} type="date" value={editor.issueDate} disabled={editor.stage === "issued"} required onChange={(v) => updateEditor({issueDate:v})} />
              <Field label={t.operationDate} type="date" value={editor.operationDate} disabled={editor.stage === "issued"} required onChange={(v) => updateEditor({operationDate:v})} />
              <Field label={t.dueDate} type="date" value={editor.dueDate} disabled={editor.stage === "issued"} required onChange={(v) => updateEditor({dueDate:v})} />
              <Field label={t.subject} value={editor.subject} disabled={editor.stage === "issued"} onChange={(v) => updateEditor({subject:v})} />
              <Field label={t.reference} value={editor.reference} disabled={editor.stage === "issued"} onChange={(v) => updateEditor({reference:v})} />
              <label className={labelClass}><span>Currency</span><select className={inputClass} value={editor.currency} disabled={editor.stage === "issued"} onChange={(e) => updateEditor({currency:e.target.value as InvoiceRecord["currency"]})}><option value="MAD">MAD — Moroccan dirham</option><option value="EUR">EUR — Euro</option><option value="USD">USD — US dollar</option></select></label>
              <label className={labelClass}><span>{t.method}</span><select className={inputClass} value={editor.paymentMethod} disabled={editor.stage === "issued"} onChange={(e) => updateEditor({paymentMethod:e.target.value as InvoiceRecord["paymentMethod"]})}>
                <option value="transfer">{t.transfer}</option><option value="cash">{t.cash}</option><option value="check">{t.check}</option><option value="card">{t.card}</option><option value="other">{t.other}</option>
              </select></label>
            </div>
          </section>
          {renderOptions(editor.seller,"seller",editor.stage === "issued")}
          <section className={panelClass}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-bold text-ink">{t.buyer}</h2>
              <label className={"no-print " + labelClass}><span>{t.useContact}</span><select className={inputClass + " min-w-52"} value="" disabled={editor.stage === "issued"} onChange={(e) => setContact(e.target.value)}><option value="">{contacts.length ? t.selectContact : t.noCustomer}</option>{contacts.filter((c: Contact) => c.type === "client").map((c: Contact) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["name",t.businessName],["address",t.address],["city",t.city],["country",t.country],["phone",t.phone],["email",t.email],["ice",t.ice],["taxId",t.taxId],["rc",t.rc],
              ] as [keyof InvoiceParty,string][]).map(([key,label]) => <Field key={key} label={label} value={editor.buyer[key]} disabled={editor.stage === "issued"} onChange={(value) => updateParty("buyer",{[key]:value})} required={key==="name"} type={key==="email"?"email":key==="phone"?"tel":"text"} />)}
            </div>
          </section>
          <section className={panelClass}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-bold text-ink">{t.lineItems}</h2><button disabled={editor.stage==="issued"} onClick={() => updateEditor({lines:[...editor.lines,{id:createInvoiceId(),description:"",unit:"unit",quantity:1,unitPriceHT:0,vatRate:settings.taxRate ?? 20}]})} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-bold text-brand hover:bg-brand-50 disabled:opacity-50"><Plus className="h-3.5 w-3.5"/>{t.addLine}</button></div>
            <div className="space-y-3">
              {editor.lines.map((line,index) => <div key={line.id} className="rounded-xl border border-line bg-canvas/40 p-3">
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-muted">{t.newLine} {index+1}</span>{editor.stage==="draft" && editor.lines.length>1 && <button aria-label={t.deleteDraft} onClick={() => updateEditor({lines:editor.lines.filter((item)=>item.id!==line.id)})} className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4"/></button>}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Field label={t.description} value={line.description} disabled={editor.stage==="issued"} onChange={(v)=>updateLine(line.id,{description:v})} required /></div>
                  <Field label={t.unit} value={line.unit} disabled={editor.stage==="issued"} onChange={(v)=>updateLine(line.id,{unit:v})} />
                  <Field label={t.quantity} type="number" value={line.quantity} min={0.001} max={100000000} step={0.001} disabled={editor.stage==="issued"} onChange={(v)=>updateLine(line.id,{quantity:v===""?0:Number(v)})} />
                  <Field label={t.unitPriceHT} type="number" value={line.unitPriceHT} min={0} max={100000000000} step={0.01} disabled={editor.stage==="issued"} onChange={(v)=>updateLine(line.id,{unitPriceHT:v===""?0:Number(v)})} />
                  <label className={labelClass}><span>{t.vatRate}</span><select className={inputClass} value={String(line.vatRate)} disabled={editor.stage==="issued"} onChange={(e)=>{if(e.target.value==="custom"){const raw=window.prompt(t.customRate+" (0–100)",String(line.vatRate));if(raw!==null&&raw.trim()!==""){const rate=Number(raw);if(Number.isFinite(rate)&&rate>=0&&rate<=100)updateLine(line.id,{vatRate:rate});}}else updateLine(line.id,{vatRate:Number(e.target.value)});}}>
                    <option value="0">0%</option><option value="7">7%</option><option value="10">10%</option><option value="14">14%</option><option value="20">20%</option>{![0,7,10,14,20].includes(line.vatRate) && <option value={line.vatRate}>{line.vatRate}%</option>}<option value="custom">{t.customRate}</option>
                  </select></label>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-xs"><span className="text-muted">{t.lineTotal}</span><strong className="tabular-nums text-ink">{amount(calculateInvoiceTotals([line]).totalTTC,editor.currency,language)}</strong></div>
              </div>)}
            </div>
            <div className="mt-4 rounded-xl bg-canvas p-3">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t.totals}</h3>
              <div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted">{t.subtotalHT}</span><strong>{amount(editorTotals?.subtotalHT||0,editor.currency,language)}</strong></div>
                {editorTotals?.taxBreakdown.map((tax)=> <div key={tax.rate} className="flex justify-between"><span className="text-muted">{t.tax} ({tax.rate}%)</span><strong>{amount(tax.vat,editor.currency,language)}</strong></div>)}
                <div className="flex justify-between border-t border-line pt-2 text-base font-extrabold text-ink"><span>{t.totalTTC}</span><span>{amount(editorTotals?.totalTTC||0,editor.currency,language)}</span></div>
              </div>
              <p className="mt-3 text-[11px] leading-4 text-muted">{t.reviewTax} {t.vatExemptNote}</p>
            </div>
          </section>
          <section className={panelClass}>
            <h2 className="mb-4 text-sm font-bold text-ink">{t.payment}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.amountPaid} type="number" value={editor.amountPaid} min={0} max={editorTotals?.totalTTC||0} step={0.01} disabled={false} onChange={(v)=>updatePaymentEditor({amountPaid:v===""?0:Number(v)})} />
              <div className="flex items-end"><div className="w-full rounded-lg bg-canvas px-3 py-2.5"><p className="text-xs text-muted">{t.balanceDue}</p><p className="mt-1 font-bold tabular-nums text-ink">{amount(editorTotals?.balanceDue||0,editor.currency,language)}</p></div></div>
              <Field label={t.paymentReference} value={editor.paymentReference} disabled={editor.stage==="issued"} onChange={(v)=>updateEditor({paymentReference:v})} />
              <Field label={t.paidDate} type="date" value={editor.paidAt} onChange={(v)=>updatePaymentEditor({paidAt:v})} />
              <div className="sm:col-span-2"><Field label={t.paymentTerms} value={editor.paymentTerms} disabled={editor.stage==="issued"} onChange={(v)=>updateEditor({paymentTerms:v})} /></div>
              {editor.stage==="issued" && <button onClick={savePayment} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-bold text-white hover:bg-brand-700"><Save className="h-4 w-4"/>{t.savePayment}</button>}
              {editor.stage==="issued" && <button onClick={()=>{const total=calculateInvoiceTotals(editor.lines).totalTTC;const updated={...editor,amountPaid:total,paidAt:todayIso(),updatedAt:new Date().toISOString()};const next=invoices.map((i)=>i.id===editor.id?updated:i);if(persist(next)){setEditor(updated);setFeedback(t.paymentSaved);}}} className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm font-bold text-ink hover:bg-canvas"><CheckCircle2 className="h-4 w-4"/>{t.markPaid}</button>}
            </div>
          </section>
          <section className={panelClass}>
            <h2 className="mb-4 text-sm font-bold text-ink">{t.design}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}><span>{t.style}</span><select className={inputClass} value={editor.theme} disabled={editor.stage==="issued"} onChange={(e)=>updateEditor({theme:e.target.value as InvoiceTheme})}><option value="classic">{t.classic}</option><option value="modern">{t.modern}</option><option value="friendly">{t.friendly}</option></select></label>
              <label className={labelClass}><span>{t.accent}</span><div className="mt-1.5 flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-2"><input aria-label={t.accent} type="color" disabled={editor.stage==="issued"} value={editor.accentColor} onChange={(e)=>updateEditor({accentColor:e.target.value})} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"/><span className="font-mono text-xs text-muted">{editor.accentColor.toUpperCase()}</span><Palette className="ms-auto h-4 w-4 text-muted"/></div></label>
              <label className={labelClass}><span>{t.logo}</span><div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-line bg-canvas px-3 py-2.5"><Upload className="h-4 w-4 text-muted"/><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={editor.stage==="issued"} className="min-w-0 flex-1 text-xs text-muted file:me-2 file:rounded-md file:border-0 file:bg-brand-50 file:px-2 file:py-1 file:font-semibold file:text-brand" onChange={(e)=>handleLogo(e.target.files?.[0])}/>{editor.logoDataUrl && <button onClick={()=>updateEditor({logoDataUrl:null})} disabled={editor.stage==="issued"} className="text-xs font-semibold text-red-600">{t.removeLogo}</button>}</div>{logoError && <span className="mt-1 block text-xs text-red-600">{t.invalidLogo}</span>}</label>
              <label className={labelClass}><span>{t.templates}</span><select className={inputClass} value="" disabled={editor.stage==="issued" || !templates.length} onChange={(e)=>{const item=templates.find((x)=>x.id===e.target.value);if(item)applyTemplate(item);}}><option value="">{templates.length?t.chooseTemplate:t.noTemplate}</option>{templates.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <div className="sm:col-span-2"><AreaField label={t.notes} value={editor.notes} disabled={editor.stage==="issued"} onChange={(v)=>updateEditor({notes:v})}/></div>
              <div className="sm:col-span-2"><AreaField label={t.taxNote} value={editor.taxNote} disabled={editor.stage==="issued"} onChange={(v)=>updateEditor({taxNote:v})}/></div>
              {editor.stage==="draft" && <div className="sm:col-span-2">
                {!templateEditorOpen ? <button onClick={()=>{setTemplateEditorOpen(true);setTemplateName("");}} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm font-semibold text-brand hover:bg-brand-50"><Save className="h-4 w-4"/>{t.saveTemplate}</button> :
                  <div className="flex flex-wrap gap-2"><input className={inputClass+" mt-0 min-w-44 flex-1"} value={templateName} onChange={(e)=>setTemplateName(e.target.value)} placeholder={t.templateName}/><button onClick={saveTemplate} className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white">{t.saveTemplateConfirm}</button><button onClick={()=>setTemplateEditorOpen(false)} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted">{t.back}</button></div>}
              </div>}
              {templates.length>0 && <div className="sm:col-span-2 space-y-2"><p className="text-xs font-semibold text-muted">{t.templates}</p>{templates.map((item)=><div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"><span className="min-w-0 truncate text-sm text-ink">{item.name}</span><button onClick={()=>deleteTemplate(item)} disabled={!ready} className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-red-600" title={t.deleteTemplate} aria-label={t.deleteTemplate}><Trash2 className="h-4 w-4"/></button></div>)}</div>}
            </div>
            <p className="mt-4 text-xs leading-5 text-muted">{t.issueHelp}</p>
          </section>
        </div>
        <aside className="min-w-0 space-y-3">
          <div className="no-print flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold text-ink"><FileText className="h-4 w-4 text-brand"/>{t.preview}</h2><span className="text-xs text-muted">{t.pdfHelp}</span></div>
          <InvoicePreview invoice={editor} t={t} language={language}/>
          <div className="no-print rounded-xl border border-line bg-canvas p-3 text-xs leading-5 text-muted"><strong className="text-ink">{t.noLegalApproval}.</strong> {t.disclaimer}<p className="mt-2">{t.localWarning}</p><p className="mt-2">{t.localDanger}</p></div>
        </aside>
      </div>
    </>}
    <div className="no-print space-y-2 text-[11px] leading-4 text-muted">
      <p>{t.noLegalApproval}. {t.localWarning}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <a className="underline underline-offset-2 hover:text-brand" href={localizedLandingPath("terms", language)}>{language === "ar" ? "شروط الاستخدام" : language === "fr" ? "Conditions d’utilisation" : "Terms of Service"}</a>
        <a className="underline underline-offset-2 hover:text-brand" href={localizedLandingPath("privacy", language)}>{language === "ar" ? "سياسة الخصوصية" : language === "fr" ? "Politique de confidentialité" : "Privacy Policy"}</a>
        <a className="underline underline-offset-2 hover:text-brand" href={localizedLandingPath("cookies", language)}>{language === "ar" ? "سياسة ملفات تعريف الارتباط" : language === "fr" ? "Politique relative aux cookies" : "Cookie Policy"}</a>
      </div>
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-xs font-semibold text-muted">{label}</p><p className="mt-2 break-words text-xl font-bold tabular-nums text-ink">{value}</p></div>;
}
function Notice({ text, danger = false }: { text: string; danger?: boolean }) {
  return <div role="status" className={"whitespace-pre-line rounded-xl border p-3 text-sm leading-5 " + (danger ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>{text}</div>;
}
