// menus/Order Book Manipulation/spoofing.js
import { DataManager } from "../../core/dataManager.js";
import { toHTMLTable, createDownloadButton, groupBy } from "../../core/utils.js";

export function initSpoofing() {
  const box = document.getElementById("spoofing-report");
  if (!box) return;

  function detectSpoofing() {
    const rows = DataManager.getData();
    if (!rows || !rows.length) return null;

    const minCancels = parseInt(document.getElementById("spoof-cancel-min")?.value || "2");
    const maxDuration = parseInt(document.getElementById("spoof-duration")?.value || "45");
    const tradeWindow = parseInt(document.getElementById("spoof-trade-window")?.value || "5");

    const flagged = [];

    // --- Group by client-security ---
    const byClientSec = groupBy(rows, r => `${r.Client}||${r.Security}`);

    for (const [key, trades] of Object.entries(byClientSec)) {
      const [client, sec] = key.split("||");

      // Only consider order events (assume dataset has EventType: 'NEW', 'CANCEL', 'TRADE')
      const newOrders = trades.filter(r => r.EventType === "NEW");
      const cancels = trades.filter(r => r.EventType === "CANCEL");
      const execs = trades.filter(r => r.EventType === "TRADE");

      if (cancels.length < minCancels) continue;

      // Check each cancelled order's lifetime
      for (const c of cancels) {
        const linkedNew = newOrders.find(n => n.OrderID === c.OrderID);
        if (!linkedNew) continue;

        const lifeSec = (c["Date Time"] - linkedNew["Date Time"]) / 1000;
        if (lifeSec <= maxDuration) {
          // Look for opposite-side trade within tradeWindow minutes
          const side = linkedNew.Side; // BUY/SELL
          const cutoff = new Date(c["Date Time"].getTime() + tradeWindow * 60000);

          const oppTrade = execs.find(
            e =>
              e.Side !== side &&
              e["Date Time"] > c["Date Time"] &&
              e["Date Time"] <= cutoff
          );

          if (oppTrade) {
            flagged.push({
              Client: client,
              Security: sec,
              "Spoof OrderID": linkedNew.OrderID,
              "Order Side": side,
              "Order Qty": linkedNew.Quantity,
              "Placed": linkedNew["Date Time"].toISOString(),
              "Cancelled": c["Date Time"].toISOString(),
              "Lifetime (sec)": lifeSec.toFixed(1),
              "Follow-up Trade": `${oppTrade.Side} ${oppTrade.Quantity} @ ${oppTrade.Price} on ${oppTrade["Date Time"].toISOString()}`,
              Rule: "Spoofing"
            });
          }
        }
      }
    }

    return flagged;
  }

  function render() {
    const flagged = detectSpoofing();
    if (flagged === null) {
      box.innerHTML = "<p style='color:orange;'>⚠️ Please upload data in Home first.</p>";
      return;
    }
    if (!flagged.length) {
      box.innerHTML = "<p>✅ Dataset loaded. No spoofing detected with current parameters.</p>";
      return;
    }

    box.innerHTML = `<div><strong>Spoofing Alerts</strong> (${flagged.length} records)</div>`;
    box.innerHTML += toHTMLTable(flagged.slice(0, 200));
    createDownloadButton(box, flagged, "spoofing_report.csv");
  }

  document.getElementById("spoof-apply")?.addEventListener("click", render);

  render();
  document.addEventListener("data:updated", render);
  document.addEventListener("data:cleared", render);
}
