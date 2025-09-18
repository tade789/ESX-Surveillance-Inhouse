// menus/Insider Trading/insider.js
import { DataManager } from "../../core/dataManager.js";
import { toHTMLTable, createDownloadButton } from "../../core/utils.js";

export function initInsider() {
  const reportBox = document.getElementById("insider-report");
  if (!reportBox) return;

  // --- Known Insider Accounts ---
  const directorsAccounts = new Set(["ET33BINITAA00011", "ET87CBECETA00002"]);
  const shareholdersAccounts = new Set(["ET10CBECETA01001", "ET87CBECETA00000"]);
  const boardAccounts = new Set(["ET10CBECETA01000", "ET55BINITAA00003"]);
  const proprietaryAccounts = new Set(["ET98BINITAA00005"]);

  function getFilteredData() {
    const rows = DataManager.getData();
    if (!rows || !rows.length) return null; // null → dataset not loaded

    const insiders = [];
    for (const r of rows) {
      let watchType = null;
      if (directorsAccounts.has(r.Client)) watchType = "Director";
      else if (shareholdersAccounts.has(r.Client)) watchType = "≥5% Shareholder";
      else if (boardAccounts.has(r.Client)) watchType = "Board Member";
      else if (proprietaryAccounts.has(r.Client)) watchType = "Proprietary Account";

      if (watchType) insiders.push({ ...r, "Watch Type": watchType });
    }

    // Filters
    const checkedTypes = Array.from(document.querySelectorAll(".watch-filter:checked")).map(cb => cb.value);
    const fromDate = document.getElementById("date-from")?.value;
    const toDate = document.getElementById("date-to")?.value;

    return insiders.filter(r => {
      if (!checkedTypes.includes(r["Watch Type"])) return false;
      if (fromDate && r.Date < fromDate) return false;
      if (toDate && r.Date > toDate) return false;
      return true;
    });
  }

  function render() {
    const filtered = getFilteredData();

    if (filtered === null) {
      reportBox.innerHTML = "<p style='color:orange;'>⚠️ Please upload data in Home first.</p>";
      return;
    }
    if (!filtered.length) {
      reportBox.innerHTML = "<p>✅ Dataset loaded, but no insider trades match filters or known accounts.</p>";
      return;
    }

    reportBox.innerHTML = `<div><strong>Insider Trading Report</strong> (${filtered.length} records)</div>`;
    reportBox.innerHTML += toHTMLTable(filtered.slice(0, 50));

    createDownloadButton(reportBox, filtered, "insider_trading_filtered.csv");
  }

  document.getElementById("apply-filters")?.addEventListener("click", render);
  render();

  document.addEventListener("data:updated", render);
  document.addEventListener("data:cleared", render);
}
