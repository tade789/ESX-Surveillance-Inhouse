// --- Trading in Illiquid Securities ---
import { DataManager } from "../../core/dataManager.js";
import { toHTMLTable, createDownloadButton } from "../../core/utils.js";

export function initIlliquidTrading() {
  const container = document.getElementById("illiquid-trading");
  if (!container) return;

  const resultsBox = container.querySelector(".results-box");

  function detect() {
    const data = DataManager.getData();
    if (!data || !data.length) return null;

    const secMap = new Map(); // key = Security, value = array of trades

    // 1. Group trades by Security
    data.forEach(trade => {
      const sec = trade.Security;
      const date = new Date(trade.Date);
      const price = parseFloat(trade.Price);
      if (!secMap.has(sec)) secMap.set(sec, []);
      secMap.get(sec).push({ ...trade, DateObj: date, PriceNum: price });
    });

    const flagged = [];

    secMap.forEach((trades, sec) => {
      // Sort trades by date
      trades.sort((a, b) => a.DateObj - b.DateObj);

      // Check if fewer than 5 trades in last 30 days
      const latestDate = trades[trades.length - 1].DateObj;
      const cutoff = new Date(latestDate);
      cutoff.setDate(cutoff.getDate() - 30);
      const recentTrades = trades.filter(t => t.DateObj >= cutoff);

      if (recentTrades.length < 5) {
        // Compute price movement in the last 30 days
        const prices = recentTrades.map(t => t.PriceNum);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const changePct = ((maxPrice - minPrice) / minPrice) * 100;

        if (changePct > 5) { // you can adjust threshold to 10 if needed
          flagged.push({
            Security: sec,
            TradesLast30Days: recentTrades.length,
            MinPrice: minPrice,
            MaxPrice: maxPrice,
            PriceChangePct: changePct.toFixed(2) + "%",
          });
        }
      }
    });

    return flagged;
  }

  function render() {
    const data = DataManager.getData();
    if (!data || !data.length) {
      resultsBox.innerHTML = "<p>Please upload data in <em>Home</em> first to run this report.</p>";
      return;
    }

    const flagged = detect();
    if (!flagged || flagged.length === 0) {
      resultsBox.innerHTML = "<p>✅ No illiquid securities detected under current rules.</p>";
      return;
    }

    resultsBox.innerHTML = toHTMLTable(flagged);
    createDownloadButton(resultsBox, flagged, "illiquid_trading_report.csv");
  }

  render();
  document.addEventListener("data:updated", render);
  document.addEventListener("data:cleared", render);
}
