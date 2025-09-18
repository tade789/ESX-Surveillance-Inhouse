// core/dataManager.js
// Centralized, in-memory dataset cache shared across modules

export const DataManager = (() => {
  let rows = [];

  function setData(newRows) {
    rows = Array.isArray(newRows) ? newRows : [];
    // Notify listeners (menus) that data changed
    document.dispatchEvent(new CustomEvent("data:updated", { detail: { count: rows.length } }));
  }

  function getData() {
    return rows;
  }

  function clearData() {
    rows = [];
    document.dispatchEvent(new Event("data:cleared"));
  }

  // Expose also on window for quick debugging or legacy code expectations
  if (!window.DataStore) window.DataStore = {};
  Object.defineProperty(window.DataStore, "rows", {
    get: () => rows,
    set: v => setData(v),
    configurable: true
  });

  return { setData, getData, clearData };
})();
