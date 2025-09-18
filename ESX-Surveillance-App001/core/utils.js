// core/utils.js

// -------- Dates & parsing --------
export function parseDateTime(value) {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value)) return value;

  // If number: Excel serial date (1900-based)
  if (typeof value === "number" && isFinite(value)) {
    // Convert Excel serial days to ms
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }

  // If string: try native parsing
  const dt = new Date(value);
  return isNaN(dt) ? null : dt;
}

export function normalizeColumnName(name) {
  if (!name && name !== 0) return null;
  return name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]+/g, "");
}

// -------- HTML / CSV helpers --------
export function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return text
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function toHTMLTable(data) {
  if (!data || !data.length) return "<p>No data available</p>";
  const headers = Object.keys(data[0]);
  let html = '<table><thead><tr>';
  headers.forEach(h => (html += `<th>${escapeHtml(h)}</th>`));
  html += "</tr></thead><tbody>";
  for (const row of data) {
    html += "<tr>";
    headers.forEach(h => (html += `<td>${escapeHtml(row[h])}</td>`));
    html += "</tr>";
  }
  html += "</tbody></table>";
  return html;
}

export function toCSV(data) {
  if (!data || !data.length) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers
      .map(h => {
        let cell = row[h];
        if (cell === null || cell === undefined) cell = "";
        else cell = String(cell);
        if (cell.includes('"') || cell.includes(",") || cell.includes("\n")) {
          cell = `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      })
      .join(",")
  );
  return headers.join(",") + "\n" + rows.join("\n");
}

export function createDownloadButton(container, data, filename) {
  if (!container) return;
  const old = container.querySelector(".download-btn");
  if (old) old.remove();
  if (!data || !data.length) return;

  const btn = document.createElement("button");
  btn.className = "download-btn";
  btn.textContent = `📥 Download ${filename}`;
  btn.style.marginTop = "12px";
  btn.addEventListener("click", () => {
    const csvStr = toCSV(data);
    const blob = new Blob([csvStr], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
  container.appendChild(btn);
}

// -------- Math & grouping --------
export function groupBy(array, keyFn) {
  const map = new Map();
  for (const item of array || []) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export function sumBy(array, prop) {
  return (array || []).reduce((acc, obj) => acc + (Number(obj?.[prop]) || 0), 0);
}

export function daysBetween(d1, d2) {
  if (!(d1 instanceof Date) || !(d2 instanceof Date)) return NaN;
  const msPerDay = 86400 * 1000;
  return Math.abs((d2 - d1) / msPerDay);
}

export function percentChange(oldVal, newVal) {
  if (!oldVal || oldVal === 0) return null;
  return ((newVal - oldVal) / oldVal) * 100;
}
