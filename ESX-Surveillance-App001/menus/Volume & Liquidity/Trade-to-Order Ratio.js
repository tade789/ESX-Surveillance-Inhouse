// --- Trade-to-Order Ratio (T/O Ratio) with Flag Filter ---
import { DataManager } from "../../core/dataManager.js";
import { toHTMLTable, createDownloadButton } from "../../core/utils.js";

export function initTradeToOrder() {
  const container = document.getElementById("trade-to-order");
  if (!container) return;

  const resultsBox = container.querySelector(".results-box");
  const fromInput = container.querySelector("#to-from");
  const toInput = container.querySelector("#to-to");
  const flagInputs = container.querySelectorAll("input.flag-checkbox");

  function detect(fromDate, toDate) {
    const data = DataManager.getData();
    if (!data || !data.length) return null;

    const filtered = data.filter(trade => {
      const tDate = new Date(trade.Date);
      return (!fromDate || tDate >= fromDate) && (!toDate || tDate <= toDate);
    });

    const secMap = new Map();

    filtered.forEach(trade => {
      const sec = trade.Security;
      const qty = parseFloat(trade.Quantity) || 0;
      const orders = parseFloat(trade.Orders) || 1;
      if (!secMap.has(sec)) secMap.set(sec, { totalTrades: 0, totalOrders: 0 });
      const entry = secMap.get(sec);
      entry.totalTrades += qty;
      entry.totalOrders += orders;
    });

    const results = [];

    secMap.forEach((entry, sec) => {
      const ratio = entry.totalOrders ? (entry.totalTrades / entry.totalOrders) * 100 : 0;
      let flag = "Medium";
      if (ratio < 20) flag = "Low";
      else if (ratio > 80) flag = "High";

      results.push({
        Security: sec,
        TotalTrades: entry.totalTrades,
        TotalOrders: entry.totalOrders,
        TO_Ratio: ratio.toFixed(2) + "%",
        Flag: flag
      });
    });

    return results;
  }

  function render() {
    const data = DataManager.getData();
    if (!data || !data.length) {
      resultsBox.innerHTML = "<p>Please upload data in <em>Home</em> first to run this report.</p>";
      return;
    }

    const fromDate = fromInput.value ? new Date(fromInput.value) : null;
    const toDate = toInput.value ? new Date(toInput.value) : null;

    let flagged = detect(fromDate, toDate);

    // Apply flag filter
    const selectedFlags = Array.from(flagInputs)
      .filter(input => input.checked)
      .map(input => input.value);

    if (selectedFlags.length > 0) {
      flagged = flagged.filter(item => selectedFlags.includes(item.Flag));
    }

    if (!flagged || flagged.length === 0) {
      resultsBox.innerHTML = "<p>✅ No matching T/O Ratios detected under current filters.</p>";
      return;
    }

    resultsBox.innerHTML = toHTMLTable(flagged);
    createDownloadButton(resultsBox, flagged, "trade_to_order_ratio_report.csv");
  }

  container.querySelectorAll("input").forEach(input => {
    input.addEventListener("change", render);
  });

  render();
  document.addEventListener("data:updated", render);
  document.addEventListener("data:cleared", render);
}
