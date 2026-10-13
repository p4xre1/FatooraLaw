import { beforeEach, expect, it } from "vitest"
import { render } from "../src/entry-server"
import { useMizan } from "../src/store/useMizan"

beforeEach(() => useMizan.getState().signOut())

it("prerenders the complete public landing without the removed badge or private account fields", () => {
  useMizan.getState().signIn("Private user", "private@example.com", "owner", "ssr-account")
  useMizan.getState().updateSettings({ company: "Private company" })
  const html = render()
  expect(html).toContain('id="features"')
  expect(html).toContain('id="pricing"')
  expect(html).toContain('id="contact"')
  expect(html).not.toContain("Pensé pour les artisans")
  expect(html).not.toContain("Private company")
  expect(html).not.toContain("Private user")
})
