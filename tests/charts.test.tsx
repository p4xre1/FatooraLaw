import { render } from "@testing-library/react"
import { expect, it } from "vitest"
import { BarChart } from "../src/components/charts"

it("does not draw a fake positive bar for a recorded zero amount", () => {
  const view = render(<BarChart labels={["Zero", "Actual"]} series={[{ name: "Amount", values: [0, 100] }]} />)
  const bars = view.container.querySelectorAll('rect[fill="var(--chart-1)"]')
  expect(bars).toHaveLength(2)
  expect(bars[0].getAttribute("height")).toBe("0")
  expect(Number(bars[1].getAttribute("height"))).toBeGreaterThan(0)
})
