// menus/Price Manipulation/cornering.js
import { DataManager } from "../../core/dataManager.js";
import { toHTMLTable, createDownloadButton } from "../../core/utils.js";

export function initCornering() {
  const box = document.getElementById("cornering-report");
  if (!box) return;

  function detectCornering() {
    const rows = DataManager.getData();
    if (!rows || !rows.length) return null;

    const threshold = parseFloat(document.getElementById("cornering-threshold")?.value || "5");

    // --- Step 1: Aggregate total volume per security-date ---
    const totalVolumeMap = new Map(); // key = sec||date -> totalVol
    const clientVolumes = new Map(); // key = sec||date||client -> clientVol

    for (const r of rows) {
      if (!r.Security || !r.Date || !r.Quantity) continue;
      const key = `${r.Security}||${r.Date}`;
      totalVolumeMap.set(key, (totalVolumeMap.get(key) || 0) + r.Quantity);
      const clientKey = `${key}||${r.Client}`;
      clientVolumes.set(clientKey, (clientVolumes.get(clientKey) || 0) + r.Quantity);
    }

    // --- Step 2: Check client dominance ---
    const flagged = [];
    for (const [clientKey, clientVol] of clientVolumes.entries()) {
      const [sec, date, client] = clientKey.split("||");
      const totalVol = totalVolumeMap.get(`${sec}||${date}`) || 0;
      const sharePct = totalVol > 0 ? (100 * clientVol / totalVol) : 0;

      if (sharePct >= threshold) {
        flagged.push({
          Security: sec,
          Date: date,
          Client: client,
          "Client Share %": sharePct.toFixed(2),
          "Client Volume": clientVol,
          "Total Volume": totalVol
        });
      }
    }

    return flagged;
  }

  function render() {
    const flagged = detectCornering();
    if (flagged === null) {
      box.innerHTML = "<p style='color:orange;'>⚠️ Please upload data in Home first.</p>";
      return;
    }
    if (!flagged.length) {
      box.innerHTML = "<p>✅ Dataset loaded. No cornering detected with current threshold.</p>";
      return;
    }

    box.innerHTML = `<div><strong>Cornering Report</strong> (${flagged.length} records)</div>`;
    box.innerHTML += toHTMLTable(flagged.slice(0, 200));
    createDownloadButton(box, flagged, "cornering_report.csv");
  }

  document.getElementById("cornering-apply")?.addEventListener("click", render);

  render();
  document.addEventListener("data:updated", render);
  document.addEventListener("data:cleared", render);
}
