import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import Projects from "../src/modules/Projects"
import { Toggle } from "../src/components/kit"
import { useMizan } from "../src/store/useMizan"
import { seedProjects } from "../src/store/seed"

beforeEach(() => useMizan.setState({ projects: structuredClone(seedProjects) }))

it("updates a milestone immediately while its modal stays open", () => {
  render(<Projects />)
  fireEvent.click(screen.getAllByRole("button", { name: "Jalons" })[0])
  const milestone = screen.getByRole("button", { name: "Finitions" })
  expect(milestone.querySelector("span")?.className).not.toContain("line-through")
  fireEvent.click(milestone)
  expect(screen.getByRole("button", { name: "Finitions" }).querySelector("span")?.className).toContain("line-through")
  fireEvent.click(screen.getByRole("button", { name: "Finitions" }))
  expect(screen.getByRole("button", { name: "Finitions" }).querySelector("span")?.className).not.toContain("line-through")
})

it("does not submit a form when a shared Toggle is clicked", () => {
  const submit = vi.fn((event: React.FormEvent) => event.preventDefault())
  const change = vi.fn()
  render(<form onSubmit={submit}><Toggle checked={false} onChange={change} /></form>)
  fireEvent.click(screen.getByRole("switch"))
  expect(change).toHaveBeenCalledWith(true)
  expect(submit).not.toHaveBeenCalled()
})
