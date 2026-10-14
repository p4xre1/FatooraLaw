import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Link, MemoryRouter, Route, Routes } from "react-router"
import { expect, it, vi } from "vitest"

vi.mock("../src/admin/blogs/client", () => ({
  getPost: vi.fn().mockResolvedValue({
    id: "a", title: "Existing title", slug: "existing-title", content: "Private draft", excerpt: "", seo_title: "", seo_description: "", keywords: [],
    author_name: "Fatorati", published: false, published_at: null, created_at: "2026-10-01", updated_at: "2026-10-01", user_id: "admin",
    translations: {},
  }),
  createPost: vi.fn(), updatePost: vi.fn(),
}))
vi.mock("../src/admin/platform/client", () => ({ getBlogPublishRules: vi.fn().mockResolvedValue({ require_translations: true, require_seo_metadata: true }) }))
import BlogEditor from "../src/admin/blogs/editor"

it("starts with a blank draft when navigating from an existing article to New", async () => {
  render(
    <MemoryRouter initialEntries={["/admin/blogs/a"]}>
      <Link to="/admin/blogs/new">New draft</Link>
      <Routes>
        <Route path="/admin/blogs/new" element={<BlogEditor />} />
        <Route path="/admin/blogs/:id" element={<BlogEditor />} />
      </Routes>
    </MemoryRouter>,
  )
  await waitFor(() => expect((screen.getByLabelText("Titre français") as HTMLInputElement).value).toBe("Existing title"))
  fireEvent.click(screen.getByRole("link", { name: "New draft" }))
  await waitFor(() => expect((screen.getByLabelText("Titre français") as HTMLInputElement).value).toBe(""))
  expect((screen.getByRole("textbox", { name: /Contenu de l’article/ }) as HTMLTextAreaElement).value).toBe("")
})
