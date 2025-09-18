// menus/Order Book Manipulation/layering.js
import { DataManager } from "../../core/dataManager.js";
import { toHTMLTable, createDownloadButton, groupBy } from "../../core/utils.js";

export function initLayering() {
  const box = document.getElementById("layering-report");
  if (!box) return;

  function detectLayering() {
    const rows = DataManager.getData();
    if (!rows || !rows.length) return null;

    const minOrders = parseInt(document.getElementById("layer-min-orders")?.value || "5");
    const minLevels = parseInt(document.getElementById("layer-min-levels")?.value || "3");
    const cancelRatio = parseInt(document.getElementById("layer-cancel-ratio")?.value || "80");
    const maxDuration = parseInt(document.getElementById("layer-max-duration")?.value || "45");
    const tradeWindow = parseInt(document.getElementById("layer-trade-window")?.value || "7");

    const flagged = [];

    // --- Group by client-security-day ---
    const byClientSec = groupBy(rows, r => `${r.Client}||${r.Security}||${r.Date}`);

    for (const [key, trades] of Object.entries(byClientSec)) {
      const [client, sec, date] = key.split("||");

      // Consider NEW, CANCEL, TRADE events
      const newOrders = trades.filter(r => r.EventType === "NEW");
      const cancels = trades.filter(r => r.EventType === "CANCEL");
      const execs = trades.filter(r => r.EventType === "TRADE");

      // Check per side
      for (const side of ["BUY", "SELL"]) {
        const sideOrders = newOrders.filter(o => o.Side === side);
        if (sideOrders.length < minOrders) continue;

        // Distinct price levels
        const levels = new Set(sideOrders.map(o => o.Price));
        if (levels.size < minLevels) continue;

        // Count cancels for those orders
        let quickCancels = 0;
        for (const o of sideOrders) {
          const c = cancels.find(x => x.OrderID === o.OrderID);
          if (!c) continue;
          const lifeSec = (c["Date Time"] - o["Date Time"]) / 1000;
          if (lifeSec <= maxDuration) quickCancels++;
        }
        const ratio = (100 * quickCancels / sideOrders.length).toFixed(1);
        if (ratio < cancelRatio) continue;

        // Look for opposite-side trade within tradeWindow minutes of last cancel
        const lastCancel = cancels.reduce((a, b) => (a["Date Time"] > b["Date Time"] ? a : b), cancels[0]);
        if (!lastCancel) continue;

        const cutoff = new Date(lastCancel["Date Time"].getTime() + tradeWindow * 60000);
        const oppTrade = execs.find(
          e => e.Side !== side && e["Date Time"] > lastCancel["Date Time"] && e["Date Time"] <= cutoff
        );

        if (oppTrade) {
          flagged.push({
            Date: date,
            Security: sec,
            Client: client,
            Side: side,
            "Total Orders": sideOrders.length,
            "Price Levels": levels.size,
            "Cancel Ratio %": ratio,
            "Last Cancel": lastCancel["Date Time"].toISOString(),
            "Opposite Trade": `${oppTrade.Side} ${oppTrade.Quantity} @ ${oppTrade.Price} (${oppTrade["Date Time"].toISOString()})`,
            Rule: "Layering"
          });
        }
      }
    }

    return flagged;
  }

  function render() {
    const flagged = detectLayering();
    if (flagged === null) {
      box.innerHTML = "<p style='color:orange;'>⚠️ Please upload data in Home first.</p>";
      return;
    }
    if (!flagged.length) {
      box.innerHTML = "<p>✅ Dataset loaded. No layering detected with current parameters.</p>";
      return;
    }

    box.innerHTML = `<div><strong>Layering Alerts</strong> (${flagged.length} records)</div>`;
    box.innerHTML += toHTMLTable(flagged.slice(0, 200));
    createDownloadButton(box, flagged, "layering_report.csv");
  }

  document.getElementById("layer-apply")?.addEventListener("click", render);

  render();
  document.addEventListener("data:updated", render);
  document.addEventListener("data:cleared", render);
}
