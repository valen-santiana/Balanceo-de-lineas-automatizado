/* =====================================================================
   Núcleo de cálculo – Balanceo de líneas (SALBP-1)
   COMSOAL híbrido · heurísticas deterministas · óptimo exacto (B&B)
   Funciones puras: no tocan el DOM (se pueden probar en Node).
   ===================================================================== */
const Core = (() => {

  // ---------- utilidades ----------
  function mulberry32(seed) {               // generador aleatorio con semilla
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const sum = a => a.reduce((s, x) => s + x, 0);
  const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

  // ---------- validación y preparación ----------
  /** tasks: [{id, desc, time, preds:[id]}] */
  function validate(tasks, C) {
    const errs = [];
    const ids = new Set();
    tasks.forEach((t, i) => {
      if (!t.id && t.id !== 0) errs.push(`Fila ${i + 1}: falta el identificador de la tarea.`);
      else if (ids.has(String(t.id))) errs.push(`La tarea ${t.id} está repetida.`);
      ids.add(String(t.id));
      if (!(t.time > 0)) errs.push(`La tarea ${t.id} necesita un tiempo mayor que cero.`);
    });
    tasks.forEach(t => t.preds.forEach(p => {
      if (!ids.has(String(p))) errs.push(`La tarea ${t.id} tiene como predecesora a ${p}, que no existe.`);
      if (String(p) === String(t.id)) errs.push(`La tarea ${t.id} no puede ser predecesora de sí misma.`);
    }));
    if (!errs.length && topoOrder(tasks) === null) errs.push('Las precedencias forman un ciclo (A antes de B y B antes de A). Revísalas.');
    if (C > 0) tasks.forEach(t => { if (t.time > C) errs.push(`La tarea ${t.id} (${t.time}) dura más que el tiempo de ciclo (${round(C, 3)}): no cabe en ninguna estación.`); });
    else errs.push('El tiempo de ciclo debe ser mayor que cero.');
    if (!tasks.length) errs.push('Ingresa al menos una tarea.');
    return errs;
  }

  function topoOrder(tasks) {
    const indeg = new Map(tasks.map(t => [String(t.id), 0]));
    const succ = new Map(tasks.map(t => [String(t.id), []]));
    tasks.forEach(t => t.preds.forEach(p => {
      if (succ.has(String(p))) { succ.get(String(p)).push(String(t.id)); indeg.set(String(t.id), indeg.get(String(t.id)) + 1); }
    }));
    const order = [], q = tasks.filter(t => indeg.get(String(t.id)) === 0).map(t => String(t.id));
    while (q.length) {
      const v = q.shift(); order.push(v);
      succ.get(v).forEach(s => { indeg.set(s, indeg.get(s) - 1); if (indeg.get(s) === 0) q.push(s); });
    }
    return order.length === tasks.length ? order : null;
  }

  /** Prepara la estructura interna indexada en orden topológico. */
  function prepare(tasks) {
    const order = topoOrder(tasks);
    const byId = new Map(tasks.map(t => [String(t.id), t]));
    const T = order.map(id => byId.get(id));
    const rowPos = new Map(tasks.map((t, r) => [String(t.id), r]));
    const idx = new Map(T.map((t, i) => [String(t.id), i]));
    const n = T.length;
    const time = T.map(t => +t.time);
    const preds = T.map(t => t.preds.map(p => idx.get(String(p))));
    const succ = Array.from({ length: n }, () => []);
    preds.forEach((ps, i) => ps.forEach(p => succ[p].push(i)));
    // sucesoras totales (directas + indirectas)
    const allSucc = Array.from({ length: n }, () => new Set());
    for (let i = n - 1; i >= 0; i--) succ[i].forEach(s => { allSucc[i].add(s); allSucc[s].forEach(x => allSucc[i].add(x)); });
    const pw = time.map((t, i) => t + sum([...allSucc[i]].map(j => time[j])));
    // columna de Kilbridge-Wester (nivel más temprano)
    const col = new Array(n).fill(0);
    for (let i = 0; i < n; i++) col[i] = preds[i].length ? Math.max(...preds[i].map(p => col[p])) + 1 : 1;
    return { T, ids: T.map(t => String(t.id)), row: T.map(t => rowPos.get(String(t.id))), n, time, preds, succ, allSucc, pw, col, total: sum(time) };
  }

  // ---------- constructor genérico de estaciones ----------
  function buildStations(P, C, pick) {
    const assigned = new Array(P.n).fill(false);
    let left = P.n;
    const stations = [];
    let cur = [], curT = 0;
    while (left) {
      const B = [];
      for (let i = 0; i < P.n; i++) {
        if (assigned[i]) continue;
        let ok = true;
        for (const p of P.preds[i]) if (!assigned[p]) { ok = false; break; }   // Lista A
        if (ok && P.time[i] <= C - curT + 1e-9) B.push(i);                     // Lista B
      }
      if (!B.length) { stations.push(cur); cur = []; curT = 0; continue; }
      const c = pick(B);
      cur.push(c); assigned[c] = true; left--; curT += P.time[c];
    }
    if (cur.length) stations.push(cur);
    return stations;
  }

  // ---------- COMSOAL ----------
  function comsoal(P, C, { mode = 'random', k = 1, iterations = 1000, seed = 1, earlyStop = false } = {}) {
    const rnd = mulberry32(seed);
    const nMin = Math.ceil(P.total / C - 1e-9);
    const weight = mode === 'lot' ? i => P.time[i] ** k : mode === 'rpw' ? i => P.pw[i] ** k : () => 1;
    const pick = B => {
      if (mode === 'random') return B[Math.floor(rnd() * B.length)];
      const w = B.map(weight); let r = rnd() * sum(w);
      for (let j = 0; j < B.length; j++) { r -= w[j]; if (r <= 0) return B[j]; }
      return B[B.length - 1];
    };
    let best = null, bestIt = 0;
    const hist = [];
    const t0 = now();
    for (let it = 1; it <= iterations; it++) {
      const st = buildStations(P, C, pick);
      hist.push(st.length);
      if (!best || st.length < best.length || (st.length === best.length && smooth(P, C, st) < smooth(P, C, best) - 1e-9)) {
        if (!best || st.length < best.length) bestIt = it;
        best = st;
      }
      if (earlyStop && best.length === nMin) break;
    }
    const nBest = best.length;
    return { stations: best, iterBest: bestIt, hist, pctOpt: 100 * hist.filter(h => h === nBest).length / hist.length,
             avgN: sum(hist) / hist.length, ms: now() - t0 };
  }

  // ---------- heurísticas deterministas ----------
  const RULES = {
    rpw: { name: 'RPW (Helgeson-Birnie)', prio: (P, i) => [P.pw[i], P.time[i]] },
    lcr: { name: 'Mayor tiempo (LCR)', prio: (P, i) => [P.time[i], P.pw[i]] },
    kw:  { name: 'Kilbridge-Wester', prio: (P, i) => [-P.col[i], P.time[i]] },
    ns:  { name: 'Más sucesoras', prio: (P, i) => [P.allSucc[i].size, P.time[i]] },
  };
  function heuristic(P, C, rule) {
    const t0 = now();
    const f = RULES[rule].prio;
    const pick = B => B.slice().sort((a, b) => {
      const pa = f(P, a), pb = f(P, b);
      for (let j = 0; j < pa.length; j++) if (pa[j] !== pb[j]) return pb[j] - pa[j];
      return P.row[a] - P.row[b];         // empate: la tarea que aparece primero en la tabla
    })[0];
    return { stations: buildStations(P, C, pick), ms: now() - t0 };
  }

  // ---------- óptimo exacto: ramificación y acotamiento ----------
  /** Resuelve el modelo de PL entera SALBP-1 por ramificación y acotamiento orientado a estaciones.
   *  Solo genera cargas máximas (dominancia de Jackson) y poda con la cota ⌈tiempo restante / C⌉. */
  function exact(P, C, { upper = null, timeLimit = 4000 } = {}) {
    const t0 = now();
    const n = P.n;
    let best = upper ? upper.map(s => s.slice()) : null;
    let bestN = best ? best.length : Infinity;
    const seen = new Map();                   // estado (tareas asignadas) -> menor n.º de estaciones
    let nodes = 0, timeout = false;
    const assigned = new Array(n).fill(false);
    const path = [];

    function lb(remaining) { return Math.ceil(remaining / C - 1e-9); }

    function key() { let s = ''; for (let i = 0; i < n; i++) s += assigned[i] ? '1' : '0'; return s; }

    function genLoads(cb) {                   // cargas máximas de la estación actual
      const load = [];
      function rec(start, t) {
        let extended = false;
        for (let i = start; i < n; i++) {
          if (assigned[i] || P.time[i] > C - t + 1e-9) continue;
          let ok = true;
          for (const p of P.preds[i]) if (!assigned[p]) { ok = false; break; }
          if (!ok) continue;
          extended = true;
          assigned[i] = true; load.push(i);
          rec(i + 1, t + P.time[i]);
          assigned[i] = false; load.pop();
          if (timeout) return;
        }
        if (!extended && load.length) {
          // es máxima solo si ninguna tarea de índice menor también cabe
          for (let i = 0; i < start; i++) {
            if (assigned[i] || P.time[i] > C - t + 1e-9) continue;
            let ok = true;
            for (const p of P.preds[i]) if (!assigned[p]) { ok = false; break; }
            if (ok) return;
          }
          cb(load.slice(), t);
        }
      }
      rec(0, 0);
    }

    function dfs(remaining) {
      if (timeout) return;
      if (++nodes % 2000 === 0 && now() - t0 > timeLimit) { timeout = true; return; }
      if (remaining <= 1e-9) {
        if (path.length < bestN) { bestN = path.length; best = path.map(s => s.slice()); }
        return;
      }
      if (path.length + lb(remaining) >= bestN) return;
      const k = key();
      const prev = seen.get(k);
      if (prev !== undefined && prev <= path.length) return;
      seen.set(k, path.length);
      const loads = [];
      genLoads((l, t) => loads.push([l, t]));
      loads.sort((a, b) => b[1] - a[1]);      // primero las cargas más llenas
      for (const [l, t] of loads) {
        l.forEach(i => { assigned[i] = true; });
        path.push(l);
        dfs(remaining - t);
        path.pop();
        l.forEach(i => { assigned[i] = false; });
        if (timeout) return;
        if (path.length + lb(remaining) >= bestN) return;   // ya se alcanzó la cota inferior
      }
    }
    dfs(P.total);
    return { stations: best, optimal: !timeout, nodes, ms: now() - t0,
             nVars: n * (best ? best.length : 0) + (best ? best.length : 0) };
  }

  // ---------- indicadores ----------
  function smooth(P, C, st) {
    const loads = st.map(s => sum(s.map(i => P.time[i])));
    const mx = Math.max(...loads);
    return Math.sqrt(sum(loads.map(l => (mx - l) ** 2)));
  }
  function metrics(P, C, st, base = {}) {
    const n = st.length;
    const loads = st.map(s => sum(s.map(i => P.time[i])));
    const E = P.total / (n * C);
    const out = {
      n, nMin: Math.ceil(P.total / C - 1e-9), loads,
      E: 100 * E, RB: 100 * (1 - E), TM: n * C - P.total,
      SI: smooth(P, C, st), maxLoad: Math.max(...loads),
    };
    // R, T, I  (Ley de Little: I = R × T)
    out.R = 1 / C;                       // unidades por unidad de tiempo
    out.T = n * C;                       // tiempo de flujo de una unidad por la línea
    out.I = out.R * out.T;               // inventario en proceso (unidades)
    if (base.TD > 0) out.cap = base.TD / C;                 // unidades por periodo disponible
    out.capReal = base.TD > 0 ? base.TD / out.maxLoad : null; // con la estación cuello de botella
    if (base.costoHora > 0) out.costoUnit = n * base.costoHora * C / base.unitPerHour;
    return out;
  }

  // ---------- modelo de PL entera en formato LP (CPLEX) ----------
  function lpModel(P, C, K) {
    const L = [];
    const x = (i, k) => `x_${P.ids[i]}_${k}`.replace(/[^A-Za-z0-9_]/g, '_');
    L.push('\\ Balanceo de líneas SALBP-1 – modelo de programación lineal entera');
    L.push(`\\ Tiempo de ciclo C = ${C}; K = ${K} estaciones como máximo`);
    L.push('Minimize');
    L.push(' obj: ' + Array.from({ length: K }, (_, k) => `y_${k + 1}`).join(' + '));
    L.push('Subject To');
    for (let i = 0; i < P.n; i++) L.push(` asig_${P.ids[i]}: ` + Array.from({ length: K }, (_, k) => x(i, k + 1)).join(' + ') + ' = 1');
    for (let k = 1; k <= K; k++) L.push(` cap_${k}: ` + P.time.map((t, i) => `${t} ${x(i, k)}`).join(' + ') + ` - ${C} y_${k} <= 0`);
    for (let b = 0; b < P.n; b++) for (const a of P.preds[b]) {
      L.push(` prec_${P.ids[a]}_${P.ids[b]}: ` + Array.from({ length: K }, (_, k) => `${k + 1} ${x(a, k + 1)}`).join(' + ') + ' - ' +
             Array.from({ length: K }, (_, k) => `${k + 1} ${x(b, k + 1)}`).join(' - ') + ' <= 0');
    }
    for (let k = 1; k < K; k++) L.push(` orden_${k}: y_${k + 1} - y_${k} <= 0`);
    L.push('Binary');
    for (let i = 0; i < P.n; i++) for (let k = 1; k <= K; k++) L.push(' ' + x(i, k));
    for (let k = 1; k <= K; k++) L.push(` y_${k}`);
    L.push('End');
    return L.join('\n');
  }

  function now() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }

  return { validate, prepare, comsoal, heuristic, exact, metrics, lpModel, RULES, round, sum, topoOrder };
})();
if (typeof module !== 'undefined') module.exports = Core;
