import { useEffect, useState } from "react"
import { todayISO } from "../lib/calendarDates"

/** Refresh date-based labels at local midnight and when a background tab resumes. */
export function useToday() {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    function refresh() {
      setToday(todayISO())
      clearTimeout(timer)
      const now = new Date()
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timer = setTimeout(refresh, nextMidnight.getTime() - now.getTime() + 20)
    }
    refresh()
    document.addEventListener("visibilitychange", refresh)
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", refresh) }
  }, [])
  return today
}
