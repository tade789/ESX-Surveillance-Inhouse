// menus/Trade based Manipulation/churning.js
import { DataManager } from "../../core/dataManager.js";
import { toHTMLTable, createDownloadButton, groupBy, sumBy } from "../../core/utils.js";

export function initChurning() {
  const box = document.getElementById("churning-report");
  if (!box) return;

  function detectChurning() {
    const rows = DataManager.getData();
    if (!rows || !rows.length) return null;

    const months = parseInt(document.getElementById("churning-months")?.value || "6");
    const ratioThreshold = parseFloat(document.getElementById("churning-threshold")?.value || "2.0");

    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());

    const filtered = rows.filter(r => r["Date Time"] >= cutoff);

    const grouped = groupBy(filtered, r => r.Client);
    const turnoverList = [];
    for (let [client, trades] of grouped.entries()) {
      turnoverList.push({ Client: client, Quantity: sumBy(trades, "Quantity") });
    }

    const meanQty =
      turnoverList.reduce((acc, v) => acc + v.Quantity, 0) / (turnoverList.length || 1);

    const churned = turnoverList
      .filter(c => meanQty > 0 && c.Quantity / meanQty > ratioThreshold)
      .map(c => ({
        Client: c.Client,
        Quantity: c.Quantity,
        "Turnover Ratio": (c.Quantity / meanQty).toFixed(2)
      }));

    return churned;
  }

  function render() {
    const flagged = detectChurning();
    if (flagged === null) {
      box.innerHTML = "<p style='color:orange;'>⚠️ Please upload data in Home first.</p>";
      return;
    }
    if (!flagged.length) {
      box.innerHTML =
        "<p>✅ Dataset loaded. No churning detected under current parameters.</p>";
      return;
    }

    box.innerHTML = `<div><strong>Churning Alerts</strong> (${flagged.length} clients flagged)</div>`;
    box.innerHTML += toHTMLTable(flagged.slice(0, 200));
    createDownloadButton(box, flagged, "churning_report.csv");
  }

  document.getElementById("churning-apply")?.addEventListener("click", render);

  render();
  document.addEventListener("data:updated", render);
  document.addEventListener("data:cleared", render);
}
