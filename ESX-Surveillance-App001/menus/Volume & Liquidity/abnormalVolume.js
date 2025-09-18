// --- Abnormal Trading Volume ---
import { DataManager } from "../../core/dataManager.js";
import { toHTMLTable, createDownloadButton } from "../../core/utils.js";

export function initAbnormalVolume() {
  const container = document.getElementById("abnormal-volume");
  if (!container) return;

  const resultsBox = container.querySelector(".results-box");

  function detect() {
    const data = DataManager.getData();
    if (!data || !data.length) return null;

    // 1. Aggregate daily volumes by Security + Date + Client
    const clientDailyMap = new Map(); // key = "Security||Date||Client"
    const marketDailyMap = new Map(); // key = "Security||Date"

    data.forEach(trade => {
      const dateStr = trade.Date;
      const sec = trade.Security;
      const cli = trade.Client;
      const qty = trade.Quantity;

      const mKey = `${sec}||${dateStr}`;
      marketDailyMap.set(mKey, (marketDailyMap.get(mKey) || 0) + qty);

      const cKey = `${sec}||${dateStr}||${cli}`;
      clientDailyMap.set(cKey, (clientDailyMap.get(cKey) || 0) + qty);
    });

    // 2. Organize by Security+Client for rolling ADV
    const secClientMap = new Map();
    clientDailyMap.forEach((vol, key) => {
      const [sec, dateStr, cli] = key.split("||");
      const date = new Date(dateStr);
      const scKey = `${sec}||${cli}`;
      if (!secClientMap.has(scKey)) secClientMap.set(scKey, []);
      secClientMap.get(scKey).push({ Date: date, DateStr: dateStr, Volume: vol });
    });

    const flagged = [];

    // 3. Compute rolling ADV (10 days, excluding current day)
    secClientMap.forEach((entries, scKey) => {
      entries.sort((a, b) => a.Date - b.Date);
      const [sec, cli] = scKey.split("||");

      for (let i = 0; i < entries.length; i++) {
        const curr = entries[i];
        const startIdx = Math.max(0, i - 10);
        const window = entries.slice(startIdx, i);
        if (window.length === 0) continue;

        const adv = window.reduce((s, e) => s + e.Volume, 0) / window.length;

        const clientVol = curr.Volume;
        const marketVol = marketDailyMap.get(`${sec}||${curr.DateStr}`) || 0;
        const marketShare = marketVol ? (clientVol / marketVol) * 100 : 0;

        if (clientVol >= 5 * adv && marketShare >= 20) {
          flagged.push({
            Security: sec,
            Date: curr.DateStr,
            Client: cli,
            ClientVolume: clientVol,
            ADV_10day: adv.toFixed(2),
            Ratio_vs_ADV: (clientVol / adv).toFixed(2) + "x",
            MarketVolume: marketVol,
            MarketSharePct: marketShare.toFixed(2) + "%",
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
      resultsBox.innerHTML = "<p>✅ No abnormal client trading volumes detected under current rules.</p>";
      return;
    }

    resultsBox.innerHTML = toHTMLTable(flagged);
    createDownloadButton(resultsBox, flagged, "abnormal_volume_report.csv");
  }

  render();
  document.addEventListener("data:updated", render);
  document.addEventListener("data:cleared", render);
}
