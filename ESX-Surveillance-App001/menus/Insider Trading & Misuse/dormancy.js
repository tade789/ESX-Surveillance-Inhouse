// menus/Trade based Manipulation/dormancy.js
import { DataManager } from "../../core/dataManager.js";
import { toHTMLTable, createDownloadButton } from "../../core/utils.js";

export function initDormancy() {
  const box = document.getElementById("dormancy-report");
  if (!box) return;

  function detectDormancy() {
    const rows = DataManager.getData();
    if (!rows || !rows.length) return null;

    const dormancyDays = parseInt(document.getElementById("dormancy-days")?.value || "90", 10);
    const minQty = parseInt(document.getElementById("dormancy-min-qty")?.value || "100", 10);

    // Group trades by client
    const byClient = new Map();
    for (const r of rows) {
      if (!r.Client || !r["Date Time"]) continue;
      if (!byClient.has(r.Client)) byClient.set(r.Client, []);
      byClient.get(r.Client).push(r);
    }

    const flagged = [];
    for (const [client, trades] of byClient.entries()) {
      // Sort trades by datetime
      trades.sort((a, b) => a["Date Time"] - b["Date Time"]);

      for (let i = 1; i < trades.length; i++) {
        const prev = trades[i - 1];
        const curr = trades[i];
        if (!curr.Quantity || curr.Quantity <= minQty) continue;

        // Days since last trade
        const gapDays = (curr["Date Time"] - prev["Date Time"]) / (1000 * 60 * 60 * 24);
        if (gapDays >= dormancyDays) {
          flagged.push({
            "Client Account": client,
            "Security": curr.Security,
            "Side": curr.Side,
            "Quantity": curr.Quantity,
            "Price": curr.Price,
            "Trade Date": curr.Date,
            "Trade Time": curr["Date Time"] instanceof Date ? curr["Date Time"].toLocaleString() : curr["Date Time"],
            "Dormant Gap (days)": Math.round(gapDays)
          });
        }
      }
    }
    return flagged;
  }

  function render() {
    const flagged = detectDormancy();

    if (flagged === null) {
      box.innerHTML = "<p style='color:orange;'>⚠️ Please upload data in Home first.</p>";
      return;
    }
    if (!flagged.length) {
      box.innerHTML = "<p>✅ Dataset loaded. No dormant unusual trades found with current filters.</p>";
      return;
    }

    box.innerHTML = `<div><strong>Dormancy Report</strong> (${flagged.length} record(s))</div>`;
    box.innerHTML += toHTMLTable(flagged.slice(0, 200));
    createDownloadButton(box, flagged, "dormancy_unusual_trades.csv");
  }

  document.getElementById("dormancy-apply")?.addEventListener("click", render);

  render();
  document.addEventListener("data:updated", render);
  document.addEventListener("data:cleared", render);
}
