// menus/Home/Home.js
import { DataHandler } from "../../core/dataHandler.js";
import { DataManager } from "../../core/dataManager.js";
import { toHTMLTable, createDownloadButton } from "../../core/utils.js";

export function initHome() {
  const fileInput = document.getElementById("file-input");
  const fileNameDisplay = document.getElementById("file-name");
  const summaryBox = document.getElementById("home-summary");

  if (!fileInput) return;

  fileInput.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;

    fileNameDisplay.textContent = file.name;

    try {
      const rows = await DataHandler.loadFile(file);
      if (rows && rows.length) {
        renderSummary(rows);
      }
    } catch (err) {
      alert("Error loading file: " + err.message);
      summaryBox.innerHTML = `<p style="color:red;">❌ Failed to load file</p>`;
    }
  });

  // if dataset already exists (cached), render immediately
  const cached = DataManager.getData();
  if (cached && cached.length) {
    renderSummary(cached);
  }

  function renderSummary(rows) {
    summaryBox.innerHTML = `
      <div><strong>✅ File loaded successfully</strong></div>
      <div>Total Records: ${rows.length}</div>
      <div style="margin-top:12px;">Preview (first 10 rows):</div>
    `;

    const preview = rows.slice(0, 10);
    summaryBox.innerHTML += toHTMLTable(preview);

    createDownloadButton(summaryBox, rows, "dataset.csv");
  }
}
