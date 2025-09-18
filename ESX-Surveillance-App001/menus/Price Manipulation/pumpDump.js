// menus/Price Manipulation/pump-dump.js
import { DataManager } from "../../core/dataManager.js";
import { toHTMLTable, createDownloadButton, groupBy } from "../../core/utils.js";

export function initPumpDump() {
  const box = document.getElementById("pump-dump-report");
  if (!box) return;

  function detectPumpDump() {
    const rows = DataManager.getData();
    if (!rows || !rows.length) return null;

    const sellThreshold = parseFloat(document.getElementById("pd-sell-threshold")?.value || "70");
    const spikeThreshold = parseFloat(document.getElementById("pd-spike-threshold")?.value || "15");

    const alerts = [];

    // --- Rule 1: Buy-Sell Flip ---
    const byClientSec = groupBy(rows, r => `${r.Client}||${r.Security}`);
    for (const [key, trades] of Object.entries(byClientSec)) {
      trades.sort((a, b) => a["Date Time"] - b["Date Time"]);
      let buyCount = 0;
      let totalBuyQty = 0;
      let totalSellQty = 0;
      let startDate = trades[0]["Date Time"];

      for (const t of trades) {
        if (t.Side === "BUY") {
          buyCount++;
          totalBuyQty += t.Quantity || 0;
        } else if (t.Side === "SELL" && buyCount >= 3) {
          totalSellQty += t.Quantity || 0;
          const days = (t["Date Time"] - startDate) / (1000 * 60 * 60 * 24);
          if (days <= 10 && totalBuyQty > 0 && (totalSellQty / totalBuyQty) * 100 >= sellThreshold) {
            alerts.push({
              Rule: "Buy-Sell Flip",
              Client: t.Client,
              Security: t.Security,
              "Buy Count": buyCount,
              "Total Buys": totalBuyQty,
              "Total Sells": totalSellQty,
              Date: t.Date
            });
            break;
          }
        }
      }
    }

    // --- Rule 2: Price Spike in 5 days ---
    const bySecurity = groupBy(rows, r => r.Security);
    for (const [sec, trades] of Object.entries(bySecurity)) {
      trades.sort((a, b) => a["Date Time"] - b["Date Time"]);
      for (let i = 0; i < trades.length; i++) {
        const start = trades[i];
        const endWindow = new Date(start["Date Time"]);
        endWindow.setDate(endWindow.getDate() + 5);

        const windowTrades = trades.filter(t => t["Date Time"] <= endWindow);
        if (!windowTrades.length) continue;
        const maxPrice = Math.max(...windowTrades.map(t => t.Price));
        const minPrice = Math.min(...windowTrades.map(t => t.Price));

        if (((maxPrice - minPrice) / minPrice) * 100 >= spikeThreshold) {
          alerts.push({
            Rule: "Price Spike",
            Security: sec,
            StartDate: start.Date,
            "Min Price": minPrice,
            "Max Price": maxPrice,
            "Spike %": (((maxPrice - minPrice) / minPrice) * 100).toFixed(2)
          });
          break;
        }
      }
    }

    // --- Rule 3: Circular Trades ---
    const byPair = groupBy(rows, r => `${r.Client}||${r.Counterparty}||${r.Security}`);
    for (const [pair, trades] of Object.entries(byPair)) {
      trades.sort((a, b) => a["Date Time"] - b["Date Time"]);
      const startDate = trades[0]["Date Time"];
      const endWindow = new Date(startDate);
      endWindow.setDate(endWindow.getDate() + 3);

      const windowTrades = trades.filter(t => t["Date Time"] <= endWindow);
      if (windowTrades.length >= 5) {
        const netQty = windowTrades.reduce((sum, t) => {
          return sum + (t.Side === "BUY" ? (t.Quantity || 0) : -(t.Quantity || 0));
        }, 0);
        if (netQty === 0) {
          alerts.push({
            Rule: "Circular Trades",
            Pair: pair,
            "Trade Count": windowTrades.length,
            Security: trades[0].Security,
            StartDate: trades[0].Date,
            EndDate: windowTrades[windowTrades.length - 1].Date
          });
        }
      }
    }

    return alerts;
  }

  function render() {
    const flagged = detectPumpDump();
    if (flagged === null) {
      box.innerHTML = "<p style='color:orange;'>⚠️ Please upload data in Home first.</p>";
      return;
    }
    if (!flagged.length) {
      box.innerHTML = "<p>✅ Dataset loaded. No pump-and-dump patterns found.</p>";
      return;
    }

    box.innerHTML = `<div><strong>Pump and Dump Alerts</strong> (${flagged.length} records)</div>`;
    box.innerHTML += toHTMLTable(flagged.slice(0, 200));
    createDownloadButton(box, flagged, "pump_and_dump_report.csv");
  }

  document.getElementById("pd-apply")?.addEventListener("click", render);

  render();
  document.addEventListener("data:updated", render);
  document.addEventListener("data:cleared", render);
}
