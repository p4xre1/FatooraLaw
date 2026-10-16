import { describe, expect, it } from "vitest"
import { adMetrics, parseAdReportCsv } from "../src/lib/adsAnalytics"

describe("ad report import", () => {
  it("aggregates daily rows by campaign and calculates common paid-traffic metrics", () => {
    const result = parseAdReportCsv(
      "Campaign name,Reporting starts,Amount spent (MAD),Impressions,Link clicks,Website purchases,Purchase conversion value\nSearch,2026-01-01,100,1000,50,5,500\nSearch,2026-01-02,50,500,25,2,200",
      "google",
    )
    expect(result.errors).toEqual([])
    expect(result.rowCount).toBe(2)
    expect(result.campaigns).toEqual([{
      name: "Search", platform: "google", spend: 150, startedAt: "2026-01-01", endedAt: "2026-01-02",
      impressions: 1500, clicks: 75, conversions: 7, conversionValue: 700,
    }])
    expect(adMetrics(result.campaigns[0])).toMatchObject({ ctr: 0.05, cpc: 2, cpa: 150 / 7, conversionRate: 7 / 75, roas: 700 / 150 })
  })

  it("accepts quoted comma-containing campaign names and rejects invalid numeric rows", () => {
    const result = parseAdReportCsv('Campaign,Cost,Clicks,Conversions\n"Brand, spring",10,4,1\nOther,nope,1,0', "facebook")
    expect(result.campaigns).toHaveLength(1)
    expect(result.campaigns[0].name).toBe("Brand, spring")
    expect(result.errors).toContain("Row 3: invalid number.")
  })

  it("reads common French and English thousands/decimal separators", () => {
    const result = parseAdReportCsv('Campaign,Spend,Clicks\nFrench,"1.234,50",2\nEnglish,"1,234.50",2', "google")
    expect(result.campaigns.map((campaign) => campaign.spend)).toEqual([1234.5, 1234.5])
  })

  it("requires a campaign column and avoids divisions by zero", () => {
    expect(parseAdReportCsv("Cost,Clicks\n10,3", "google").campaigns).toEqual([])
    expect(adMetrics({ spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0 })).toEqual({ ctr: null, cpc: null, cpa: null, conversionRate: null, roas: null })
  })
})
