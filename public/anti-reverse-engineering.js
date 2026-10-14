/**
 * ANTI-REVERSE-ENGINEERING & ANTI-TAMPER ARMOR
 * Military-grade browser-layer defenses against inspection, debugging,
 * and source extraction.
 */
(function () {
  "use strict"

  // 1. Block right-click / context menu (prevents copy / inspect element via UI)
  document.addEventListener("contextmenu", function (e) {
    e.preventDefault()
    return false
  }, true)

  // 2. Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U (view source)
  document.addEventListener("keydown", function (e) {
    const key = e.key || e.keyCode
    if (
      key === "F12" ||
      (e.ctrlKey && e.shiftKey && (key === "I" || key === "J" || key === "C")) ||
      (e.ctrlKey && key === "U") ||
      (e.ctrlKey && key === "S") ||
      (e.metaKey && key === "S")
    ) {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
  }, true)

  // 3. Detect DevTools opening via debugger trap + timing
  let devOpenTimer = null
  function trapDevTools() {
    const start = performance.now()
    debugger
    const end = performance.now()
    if (end - start > 100) {
      // DevTools is open (debugger pauses longer when tools are active)
      document.body.innerHTML = '<div style="position:fixed;inset:0;background:#0a0a1a;color:#e2e2e2;display:flex;align-items:center;justify-content:center;font-family:sans-serif;font-size:1.2rem;z-index:999999">SECURITY ARMOR ACTIVE — INSPECTION BLOCKED</div>'
    }
  }
  setInterval(trapDevTools, 800)
  setTimeout(trapDevTools, 300)

  // 4. Clear console repeatedly so attackers can't read logs / errors
  const clearConsole = () => {
    try { console.clear() } catch (_) {}
  }
  setInterval(clearConsole, 250)

  // 5. Overwrite console methods with no-ops to suppress information leakage
  const methods = ["log", "warn", "error", "info", "debug", "trace", "dir", "group", "groupEnd", "table", "time", "timeEnd"]
  methods.forEach((m) => {
    try { console[m] = () => {} } catch (_) {}
  })

  // 6. Block selection / copy of page content (basic content protection)
  document.addEventListener("selectstart", function (e) {
    e.preventDefault()
    return false
  }, true)
})()
