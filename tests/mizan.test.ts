import { Blob as NodeBlob } from "node:buffer"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { parseCSV, runAsync, toCSV, toExcel } from "../src/lib/mizan"
import { useMizan } from "../src/store/useMizan"
import { exportCurrentBackup, exportLegacyBackup } from "../src/lib/legacyBackup"

let downloaded: NodeBlob
beforeEach(() => {
  vi.stubGlobal("Blob", NodeBlob)
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn((blob: NodeBlob) => { downloaded = blob; return "blob:test" }),
    revokeObjectURL: vi.fn(),
  })
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe("CSV parsing", () => {
  it("supports commas, escaped quotes, and multiline quoted fields", () => {
    expect(parseCSV('\uFEFFName,Note,Amount\r\n"Atlas, SARL","first\r\nsecond ""line""",42\r\n'))
      .toEqual([["Name", "Note", "Amount"], ["Atlas, SARL", 'first\r\nsecond "line"', "42"]])
  })
  it("preserves significant spaces and empty trailing columns", () => {
    expect(parseCSV("Name,City,\n  Atlas  ,Rabat,\n")).toEqual([["Name", "City", ""], ["  Atlas  ", "Rabat", ""]])
  })
  it("rejects unterminated quotes instead of silently corrupting an import", () => {
    expect(() => parseCSV('Name,Note\nAtlas,"unfinished')).toThrow()
  })
  it("returns no rows for an empty file", () => {
    expect(parseCSV("")).toEqual([])
  })
})

describe("spreadsheet exports", () => {
  it("escapes CSV headers as well as cells and quotes carriage returns", async () => {
    toCSV([{ 'Name, "company"': "Atlas\rSARL" }])
    expect(await downloaded.text()).toBe('"Name, ""company"""\n"Atlas\rSARL"')
    expect(new Uint8Array(await downloaded.arrayBuffer()).slice(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]))
  })
  it("neutralizes formulas in text cells but preserves numeric negatives", async () => {
    toCSV([{ Name: '=HYPERLINK("https://evil.invalid")', Note: " \t+1+1", Amount: -42 }])
    const rows = parseCSV(await downloaded.text())
    expect(rows[1][0].startsWith("'=")).toBe(true)
    expect(rows[1][1]).toBe("' \t+1+1")
    expect(rows[1][2]).toBe("-42")
  })
  it("HTML-escapes Excel headers and every cell", async () => {
    toExcel([{ '<img src=x onerror="alert(1)">': '<script>alert("x")</script>&' }])
    const html = await downloaded.text()
    expect(html).not.toContain("<img")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("&amp;")
  })
  it("prevents formulas in Excel exports too", async () => {
    toExcel([{ Name: "@SUM(1,2)", Amount: -42 }])
    expect(await downloaded.text()).toContain("&#39;@SUM(1,2)")
  })
})

it("rejects asynchronous work failures rather than throwing outside the promise", async () => {
  vi.useFakeTimers()
  const task = runAsync(() => { throw new Error("export failed") }, 10)
  const result = expect(task).rejects.toThrow("export failed")
  await vi.advanceTimersByTimeAsync(10)
  await result
  vi.useRealTimers()
})

it("exports legacy records without exporting old authentication or deleting the original", async () => {
  const legacy = JSON.stringify({ state: { auth: { name: "Old user", role: "owner" }, contacts: [{ name: "Atlas" }] } })
  localStorage.setItem("mizan.store.v1", legacy)
  exportLegacyBackup()
  const backup = JSON.parse(await downloaded.text())
  expect(backup.data).toEqual({ contacts: [{ name: "Atlas" }] })
  expect(backup.data.auth).toBeUndefined()
  expect(localStorage.getItem("mizan.store.v1")).toBe(legacy)
})


it("exports all current business records including subscriptions, but no auth or session objects", async () => {
  useMizan.getState().signIn("Tester", "tester@gmail.com", "owner", "backup-account")
  useMizan.getState().addTool({ name: "Backed up tool", cost: 19.5, start: "", expiry: "" })
  exportCurrentBackup()
  const backup = JSON.parse(await downloaded.text())
  expect(backup.format).toBe("fatorati-local-backup")
  expect(backup.data.tools[0].name).toBe("Backed up tool")
  expect(Object.keys(backup.data).sort()).toEqual(["audit", "contacts", "contracts", "expenses", "projects", "settings", "stock", "team", "tools"])
  expect(backup.auth).toBeUndefined()
  expect(backup.data.auth).toBeUndefined()
  expect(backup.data.signIn).toBeUndefined()
})
