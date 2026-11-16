/* =====================================================================
   Métodos de balanceo adicionales (Hoffman, Moodie & Young, clásico)
   Trabajan sobre la misma estructura P de Core.prepare y no modifican
   ninguna función de core.js.
   ===================================================================== */
const Extra = (() => {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const EPS = 1e-9;
  const load = (P, st) => st.reduce((s, i) => s + P.time[i], 0);
  const smooth = (P, sts) => { const L = sts.map(s => load(P, s)), mx = Math.max(...L); return Math.sqrt(L.reduce((a, l) => a + (mx - l) ** 2, 0)); };

  /** Método clásico: se abre una estación y se llena con las tareas disponibles
   *  en el orden de su numeración (la primera disponible que quepa). */
  function clasico(P, C) {
    const t0 = now();
    const done = new Array(P.n).fill(false);
    const stations = []; let cur = [], curT = 0, left = P.n;
    while (left) {
      let pick = -1;
      for (let i = 0; i < P.n; i++) {
        if (done[i] || !P.preds[i].every(p => done[p]) || P.time[i] > C - curT + EPS) continue;
        if (pick < 0 || P.row[i] < P.row[pick]) pick = i;
      }
      if (pick < 0) { stations.push(cur); cur = []; curT = 0; continue; }
      cur.push(pick); done[pick] = true; curT += P.time[pick]; left--;
    }
    if (cur.length) stations.push(cur);
    return { stations, ms: now() - t0 };
  }

  /** Método de Hoffman: para cada estación se enumeran todas las combinaciones
   *  factibles de tareas (respetando precedencias y el ciclo C) y se elige la de
   *  mayor carga, es decir, la de menor tiempo ocioso. */
  function hoffman(P, C, { nodeLimit = 300000 } = {}) {
    const t0 = now();
    const done = new Array(P.n).fill(false);
    const stations = []; let left = P.n, truncated = false;
    while (left) {
      let best = [], bestT = -1, nodes = 0;
      const inSt = new Array(P.n).fill(false), cur = [];
      const seen = new Set();
      const dfs = (curT) => {
        if (++nodes > nodeLimit) { truncated = true; return true; }
        if (curT > bestT + EPS || (Math.abs(curT - bestT) < EPS && cur.length < best.length)) { best = cur.slice(); bestT = curT; }
        if (bestT >= C - EPS) return true;                      // estación llena: no hay nada mejor
        for (let i = 0; i < P.n; i++) {
          if (done[i] || inSt[i] || P.time[i] > C - curT + EPS) continue;
          if (!P.preds[i].every(p => done[p] || inSt[p])) continue;
          inSt[i] = true; cur.push(i);
          const key = cur.slice().sort((a, b) => a - b).join(',');
          let stop = false;
          if (!seen.has(key)) { seen.add(key); stop = dfs(curT + P.time[i]); }
          cur.pop(); inSt[i] = false;
          if (stop) return true;
        }
        return false;
      };
      dfs(0);
      if (!best.length) throw new Error('Hoffman: hay una tarea más larga que el tiempo de ciclo.');
      best.sort((a, b) => a - b).forEach(i => { done[i] = true; left--; });
      stations.push(best);
    }
    return { stations, ms: now() - t0, truncated };
  }

  /** Moodie & Young.
   *  Fase 1: regla del tiempo de operación más largo (la misma heurística LCR de la app).
   *  Fase 2: transferencias e intercambios de tareas desde la estación más cargada
   *  (Gmáx) hacia la menos cargada (Gmín) cuando la diferencia de tiempos es menor que
   *  2·META, con META = (Gmáx − Gmín)/2, respetando precedencias y el ciclo C.
   *  Si Gmáx y Gmín no admiten movimiento, se prueba con la siguiente pareja más cargada → menos cargada.
   *  Solo se acepta un movimiento si baja el índice de suavidad; la fase 2 no cambia el número de estaciones. */
  function moodieYoung(P, C, phase1) {
    const t0 = now();
    const sts = phase1.map(s => s.slice());
    const where = new Array(P.n);
    const sync = () => sts.forEach((s, k) => s.forEach(i => { where[i] = k; }));
    const okTask = x => P.preds[x].every(p => where[p] <= where[x]) && P.succ[x].every(q => where[x] <= where[q]);
    sync();
    const si1 = smooth(P, sts); let moves = 0;
    for (let guard = 0; guard < 500; guard++) {
      const L = sts.map(s => load(P, s));
      const order = L.map((l, k) => k).sort((a, b) => L[b] - L[a] || a - b);
      // parejas (más cargada → menos cargada): primero Gmáx–Gmín; si no hay movimiento, las siguientes
      const pairs = [];
      for (let x = 0; x < order.length; x++) for (let y = order.length - 1; y > x; y--) if (L[order[x]] > L[order[y]] + EPS) pairs.push([order[x], order[y]]);
      const cur = smooth(P, sts);
      let bestMove = null, bestSI = cur - 1e-7;
      for (const [a, b] of pairs) {
        const goal = (L[a] - L[b]) / 2;
        if (goal <= EPS) continue;
        // transferencias de una tarea
        for (const i of sts[a]) {
          if (P.time[i] >= 2 * goal - EPS || L[b] + P.time[i] > C + EPS) continue;
          where[i] = b;
          if (okTask(i)) { const t = sts.map(s => s.slice()); t[a] = t[a].filter(x => x !== i); t[b].push(i); const v = smooth(P, t); if (v < bestSI) { bestSI = v; bestMove = { type: 'T', i, a, b }; } }
          where[i] = a;
        }
        // intercambios de una tarea por otra
        for (const i of sts[a]) for (const j of sts[b]) {
          const d = P.time[i] - P.time[j];
          if (d <= EPS || d >= 2 * goal - EPS || L[b] + d > C + EPS) continue;
          where[i] = b; where[j] = a;
          if (okTask(i) && okTask(j)) { const t = sts.map(s => s.slice()); t[a] = t[a].filter(x => x !== i).concat(j); t[b] = t[b].filter(x => x !== j).concat(i); const v = smooth(P, t); if (v < bestSI) { bestSI = v; bestMove = { type: 'I', i, j, a, b }; } }
          where[i] = a; where[j] = b;
        }
        if (bestMove) break;                                    // se usa la pareja Gmáx–Gmín si tiene movimiento
      }
      if (!bestMove) break;
      const { i, j, a: A, b: B } = bestMove;
      sts[A] = sts[A].filter(x => x !== i); sts[B].push(i);
      if (bestMove.type === 'I') { sts[B] = sts[B].filter(x => x !== j); sts[A].push(j); }
      sts.forEach(s => s.sort((x, y) => x - y));
      sync(); moves++;
    }
    return { stations: sts, ms: now() - t0, moves, si1, si2: smooth(P, sts) };
  }

  return { clasico, hoffman, moodieYoung };
})();
if (typeof module !== 'undefined') module.exports = Extra;
