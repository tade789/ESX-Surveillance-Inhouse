// menus/Price Manipulation/mark-open.js
import { DataManager } from "../../core/dataManager.js";
import { toHTMLTable, createDownloadButton } from "../../core/utils.js";

export function initMarkOpen() {
  const box = document.getElementById("mark-open-report");
  if (!box) return;

  function detectMarkOpen() {
    const rows = DataManager.getData();
    if (!rows || !rows.length) return null;

    const windowMin = parseInt(document.getElementById("mo-window")?.value || "5", 10);
    const pctThreshold = parseFloat(document.getElementById("mo-threshold")?.value || "5");

    // Group trades by security+date
    const bySecDate = new Map();
    for (const r of rows) {
      if (!r.Security || !r.Date || !r["Date Time"]) continue;
      const key = `${r.Security}|${r.Date}`;
      if (!bySecDate.has(key)) bySecDate.set(key, []);
      bySecDate.get(key).push(r);
    }

    const flagged = [];

    for (const [key, trades] of bySecDate.entries()) {
      trades.sort((a, b) => a["Date Time"] - b["Date Time"]);
      const firstTrade = trades[0];
      if (!firstTrade) continue;

      // Determine market open time = first trade's date at 09:00 (or use first trade time baseline)
      const tradeDate = firstTrade.Date;
      const openTime = new Date(firstTrade["Date Time"]);
      openTime.setHours(9, 0, 0, 0); // adjust to your market open

      const cutoff = new Date(openTime.getTime() + windowMin * 60000);

      // Get previous close price (from prior day)
      const prevDate = new Date(openTime);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevKey = `${firstTrade.Security}|${prevDate.toISOString().slice(0, 10)}`;
      const prevTrades = bySecDate.get(prevKey);

      if (!prevTrades || !prevTrades.length) continue;
      const prevClose = prevTrades[prevTrades.length - 1].Price;

      for (const t of trades) {
        if (t["Date Time"] >= openTime && t["Date Time"] <= cutoff) {
          if (t.Price >= prevClose * (1 + pctThreshold / 100)) {
            flagged.push({
              "Security": t.Security,
              "Date": t.Date,
              "Time": t["Date Time"] instanceof Date ? t["Date Time"].toLocaleTimeString() : t["Date Time"],
              "Trade Price": t.Price,
              "Prev Close": prevClose,
              "Pct Above Close": (((t.Price - prevClose) / prevClose) * 100).toFixed(2) + "%"
            });
          }
        }
      }
    }

    return flagged;
  }

  function render() {
    const flagged = detectMarkOpen();
    if (flagged === null) {
      box.innerHTML = "<p style='color:orange;'>⚠️ Please upload data in Home first.</p>";
      return;
    }
    if (!flagged.length) {
      box.innerHTML = "<p>✅ Dataset loaded. No suspicious mark-the-open trades found.</p>";
      return;
    }

    box.innerHTML = `<div><strong>Mark the Open Report</strong> (${flagged.length} record(s))</div>`;
    box.innerHTML += toHTMLTable(flagged.slice(0, 200));
    createDownloadButton(box, flagged, "mark_open_report.csv");
  }

  document.getElementById("mo-apply")?.addEventListener("click", render);

  render();
  document.addEventListener("data:updated", render);
  document.addEventListener("data:cleared", render);
}
