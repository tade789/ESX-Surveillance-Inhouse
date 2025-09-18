// core/dataHandler.js
import { DataManager } from "./dataManager.js";
import { parseDateTime, normalizeColumnName } from "./utils.js";

// Ensure PapaParse & XLSX are available globally (loaded in index.html)
const hasPapa = () => typeof Papa !== "undefined" && Papa?.parse;
const hasXLSX = () => typeof XLSX !== "undefined" && XLSX?.read;

export const DataHandler = {
  /**
   * Load a file (CSV/XLSX/XLS), normalize and cache.
   * Returns processed rows.
   */
  async loadFile(file) {
    if (!file) throw new Error("No file selected.");
    const ext = file.name.split(".").pop().toLowerCase();

    let raw = [];
    if (ext === "csv") {
      if (!hasPapa()) throw new Error("PapaParse not found.");
      raw = await this.parseCSV(file);
    } else if (ext === "xlsx" || ext === "xls") {
      if (!hasXLSX()) throw new Error("SheetJS (XLSX) not found.");
      raw = await this.parseExcel(file);
    } else {
      throw new Error("Unsupported file type. Please upload .csv, .xlsx, or .xls");
    }

    const processed = this.preprocessData(raw);
    if (!processed || !processed.length) {
      throw new Error("No valid records after preprocessing.");
    }

    DataManager.setData(processed);
    return processed;
  },

  // ---------- CSV parser ----------
  parseCSV(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: "greedy",
        complete: results => resolve(results.data || []),
        error: err => reject(err)
      });
    });
  },

  // ---------- Excel parser ----------
  parseExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read Excel file."));
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: "binary" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws, { defval: "" }); // keep empty cells
          resolve(data || []);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsBinaryString(file);
    });
  },

  // ---------- Normalization ----------
  preprocessData(rawData) {
    if (!rawData || !rawData.length) return [];

    // Build normalized->raw map
    const rawKeys = Object.keys(rawData[0] || {});
    const keyMap = {};
    for (const rk of rawKeys) {
      keyMap[normalizeColumnName(rk)] = rk;
    }

    // Strictly required columns (normalized form)
    const required = [
      "client",
      "price",
      "volume",
      "buy/sell",
      "execution date/time",
      "symbol"
    ];

    const missing = required.filter(k => !(k in keyMap));
    if (missing.length) {
      alert(`Missing required columns: ${missing.join(", ")}`);
      return [];
    }

    // Optional columns
    const opt = {
      username: keyMap["username"],
      order_quantity: keyMap["order quantity"],
      prev_close: keyMap["prev close"]
    };

    // Row-wise normalization
    const out = [];
    for (const row of rawData) {
      try {
        const client = String(row[keyMap["client"]] ?? "").trim();
        const price = parseFloat(row[keyMap["price"]]);
        const qty = parseFloat(row[keyMap["volume"]]);
        const side = String(row[keyMap["buy/sell"]] ?? "").trim().toLowerCase();
        const dt = parseDateTime(row[keyMap["execution date/time"]]);
        const security = String(row[keyMap["symbol"]] ?? "").trim();

        if (!client || !security || !dt || isNaN(price) || isNaN(qty) || !side) continue;

        out.push({
          Client: client,
          Price: +price || 0,
          Quantity: +qty || 0,
          Side: side,
          "Date Time": dt,
          Date: dt ? dt.toISOString().slice(0, 10) : null,
          Security: security,
          Username: opt.username ? String(row[opt.username] ?? "").trim() : "",
          "Order Quantity": opt.order_quantity ? +row[opt.order_quantity] || 0 : null,
          "Prev Close": opt.prev_close ? +row[opt.prev_close] || 0 : null
        });
      } catch {
        // skip malformed row
      }
    }

    return out;
  }
};
