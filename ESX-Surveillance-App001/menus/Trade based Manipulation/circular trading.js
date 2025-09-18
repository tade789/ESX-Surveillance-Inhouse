// menus/Trade based Manipulation/circular-trading.js
import { DataManager } from "../../core/dataManager.js";
import { toHTMLTable, createDownloadButton, groupBy } from "../../core/utils.js";

export function initCircularTrading() {
  const box = document.getElementById("circular-trading-report");
  if (!box) return;

  const fromInput = document.getElementById("circular-from");
  const toInput = document.getElementById("circular-to");
  const daysInput = document.getElementById("circular-days");
  const entitiesInput = document.getElementById("circular-entities");
  const volInput = document.getElementById("circular-volume");
  const minutesInput = document.getElementById("circular-minutes");
  const netPctInput = document.getElementById("circular-netpct");
  const severitySel = document.getElementById("circular-severity");
  const applyBtn = document.getElementById("circular-apply");
  const resetBtn = document.getElementById("circular-reset");

  function params() {
    return {
      fromDate: fromInput.value ? new Date(fromInput.value) : null,
      toDate: toInput.value ? new Date(toInput.value) : null,
      circleDays: parseInt(daysInput.value) || 1,
      maxEntities: parseInt(entitiesInput.value) || 4,
      minVolume: parseInt(volInput.value) || 8000,
      timeWindowMin: parseInt(minutesInput.value) || 15,
      netChangePct: parseFloat(netPctInput.value) || 5,
      severity: severitySel.value || "CRITICAL",
    };
  }

  function withinDays(d1, d2, days) {
    const ms = Math.abs(d2 - d1);
    return ms <= days * 24 * 3600 * 1000;
  }

  function timeDiffMinutes(d1, d2) {
    return Math.abs(d2 - d1) / 60000;
  }

  // Build directed edges from Seller -> Buyer for pairs that satisfy time and net change thresholds.
  function buildEdges(trades, p) {
    const edges = []; // {security, date, seller, buyer, qtySell, qtyBuy, volume, netPct, tSell, tBuy, diffMin}
    const buys = trades.filter(r => r.Side?.toLowerCase() === "buy");
    const sells = trades.filter(r => r.Side?.toLowerCase() === "sell");

    for (const s of sells) {
      for (const b of buys) {
        if (s.Security !== b.Security) continue;

        // date window (same day or up to circleDays window)
        if (!withinDays(s["Date Time"], b["Date Time"], p.circleDays)) continue;

        // optional From/To range already applied upstream
        const diffMin = timeDiffMinutes(s["Date Time"], b["Date Time"]);
        if (diffMin > p.timeWindowMin) continue;

        const denom = s.Quantity + b.Quantity;
        const netPct = denom === 0 ? 100 : Math.abs((s.Quantity - b.Quantity) / denom * 100);
        if (netPct > p.netChangePct) continue;

        const volume = Math.min(s.Quantity, b.Quantity);
        edges.push({
          security: s.Security,
          date: s.Date, // keep starting day marker (we also export times)
          seller: s.Client,
          buyer: b.Client,
          qtySell: s.Quantity,
          qtyBuy: b.Quantity,
          volume,
          netPct,
          tSell: s["Date Time"],
          tBuy: b["Date Time"],
          diffMin,
        });
      }
    }
    return edges;
  }

  // Find cycles up to maxEntities per security using DFS on directed graph from edges.
  function findCycles(edges, p) {
    // graph: security => { adj: Map<client, Set<client>>, edgesByPair: Map<seller||buyer, [edge,...]> }
    const edgesBySec = new Map();
    for (const e of edges) {
      if (!edgesBySec.has(e.security)) {
        edgesBySec.set(e.security, { adj: new Map(), edgesByPair: new Map() });
      }
      const g = edgesBySec.get(e.security);
      if (!g.adj.has(e.seller)) g.adj.set(e.seller, new Set());
      g.adj.get(e.seller).add(e.buyer);
      const key = `${e.seller}||${e.buyer}`;
      if (!g.edgesByPair.has(key)) g.edgesByPair.set(key, []);
      g.edgesByPair.get(key).push(e);
    }

    const cycles = []; // {security, clients:[...], startTime, endTime, minEdgeVolume, totalMinEdgeVolume, edgesUsed:[edge,...]}
    const seenCanonical = new Set();

    function canonicalPath(nodes) {
      // rotate so smallest string is first, and ensure direction canonical by choosing lexicographically minimal rotation
      const n = nodes.length;
      let best = null;
      for (let i = 0; i < n; i++) {
        const rotated = nodes.slice(i).concat(nodes.slice(0, i));
        const key = rotated.join("->");
        if (best === null || key < best) best = key;
      }
      return best;
    }

    for (const [security, g] of edgesBySec.entries()) {
      const adj = g.adj;

      const dfs = (start, node, path, visited, depthLimit) => {
        if (path.length > depthLimit) return;
        const nexts = adj.get(node) || new Set();
        for (const nb of nexts) {
          if (nb === start && path.length >= 2) {
            // found a cycle: path ... -> node -> start
            const cycleNodes = path.concat([start]); // unique nodes with closure
            if (cycleNodes.length - 1 > p.maxEntities) continue; // entities cap

            // grab edges along the cycle (choose earliest matching edges that keep window tight)
            let edgesUsed = [];
            let tMin = null, tMax = null;
            let minEdgeVolume = Infinity;

            for (let i = 0; i < cycleNodes.length - 1; i++) {
              const a = cycleNodes[i];
              const b = cycleNodes[i + 1];
              const list = g.edgesByPair.get(`${a}||${b}`) || [];
              if (!list.length) { edgesUsed = []; break; }
              // choose the earliest by time to maintain compact window; could be improved with DP
              const chosen = list.reduce((best, cur) => (!best || cur.tSell < best.tSell ? cur : best), null);
              if (!chosen) { edgesUsed = []; break; }
              edgesUsed.push(chosen);
              const cTimes = [chosen.tSell, chosen.tBuy];
              const cMin = new Date(Math.min(...cTimes));
              const cMax = new Date(Math.max(...cTimes));
              tMin = tMin ? new Date(Math.min(tMin, cMin)) : cMin;
              tMax = tMax ? new Date(Math.max(tMax, cMax)) : cMax;
              if (chosen.volume < minEdgeVolume) minEdgeVolume = chosen.volume;
            }
            if (!edgesUsed.length) continue;

            // circleDays & From/To window already respected by buildEdges; still ensure cycle compactness:
            if (!withinDays(tMin, tMax, p.circleDays)) continue;

            const clients = cycleNodes.slice(0, -1); // last repeats start
            const canon = `${security}|${canonicalPath(clients)}`;
            if (seenCanonical.has(canon)) continue;
            seenCanonical.add(canon);

            cycles.push({
              security,
              clients,
              startTime: tMin,
              endTime: tMax,
              minEdgeVolume: Number.isFinite(minEdgeVolume) ? minEdgeVolume : 0,
              totalMinEdgeVolume: edgesUsed.reduce((s, e) => s + e.volume, 0),
              edgesUsed
            });
            continue;
          }
          if (visited.has(nb)) continue;
          visited.add(nb);
          dfs(start, nb, path.concat([nb]), visited, p.maxEntities);
          visited.delete(nb);
        }
      };

      for (const start of adj.keys()) {
        const visited = new Set([start]);
        dfs(start, start, [start], visited, p.maxEntities);
      }
    }

    // enforce Min Volume (by total min edges) & entities <= max
    return cycles.filter(c =>
      c.clients.length <= p.maxEntities && c.totalMinEdgeVolume >= p.minVolume
    );
  }

  function detect() {
    const rows = DataManager.getData();
    if (!rows || !rows.length) return null;
    const p = params();

    // date range filter
    let filtered = rows;
    if (p.fromDate) filtered = filtered.filter(r => r["Date Time"] >= p.fromDate);
    if (p.toDate)   filtered = filtered.filter(r => r["Date Time"] <= p.toDate);

    // group by security (keep all dates; circleDays will constrain at edge/cycle level)
    const secGroups = groupBy(filtered, r => r.Security);

    const allEdges = [];
    for (const [sec, trades] of secGroups.entries()) {
      // Build qualified directed edges Seller->Buyer
      const edges = buildEdges(trades, p);
      allEdges.push(...edges);
    }

    // Cycle detection (multi-entity)
    const cycles = findCycles(allEdges, p);

    // Summary rows
    const summary = cycles.map(c => ({
      Security: c.security,
      Entities: c.clients.length,
      Clients: c.clients.join(" → "),
      "Window Start": c.startTime.toISOString(),
      "Window End": c.endTime.toISOString(),
      "Cycle Edges": c.edgesUsed.length,
      "Min Edge Volume": c.minEdgeVolume,
      "Total Circulated Volume": c.totalMinEdgeVolume,
      Severity: p.severity
    }));

    // Detail rows (pair matches that contributed to cycles)
    const details = [];
    cycles.forEach(c => {
      c.edgesUsed.forEach(e => {
        details.push({
          Security: c.security,
          Date: e.date,
          BuyerClient: e.buyer,
          SellerClient: e.seller,
          BuyerQty: e.qtyBuy,
          SellerQty: e.qtySell,
          VolumeCounted: e.volume,
          NetPositionChangePct: e.netPct.toFixed(2),
          TimeDiffMinutes: e.diffMin.toFixed(2),
          BuyerTime: e.tBuy.toISOString(),
          SellerTime: e.tSell.toISOString()
        });
      });
    });

    return { summary, details };
  }

  function render() {
    const res = detect();
    if (!res) {
      box.innerHTML = "<p style='color:orange;'>⚠️ Please upload data in Home first.</p>";
      return;
    }

    const { summary, details } = res;

    if ((!summary || !summary.length) && (!details || !details.length)) {
      box.innerHTML = "<p>✅ Dataset loaded. No circular trading detected under current filters.</p>";
      return;
    }

    let html = "";
    if (summary && summary.length) {
      html += "<h4>Summary – Circular Trading Cycles</h4>";
      html += toHTMLTable(summary);
    }
    if (details && details.length) {
      html += "<hr/><h4>Details – Qualified Seller→Buyer Pairs</h4>";
      html += toHTMLTable(details);
    }
    box.innerHTML = html;

    // Attach downloads AFTER injecting HTML so buttons go inside the box
    if (summary && summary.length) {
      createDownloadButton(box, summary, "circular_trading_summary.csv");
    }
    if (details && details.length) {
      createDownloadButton(box, details, "circular_trading_details.csv");
    }
  }

  function reset() {
    fromInput.value = "";
    toInput.value = "";
    daysInput.value = "1";
    entitiesInput.value = "4";
    volInput.value = "8000";
    minutesInput.value = "15";
    netPctInput.value = "5";
    severitySel.value = "CRITICAL";
    render();
  }

  applyBtn?.addEventListener("click", render);
  resetBtn?.addEventListener("click", reset);

  render();
  document.addEventListener("data:updated", render);
  document.addEventListener("data:cleared", render);
}
