import type { AdCampaign, AuditEvent, CalendarEvent, Contact, Contract, DeliveryOrder, Expense, Project, Settings, StockItem, SubscriptionTool, TeamMember, VerificationCall, VerificationTeam } from "./types"

/** Neutral configuration, not a sample business identity. The tax/currency values
 * are editable form defaults, not declarations about an authenticated business.
 */
export const defaultSettings: Settings = {
  company: "", ice: "", taxId: "", rc: "", address: "", city: "",
  currency: "MAD", taxRate: 20, logo: null, headerNote: "", footerNote: "",
}

export function emptyBusinessData(): {
  settings: Settings; projects: Project[]; contacts: Contact[]; expenses: Expense[];
  stock: StockItem[]; contracts: Contract[]; team: TeamMember[];
  tools: SubscriptionTool[]; audit: AuditEvent[]; orders: DeliveryOrder[]; campaigns: AdCampaign[];
  calendarEvents: CalendarEvent[];
  verificationTeam: VerificationTeam;
  verificationCalls: VerificationCall[];
} {
  return {
    settings: { ...defaultSettings }, projects: [], contacts: [], expenses: [],
    stock: [], contracts: [], team: [], tools: [], audit: [], orders: [], campaigns: [], calendarEvents: [],
    verificationTeam: { name: "", members: [] }, verificationCalls: [],
  }
}
