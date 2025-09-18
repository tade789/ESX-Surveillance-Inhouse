// menus/Insider Trading/front-running.js
import { DataManager } from "../../core/dataManager.js";
import { toHTMLTable, createDownloadButton } from "../../core/utils.js";

/**
 * Base front-running heuristic:
 * - Identify "watch accounts" (Proprietary, Employee)
 * - Identify client trades (non-watch accounts)
 * - For each client trade meeting size threshold:
 *    find prior watch trades in same security and side, within time window,
 *    with optional price advantage (buy: watchPrice <= clientPrice; sell: watchPrice >= clientPrice)
 * - Output matched pairs
 */

export function initFrontRunning() {
  const box = document.getElementById("front-running-report");
  if (!box) return;

  // ---- Configure Watch Lists (edit these as needed) ----
  // Proprietary accounts (by Client account code)
  const proprietaryAccounts = new Set([
    "ET98BINITAA00005" // example from earlier
  ]);

  // Employee list — match by Username field (case-insensitive)
  // Add trading staff usernames here
  const employeeUsernames = new Set([
    // "jdoe", "tadesse", ...
  ]);

  function isWatchAccount(row, allowedTypes) {
    // Determine watch type of this row (if any)
    const user = (row.Username || "").toString().trim().toLowerCase();
    const client = (row.Client || "").toString().trim();

    const isProp = proprietaryAccounts.has(client);
    const isEmp  = user && employeeUsernames.has(user);

    if (isProp && allowedTypes.has("Proprietary")) return "Proprietary";
    if (isEmp  && allowedTypes.has("Employee"))    return "Employee";
    return null;
  }

  function minutesBetween(d1, d2) {
    if (!(d1 instanceof Date) || !(d2 instanceof Date)) return NaN;
    return (d2 - d1) / 60000; // d2 after d1 => positive
  }

  function applyFiltersAndDetect() {
    const rows = DataManager.getData();
    if (!rows || !rows.length) return null;

    // --- Read filters ---
    const fromDate = document.getElementById("fr-date-from")?.value || null;
    const toDate   = document.getElementById("fr-date-to")?.value   || null;
    const windowMin = Math.max(1, parseInt(document.getElementById("fr-window")?.value || "30", 10));
    const minClientQty = Math.max(1, parseInt(document.getElementById("fr-min-client-qty")?.value || "1000", 10));
    const minWatchPct  = Math.min(100, Math.max(1, parseInt(document.getElementById("fr-min-watch-pct")?.value || "20", 10)));
    const requirePriceAdv = !!document.getElementById("fr-price-adv")?.checked;

    const allowedTypes = new Set(
      Array.from(document.querySelectorAll(".fr-watch-filter:checked")).map(cb => cb.value)
    );

    // --- Filter by date first (cheap) ---
    const inDate = rows.filter(r => {
      if (!r.Date) return false;
      if (fromDate && r.Date < fromDate) return false;
      if (toDate   && r.Date > toDate)   return false;
      return true;
    });

    // --- Split into watch and client trades ---
    const watchTrades = [];
    const clientTrades = [];

    for (const r of inDate) {
      const wt = isWatchAccount(r, allowedTypes);
      if (wt) {
        watchTrades.push({ ...r, WatchType: wt });
      } else {
        clientTrades.push(r);
      }
    }

    if (!watchTrades.length || !clientTrades.length) {
      return { matches: [], debug: { watchCount: watchTrades.length, clientCount: clientTrades.length } };
    }

    // --- Index watch trades by Security + Side for quick lookup ---
    const idx = new Map(); // key: "SEC|side" -> array of watch trades
    for (const w of watchTrades) {
      const key = `${w.Security}|${w.Side}`;
      if (!idx.has(key)) idx.set(key, []);
      idx.get(key).push(w);
    }
    // Ensure each list is time-sorted ascending
    for (const list of idx.values()) {
      list.sort((a,b) => a["Date Time"] - b["Date Time"]);
    }

    const matches = [];
    // --- Scan client trades and look back within window ---
    for (const c of clientTrades) {
      if (!c["Date Time"] || !c.Security || !c.Side) continue;
      if ((c.Quantity || 0) < minClientQty) continue;

      const key = `${c.Security}|${c.Side}`;
      const bucket = idx.get(key);
      if (!bucket || !bucket.length) continue;

      // Find candidate watch trades: t_w in [t_c - windowMin, t_c)
      const tc = c["Date Time"];
      const tStart = new Date(tc.getTime() - windowMin * 60000);

      // Walk bucket (already sorted) and check rule
      for (let i = bucket.length - 1; i >= 0; i--) {
        const w = bucket[i];
        const tw = w["Date Time"];
        if (!tw) continue;

        if (tw >= tc) continue;                 // not "before"
        if (tw < tStart) break;                 // outside window (earlier than start)

        // Quantity threshold: watch >= minWatchPct% of client qty
        const watchQtyOK = (w.Quantity || 0) >= (c.Quantity || 0) * (minWatchPct / 100);

        // Price advantage (optional)
        let priceAdvOK = true;
        if (requirePriceAdv) {
          if (c.Side.toLowerCase() === "buy")   priceAdvOK = (w.Price || 0) <= (c.Price || 0);
          else if (c.Side.toLowerCase() === "sell") priceAdvOK = (w.Price || 0) >= (c.Price || 0);
        }

        if (watchQtyOK && priceAdvOK) {
          const mins = Math.round((tc - tw) / 60000);
          matches.push({
            Date: c.Date,
            Security: c.Security,

            "Client Account": c.Client,
            "Client Side": c.Side,
            "Client Qty": c.Quantity,
            "Client Price": c.Price,
            "Client Time": c["Date Time"] instanceof Date ? c["Date Time"].toLocaleString() : c["Date Time"],

            "Watch Account": w.Client,
            "Watch Username": w.Username || "",
            "Watch Type": w.WatchType,
            "Watch Side": w.Side,
            "Watch Qty": w.Quantity,
            "Watch Price": w.Price,
            "Watch Time": w["Date Time"] instanceof Date ? w["Date Time"].toLocaleString() : w["Date Time"],

            "Minutes Before": mins,
            "Price Advantage?": requirePriceAdv ? "Yes" : (c.Side?.toLowerCase()==="buy" ? (w.Price<=c.Price?"Yes":"No") : (w.Price>=c.Price?"Yes":"No"))
          });
        }
      }
    }

    return { matches, debug: { watchCount: watchTrades.length, clientCount: clientTrades.length } };
  }

  function render() {
    const res = applyFiltersAndDetect();
    if (res === null) {
      box.innerHTML = "<p style='color:orange;'>⚠️ Please upload data in Home first.</p>";
      return;
    }

    const { matches, debug } = res;

    if (!matches.length) {
      box.innerHTML = `
        <p>✅ Dataset loaded. No front-running candidates with current filters.</p>
        <p style="opacity:.8">Watch trades considered: ${debug.watchCount || 0}; Client trades considered: ${debug.clientCount || 0}</p>
      `;
      return;
    }

    box.innerHTML = `<div><strong>Front Running Candidates</strong> (${matches.length} pair(s))</div>`;
    box.innerHTML += toHTMLTable(matches.slice(0, 200)); // preview top 200 rows
    createDownloadButton(box, matches, "front_running_candidates.csv");
  }

  // Hook filters
  document.getElementById("fr-apply")?.addEventListener("click", render);

  // Render immediately (if dataset cached)
  render();

  // Re-render on dataset updates/clears
  document.addEventListener("data:updated", render);
  document.addEventListener("data:cleared", render);
}
