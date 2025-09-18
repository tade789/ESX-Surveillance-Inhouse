// menus/Price Manipulation/mark-close.js
import { DataManager } from "../../core/dataManager.js";
import { toHTMLTable, createDownloadButton } from "../../core/utils.js";

export function initMarkClose() {
  const box = document.getElementById("mark-close-report");
  if (!box) return;

  function detectMarkClose() {
    const rows = DataManager.getData();
    if (!rows || !rows.length) return null;

    const closeWindow = parseInt(document.getElementById("mc-window")?.value || "5", 10);
    const pctThreshold = parseFloat(document.getElementById("mc-threshold")?.value || "5");

    const closingHour = 16; // assume market closes at 16:00
    const cutoffMinute = 60 - closeWindow;

    // --- Step 1: Group trades by Security+Date for average price ---
    const bySecDate = new Map();
    for (const r of rows) {
      if (!r.Security || !r.Date || !r.Price) continue;
      const key = `${r.Security}||${r.Date}`;
      if (!bySecDate.has(key)) bySecDate.set(key, []);
      bySecDate.get(key).push(r);
    }

    const flagged = [];
    for (const [key, trades] of bySecDate.entries()) {
      // Calculate day avg price
      const avgPrice = trades.reduce((sum, t) => sum + t.Price, 0) / trades.length;

      for (const t of trades) {
        const dt = t["Date Time"];
        if (!(dt instanceof Date)) continue;

        // within last N minutes of session
        if (
          dt.getHours() === closingHour - 1 && dt.getMinutes() >= cutoffMinute ||
          dt.getHours() === closingHour
        ) {
          const pctDiff = ((t.Price - avgPrice) / avgPrice) * 100;
          if (Math.abs(pctDiff) >= pctThreshold) {
            flagged.push({
              Security: t.Security,
              Date: t.Date,
              Client: t.Client || "",
              "Trade Price": t.Price,
              "Avg Day Price": avgPrice.toFixed(2),
              "Price Change %": pctDiff.toFixed(2),
              "Trade Time": dt.toLocaleTimeString()
            });
          }
        }
      }
    }

    return flagged;
  }

  function render() {
    const flagged = detectMarkClose();
    if (flagged === null) {
      box.innerHTML = "<p style='color:orange;'>⚠️ Please upload data in Home first.</p>";
      return;
    }
    if (!flagged.length) {
      box.innerHTML = "<p>✅ Dataset loaded. No mark-the-close trades found with current filters.</p>";
      return;
    }

    box.innerHTML = `<div><strong>Mark the Close Report</strong> (${flagged.length} records)</div>`;
    box.innerHTML += toHTMLTable(flagged.slice(0, 200));
    createDownloadButton(box, flagged, "mark_the_close_report.csv");
  }

  document.getElementById("mc-apply")?.addEventListener("click", render);

  render();
  document.addEventListener("data:updated", render);
  document.addEventListener("data:cleared", render);
}
