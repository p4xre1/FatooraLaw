import { useTranslation } from "../lib/language/store"
import { Field, Input, Select } from "./kit"
import type { Contact } from "../store/types"

/**
 * Pick a client (or supplier) — or be one, inline.
 *
 * The rule this component exists for: no form in the dashboard may send
 * the owner to Clients & Fournisseurs to create the party first, and no
 * client is ever typed twice. The select lists the existing parties and
 * ends with "＋ Nouveau client…"; choosing it unfolds name / phone /
 * city right there, and `resolveParty` creates the contact and hands
 * back its id at submit time, so the party lands in the contacts —
 * ranked, mapped and analysed like any other — from the one form.
 */
export const NEW_PARTY = "__new_party"

export type PartyDraft = { name: string; phone: string; city: string }
export const emptyPartyDraft = (): PartyDraft => ({ name: "", phone: "", city: "" })

export default function PartyPicker({
  label,
  kind,
  options,
  choice,
  onChoice,
  draft,
  onDraft,
  unknownLabel,
}: {
  label: string
  kind: Contact["type"]
  options: { id: string; name: string }[]
  choice: string
  onChoice: (value: string) => void
  draft: PartyDraft
  onDraft: (draft: PartyDraft) => void
  /** An optional "" choice kept ahead of the list (e.g. a contract's unknown client). */
  unknownLabel?: string
}) {
  const { t: copy } = useTranslation()
  const contactsCopy = copy.contacts
  return (
    <div className="space-y-3">
      <Field label={label}>
        <Select value={choice} onChange={(e) => onChoice(e.target.value)}>
          {unknownLabel !== undefined && <option value="">{unknownLabel}</option>}
          {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          <option value={NEW_PARTY}>{kind === "client" ? copy.delivery.form.newClientOption : copy.procurement.create.newSupplier}</option>
        </Select>
      </Field>
      {choice === NEW_PARTY && (
        <div className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-3">
          <Field label={contactsCopy.nameOrCompany}>
            <Input value={draft.name} onChange={(e) => onDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label={contactsCopy.phone}>
            <Input value={draft.phone} onChange={(e) => onDraft({ ...draft, phone: e.target.value })} placeholder="+212 6…" />
          </Field>
          <Field label={contactsCopy.table.city}>
            <Input value={draft.city} onChange={(e) => onDraft({ ...draft, city: e.target.value })} />
          </Field>
        </div>
      )}
    </div>
  )
}

/** Whether the pick (or the inline draft) is complete enough to save with. */
export function partyReady(choice: string, draft: PartyDraft): boolean {
  return choice === NEW_PARTY ? draft.name.trim().length > 0 : choice.length > 0
}

/**
 * The id to save with: the picked party, "" for an explicit unknown, or
 * the freshly created contact's id when the party was typed inline.
 */
export function resolveParty(
  addContact: (contact: Omit<Contact, "id">) => string,
  kind: Contact["type"],
  choice: string,
  draft: PartyDraft,
): string {
  if (choice !== NEW_PARTY) return choice
  return addContact({
    type: kind,
    name: draft.name,
    ice: "",
    phone: draft.phone,
    email: "",
    city: draft.city,
    balance: 0,
    birthYear: null,
    source: null,
    channel: null,
  })
}
