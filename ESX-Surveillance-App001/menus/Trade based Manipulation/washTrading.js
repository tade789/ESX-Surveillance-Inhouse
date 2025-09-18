// menus/Trade based Manipulation/washTrading.js
import { DataManager } from "../../core/dataManager.js";
import { toHTMLTable, createDownloadButton } from "../../core/utils.js";

export function initWashTrading() {
  const box = document.getElementById("wash-trading-report");
  if (!box) return;

  function detectWashTrading() {
    const rows = DataManager.getData();
    if (!rows || !rows.length) return null;

    const dayWindow = parseInt(document.getElementById("wash-window")?.value || "3");

    const matches = [];
    const sorted = [...rows].sort((a, b) => {
      if (a.Client === b.Client) return a["Date Time"] - b["Date Time"];
      return a.Client.localeCompare(b.Client);
    });

    const clients = [...new Set(sorted.map(r => r.Client))];

    clients.forEach(client => {
      const clientTrades = sorted.filter(r => r.Client === client);
      for (let i = 0; i < clientTrades.length; i++) {
        for (let j = i + 1; j < clientTrades.length; j++) {
          const t1 = clientTrades[i];
          const t2 = clientTrades[j];
          const dayDiff = Math.abs((t2["Date Time"] - t1["Date Time"]) / (1000 * 3600 * 24));
          if (dayDiff > dayWindow) break;

          if (
            t1.Security === t2.Security &&
            t1.Price === t2.Price &&
            t1.Quantity === t2.Quantity &&
            t1.Side !== t2.Side
          ) {
            matches.push({
              Security: t1.Security,
              Date1: t1.Date,
              Date2: t2.Date,
              Client: client,
              Side1: t1.Side,
              Side2: t2.Side,
              Quantity: t1.Quantity,
              Price: t1.Price
            });
          }
        }
      }
    });

    return matches;
  }

  function render() {
    const flagged = detectWashTrading();
    if (flagged === null) {
      box.innerHTML = "<p style='color:orange;'>⚠️ Please upload data in Home first.</p>";
      return;
    }
    if (!flagged.length) {
      box.innerHTML = "<p>✅ Dataset loaded. No wash trading detected with current parameters.</p>";
      return;
    }

    box.innerHTML = `<div><strong>Wash Trading Alerts</strong> (${flagged.length} matches)</div>`;
    box.innerHTML += toHTMLTable(flagged.slice(0, 200));
    createDownloadButton(box, flagged, "wash_trading_report.csv");
  }

  document.getElementById("wash-apply")?.addEventListener("click", render);

  render();
  document.addEventListener("data:updated", render);
  document.addEventListener("data:cleared", render);
}
