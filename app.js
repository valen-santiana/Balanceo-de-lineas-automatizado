/* =====================================================================
   Interfaz – Balanceo COMSOAL
   ===================================================================== */
(() => {
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (x, d = 2) => (x === null || x === undefined || !isFinite(x)) ? '—' : (+x).toLocaleString('es-EC', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const STORE = 'balanceo-comsoal-v1';

// ---------------- ejemplos ----------------
const EJEMPLOS = {
  camiseta: {
    producto: 'Camiseta básica cuello redondo – talla M', unidad: 's', cmode: 'demanda', horas: 8, turnos: 1, pausas: 0, demanda: 600, cDado: 48,
    tasks: [
      [1, 'Cortar delantero y espalda', 20, ''], [2, 'Cortar mangas', 14, ''], [3, 'Cortar cuello (rib)', 8, ''],
      [4, 'Pegar etiqueta en espalda', 12, '1'], [5, 'Unir hombros (overlock)', 25, '4'], [6, 'Cerrar cuello en anillo', 10, '3'],
      [7, 'Pegar cuello al escote', 30, '5, 6'], [8, 'Pespuntar cinta de refuerzo', 22, '7'], [9, 'Dobladillo de mangas', 18, '2'],
      [10, 'Pegar mangas (overlock)', 40, '8, 9'], [11, 'Cerrar costados y mangas', 45, '10'], [12, 'Dobladillo de bajo', 28, '11'],
      [13, 'Despitar (cortar hilos)', 20, '12'], [14, 'Inspección de calidad', 15, '13'], [15, 'Doblar y empacar', 18, '14']],
    bom: [['P-01', 'Delantero', 1, 'pieza', '', '5'], ['P-02', 'Espalda', 1, 'pieza', '', '4'], ['P-03', 'Manga', 2, 'pieza', '', '9'], ['P-04', 'Cuello rib 46 × 5 cm', 1, 'pieza', '', '6'],
      ['E-01', 'Juego de etiquetas (marca/talla y composición)', 1, 'juego', '', '4'], ['C-01', 'Cinta de refuerzo de espalda', 0.2, 'm', '', '8'],
      ['B-01', 'Bolsa y etiqueta colgante', 1, 'juego', '', '15'], ['M-01', 'Tela jersey 100 % algodón 160 g/m²', 1, 'm²', 'P-01, P-02, P-03', '1'],
      ['M-02', 'Tejido rib 1×1', 0.025, 'm²', 'P-04', '3'], ['H-01', 'Hilo poliéster 40/2 (overlock)', 90, 'm', '', '5'], ['H-02', 'Hilo poliéster 40/2 (recubridora)', 60, 'm', '', '9']],
    notas: 'Talla M. Ancho de pecho 52 cm, largo total 72 cm, hombro 46 cm, manga 20 cm.\nCosturas de unión en overlock de 4 hilos; dobladillos en recubridora de 2 agujas.\nTiempos estándar referenciales para el ejercicio.'
  },
  clase: {
    producto: 'Ejercicio de clase', unidad: 'min', cmode: 'dado', cDado: 19, horas: 8, turnos: 1, pausas: 0, demanda: 25,
    tasks: [[1, 'Tarea 1', 3, ''], [2, 'Tarea 2', 3, ''], [3, 'Tarea 3', 4, ''], [4, 'Tarea 4', 7, '1, 2'], [5, 'Tarea 5', 5, '3'],
      [6, 'Tarea 6', 3, '4, 5'], [7, 'Tarea 7', 6, '6'], [8, 'Tarea 8', 1, '6'], [9, 'Tarea 9', 4, '7'], [10, 'Tarea 10', 4, '6'],
      [11, 'Tarea 11', 8, '8'], [12, 'Tarea 12', 6, '9, 10, 11']],
    bom: [], notas: ''
  }
};

const METHODS = [
  { key: 'c-random', group: 'comsoal', label: 'COMSOAL aleatorio', short: 'Aleatorio', mode: 'random', on: true },
  { key: 'c-lot', group: 'comsoal', label: 'COMSOAL + LOT', short: 'LOT', mode: 'lot', on: true },
  { key: 'c-rpw', group: 'comsoal', label: 'COMSOAL + RPW', short: 'RPW', mode: 'rpw', on: true },
  { key: 'h-rpw', group: 'det', label: 'RPW determinista', rule: 'rpw', on: true, hint: 'Helgeson-Birnie' },
  { key: 'h-lcr', group: 'det', label: 'Mayor tiempo (LCR)', rule: 'lcr', on: true },
  { key: 'h-kw', group: 'det', label: 'Kilbridge-Wester', rule: 'kw', on: true },
  { key: 'h-ns', group: 'det', label: 'Más sucesoras', rule: 'ns', on: false },
  { key: 'exact', group: 'exact', label: 'Óptimo exacto (PL entera)', on: true, hint: 'B&B' },
];
const KPIS = [
  { key: 'E', label: 'Eficiencia y retraso de balance', hint: 'E, RB', on: true },
  { key: 'TM', label: 'Tiempo muerto', hint: 'n·C − Σt', on: true },
  { key: 'SI', label: 'Índice de suavidad', hint: 'IS', on: true },
  { key: 'CAP', label: 'Capacidad de producción', hint: 'TD / C', on: true },
  { key: 'RTI', label: 'Inventario en proceso', hint: 'I = R × T', on: true },
  { key: 'COST', label: 'Costo de mano de obra', hint: '$/u', on: false },
];

// ---------------- estado ----------------
let S = null;           // estado (se crea en init)
let R = null;           // resultados
let selKey = null;      // método seleccionado
let planoView = null;

function defaultState() {
  const e = EJEMPLOS.camiseta;
  return {
    producto: e.producto, unidad: e.unidad, seed: 1, cmode: e.cmode, cDado: e.cDado, horas: e.horas, turnos: e.turnos, pausas: e.pausas,
    demanda: e.demanda, nObj: 7, iters: 1000, kSesgo: 6, costoHora: '',
    methods: Object.fromEntries(METHODS.map(m => [m.key, m.on])), kpis: Object.fromEntries(KPIS.map(k => [k.key, k.on])),
    tasks: e.tasks.map(([id, desc, time, preds]) => ({ id: String(id), desc, time: String(time), preds })),
    bom: e.bom.map(([c, d, q, u, p = '', t = '']) => ({ c, d, q: String(q), u, p, t })), notas: e.notas, plano: null,
    curso: cursoFor('camiseta'), proyecto: defaultProyecto(),
  };
}
// Los datos viven solo en esta pestaña (sessionStorage): sobreviven a una recarga y se borran al cerrarla.
let dirty = false;            // hay cambios que el usuario no ha guardado en un archivo .json
let booting = true;
function save() { try { sessionStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* almacenamiento no disponible */ } if (!booting) dirty = true; }
function load() {
  try {   // versiones anteriores guardaban en localStorage: se recupera una sola vez y se elimina
    const old = localStorage.getItem(STORE);
    if (old !== null) { if (!sessionStorage.getItem(STORE)) sessionStorage.setItem(STORE, old); localStorage.removeItem(STORE); }
  } catch (e) { /* sin almacenamiento */ }
  try { const t = sessionStorage.getItem(STORE); if (t) { const o = JSON.parse(t); if (o && Array.isArray(o.tasks)) { S = Object.assign(defaultState(), o); if (!o.curso) S.curso = emptyCurso(); } } } catch (e) { /* sin datos guardados */ }
}

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2600); }
let dlCap;   // capacidad de descargas cuando la app corre dentro de un visor que la ofrece
async function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain;charset=utf-8' });
  if (window.claude && typeof window.claude.use === 'function') {
    if (dlCap === undefined) { try { dlCap = await window.claude.use('downloads'); } catch (e) { dlCap = null; } }
    if (dlCap) {
      const fname = /\.(lp)$/i.test(name) ? name.replace(/\.lp$/i, '.lp.txt') : name;
      try { await dlCap.save({ filename: fname, data: blob }); toast('Archivo guardado'); }
      catch (e) { if (e && e.code !== 'declined') toast('No se pudo guardar el archivo en esta vista.'); }
      return;
    }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const xlsxBlob = wb => new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

// ---------------- tareas ----------------
const parsePreds = s => String(s || '').split(/[,;\s]+/).map(x => x.trim()).filter(Boolean);
const num = s => { const v = parseFloat(String(s).replace(',', '.')); return isFinite(v) ? v : NaN; };
function tasksForCore() {
  return S.tasks.filter(t => String(t.id).trim() !== '' || String(t.time).trim() !== '')
    .map(t => ({ id: String(t.id).trim(), desc: t.desc || '', time: num(t.time), preds: parsePreds(t.preds) }));
}

function renderTasks() {
  const tb = $('#taskTable tbody');
  tb.innerHTML = S.tasks.map((t, i) => `<tr data-i="${i}">
      <td><input class="id" data-f="id" value="${esc(t.id)}" aria-label="Tarea fila ${i + 1}"></td>
      <td><input data-f="desc" value="${esc(t.desc)}" aria-label="Descripción fila ${i + 1}"></td>
      <td><input class="t" data-f="time" inputmode="decimal" value="${esc(t.time)}" style="text-align:right" aria-label="Tiempo fila ${i + 1}"></td>
      <td><input class="p" data-f="preds" value="${esc(t.preds)}" aria-label="Predecesoras fila ${i + 1}"></td>
      <td class="pw" data-pw="${i}"></td>
      <td><button class="btn ghost" data-del="${i}" title="Eliminar tarea" aria-label="Eliminar tarea ${esc(t.id)}">×</button></td></tr>`).join('');
  refreshDerived();
}
function refreshDerived() {
  const T = tasksForCore();
  const ids = new Set(T.map(t => t.id));
  // marcar errores en celdas
  $$('#taskTable tbody tr').forEach(tr => {
    const t = S.tasks[+tr.dataset.i]; if (!t) return;
    const time = tr.querySelector('[data-f=time]'), pr = tr.querySelector('[data-f=preds]');
    time.classList.toggle('err', String(t.time).trim() !== '' && !(num(t.time) > 0));
    pr.classList.toggle('err', parsePreds(t.preds).some(p => !ids.has(p) || p === String(t.id).trim()));
  });
  // pesos posicionales
  let P = null;
  const C = computeC();
  if (T.length && T.every(t => t.time > 0) && Core.topoOrder(T) && T.every(t => t.preds.every(p => ids.has(p)))) { try { P = Core.prepare(T); } catch (e) { P = null; } }
  $$('[data-pw]').forEach(td => {
    const t = S.tasks[+td.dataset.pw]; const j = P ? P.ids.indexOf(String(t.id).trim()) : -1;
    td.textContent = j >= 0 ? fmt(P.pw[j]) : '';
  });
  const u = S.unidad;
  const tot = T.reduce((s, t) => s + (t.time > 0 ? t.time : 0), 0);
  const tmax = Math.max(0, ...T.map(t => t.time > 0 ? t.time : 0));
  $('#statLine').innerHTML = `<span>Tareas <b>${T.length}</b></span><span>Σt <b>${fmt(tot)}</b> ${u}</span><span>t<sub>máx</sub> <b>${fmt(tmax)}</b> ${u}</span>` +
    (C.C > 0 ? `<span>n<sub>mín</sub> <b>${Math.ceil(tot / C.C - 1e-9)}</b></span>` : '');
  $('#thTime').textContent = `Tiempo (${u})`;
  renderC();
}

function bindTasks() {
  const tb = $('#taskTable tbody');
  tb.addEventListener('input', e => {
    const f = e.target.dataset.f; if (!f) return;
    const i = +e.target.closest('tr').dataset.i; S.tasks[i][f] = e.target.value; save(); refreshDerived(); markStale();
  });
  tb.addEventListener('click', e => {
    const d = e.target.closest('[data-del]'); if (!d) return;
    S.tasks.splice(+d.dataset.del, 1); save(); renderTasks(); markStale();
  });
  tb.addEventListener('paste', e => {      // pegar varias filas desde Excel
    const txt = (e.clipboardData || window.clipboardData).getData('text');
    if (!txt || !/\t|\n/.test(txt.trim())) return;
    e.preventDefault();
    const rows = txt.replace(/\r/g, '').split('\n').filter(r => r.trim()).map(r => r.split('\t'));
    const start = +e.target.closest('tr').dataset.i;
    const cols = ['id', 'desc', 'time', 'preds'];
    const c0 = cols.indexOf(e.target.dataset.f);
    rows.forEach((r, k) => {
      const i = start + k; if (!S.tasks[i]) S.tasks[i] = { id: '', desc: '', time: '', preds: '' };
      r.forEach((v, j) => { const f = cols[c0 + j]; if (f) S.tasks[i][f] = v.trim(); });
    });
    save(); renderTasks(); markStale(); toast(`${rows.length} fila(s) pegadas`);
  });
  $('#addRow').onclick = () => {
    const ids = S.tasks.map(t => parseInt(t.id, 10)).filter(isFinite);
    S.tasks.push({ id: String(ids.length ? Math.max(...ids) + 1 : S.tasks.length + 1), desc: '', time: '', preds: '' });
    save(); renderTasks(); const r = $$('#taskTable tbody tr').pop(); r && r.querySelector('[data-f=desc]').focus();
  };
  $('#clearRows').onclick = () => {
    if ($('#clearRows').dataset.confirm !== '1') { $('#clearRows').dataset.confirm = '1'; $('#clearRows').textContent = '¿Seguro? Pulsa otra vez'; setTimeout(() => { $('#clearRows').dataset.confirm = ''; $('#clearRows').textContent = 'Vaciar tabla'; }, 3000); return; }
    $('#clearRows').dataset.confirm = ''; $('#clearRows').textContent = 'Vaciar tabla';
    S.tasks = [{ id: '1', desc: '', time: '', preds: '' }]; save(); renderTasks(); markStale();
  };
}

// ---------------- tiempo de ciclo ----------------
const UNIT_S = { s: 1, min: 60, h: 3600 };
function computeC() {
  const u = UNIT_S[S.unidad];
  const T = tasksForCore();
  const tot = T.reduce((s, t) => s + (t.time > 0 ? t.time : 0), 0);
  const tmax = Math.max(0, ...T.map(t => t.time > 0 ? t.time : 0));
  const tdSec = ((num(S.horas) || 0) * 3600 - (num(S.pausas) || 0) * 60) * (num(S.turnos) || 1);
  const TD = tdSec / u;                                     // tiempo disponible por día en la unidad de las tareas
  if (S.cmode === 'dado') return { C: num(S.cDado), TD: TD > 0 ? TD : null, how: 'dado' };
  if (S.cmode === 'demanda') { const D = num(S.demanda); return { C: D > 0 && TD > 0 ? TD / D : NaN, TD, D, how: 'demanda' }; }
  const n = Math.max(1, parseInt(S.nObj, 10) || 1);
  return { C: Math.max(tmax, tot / n), TD: TD > 0 ? TD : null, n, tot, tmax, how: 'estaciones' };
}
function renderC() {
  const c = computeC(), u = S.unidad;
  $$('.seg [data-cmode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cmode === S.cmode)));
  $('#cm-dado').hidden = S.cmode !== 'dado'; $('#cm-demanda').hidden = S.cmode !== 'demanda'; $('#cm-estaciones').hidden = S.cmode !== 'estaciones';
  let h = '';
  if (c.how === 'demanda') h = `<div class="muted">C = tiempo disponible / demanda</div><div class="eq">C = ${fmt(c.TD)} / ${fmt(c.D)} = <b>${fmt(c.C, 3)} ${u}</b></div>`;
  else if (c.how === 'estaciones') h = `<div class="muted">C<sub>mín</sub> = máx(t<sub>máx</sub>, Σt / n)</div><div class="eq">máx(${fmt(c.tmax)}, ${fmt(c.tot)} / ${c.n}) = <b>${fmt(c.C, 3)} ${u}</b></div><div class="muted" style="font-size:.78rem">Es la cota inferior; con las precedencias puede necesitarse una estación más.</div>`;
  else h = `<div class="eq">C = <b>${fmt(c.C, 3)} ${u}</b></div>` + (c.TD ? `<div class="muted" style="font-size:.78rem">Tiempo disponible por día: ${fmt(c.TD)} ${u} (para la capacidad)</div>` : '');
  if (!(c.C > 0)) h = `<div class="eq" style="color:var(--bad)">Completa los datos para calcular C</div>`;
  $('#cCalc').innerHTML = h;
}
function bindParams() {
  const ids = ['producto', 'unidad', 'seed', 'cDado', 'horas', 'turnos', 'pausas', 'demanda', 'nObj', 'iters', 'kSesgo', 'costoHora', 'notas'];
  ids.forEach(id => { const el = $('#' + id); el.value = S[id] ?? ''; el.addEventListener('input', () => { S[id] = el.value; save(); refreshDerived(); if (id !== 'notas' && id !== 'producto') markStale(); }); });
  $$('.seg [data-cmode]').forEach(b => b.onclick = () => { S.cmode = b.dataset.cmode; save(); refreshDerived(); markStale(); });
  $('#methodChecks').innerHTML = METHODS.map(m => `<label class="check"><input type="checkbox" data-m="${m.key}" ${S.methods[m.key] ? 'checked' : ''}><span>${m.label}</span><small>${m.group === 'comsoal' ? (m.mode === 'random' ? 'uniforme' : 'k suave y fuerte') : m.hint || ''}</small></label>`).join('');
  $('#kpiChecks').innerHTML = KPIS.map(k => `<label class="check"><input type="checkbox" data-k="${k.key}" ${S.kpis[k.key] ? 'checked' : ''}><span>${k.label}</span><small>${k.hint}</small></label>`).join('');
  $('#methodChecks').onchange = e => { S.methods[e.target.dataset.m] = e.target.checked; save(); markStale(); };
  $('#kpiChecks').onchange = e => { S.kpis[e.target.dataset.k] = e.target.checked; save(); if (R) renderDetail(); };
}

// ---------------- cálculo ----------------
let stale = false;
function markStale() { if (R && !stale) { stale = true; $('#btnRun').textContent = 'Recalcular con los datos nuevos'; } }

function run(opts = {}) {
  const T = tasksForCore();
  const c = computeC();
  const errs = Core.validate(T, c.C);
  const box = $('#errBox');
  if (!Object.values(S.methods).some(Boolean)) errs.push('Selecciona al menos un método.');
  if (errs.length) { box.hidden = false; box.innerHTML = `<b>Revisa los datos antes de balancear:</b><ul>${errs.slice(0, 8).map(e => `<li>${esc(e)}</li>`).join('')}</ul>`; return; }
  box.hidden = true;
  const btn = $('#btnRun'); btn.disabled = true; btn.textContent = 'Calculando…';
  setTimeout(() => {
    try {
      const P = Core.prepare(T), C = c.C;
      const iters = Math.max(10, parseInt(S.iters, 10) || 1000), kS = Math.max(1, parseFloat(S.kSesgo) || 6), seed = parseInt(S.seed, 10) || 1;
      const out = [];
      for (const m of METHODS) {
        if (!S.methods[m.key]) continue;
        if (m.group === 'comsoal') {
          const ks = m.mode === 'random' ? [1] : (kS === 1 ? [1] : [1, kS]);
          for (const k of ks) {
            const r = Core.comsoal(P, C, { mode: m.mode, k, iterations: iters, seed });
            out.push({ key: `${m.key}-${k}`, name: m.mode === 'random' ? 'COMSOAL aleatorio' : `COMSOAL + ${m.short} (k = ${k})`, kind: 'COMSOAL', ...r });
          }
        } else if (m.group === 'det') {
          out.push({ key: m.key, name: m.label, kind: 'Heurística', ...Core.heuristic(P, C, m.rule) });
        }
      }
      if (S.methods.exact) {
        const ub = out.length ? out.reduce((a, b) => b.stations.length < a.stations.length ? b : a).stations : null;
        const r = Core.exact(P, C, { upper: ub, timeLimit: 5000 });
        out.push({ key: 'exact', name: 'Óptimo exacto (PL entera)', kind: 'Exacto', ...r });
      }
      const base = { TD: c.TD, costoHora: num(S.costoHora), unitPerHour: 3600 / UNIT_S[S.unidad] };
      out.forEach(o => { o.m = Core.metrics(P, C, o.stations, base); });
      const nOpt = out.find(o => o.kind === 'Exacto' && o.optimal)?.m.n ?? null;
      // ranking
      const rank = (a, b) => a.m.n - b.m.n || a.m.SI - b.m.SI || pref(b) - pref(a);
      const pref = o => o.kind === 'COMSOAL' ? o.pctOpt / 100 : o.kind === 'Heurística' ? 1.2 : 1.1;
      const sorted = out.slice().sort(rank);
      R = { P, C, c, out, sorted, best: sorted[0], nOpt, iters, unit: S.unidad, when: new Date() };
      selKey = R.best.key; stale = false;
      renderResults();
      if (!opts.silent) { go('resultados'); toast('Balanceo calculado'); }
    } catch (e) {
      box.hidden = false; box.textContent = 'No se pudo calcular: ' + e.message;
    } finally { btn.disabled = false; btn.textContent = 'Balancear la línea'; }
  }, 30);
}

// ---------------- resultados ----------------
const stColor = i => `var(--st${(i % 10) + 1})`;
function stationOf(o) { const m = new Map(); o.stations.forEach((s, k) => s.forEach(i => m.set(i, k))); return m; }

function renderResults() {
  $('#resEmpty').hidden = !!R; $('#resBody').hidden = !R;
  if (!R) return;
  const { out, best, nOpt, C, P } = R, u = R.unit;
  const comsoals = out.filter(o => o.kind === 'COMSOAL');
  const bestC = comsoals.slice().sort((a, b) => a.m.n - b.m.n || b.pctOpt - a.pctOpt)[0];
  const ex = out.find(o => o.kind === 'Exacto');
  let p = `Con C = ${fmt(C, 3)} ${u}, la línea necesita <b>${best.m.n} estaciones</b> con eficiencia de <b>${fmt(best.m.E)} %</b>. `;
  if (ex) p += ex.optimal ? `El modelo exacto demuestra que ${ex.m.n} es el mínimo posible${ex.m.n > ex.m.nMin ? ` (el mínimo teórico de ${ex.m.nMin} no es alcanzable por las precedencias)` : ''}. ` : `El modelo exacto no terminó en el tiempo límite; su mejor solución tiene ${ex.m.n} estaciones. `;
  if (bestC) p += `Entre los modos de COMSOAL, <b>${esc(bestC.name)}</b> converge mejor: ${fmt(bestC.pctOpt, 1)} % de sus iteraciones dan ${bestC.m.n} estaciones.`;
  $('#verdict').innerHTML = `<div class="big num">${best.m.n}<small>estaciones</small></div><div><div class="eyebrow">Método recomendado</div><h2>${esc(best.name)}</h2><p>${p}</p></div>`;

  const rows = R.sorted;
  $('#cmpTable').innerHTML = `<thead><tr><th>Método</th><th>Tipo</th><th class="n">Estaciones</th><th class="n">Eficiencia</th><th class="n">T. muerto</th><th class="n">Suavidad</th><th>Iter. óptimas</th><th class="n">Cálculo</th><th>Estado</th></tr></thead><tbody>` +
    rows.map(o => {
      const opt = nOpt !== null ? o.m.n === nOpt : o.m.n === best.m.n;
      const st = o === best ? '<span class="pill best">Recomendado</span>' : opt ? '<span class="pill ok">Óptimo</span>' : `<span class="pill warn">+${o.m.n - (nOpt ?? best.m.n)} estación</span>`;
      const it = o.kind === 'COMSOAL' ? `<div style="display:flex;gap:8px;align-items:center"><div class="bar-mini" style="flex:1"><i style="width:${o.pctOpt}%"></i></div><span class="num" style="font-size:.8rem;min-width:44px;text-align:right">${fmt(o.pctOpt, 1)} %</span></div>` : '<span class="muted">—</span>';
      return `<tr data-k="${o.key}" class="${o.key === selKey ? 'sel' : ''}"><td class="m">${esc(o.name)}</td><td><span class="pill kind">${o.kind}</span></td><td class="n">${o.m.n}</td><td class="n">${fmt(o.m.E)} %</td><td class="n">${fmt(o.m.TM)}</td><td class="n">${fmt(o.m.SI)}</td><td>${it}</td><td class="n">${fmt(o.ms, 0)} ms</td><td>${st}</td></tr>`;
    }).join('') + '</tbody>';
  $('#cmpNote').innerHTML = `Iteraciones de COMSOAL: ${R.iters} por modo, semilla ${esc(S.seed)}. Criterio: menos estaciones → menor índice de suavidad → mayor facilidad para llegar al resultado.`;
  $$('#cmpTable tbody tr').forEach(tr => tr.onclick = () => { selKey = tr.dataset.k; renderResults(); });
  renderDetail();
  renderLP();
  renderDiagrams();
}

function kpiCards(o) {
  const m = o.m, u = R.unit, k = S.kpis, cards = [];
  const card = (label, v, unit, f) => cards.push(`<div class="kpi"><div class="k">${label}</div><div class="v">${v}<small>${unit || ''}</small></div>${f ? `<div class="f">${f}</div>` : ''}</div>`);
  card('Estaciones', m.n, '', `mínimo teórico ${m.nMin}`);
  card('Tiempo de ciclo', fmt(R.C, 3), u, R.c.how === 'demanda' ? 'TD / demanda' : '');
  if (k.E) { card('Eficiencia', fmt(m.E), '%', 'Σt / (n·C)'); card('Retraso de balance', fmt(m.RB), '%', '1 − E'); }
  if (k.TM) card('Tiempo muerto', fmt(m.TM), u + '/ciclo', 'n·C − Σt');
  if (k.SI) card('Índice de suavidad', fmt(m.SI), '', '√Σ(Smáx − Si)²');
  if (k.CAP) {
    const perH = (3600 / UNIT_S[u]) / R.C;
    card('Capacidad', fmt(perH, 1), 'u/h', '1 h / C');
    if (m.cap) card('Capacidad diaria', fmt(m.cap, 0), 'u/día', 'TD / C');
  }
  if (k.RTI) {
    card('Tasa R', fmt(m.R, 4), `u/${u}`, 'R = 1 / C');
    card('Tiempo de flujo T', fmt(m.T), u, 'T = n · C');
    card('Inventario en proceso', fmt(m.I), 'u', 'I = R × T');
  }
  if (k.COST) {
    const ch = num(S.costoHora);
    if (ch > 0) card('Costo de mano de obra', '$' + fmt(m.n * ch * R.C / (3600 / UNIT_S[u]), 3), '/u', `${m.n} operarios × $${fmt(ch)}/h`);
    else card('Costo de mano de obra', '—', '', 'ingresa el costo por hora');
  }
  return cards.join('');
}

function renderDetail() {
  const o = R.out.find(x => x.key === selKey) || R.best; const P = R.P, u = R.unit;
  $('#selName').textContent = o.name;
  $('#kpiGrid').innerHTML = kpiCards(o);
  $('#asgTable').innerHTML = `<thead><tr><th>Est.</th><th>Tareas</th><th class="n">Tiempo</th><th class="n">Ocio</th><th>Uso</th></tr></thead><tbody>` +
    o.stations.map((s, k) => {
      const t = Core.sum(s.map(i => P.time[i])), pct = 100 * t / R.C;
      const names = s.map(i => `<span class="mono">${esc(P.ids[i])}</span>${P.T[i].desc ? ` <span class="muted">${esc(P.T[i].desc)}</span>` : ''}`).join('<br>');
      return `<tr><td class="num"><span class="swatch" style="background:${stColor(k)}"></span>${k + 1}</td><td style="font-size:.84rem">${names}</td><td class="n">${fmt(t)}</td><td class="n">${fmt(R.C - t)}</td><td style="min-width:90px"><div style="display:flex;gap:6px;align-items:center"><div class="bar-mini" style="flex:1"><i style="width:${Math.min(100, pct)}%;background:${stColor(k)}"></i></div><span class="num" style="font-size:.78rem">${fmt(pct, 0)}%</span></div></td></tr>`;
    }).join('') + `<tr><td><b>Total</b></td><td class="muted">${P.n} tareas</td><td class="n"><b>${fmt(P.total)}</b></td><td class="n"><b>${fmt(o.m.TM)}</b></td><td class="num"><b>${fmt(o.m.E, 1)}%</b></td></tr></tbody>`;
  $('#loadChart').innerHTML = loadSVG(o, 520, 300);
  if (o.kind === 'COMSOAL') {
    const counts = {}; o.hist.forEach(h => { counts[h] = (counts[h] || 0) + 1; });
    const ks = Object.keys(counts).map(Number).sort((a, b) => a - b), tot = o.hist.length;
    $('#distBox').innerHTML = `<h3 style="margin:16px 0 6px">Estaciones obtenidas en las ${tot} iteraciones</h3>` +
      ks.map(n => `<div style="display:grid;grid-template-columns:90px 1fr 56px;gap:8px;align-items:center;font-size:.84rem;margin-bottom:4px"><span class="num">${n} estaciones</span><div class="bar-mini" style="height:12px"><i style="width:${100 * counts[n] / tot}%;background:${n === o.m.n ? 'var(--accent)' : 'var(--muted)'}"></i></div><span class="num" style="text-align:right">${fmt(100 * counts[n] / tot, 1)} %</span></div>`).join('') +
      `<p class="note">Mejor solución encontrada en la iteración ${o.iterBest}.</p>`;
  } else if (o.kind === 'Exacto') {
    $('#distBox').innerHTML = `<p class="note" style="margin-top:14px">${o.optimal ? `Óptimo demostrado: se exploraron ${fmt(o.nodes, 0)} nodos del árbol de ramificación y acotamiento.` : 'Se alcanzó el tiempo límite; la solución mostrada es la mejor encontrada.'}</p>`;
  } else $('#distBox').innerHTML = `<p class="note" style="margin-top:14px">Método determinista: siempre produce la misma asignación con los mismos datos.</p>`;
}

function loadSVG(o, W, H) {
  const P = R.P, C = R.C, n = o.stations.length;
  const padL = 44, padR = 10, padT = 16, padB = 30, w = W - padL - padR, h = H - padT - padB;
  const maxV = C * 1.12, y = v => padT + h - h * v / maxV, bw = Math.min(64, w / n * 0.72);
  const step = niceStep(maxV);
  let g = '';
  for (let v = 0; v <= maxV; v += step) g += `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" stroke="var(--plot-grid)"/><text x="${padL - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end">${fmt(v)}</text>`;
  o.stations.forEach((s, k) => {
    const cx = padL + w * (k + 0.5) / n; let base = 0;
    s.forEach(i => {
      const t = P.time[i];
      g += `<rect x="${cx - bw / 2}" y="${y(base + t)}" width="${bw}" height="${y(base) - y(base + t)}" fill="${stColor(k)}" stroke="var(--surface)" stroke-width="1"><title>${esc(P.ids[i])}: ${fmt(t)}</title></rect>`;
      if (y(base) - y(base + t) > 13) g += `<text x="${cx}" y="${(y(base) + y(base + t)) / 2 + 4}" font-size="10.5" text-anchor="middle" style="fill:var(--ink)">${esc(P.ids[i])}</text>`;
      base += t;
    });
    g += `<text x="${cx}" y="${H - 10}" font-size="11.5" text-anchor="middle">E${k + 1}</text>`;
  });
  g += `<line x1="${padL}" x2="${W - padR}" y1="${y(C)}" y2="${y(C)}" stroke="var(--accent)" stroke-width="2" stroke-dasharray="6 4"/><text x="${W - padR}" y="${y(C) - 6}" font-size="11" text-anchor="end" style="fill:var(--accent);font-weight:600">C = ${fmt(C, 2)}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Carga por estación">${g}</svg>`;
}
function niceStep(max) { const r = max / 5, p = 10 ** Math.floor(Math.log10(r)), m = r / p; return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p; }

// ---------------- diagrama de precedencias ----------------
function precSVG(o) {
  const P = R ? R.P : null; if (!P) return '';
  const n = P.n;
  const rest = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) rest[i] = P.succ[i].length ? Math.max(...P.succ[i].map(s => rest[s] + 1)) : 0;
  const L = Math.max(...rest);
  const lvl = rest.map(r => L - r);
  const cols = {}; for (let i = 0; i < n; i++) (cols[lvl[i]] = cols[lvl[i]] || []).push(i);
  Object.values(cols).forEach(c => c.sort((a, b) => P.pw[b] - P.pw[a]));
  // ordenar filas por baricentro de predecesoras para reducir cruces
  const ypos = new Array(n).fill(0);
  for (let l = 0; l <= L; l++) {
    const c = cols[l] || [];
    if (l > 0) c.sort((a, b) => bary(a) - bary(b));
    c.forEach((i, k) => { ypos[i] = k - (c.length - 1) / 2; });
  }
  function bary(i) { return P.preds[i].length ? Core.sum(P.preds[i].map(p => ypos[p])) / P.preds[i].length : 0; }
  const maxRows = Math.max(...Object.values(cols).map(c => c.length));
  const dx = 92, dy = 74, r = 23, W = (L + 1) * dx + 40, H = maxRows * dy + 40;
  const X = i => 20 + r + lvl[i] * dx, Y = i => H / 2 + ypos[i] * dy;
  const so = o ? stationOf(o) : null;
  let g = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)"/></marker></defs>`;
  for (let b = 0; b < n; b++) for (const a of P.preds[b]) {
    const x1 = X(a), y1 = Y(a), x2 = X(b), y2 = Y(b), d = Math.hypot(x2 - x1, y2 - y1);
    g += `<line x1="${x1 + (x2 - x1) * r / d}" y1="${y1 + (y2 - y1) * r / d}" x2="${x2 - (x2 - x1) * (r + 3) / d}" y2="${y2 - (y2 - y1) * (r + 3) / d}" stroke="var(--muted)" stroke-width="1.3" marker-end="url(#ah)"/>`;
  }
  for (let i = 0; i < n; i++) {
    const fill = so ? stColor(so.get(i)) : 'var(--surface)';
    g += `<g><title>${esc(P.ids[i])} ${esc(P.T[i].desc)} – ${fmt(P.time[i])} ${R.unit}${so ? ' – estación ' + (so.get(i) + 1) : ''}</title><circle cx="${X(i)}" cy="${Y(i)}" r="${r}" fill="${fill}" stroke="var(--ink)" stroke-width="1.2"/>` +
      `<text x="${X(i)}" y="${Y(i) - 2}" font-size="12.5" font-weight="700" text-anchor="middle" style="fill:var(--ink)">${esc(P.ids[i])}</text>` +
      `<text x="${X(i)}" y="${Y(i) + 12}" font-size="10.5" text-anchor="middle" style="fill:var(--ink)">${fmt(P.time[i])}</text></g>`;
  }
  if (so) {
    let lx = 20; const ly = 14;
    o.stations.forEach((s, k) => { g += `<rect x="${lx}" y="${ly - 9}" width="11" height="11" rx="2" fill="${stColor(k)}"/><text x="${lx + 15}" y="${ly}" font-size="11">E${k + 1}</text>`; lx += 46; });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + 10}" width="${W}" role="img" aria-label="Diagrama de precedencias">${g}</svg>`;
}
function renderDiagrams() {
  if (!R) { $('#precChart').innerHTML = '<div class="empty">Balancea la línea para ver el diagrama coloreado por estación.</div>'; return; }
  const o = R.out.find(x => x.key === selKey) || R.best;
  $('#precTitle').textContent = `Precedencias – ${o.name}`;
  $('#precChips').innerHTML = R.out.map(x => `<button class="chip" type="button" data-k="${x.key}" aria-pressed="${x.key === o.key}">${esc(x.name.replace('COMSOAL ', 'C. ').replace(' (PL entera)', ''))}</button>`).join('');
  $$('#precChips .chip').forEach(b => b.onclick = () => { selKey = b.dataset.k; renderResults(); });
  $('#precChart').innerHTML = precSVG(o);
  $('#loadChart2').innerHTML = loadSVG(o, 900, 340);
}

// ---------------- modelo LP ----------------
function renderLP() {
  const K = R.best.m.n;
  const txt = Core.lpModel(R.P, +R.C.toFixed(6), K);
  const nPrec = R.P.preds.reduce((s, p) => s + p.length, 0);
  $('#lpInfo').innerHTML = `Con K = ${K}: <b>${R.P.n * K + K}</b> variables binarias y <b>${R.P.n + K + nPrec + K - 1}</b> restricciones. El archivo .lp se abre en LINGO, CPLEX, Gurobi, GLPK o HiGHS.`;
  $('#lpText').textContent = txt.length > 6000 ? txt.slice(0, 6000) + '\n…' : txt;
  $('#btnLP').onclick = () => download('modelo_balanceo.lp', txt);
}

// ---------------- Excel ----------------
function sheet(aoa, widths) { const ws = XLSX.utils.aoa_to_sheet(aoa); if (widths) ws['!cols'] = widths.map(w => ({ wch: w })); return ws; }
function exportExcel() {
  if (typeof XLSX === 'undefined') { toast('No se pudo cargar la librería de Excel. Revisa tu conexión.'); return; }
  const wb = XLSX.utils.book_new(), u = S.unidad;
  const T = tasksForCore();
  const c = computeC();
  const resumen = [['BALANCEO DE LÍNEAS – COMSOAL'], [], ['Producto', S.producto], ['Fecha', new Date().toLocaleString('es-EC')], ['Unidad de tiempo', u],
    ['Modo de tiempo de ciclo', { dado: 'Dado', demanda: 'Por demanda', estaciones: 'Por estaciones' }[S.cmode]],
    ['Tiempo disponible por día', c.TD ? +c.TD.toFixed(3) : ''], ['Demanda por día', S.cmode === 'demanda' ? num(S.demanda) : ''],
    ['Tiempo de ciclo C', c.C > 0 ? +c.C.toFixed(4) : ''], ['Suma de tiempos Σt', T.reduce((s, t) => s + (t.time || 0), 0)],
    ['Estaciones mínimas teóricas', c.C > 0 ? Math.ceil(T.reduce((s, t) => s + (t.time || 0), 0) / c.C - 1e-9) : '']];
  if (R) {
    const b = R.best;
    resumen.push([], ['RESULTADO'], ['Método recomendado', b.name], ['Estaciones', b.m.n], ['Eficiencia (%)', +b.m.E.toFixed(2)], ['Retraso de balance (%)', +b.m.RB.toFixed(2)],
      ['Tiempo muerto por ciclo', +b.m.TM.toFixed(3)], ['Índice de suavidad', +b.m.SI.toFixed(3)], ['Capacidad (u/h)', +((3600 / UNIT_S[u]) / R.C).toFixed(2)],
      ['Capacidad diaria (u)', b.m.cap ? +b.m.cap.toFixed(1) : ''], ['Tasa R (u por ' + u + ')', +b.m.R.toFixed(5)], ['Tiempo de flujo T = n·C', +b.m.T.toFixed(3)], ['Inventario en proceso I = R×T', +b.m.I.toFixed(2)]);
    const ex = R.out.find(o => o.kind === 'Exacto');
    if (ex) resumen.push(['Óptimo exacto', ex.optimal ? `${ex.m.n} estaciones (demostrado)` : `${ex.m.n} estaciones (tiempo límite)`]);
    if (stale) resumen.push([], ['Aviso', 'Los datos cambiaron después del último cálculo. Pulsa Recalcular para actualizar los resultados.']);
  }
  XLSX.utils.book_append_sheet(wb, sheet(resumen, [34, 46]), 'Resumen');
  const pwMap = {}; if (R) R.P.ids.forEach((id, i) => { pwMap[id] = R.P.pw[i]; });
  XLSX.utils.book_append_sheet(wb, sheet([['Tarea', 'Descripción', `Tiempo (${u})`, 'Predecesoras', 'Peso posicional']].concat(T.map(t => [t.id, t.desc, t.time, t.preds.join(', '), pwMap[t.id] ?? ''])), [8, 36, 12, 16, 16]), 'Tareas');
  if (R) {
    XLSX.utils.book_append_sheet(wb, sheet([['Método', 'Tipo', 'Estaciones', 'Eficiencia (%)', 'Retraso (%)', 'Tiempo muerto', 'Índice de suavidad', 'Iteraciones óptimas (%)', 'Promedio n', 'Tiempo de cálculo (ms)', 'Recomendado']]
      .concat(R.out.map(o => [o.name, o.kind, o.m.n, +o.m.E.toFixed(2), +o.m.RB.toFixed(2), +o.m.TM.toFixed(3), +o.m.SI.toFixed(3), o.kind === 'COMSOAL' ? +o.pctOpt.toFixed(1) : '', o.kind === 'COMSOAL' ? +o.avgN.toFixed(3) : '', +o.ms.toFixed(1), o === R.best ? 'Sí' : ''])), [32, 12, 11, 13, 11, 13, 17, 21, 11, 20, 12]), 'Comparación');
    const used = new Set();
    R.out.forEach(o => {
      const rows = [[o.name], [], ['Estación', 'Tareas', 'Descripción', `Tiempo (${u})`, `Ocio (${u})`, 'Utilización (%)']];
      o.stations.forEach((s, k) => { const t = Core.sum(s.map(i => R.P.time[i])); rows.push([k + 1, s.map(i => R.P.ids[i]).join(', '), s.map(i => R.P.T[i].desc).filter(Boolean).join('; '), t, +(R.C - t).toFixed(3), +(100 * t / R.C).toFixed(1)]); });
      rows.push([], ['Estaciones', o.m.n], ['Eficiencia (%)', +o.m.E.toFixed(2)], ['Tiempo muerto', +o.m.TM.toFixed(3)], ['Índice de suavidad', +o.m.SI.toFixed(3)]);
      let nm = o.name.replace('COMSOAL', 'C').replace(/[\\/?*\[\]:]/g, '').replace(/\s+/g, ' ').slice(0, 28);
      while (used.has(nm)) nm = nm.slice(0, 26) + '_' + used.size; used.add(nm);
      XLSX.utils.book_append_sheet(wb, sheet(rows, [10, 22, 60, 12, 10, 14]), nm);
    });
    XLSX.utils.book_append_sheet(wb, sheet(Core.lpModel(R.P, +R.C.toFixed(6), R.best.m.n).split('\n').map(l => [l]), [120]), 'Modelo PLE');
  }
  if (S.bom.length) XLSX.utils.book_append_sheet(wb, sheet([['Código', 'Descripción', 'Cantidad', 'Unidad', 'Pertenece a', 'Se usa en tarea']].concat(S.bom.map(b => [b.c, b.d, num(b.q), b.u, b.p || '', b.t || ''])), [10, 46, 10, 10, 18, 14]), 'Lista de materiales');
  {
    const { rows } = cursoSequence();
    if (rows.length) {
      const nm = Object.fromEntries(CTYPES.map(c => [c.k, c.name]));
      const { s, unset } = cursoSummary(rows);
      const aoa = [['CURSOGRAMA ANALÍTICO'], ['Objeto', S.curso.meta.objeto || S.producto], ['Método', S.curso.meta.metodo], ['Diagrama del', S.curso.meta.diagrama], ['Lugar', S.curso.meta.lugar], ['Elaborado por', S.curso.meta.elaboro], [],
        ['N.º', 'Descripción de la actividad', 'Cantidad', 'Distancia (m)', 'Tipo de actividad', `Tiempo (${u})`, 'Observaciones', 'Responsable', 'Mejora propuesta']]
        .concat(rows.map((r, i) => [i + 1, r.desc, r.cant, isFinite(r.dist) ? r.dist : '', nm[r.tipo] || 'Sin clasificar', isFinite(r.time) ? r.time : '', r.obs, r.resp, r.mejora]));
      aoa.push([], ['RESUMEN'], ['Actividad', 'Cantidad', `Tiempo (${u})`, 'Distancia (m)']);
      CTYPES.forEach(c => aoa.push([c.name, s[c.k].n, s[c.k].t, s[c.k].d]));
      aoa.push(['Total', CTYPES.reduce((x, c) => x + s[c.k].n, 0), CTYPES.reduce((x, c) => x + s[c.k].t, 0), CTYPES.reduce((x, c) => x + s[c.k].d, 0)]);
      if (unset) aoa.push(['Sin clasificar', unset]);
      XLSX.utils.book_append_sheet(wb, sheet(aoa, [8, 44, 16, 20, 12, 14]), 'Cursograma');
    }
  }
  const name = (S.producto || 'balanceo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40);
  download(`Balanceo_${name}.xlsx`, xlsxBlob(wb));
}
function exportTemplate() {
  if (typeof XLSX === 'undefined') { toast('No se pudo cargar la librería de Excel.'); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet([['Tarea', 'Descripción', 'Tiempo', 'Predecesoras'], [1, 'Primera operación', 10, ''], [2, 'Segunda operación', 8, '1'], [3, 'Tercera operación', 12, '1, 2']], [8, 36, 10, 16]), 'Tareas');
  download('Plantilla_balanceo.xlsx', xlsxBlob(wb));
}
function importFile(file) {
  if (typeof XLSX === 'undefined') { toast('No se pudo cargar la librería de Excel.'); return; }
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const wb = XLSX.read(new Uint8Array(rd.result), { type: 'array' });
      const name = wb.SheetNames.find(n => /tarea/i.test(n)) || wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
      const hi = rows.findIndex(r => r.some(c => /tarea|id|operaci/i.test(String(c))) && r.some(c => /tiempo|time|dur/i.test(String(c))));
      if (hi < 0) throw new Error('No encontré las columnas Tarea y Tiempo. Usa la plantilla.');
      const H = rows[hi].map(c => String(c).toLowerCase());
      const col = re => H.findIndex(h => re.test(h));
      const ci = col(/tarea|^id|operaci/), cd = col(/desc|nombre/), ct = col(/tiempo|time|dur/), cp = col(/pred|prec/);
      const T = rows.slice(hi + 1).filter(r => String(r[ci]).trim() !== '').map(r => ({ id: String(r[ci]).trim(), desc: cd >= 0 ? String(r[cd]) : '', time: String(r[ct]).replace(',', '.'), preds: cp >= 0 ? String(r[cp]) : '' }));
      if (!T.length) throw new Error('La hoja no tiene filas de tareas.');
      S.tasks = T; save(); renderTasks(); markStale(); go('datos'); toast(`${T.length} tareas importadas de "${name}"`);
    } catch (e) { toast('No se pudo importar: ' + e.message); }
  };
  rd.readAsArrayBuffer(file);
}

// ---------------- Excel con formato (ExcelJS) ----------------
const XC = { navy: 'FF0E2440', navy2: 'FF163256', orange: 'FFEA580C', orangeSoft: 'FFFFEDE3', head: 'FFE7EDF4', line: 'FFD6DEE8', muted: 'FF5B6B80', white: 'FFFFFFFF', stripe: 'FFF3F6F9', ok: 'FF157F3D', okSoft: 'FFE1F3E7', warnSoft: 'FFFDF0DA' };
const ST_HEX = ['FFF2A285', 'FF8EB6E3', 'FF9FD19A', 'FFC7AEE0', 'FFF6CB7C', 'FF86D2C7', 'FFD8BC9C', 'FFEBA5C6', 'FFBCC784', 'FFA7ACE0'];
const fillOf = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin', color: { argb: XC.line } };
const boxB = { top: thin, left: thin, bottom: thin, right: thin };

/** Encabezado institucional común a todas las hojas. Devuelve la fila siguiente libre. */
function xHeader(ws, title, ncols) {
  const P = S.proyecto || {};
  ws.mergeCells(1, 1, 1, ncols); ws.mergeCells(2, 1, 2, ncols); ws.mergeCells(3, 1, 3, ncols);
  const a = ws.getCell(1, 1); a.value = P.institucion || ''; a.font = { bold: true, size: 13, color: { argb: XC.white } };
  const b = ws.getCell(2, 1); b.value = [P.facultad, P.carrera, P.asignatura].filter(Boolean).join(' · '); b.font = { size: 10, color: { argb: 'FFC9D5E4' } };
  const c = ws.getCell(3, 1); c.value = title; c.font = { bold: true, size: 12, color: { argb: XC.orange } };
  for (let r = 1; r <= 3; r++) for (let k = 1; k <= ncols; k++) ws.getCell(r, k).fill = fillOf(XC.navy);
  ws.getRow(1).height = 22; ws.getRow(3).height = 20;
  [a, b, c].forEach(x => { x.alignment = { vertical: 'middle', indent: 1 }; });
  return 5;
}
function xTable(ws, name, row, cols, rows, opts = {}) {
  ws.addTable({ name, ref: ws.getCell(row, 1).address, headerRow: true, totalsRow: false,
    style: { theme: opts.theme || 'TableStyleMedium2', showRowStripes: true },
    columns: cols.map(c => ({ name: c.h, filterButton: opts.filter !== false })), rows: rows.length ? rows : [cols.map(() => null)] });
  const hr = ws.getRow(row);
  cols.forEach((c, k) => {
    const cell = hr.getCell(k + 1);
    cell.fill = fillOf(XC.navy); cell.font = { bold: true, color: { argb: XC.white } };
    cell.alignment = { vertical: 'middle', horizontal: c.num ? 'right' : 'left', wrapText: true };
    if (c.fmt) for (let r = row + 1; r <= row + rows.length; r++) ws.getCell(r, k + 1).numFmt = c.fmt;
    if (c.w) ws.getColumn(k + 1).width = c.w;
  });
  hr.height = 30;
  return row + rows.length + 1;
}
function xKV(ws, row, pairs, col = 1) {
  pairs.forEach(([k, v, fmt, hl]) => {
    const a = ws.getCell(row, col), b = ws.getCell(row, col + 1);
    a.value = k; b.value = (v === undefined || v === null) ? '' : v;
    a.fill = fillOf(XC.head); a.font = { bold: true, color: { argb: 'FF142235' } };
    a.border = boxB; b.border = boxB;
    if (fmt) b.numFmt = fmt;
    if (typeof v === 'number') b.alignment = { horizontal: 'right' };
    if (hl) { b.fill = fillOf(XC.orangeSoft); b.font = { bold: true, color: { argb: XC.orange } }; }
    row++;
  });
  return row;
}
function xSection(ws, row, text, ncols) {
  ws.mergeCells(row, 1, row, ncols);
  const c = ws.getCell(row, 1); c.value = text; c.font = { bold: true, size: 11, color: { argb: XC.navy } };
  c.border = { bottom: { style: 'medium', color: { argb: XC.orange } } };
  return row + 1;
}
const safeName = (s, used) => { let n = s.replace(/[\\/?*\[\]:]/g, '').replace(/\s+/g, ' ').slice(0, 28); while (used.has(n)) n = n.slice(0, 25) + '_' + used.size; used.add(n); return n; };
const tblName = (s, i) => ('T_' + s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '_') + '_' + i).slice(0, 60);

async function exportExcelPro() {
  const wb = new ExcelJS.Workbook();
  wb.creator = (S.proyecto && S.proyecto.autor) || 'Balanceo COMSOAL'; wb.created = new Date();
  const u = S.unidad, T = tasksForCore(), c = computeC(), P = S.proyecto || {};
  const sumT = T.reduce((s, t) => s + (t.time || 0), 0);
  const F2 = '#,##0.00', F3 = '#,##0.000', FP = '0.00" %"', F0 = '#,##0';

  // ---------- Resumen ----------
  const ws = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  ws.getColumn(1).width = 36; ws.getColumn(2).width = 52;
  let r = xHeader(ws, 'Balanceo de líneas – COMSOAL', 2);
  r = xSection(ws, r, 'Proyecto', 2);
  r = xKV(ws, r, [['Producto o proceso', S.producto], ['Autor', P.autor], ['Docente', P.docente], ['Período académico', P.periodo], ['Fecha de exportación', new Date().toLocaleString('es-EC')]]);
  r = xSection(ws, r + 1, 'Parámetros', 2);
  r = xKV(ws, r, [['Unidad de tiempo', u], ['Tiempo de ciclo obtenido', { dado: 'Dado', demanda: 'Por demanda', estaciones: 'Por número de estaciones' }[S.cmode]],
    ['Tiempo disponible por día (' + u + ')', c.TD ? +c.TD.toFixed(3) : '', F2], ['Demanda por día (u)', S.cmode === 'demanda' ? num(S.demanda) : '', F0],
    ['Tiempo de ciclo C (' + u + ')', c.C > 0 ? +c.C.toFixed(4) : '', F3, true], ['Suma de tiempos Σt (' + u + ')', sumT, F2],
    ['Estaciones mínimas teóricas', c.C > 0 ? Math.ceil(sumT / c.C - 1e-9) : '', F0]]);
  if (R) {
    const b = R.best, ex = R.out.find(o => o.kind === 'Exacto');
    r = xSection(ws, r + 1, 'Resultado', 2);
    r = xKV(ws, r, [['Método recomendado', b.name, null, true], ['Estaciones', b.m.n, F0, true], ['Eficiencia', +b.m.E.toFixed(2), FP], ['Retraso de balance', +b.m.RB.toFixed(2), FP],
      ['Tiempo muerto por ciclo (' + u + ')', +b.m.TM.toFixed(3), F2], ['Índice de suavidad', +b.m.SI.toFixed(3), F3], ['Capacidad (u/h)', +((3600 / UNIT_S[u]) / R.C).toFixed(2), F2],
      ['Capacidad diaria (u)', b.m.cap ? +b.m.cap.toFixed(1) : '', '#,##0.0'], ['Tasa R (u/' + u + ')', +b.m.R.toFixed(5), '0.00000'], ['Tiempo de flujo T = n·C (' + u + ')', +b.m.T.toFixed(3), F2],
      ['Inventario en proceso I = R × T (u)', +b.m.I.toFixed(2), F2], ['Óptimo exacto', ex ? (ex.optimal ? `${ex.m.n} estaciones (demostrado)` : `${ex.m.n} estaciones (tiempo límite)`) : 'No calculado']]);
    if (stale) { r = xKV(ws, r + 1, [['Aviso', 'Los datos cambiaron después del último cálculo. Pulsa Recalcular en la app.']]); }
  }

  // ---------- Tareas ----------
  const pwMap = {}; if (R) R.P.ids.forEach((id, i) => { pwMap[id] = R.P.pw[i]; });
  const wt = wb.addWorksheet('Tareas', { views: [{ state: 'frozen', ySplit: 5, showGridLines: false }] });
  xHeader(wt, 'Tareas de la línea', 5);
  xTable(wt, 'Tareas', 5, [{ h: 'Tarea', w: 9 }, { h: 'Descripción', w: 40 }, { h: `Tiempo (${u})`, w: 13, num: true }, { h: 'Predecesoras', w: 16 }, { h: 'Peso posicional', w: 16, num: true }],
    T.map(t => [t.id, t.desc, isFinite(t.time) ? t.time : null, t.preds.join(', '), pwMap[t.id] ?? null]));

  if (R) {
    // ---------- Comparación ----------
    const wc = wb.addWorksheet('Comparación', { views: [{ state: 'frozen', ySplit: 5, showGridLines: false }] });
    xHeader(wc, 'Comparación de métodos', 10);
    const rowsC = R.sorted.map(o => [o.name, o.kind, o.m.n, +o.m.E.toFixed(2), +o.m.TM.toFixed(3), +o.m.SI.toFixed(3), o.kind === 'COMSOAL' ? +o.pctOpt.toFixed(1) : null, o.kind === 'COMSOAL' ? +o.avgN.toFixed(3) : null, +o.ms.toFixed(1), o === R.best ? 'Recomendado' : (R.nOpt !== null && o.m.n === R.nOpt ? 'Óptimo' : (o.m.n > (R.nOpt ?? R.best.m.n) ? `+${o.m.n - (R.nOpt ?? R.best.m.n)} estación` : ''))]);
    const end = xTable(wc, 'Comparacion', 5, [{ h: 'Método', w: 30 }, { h: 'Tipo', w: 12 }, { h: 'Estaciones', w: 11, num: true, fmt: F0 }, { h: 'Eficiencia (%)', w: 13, num: true, fmt: '0.00' },
      { h: `Tiempo muerto (${u})`, w: 15, num: true, fmt: F2 }, { h: 'Índice de suavidad', w: 15, num: true, fmt: F3 }, { h: 'Iter. óptimas (%)', w: 15, num: true, fmt: '0.0' },
      { h: 'Promedio n', w: 11, num: true, fmt: F3 }, { h: 'Cálculo (ms)', w: 12, num: true, fmt: '0.0' }, { h: 'Estado', w: 14 }], rowsC);
    rowsC.forEach((row, i) => {
      const rr = wc.getRow(6 + i);
      if (row[9] === 'Recomendado') for (let k = 1; k <= 10; k++) { const cell = rr.getCell(k); cell.fill = fillOf(XC.orangeSoft); cell.font = { bold: true, color: { argb: k === 10 ? XC.orange : 'FF142235' } }; }
      else if (row[9] === 'Óptimo') rr.getCell(10).font = { color: { argb: XC.ok }, bold: true };
      else if (row[9]) rr.getCell(10).font = { color: { argb: 'FFA35A00' }, bold: true };
    });
    wc.addConditionalFormatting({ ref: `G6:G${end - 1}`, rules: [{ type: 'dataBar', priority: 1, cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 100 }], color: { argb: XC.orange }, gradient: false }] });
    const note = wc.getCell(end + 1, 1); note.value = 'Criterio: menos estaciones → menor índice de suavidad → mayor facilidad para llegar al resultado.'; note.font = { italic: true, color: { argb: XC.muted } };

    // ---------- una hoja por método ----------
    const used = new Set(['Resumen', 'Tareas', 'Comparación']);
    R.sorted.forEach((o, mi) => {
      const wm = wb.addWorksheet(safeName(o.name.replace('COMSOAL', 'C'), used), { views: [{ state: 'frozen', ySplit: 5, showGridLines: false }] });
      xHeader(wm, `Asignación por estación – ${o.name}`, 6);
      const rows = o.stations.map((s, k) => { const t = Core.sum(s.map(i => R.P.time[i])); return [k + 1, s.map(i => R.P.ids[i]).join(', '), s.map(i => R.P.T[i].desc).filter(Boolean).join('; '), t, +(R.C - t).toFixed(3), +(t / R.C).toFixed(4)]; });
      const e = xTable(wm, tblName(o.name, mi), 5, [{ h: 'Estación', w: 10, num: true }, { h: 'Tareas', w: 20 }, { h: 'Descripción', w: 58 }, { h: `Tiempo (${u})`, w: 13, num: true, fmt: F2 }, { h: `Ocio (${u})`, w: 11, num: true, fmt: F2 }, { h: 'Utilización', w: 12, num: true, fmt: '0.0%' }], rows, { filter: false });
      rows.forEach((_, k) => { const cell = wm.getCell(6 + k, 1); cell.fill = fillOf(ST_HEX[k % 10]); cell.font = { bold: true }; cell.alignment = { horizontal: 'center' }; wm.getCell(6 + k, 3).alignment = { wrapText: true, vertical: 'top' }; });
      wm.addConditionalFormatting({ ref: `F6:F${e - 1}`, rules: [{ type: 'dataBar', priority: 1, cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }], color: { argb: 'FF8EB6E3' }, gradient: false }] });
      xKV(wm, e + 1, [['Estaciones', o.m.n, F0, true], ['Eficiencia', +o.m.E.toFixed(2), FP], [`Tiempo muerto (${u})`, +o.m.TM.toFixed(3), F2], ['Índice de suavidad', +o.m.SI.toFixed(3), F3]], 3);
    });

    // ---------- Modelo PLE ----------
    const wl = wb.addWorksheet('Modelo PLE', { views: [{ showGridLines: false }] });
    xHeader(wl, 'Modelo de programación lineal entera (formato .lp)', 1);
    wl.getColumn(1).width = 130;
    Core.lpModel(R.P, +R.C.toFixed(6), R.best.m.n).split('\n').forEach((line, i) => { const cell = wl.getCell(5 + i, 1); cell.value = line; cell.font = { name: 'Consolas', size: 9, color: { argb: /^(Minimize|Subject To|Binary|End)/.test(line) ? XC.orange : 'FF142235' }, bold: /^(Minimize|Subject To|Binary|End)/.test(line) }; });
  }

  // ---------- Lista de materiales ----------
  if (S.bom.length) {
    const wbm = wb.addWorksheet('Lista de materiales', { views: [{ state: 'frozen', ySplit: 5, showGridLines: false }] });
    xHeader(wbm, `Lista de materiales – ${S.producto || ''}`, 6);
    xTable(wbm, 'ListaMateriales', 5, [{ h: 'Código', w: 10 }, { h: 'Descripción', w: 48 }, { h: 'Cantidad', w: 11, num: true }, { h: 'Unidad', w: 10 }, { h: 'Pertenece a', w: 20 }, { h: 'Se usa en tarea', w: 15 }], S.bom.map(b => [b.c, b.d, isFinite(num(b.q)) ? num(b.q) : null, b.u, b.p || '', b.t || '']));
  }

  // ---------- Cursograma (formato de la plantilla) ----------
  const { rows: cr } = cursoSequence();
  if (cr.length) {
    const nm = Object.fromEntries(CTYPES.map(x => [x.k, x.name]));
    const glyph = { O: '○', T: '⇨', I: '□', D: 'D', A: '▽' };
    const cfill = { O: 'FFF6CB7C', T: 'FF8EB6E3', I: 'FF9FD19A', D: 'FFF2A285', A: 'FFC9D1DC' };
    const M = S.curso.meta;
    const wcu = wb.addWorksheet('Cursograma', { views: [{ state: 'frozen', ySplit: 22, showGridLines: false }] });
    [6, 42, 10, 12, 16, 9, 12, 30, 18, 30].forEach((w, k) => { wcu.getColumn(k + 1).width = w; });
    xHeader(wcu, 'Cursograma analítico – división del trabajo', 10);
    wcu.mergeCells('A5:J5'); const t5 = wcu.getCell('A5'); t5.value = 'CURSOGRAMA ANALÍTICO / DIAGRAMA DE FLUJO DE PROCESO'; t5.font = { bold: true, size: 12, color: { argb: XC.navy } }; t5.alignment = { horizontal: 'center' };
    const chk = (opts, v) => opts.map(o => `${o === v ? '☒' : '☐'} ${o}`).join('   ');
    const fechaTxt = M.fecha ? new Date(M.fecha + 'T12:00').toLocaleDateString('es-EC') : '';
    const grid = [
      [['Objeto y nivel del análisis', M.objeto || S.producto], ['Tipo', chk(['Operario', 'Material', 'Equipo'], M.diagrama)], ['Hoja núm.', `${M.hoja || ''} de ${M.hojaDe || ''}`]],
      [['Proceso analizado', M.proceso], ['Método', chk(['Actual', 'Propuesto'], M.metodo)], ['Producto / código', M.producto]],
      [['Localización', M.lugar], ['Operador(es)', M.operadores], ['Elaborado por', `${M.elaboro || ''}${fechaTxt ? '   ·   Fecha: ' + fechaTxt : ''}`]],
      [['Aprobó', M.aprobo], ['Comentarios', M.comentarios], ['Revisión', M.revision]]];
    const spans = [['A', 'C'], ['D', 'G'], ['H', 'J']];
    grid.forEach((row, i) => {
      const r = 6 + i; wcu.getRow(r).height = 30;
      row.forEach(([lab, val], j) => {
        wcu.mergeCells(`${spans[j][0]}${r}:${spans[j][1]}${r}`);
        const cell = wcu.getCell(`${spans[j][0]}${r}`);
        cell.value = { richText: [{ text: lab + ':  ', font: { bold: true, size: 9, color: { argb: XC.muted } } }, { text: String(val || ''), font: { size: 10, color: { argb: 'FF142235' } } }] };
        cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
        for (let c = spans[j][0].charCodeAt(0); c <= spans[j][1].charCodeAt(0); c++) wcu.getCell(String.fromCharCode(c) + r).border = boxB;
      });
    });
    // resumen de actividades con fórmulas (se actualiza si se editan las filas en Excel)
    const first = 23, last = 22 + cr.length;
    wcu.mergeCells('B11:E11'); const rs = wcu.getCell('B11'); rs.value = 'RESUMEN DE ACTIVIDADES'; rs.font = { bold: true, color: { argb: XC.navy } }; rs.border = { bottom: { style: 'medium', color: { argb: XC.orange } } };
    ['Actividad', 'Actual', 'Propuesto', 'Economía'].forEach((h, k) => { const c = wcu.getCell(12, 2 + k); c.value = h; c.fill = fillOf(XC.navy); c.font = { bold: true, color: { argb: XC.white } }; c.alignment = { horizontal: k ? 'right' : 'left' }; });
    const { s: cs } = cursoSummary(cr);
    let dT = 0, tT = 0; CTYPES.forEach(x => { dT += cs[x.k].d; tT += cs[x.k].t; });
    const sumDefs = SUM_ORDER.map(k => ({ k, label: nm[k], f: `COUNTIF(E${first}:E${last},"${nm[k]}")`, v: cs[k].n, fmt: F0 }))
      .concat([{ label: 'Distancia (m)', f: `SUM(D${first}:D${last})`, v: dT, fmt: F2, key: 'dist' }, { label: `Tiempo total (${u})`, f: `SUM(G${first}:G${last})`, v: tT, fmt: F2, key: 'time', tot: true }]);
    sumDefs.forEach((d, i) => {
      const r = 13 + i, pv = num(S.curso.prop[d.k || d.key]);
      if (d.k) { const g = wcu.getCell(r, 1); g.value = glyph[d.k]; g.alignment = { horizontal: 'center' }; g.font = { bold: true }; g.fill = fillOf(cfill[d.k]); }
      const L = wcu.getCell(r, 2); L.value = d.label; L.fill = fillOf(XC.head); L.font = { bold: true };
      const A = wcu.getCell(r, 3); A.value = { formula: d.f, result: d.v }; A.numFmt = d.fmt;
      const Pc = wcu.getCell(r, 4); if (isFinite(pv)) Pc.value = pv; Pc.numFmt = d.fmt; Pc.fill = fillOf('FFFFFBEA');
      const E = wcu.getCell(r, 5); E.value = { formula: `IF(D${r}="","",C${r}-D${r})`, result: isFinite(pv) ? d.v - pv : '' }; E.numFmt = d.fmt;
      for (let c = 2; c <= 5; c++) { const cc = wcu.getCell(r, c); cc.border = boxB; if (d.tot) { cc.font = { bold: true, color: { argb: c === 2 ? 'FF142235' : XC.orange } }; } }
    });
    const nt = wcu.getCell('G13'); nt.value = 'Escribe en "Propuesto" los valores del método mejorado; la economía se calcula sola.'; nt.font = { italic: true, size: 9, color: { argb: XC.muted } };
    xTable(wcu, 'Cursograma', 22, [{ h: 'N.º', num: true }, { h: 'Descripción de la actividad' }, { h: 'Cantidad', num: true }, { h: 'Distancia (m)', num: true, fmt: F2 }, { h: 'Tipo de actividad' },
      { h: 'Símbolo' }, { h: `Tiempo (${u})`, num: true, fmt: F2 }, { h: 'Observaciones' }, { h: 'Responsable' }, { h: 'Mejora propuesta' }],
      cr.map((x, i) => [i + 1, x.desc, isFinite(num(x.cant)) ? num(x.cant) : (x.cant || null), isFinite(x.dist) ? x.dist : null, nm[x.tipo] || 'Sin clasificar', glyph[x.tipo] || '?', isFinite(x.time) ? x.time : null, x.obs || null, x.resp || null, x.mejora || null]));
    cr.forEach((x, i) => { const r = first + i; const g = wcu.getCell(r, 6); g.alignment = { horizontal: 'center' }; g.font = { bold: true, size: 13 }; g.fill = fillOf(cfill[x.tipo] || XC.warnSoft); [2, 8, 10].forEach(c => { wcu.getCell(r, c).alignment = { wrapText: true, vertical: 'top' }; }); });
    // lista desplegable de tipos para seguir editando en Excel
    for (let r = first; r <= last; r++) wcu.getCell(r, 5).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${SUM_ORDER.map(k => nm[k]).join(',')}"`] };
  }

  wb.eachSheet(sh => { sh.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }; });
  const buf = await wb.xlsx.writeBuffer();
  const name = (S.producto || 'balanceo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40);
  await download(`Balanceo_${name}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

// ---------------- datos del proyecto (institución, autor…) ----------------
const PROY_FIELDS = [['institucion', 'Institución'], ['facultad', 'Facultad'], ['carrera', 'Carrera'], ['asignatura', 'Asignatura'], ['autor', 'Autor(a)'], ['docente', 'Docente'], ['periodo', 'Período académico']];
function defaultProyecto() { return { institucion: 'Escuela Politécnica Nacional', facultad: 'Facultad de Ciencias Administrativas', carrera: 'Ingeniería de la Producción', asignatura: 'Diseño de Sistemas de Producción', autor: 'Valentina Santiana', docente: '', periodo: '2026-B' }; }
function ensureProyecto() { if (!S.proyecto || typeof S.proyecto !== 'object') S.proyecto = defaultProyecto(); PROY_FIELDS.forEach(([k]) => { if (S.proyecto[k] === undefined) S.proyecto[k] = ''; }); }
function renderProyecto() {
  ensureProyecto(); const P = S.proyecto;

  $('#printInst').textContent = [P.institucion, P.facultad, P.carrera].filter(Boolean).join(' · ');
  $('#printSub').textContent = [P.asignatura, 'Cursograma analítico', P.autor, P.periodo].filter(Boolean).join(' · ');
  $('#printInst2').textContent = $('#printInst').textContent;
  $('#printSub2').textContent = [P.asignatura, 'Estructura del producto y gráfica de ensamble', S.producto, P.autor, P.periodo].filter(Boolean).join(' · ');
}
function bindProyecto() {
  ensureProyecto();
  $('#proyFields').innerHTML = PROY_FIELDS.map(([k, l]) => `<div class="field"><label for="proy-${k}">${l}</label><input id="proy-${k}" data-pk="${k}" type="text" value="${esc(S.proyecto[k])}"></div>`).join('');
  $('#proyFields').addEventListener('input', e => { const k = e.target.dataset.pk; if (!k) return; S.proyecto[k] = e.target.value; save(); renderProyecto(); });
  $('#proyReset').onclick = () => { S.proyecto = defaultProyecto(); save(); syncProyecto(); };
}
function syncProyecto() { ensureProyecto(); PROY_FIELDS.forEach(([k]) => { const el = $('#proy-' + k); if (el) el.value = S.proyecto[k] || ''; }); renderProyecto(); }

// ---------------- lista de materiales ----------------
function taskSelect(val, i) {
  const T = tasksForCore().filter(t => t.id);
  const cur = matchTask(val, T.map(t => t.id)) || String(val || '').trim();
  let o = `<option value="">—</option>` + T.map(t => `<option value="${esc(t.id)}"${t.id === cur ? ' selected' : ''}>T${esc(t.id)}${t.desc ? ' · ' + esc(t.desc.length > 22 ? t.desc.slice(0, 21) + '…' : t.desc) : ''}</option>`).join('');
  if (cur && !T.some(t => t.id === cur)) o += `<option value="${esc(cur)}" selected>${esc(cur)} (no existe)</option>`;
  return `<select data-f="t" aria-label="Se usa en tarea">${o}</select>`;
}
function renderBom() {
  $('#bomTable tbody').innerHTML = S.bom.map((b, i) => `<tr data-i="${i}"><td><input class="id" data-f="c" value="${esc(b.c)}" aria-label="Código"></td><td><input data-f="d" value="${esc(b.d)}" aria-label="Descripción"></td><td><input class="t" data-f="q" value="${esc(b.q)}" style="text-align:right" aria-label="Cantidad"></td><td><input data-f="u" value="${esc(b.u)}" aria-label="Unidad"></td><td><input class="p" data-f="p" value="${esc(b.p || '')}" placeholder="(producto)" aria-label="Pertenece a"></td><td>${taskSelect(b.t, i)}</td><td><button class="btn ghost" data-del="${i}" aria-label="Eliminar material">×</button></td></tr>`).join('') ||
    `<tr><td colspan="7" class="muted" style="padding:12px">Sin materiales. Agrega los componentes del producto.</td></tr>`;
  renderProdViz();
}
function bindBom() {
  const tb = $('#bomTable tbody');
  tb.addEventListener('input', e => { const f = e.target.dataset.f; if (!f) return; S.bom[+e.target.closest('tr').dataset.i][f] = e.target.value; save(); clearTimeout(bindBom._t); bindBom._t = setTimeout(renderProdViz, 250); });
  tb.addEventListener('change', e => { if (e.target.tagName !== 'SELECT') return; S.bom[+e.target.closest('tr').dataset.i][e.target.dataset.f] = e.target.value; save(); renderProdViz(); });
  tb.addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (!d) return; S.bom.splice(+d.dataset.del, 1); save(); renderBom(); });
  $('#addBom').onclick = () => { S.bom.push({ c: '', d: '', q: '1', u: 'u', p: '', t: '' }); save(); renderBom(); };
}

// ---------------- estructura del producto y gráfica de ensamble ----------------
const splitCodes = s => String(s || '').split(/[,;]+/).map(x => x.trim()).filter(Boolean);
const normId = s => String(s || '').toUpperCase().replace(/[\s\-_.]/g, '');
/** Devuelve el id real de la tarea a partir de lo escrito ("5", "T5", "ta", "T-A"...). */
function matchTask(x, ids) {
  const n = normId(x); if (!n) return null;
  for (const id of ids) { const m = normId(id); if (m === n || 'T' + m === n || m === 'T' + n) return id; }
  return null;
}
function bomItems() {
  const ids = tasksForCore().map(t => t.id);
  return S.bom.filter(b => String(b.c || '').trim() || String(b.d || '').trim()).map(b => ({ c: String(b.c || '').trim(), d: b.d || '', q: b.q, u: b.u || '', p: splitCodes(b.p), t: splitCodes(b.t).map(x => matchTask(x, ids) || x) }));
}

/** Árbol de estructura del producto (BOM multinivel). */
function treeSVG() {
  const items = bomItems();
  if (!items.length) return null;
  const codes = new Set(items.map(i => i.c));
  const kids = new Map([['__root', []]]);
  items.forEach(i => kids.set(i.c, []));
  const shared = new Set(items.filter(i => i.p.filter(p => codes.has(p)).length > 1).map(i => i.c));
  items.forEach(i => {
    const ps = i.p.filter(p => codes.has(p) && p !== i.c);
    if (!ps.length) kids.get('__root').push(i); else ps.forEach(p => kids.get(p).push(i));
  });
  const BW = 150, BH = 58, GX = 18, GY = 46;
  let leaf = 0; const nodes = [], links = [];
  function place(item, depth, path) {
    const ch = (kids.get(item ? item.c : '__root') || []).filter(k => !path.has(k.c));
    const node = { item, depth, x: 0 };
    if (!ch.length) { node.x = leaf++ * (BW + GX); }
    else {
      const xs = ch.map(k => { const n = place(k, depth + 1, new Set([...path, k.c])); links.push([node, n]); return n.x; });
      node.x = (Math.min(...xs) + Math.max(...xs)) / 2;
    }
    nodes.push(node); return node;
  }
  const root = place(null, 0, new Set());
  const maxD = Math.max(...nodes.map(n => n.depth));
  const W = Math.max(leaf, 1) * (BW + GX) + 20, H = (maxD + 1) * (BH + GY) + 20;
  const X = n => 10 + n.x, Y = n => 10 + n.depth * (BH + GY);
  let g = `<rect width="${W}" height="${H}" fill="var(--surface)"/>`;
  links.forEach(([a, b]) => {
    const x1 = X(a) + BW / 2, y1 = Y(a) + BH, x2 = X(b) + BW / 2, y2 = Y(b), my = (y1 + y2) / 2;
    g += `<path d="M${x1},${y1} V${my} H${x2} V${y2}" fill="none" stroke="var(--muted)" stroke-width="1.3"/>`;
  });
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  nodes.forEach(n => {
    const x = X(n), y = Y(n);
    if (!n.item) {
      g += `<rect x="${x}" y="${y}" width="${BW}" height="${BH}" rx="8" fill="var(--navy)"/>` +
        `<text x="${x + BW / 2}" y="${y + 20}" font-size="10" text-anchor="middle" style="fill:var(--accent)" font-weight="700">NIVEL 0 · PRODUCTO</text>` +
        `<text x="${x + BW / 2}" y="${y + 38}" font-size="11.5" text-anchor="middle" style="fill:var(--navy-ink)" font-weight="700">${esc(clip(S.producto || 'Producto', 24))}</text>`;
      return;
    }
    const it = n.item, sh = shared.has(it.c);
    g += `<rect x="${x}" y="${y}" width="${BW}" height="${BH}" rx="8" fill="var(--sunken)" stroke="${sh ? 'var(--accent)' : 'var(--line)'}" stroke-width="${sh ? 1.4 : 1}"${sh ? ' stroke-dasharray="4 3"' : ''}/>` +
      `<rect x="${x}" y="${y}" width="5" height="${BH}" rx="2" fill="var(--st${(n.depth - 1) % 10 + 1})"/>` +
      `<text x="${x + 13}" y="${y + 17}" font-size="11" font-weight="700" style="fill:var(--ink)">${esc(clip(it.c || '—', 12))}</text>` +
      `<text x="${x + BW - 8}" y="${y + 17}" font-size="9.5" text-anchor="end" style="fill:var(--muted)">Nivel ${n.depth}</text>` +
      `<text x="${x + 13}" y="${y + 33}" font-size="10.5" style="fill:var(--ink)">${esc(clip(it.d, 22))}</text>` +
      `<text x="${x + 13}" y="${y + 48}" font-size="10.5" style="fill:var(--muted)">Cant.: ${esc(it.q)} ${esc(it.u)}${sh ? ' · compartido' : ''}</text>`;
  });
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Árbol de estructura del producto">${g}</svg>`, levels: maxD, n: items.length, root };
}

/** Gráfica de ensamble: componentes que ingresan a cada tarea, en la secuencia del proceso. */
function assemblySVG() {
  const items = bomItems();
  const order = cursoSequence().order;           // misma secuencia que el cursograma
  if (!order.length) return null;
  const byTask = new Map(order.map(t => [t.id, []]));
  const unassigned = [];
  items.forEach(i => { const t = i.t.find(x => byTask.has(x)); if (t) byTask.get(t).push(i); else unassigned.push(i); });
  const rowH = 34, xMain = 470, xComp = 300, top = 20;
  const rows = [];
  order.forEach(t => { byTask.get(t.id).forEach(c => rows.push({ kind: 'c', c, t: t.id })); rows.push({ kind: 't', t }); });
  const W = 860, H = top + rows.length * rowH + 76;
  let g = `<rect width="${W}" height="${H}" fill="var(--surface)"/>`;
  const yOf = i => top + i * rowH + rowH / 2;
  const firstT = rows.findIndex(r => r.kind === 't');
  g += `<line x1="${xMain}" y1="${yOf(0)}" x2="${xMain}" y2="${top + rows.length * rowH + 22}" stroke="var(--ink)" stroke-width="2"/>`;
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  let joinCount = 0;
  rows.forEach((r, i) => {
    const y = yOf(i);
    if (r.kind === 'c') {
      g += `<path d="M${xComp + 16},${y} H${xMain - 8}" fill="none" stroke="var(--muted)" stroke-width="1.4"/><path d="M${xMain - 14},${y - 4} L${xMain - 6},${y} L${xMain - 14},${y + 4}" fill="none" stroke="var(--muted)" stroke-width="1.4"/>`;
      const code = clip(r.c.c || '—', 12), bw = Math.max(32, code.length * 6.4 + 14);
      g += `<rect x="${xComp + 16 - bw}" y="${y - 12}" width="${bw}" height="24" rx="12" fill="var(--cO)" stroke="var(--ink)" stroke-width="1.2"/><text x="${xComp + 16 - bw / 2}" y="${y + 3.5}" font-size="9.5" font-weight="700" text-anchor="middle" style="fill:var(--ink)">${esc(code)}</text>`;
      g += `<text x="${xComp + 8 - bw}" y="${y + 4}" font-size="11" text-anchor="end" style="fill:var(--ink)">${esc(clip(r.c.d, 34))} <tspan style="fill:var(--muted)">(${esc(r.c.q)} ${esc(r.c.u)})</tspan></text>`;
    } else {
      const has = byTask.get(r.t.id).length > 0;
      if (has) { joinCount++; g += `<circle cx="${xMain}" cy="${y}" r="15" fill="var(--cT)" stroke="var(--ink)" stroke-width="1.3"/><text x="${xMain}" y="${y + 3.5}" font-size="8.5" font-weight="700" text-anchor="middle" style="fill:var(--ink)">SA-${joinCount}</text>`; }
      else g += `<circle cx="${xMain}" cy="${y}" r="9" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.3"/>`;
      g += `<text x="${xMain + 26}" y="${y + 4}" font-size="11.5" style="fill:var(--ink)"><tspan font-weight="700">T${esc(r.t.id)}</tspan> ${esc(clip(r.t.desc || '', 44))}</text>`;
    }
  });
  const yEnd = top + rows.length * rowH + 22;
  g += `<rect x="${xMain - 85}" y="${yEnd}" width="170" height="30" rx="6" fill="var(--navy)"/><text x="${xMain}" y="${yEnd + 19}" font-size="11" font-weight="700" text-anchor="middle" style="fill:var(--navy-ink)">PRODUCTO TERMINADO</text>`;
  g += `<g transform="translate(16,${yEnd + 4})" font-size="10.5"><circle cx="8" cy="6" r="7" fill="var(--cO)" stroke="var(--ink)"/><text x="20" y="10" style="fill:var(--muted)">Componente</text>` +
       `<circle cx="104" cy="6" r="7" fill="var(--cT)" stroke="var(--ink)"/><text x="116" y="10" style="fill:var(--muted)">Ensamble (SA)</text>` +
       `<circle cx="214" cy="6" r="5" fill="var(--surface)" stroke="var(--ink)"/><text x="224" y="10" style="fill:var(--muted)">Operación</text></g>`;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Gráfica de ensamble">${g}</svg>`, unassigned, joins: joinCount };
}

function renderProdViz() {
  const tr = treeSVG();
  $('#treeChart').innerHTML = tr ? tr.svg : '<div class="empty">Agrega materiales a la lista para ver el árbol del producto.</div>';
  $('#treeNote').textContent = tr ? `${tr.n} componentes en ${tr.levels} nivel(es) bajo el producto. Los recuadros con borde naranja discontinuo pertenecen a más de un componente.` : '';
  const as = assemblySVG();
  $('#asmChart').innerHTML = as ? as.svg : '<div class="empty">Registra tareas en la sección Datos para ver la gráfica de ensamble.</div>';
  if (as && as.unassigned.length && as.unassigned.length === bomItems().length) $('#asmChart').insertAdjacentHTML('afterbegin', '<p class="note" style="margin:0 0 8px">Ningún material tiene tarea asignada todavía: elige en la columna <b>Se usa en tarea</b> de la lista de materiales la tarea donde ingresa cada uno.</p>');
  $('#asmNote').innerHTML = !as ? '' : (as.unassigned.length
    ? `<span class="badge-warn">${as.unassigned.length} material(es) sin tarea asignada: ${as.unassigned.map(i => esc(i.c || i.d)).join(', ')}. Elige en la columna "Se usa en tarea" la tarea donde ingresa cada uno.</span>`
    : `Todos los materiales tienen tarea asignada · ${as.joins} punto(s) de ensamble.`);
}
function dlSVG(sel, name) {
  const s = $(sel + ' svg'); if (!s) { toast('No hay diagrama para descargar.'); return; }
  const css = getComputedStyle(document.documentElement);
  download(name, s.outerHTML.replace(/var\(--([a-z0-9-]+)\)/g, (_, v) => css.getPropertyValue('--' + v).trim() || '#000'), 'image/svg+xml');
}
function printSection(cls) {
  document.body.classList.add(cls);
  const off = () => { document.body.classList.remove(cls); window.removeEventListener('afterprint', off); };
  window.addEventListener('afterprint', off);
  try { window.print(); } catch (e) { off(); }
  setTimeout(off, 1500);
}
function bindProdViz() {
  $('#dlTree').onclick = () => dlSVG('#treeChart', 'estructura_producto.svg');
  $('#dlAsm').onclick = () => dlSVG('#asmChart', 'grafica_ensamble.svg');
  $('#printProd').onclick = () => printSection('print-prod');
}

// ---------------- plano ----------------
function showPlano() {
  const box = $('#planoBox');
  if (!S.plano) { box.innerHTML = '<div class="empty" style="color:#5A6677">Arrastra aquí un plano .dxf (AutoCAD), .svg, .png o .jpg</div>'; $('#planoName').textContent = 'Sin plano'; return; }
  $('#planoName').textContent = S.plano.name;
  if (S.plano.type === 'dxf') {
    const r = DXF.render(S.plano.data, { fg: '#1b1b1b' });
    if (!r) { box.innerHTML = '<div class="empty" style="color:#B42318">El archivo DXF no tiene entidades que se puedan dibujar.</div>'; return; }
    box.innerHTML = r.svg + '<div class="plano-tools"><button class="btn" type="button" data-z="in" aria-label="Acercar">+</button><button class="btn" type="button" data-z="out" aria-label="Alejar">−</button><button class="btn" type="button" data-z="fit">Ajustar</button></div>';
    planoView = { vb: r.viewBox.slice(), base: r.viewBox.slice() };
    bindPan(box);
  } else box.innerHTML = `<img src="${S.plano.data}" alt="Plano de ingeniería">`;
}
function bindPan(box) {
  const svg = box.querySelector('svg');
  const set = () => svg.setAttribute('viewBox', planoView.vb.join(' '));
  const zoom = (f, cx = 0.5, cy = 0.5) => { const v = planoView.vb; const nw = v[2] * f, nh = v[3] * f; v[0] += (v[2] - nw) * cx; v[1] += (v[3] - nh) * cy; v[2] = nw; v[3] = nh; set(); };
  box.onwheel = e => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
  box.querySelector('.plano-tools').onclick = e => { const z = e.target.dataset.z; if (z === 'in') zoom(1 / 1.3); if (z === 'out') zoom(1.3); if (z === 'fit') { planoView.vb = planoView.base.slice(); set(); } };
  let drag = null; const pts = new Map();
  box.onpointerdown = e => { if (e.target.closest('.plano-tools')) return; box.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = { x: e.clientX, y: e.clientY }; box.classList.add('drag'); };
  box.onpointermove = e => {
    if (!pts.has(e.pointerId)) return;
    const r = svg.getBoundingClientRect(), sc = Math.max(planoView.vb[2] / r.width, planoView.vb[3] / r.height);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()]; const d0 = Math.hypot(a[0] - b[0], a[1] - b[1]);
      pts.set(e.pointerId, [e.clientX, e.clientY]); const [c, d] = [...pts.values()]; const d1 = Math.hypot(c[0] - d[0], c[1] - d[1]);
      if (d0 > 0 && d1 > 0) zoom(d0 / d1); return;
    }
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    planoView.vb[0] -= (e.clientX - drag.x) * sc; planoView.vb[1] -= (e.clientY - drag.y) * sc; drag = { x: e.clientX, y: e.clientY }; set();
  };
  box.onpointerup = box.onpointercancel = e => { pts.delete(e.pointerId); if (!pts.size) box.classList.remove('drag'); };
}
function loadPlanoFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const rd = new FileReader();
  if (ext === 'dxf') { rd.onload = () => { S.plano = { name: file.name, type: 'dxf', data: rd.result }; save(); showPlano(); toast('Plano cargado'); }; rd.readAsText(file); }
  else if (['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext)) { rd.onload = () => { S.plano = { name: file.name, type: 'img', data: rd.result }; save(); showPlano(); toast('Plano cargado'); }; rd.readAsDataURL(file); }
  else toast('Formato no admitido. Usa .dxf, .svg, .png o .jpg');
}

// ---------------- cursograma ----------------
const CTYPES = [
  { k: 'O', name: 'Operación' }, { k: 'T', name: 'Transporte' }, { k: 'I', name: 'Inspección' },
  { k: 'D', name: 'Espera' }, { k: 'A', name: 'Almacenamiento' },
];
const CURSO_PRESET = {
  camiseta: {
    tipos: { 1: 'O', 2: 'O', 3: 'O', 4: 'O', 5: 'O', 6: 'O', 7: 'O', 8: 'O', 9: 'O', 10: 'O', 11: 'O', 12: 'O', 13: 'O', 14: 'I', 15: 'O' },
    extras: [
      { id: 'x1', after: '', tipo: 'A', desc: 'Tela en bodega de materia prima', time: '', dist: '' },
      { id: 'x2', after: '', tipo: 'T', desc: 'Llevar tela a la mesa de corte', time: '30', dist: '15' },
      { id: 'x3', after: '3', tipo: 'I', desc: 'Revisar piezas cortadas', time: '10', dist: '' },
      { id: 'x4', after: '3', tipo: 'T', desc: 'Llevar piezas a la línea de costura', time: '15', dist: '8' },
      { id: 'x5', after: '12', tipo: 'D', desc: 'Espera en bandeja de acabados', time: '30', dist: '' },
      { id: 'x6', after: '__end', tipo: 'T', desc: 'Llevar a bodega de producto terminado', time: '40', dist: '20' },
      { id: 'x7', after: '__end', tipo: 'A', desc: 'Producto terminado en bodega', time: '', dist: '' },
    ],
    meta: { objeto: 'Camiseta básica cuello redondo – talla M · proceso completo, de la tela en bodega al producto terminado', proceso: 'Confección de camiseta básica', lugar: 'Taller de confección', aprobo: '',
            metodo: 'Actual', diagrama: 'Material', operadores: '8 operarios de la línea de costura', comentarios: 'Tiempos estándar referenciales para el ejercicio.', hoja: '1', hojaDe: '1', producto: 'CAM-M', elaboro: 'Valentina Santiana', fecha: '', revision: '' },
  },
};
const CMETA = [['objeto', 'Objeto y nivel del análisis'], ['proceso', 'Proceso analizado'], ['lugar', 'Localización'], ['aprobo', 'Aprobó'],
  ['operadores', 'Operador(es)'], ['comentarios', 'Comentarios'], ['producto', 'Producto / código'], ['elaboro', 'Elaborado por'], ['fecha', 'Fecha'], ['revision', 'Revisión']];
const SUM_ORDER = ['O', 'T', 'D', 'I', 'A'];          // orden de la plantilla: operación, transporte, espera, inspección, almacenamiento
function emptyCurso() {
  return { tipos: {}, dist: {}, info: {}, extras: [], prop: { O: '', T: '', D: '', I: '', A: '', dist: '', time: '' },
           meta: { objeto: '', proceso: '', lugar: '', aprobo: '', metodo: 'Actual', diagrama: 'Material', operadores: '', comentarios: '', hoja: '1', hojaDe: '1', producto: '', elaboro: '', fecha: '', revision: '' } };
}
function cursoFor(key) { const p = CURSO_PRESET[key]; return p ? JSON.parse(JSON.stringify(Object.assign(emptyCurso(), p))) : emptyCurso(); }
function ensureCurso() {
  if (!S.curso || typeof S.curso !== 'object') S.curso = emptyCurso();
  const d = emptyCurso();
  for (const k in d) if (S.curso[k] === undefined) S.curso[k] = d[k];
  for (const k in d.meta) if (S.curso.meta[k] === undefined) S.curso.meta[k] = d.meta[k];   // proyectos guardados antes de la plantilla
  for (const k in d.prop) if (S.curso.prop[k] === undefined) S.curso.prop[k] = '';
}

/** Símbolo ASME en SVG. cx, cy: centro; r: tamaño; on: relleno de color. */
function symSVG(t, cx, cy, r, on = true) {
  const fill = on ? `var(--c${t})` : 'none', st = on ? 'var(--ink)' : 'var(--muted)', w = on ? 1.4 : 1.1;
  if (t === 'O') return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${st}" stroke-width="${w}"/>`;
  if (t === 'I') return `<rect x="${cx - r * .9}" y="${cy - r * .9}" width="${r * 1.8}" height="${r * 1.8}" fill="${fill}" stroke="${st}" stroke-width="${w}"/>`;
  if (t === 'T') { const L = r * 1.15, h = r * .42, H = r * .9; return `<path d="M${cx - L},${cy - h} H${cx + L * .2} V${cy - H} L${cx + L},${cy} L${cx + L * .2},${cy + H} V${cy + h} H${cx - L} Z" fill="${fill}" stroke="${st}" stroke-width="${w}" stroke-linejoin="round"/>`; }
  if (t === 'D') return `<path d="M${cx - r * .85},${cy - r * .85} H${cx} A${r * .85},${r * .85} 0 0 1 ${cx},${cy + r * .85} H${cx - r * .85} Z" fill="${fill}" stroke="${st}" stroke-width="${w}"/>`;
  if (t === 'A') return `<path d="M${cx - r},${cy - r * .75} H${cx + r} L${cx},${cy + r * .95} Z" fill="${fill}" stroke="${st}" stroke-width="${w}" stroke-linejoin="round"/>`;
  return '';
}
const symIcon = (t, on = true, w = 28, h = 22) => `<svg viewBox="0 0 28 22" width="${w}" height="${h}" aria-hidden="true">${symSVG(t, 14, 11, 8, on)}</svg>`;

/** Secuencia del proceso: orden topológico que respeta el orden de la tabla (no altera los datos). */
function cursoSequence() {
  ensureCurso();
  const T = tasksForCore().filter(t => t.id !== '');
  const ids = new Set(T.map(t => t.id));
  const indeg = new Map(T.map(t => [t.id, t.preds.filter(p => ids.has(p)).length]));
  const succ = new Map(T.map(t => [t.id, []]));
  T.forEach(t => t.preds.forEach(p => { if (succ.has(p)) succ.get(p).push(t.id); }));
  const done = new Set(), order = [];
  let guard = 0;
  while (order.length < T.length && guard++ < T.length + 5) {
    const next = T.find(t => !done.has(t.id) && indeg.get(t.id) === 0);
    if (!next) { T.forEach(t => { if (!done.has(t.id)) { order.push(t); done.add(t.id); } }); break; } // ciclo: se respeta el orden de la tabla
    order.push(next); done.add(next.id);
    succ.get(next.id).forEach(s => indeg.set(s, indeg.get(s) - 1));
  }
  const ex = S.curso.extras;
  const rows = [];
  const xrow = e => ({ kind: 'extra', ref: e, id: e.id, tipo: e.tipo || '', desc: e.desc, time: num(e.time), dist: num(e.dist), cant: e.cant ?? '1', obs: e.obs || '', resp: e.resp || '', mejora: e.mejora || '' });
  const pushExtras = key => ex.filter(e => (e.after || '') === key).forEach(e => rows.push(xrow(e)));
  pushExtras('');
  order.forEach(t => {
    const inf = S.curso.info[t.id] || {};
    rows.push({ kind: 'task', id: t.id, tipo: S.curso.tipos[t.id] || '', desc: t.desc || `Tarea ${t.id}`, time: t.time, dist: num(S.curso.dist[t.id]), cant: inf.cant ?? '1', obs: inf.obs || '', resp: inf.resp || '', mejora: inf.mejora || '' });
    pushExtras(t.id);
  });
  ex.filter(e => e.after && e.after !== '__end' && !ids.has(e.after)).forEach(e => rows.push(xrow(e)));
  pushExtras('__end');
  return { rows, order };
}

function cursoChartSVG(rows) {
  const u = S.unidad;
  const W = 900, rowH = 30, top = 66, n = rows.length, H = top + n * rowH + 12;
  const X = { n: 22, d: 52, O: 470, T: 528, I: 586, D: 644, A: 702, t: 776, m: 852 };
  let g = `<rect x="0" y="0" width="${W}" height="${H}" fill="var(--surface)"/>`;
  g += `<rect x="0" y="0" width="${W}" height="30" fill="var(--navy)"/>` +
       `<text x="16" y="20" font-size="13" font-weight="700" style="fill:var(--navy-ink)">CURSOGRAMA ANALÍTICO</text>` +
       `<text x="${W - 16}" y="20" font-size="11" text-anchor="end" style="fill:var(--navy-muted)">${esc((() => { const t = S.curso.meta.proceso || S.producto || ''; return t.length > 52 ? t.slice(0, 51) + '…' : t; })())} · Método ${esc(S.curso.meta.metodo)} · ${esc(S.curso.meta.diagrama || '')}</text>`;
  g += `<rect x="0" y="30" width="${W}" height="34" fill="var(--head)"/>`;
  g += `<text x="${X.n}" y="52" font-size="10.5" font-weight="700" text-anchor="middle" style="fill:var(--muted)">N.º</text><text x="${X.d}" y="52" font-size="10.5" font-weight="700" style="fill:var(--muted)">DESCRIPCIÓN DE LA ACTIVIDAD</text>`;
  CTYPES.forEach(c => { g += symSVG(c.k, X[c.k], 47, 8.5, false); });
  g += `<text x="${X.t}" y="52" font-size="10.5" font-weight="700" text-anchor="middle" style="fill:var(--muted)">TIEMPO (${u})</text><text x="${X.m}" y="52" font-size="10.5" font-weight="700" text-anchor="middle" style="fill:var(--muted)">DIST. (m)</text>`;
  const pts = [];
  rows.forEach((r, i) => {
    const y = top + i * rowH + rowH / 2;
    if (i % 2 === 1) g += `<rect x="0" y="${y - rowH / 2}" width="${W}" height="${rowH}" fill="var(--sunken)"/>`;
    g += `<line x1="0" x2="${W}" y1="${y + rowH / 2}" y2="${y + rowH / 2}" stroke="var(--line)"/>`;
    const d = r.desc.length > 58 ? r.desc.slice(0, 56) + '…' : r.desc;
    g += `<text x="${X.n}" y="${y + 4}" font-size="11.5" text-anchor="middle" style="fill:var(--ink)">${i + 1}</text>`;
    g += `<text x="${X.d}" y="${y + 4}" font-size="11.5" style="fill:var(--ink)">${esc(d)}${r.kind === 'task' ? ` <tspan style="fill:var(--muted)" font-size="10">(T${esc(r.id)})</tspan>` : ''}</text>`;
    CTYPES.forEach(c => { g += `<circle cx="${X[c.k]}" cy="${y}" r="1.6" fill="var(--line)"/>`; });
    if (r.tipo) pts.push([X[r.tipo], y, r.tipo]);
    else g += `<text x="${(X.O + X.A) / 2}" y="${y + 4}" font-size="10.5" text-anchor="middle" style="fill:var(--warn)">sin clasificar</text>`;
    g += `<text x="${X.t}" y="${y + 4}" font-size="11.5" text-anchor="middle" style="fill:var(--ink)">${isFinite(r.time) ? fmt(r.time) : ''}</text>`;
    g += `<text x="${X.m}" y="${y + 4}" font-size="11.5" text-anchor="middle" style="fill:var(--ink)">${isFinite(r.dist) ? fmt(r.dist) : ''}</text>`;
  });
  if (pts.length > 1) g += `<polyline points="${pts.map(p => p[0] + ',' + p[1]).join(' ')}" fill="none" stroke="var(--muted)" stroke-width="1.8"/>`;
  pts.forEach(p => { g += symSVG(p[2], p[0], p[1], 9); });
  [X.d - 8, X.O - 32, X.A + 32, X.t + 38].forEach(x => { g += `<line x1="${x}" x2="${x}" y1="30" y2="${H - 12}" stroke="var(--line)"/>`; });
  g += `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 12}" fill="none" stroke="var(--line)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Cursograma analítico">${g}</svg>`;
}

function cursoSummary(rows) {
  const s = {}; CTYPES.forEach(c => { s[c.k] = { n: 0, t: 0, d: 0, tKnown: 0 }; });
  let unset = 0;
  rows.forEach(r => {
    if (!r.tipo) { unset++; return; }
    const o = s[r.tipo]; o.n++; if (isFinite(r.time)) { o.t += r.time; o.tKnown++; } if (isFinite(r.dist)) o.d += r.dist;
  });
  return { s, unset };
}

function renderCurso(tableToo = true) {
  ensureCurso();
  const { rows, order } = cursoSequence(), u = S.unidad, C = S.curso;
  $('#curTitle').textContent = C.meta.proceso || S.producto || 'Secuencia del proceso';
  $('#curLegend').innerHTML = CTYPES.map(c => `<span>${symIcon(c.k, true, 22, 18)}${c.name}</span>`).join('');
  $('#curChart').innerHTML = rows.length ? cursoChartSVG(rows) : '<div class="empty">Registra tareas en la sección Datos para generar el cursograma.</div>';
  const { s, unset } = cursoSummary(rows);
  $('#curWarn').innerHTML = unset ? `<span class="badge-warn">${unset} actividad(es) sin clasificar. Asigna su tipo en la tabla de abajo o usa <b>Sugerir tipos</b>.</span>` : '';
  const opts = ['<option value="">Al inicio</option>'].concat(order.map(t => `<option value="${esc(t.id)}">Después de T${esc(t.id)}</option>`), ['<option value="__end">Al final</option>']).join('');
  if (tableToo) $('#curTable').innerHTML = `<thead><tr><th class="n">N.º</th><th>Actividad</th>${CTYPES.map(c => `<th style="text-align:center" title="${c.name}">${symIcon(c.k, false, 22, 18)}</th>`).join('')}<th class="n">Cant.</th><th class="n">Tiempo (${u})</th><th class="n">Dist. (m)</th><th>Observaciones</th><th>Responsable</th><th>Mejora propuesta</th><th>Posición</th><th class="c-x"><span class="sr">Eliminar</span></th></tr></thead><tbody>` +
    rows.map((r, i) => {
      const isX = r.kind === 'extra';
      const symCells = CTYPES.map(c => `<td class="sym"><button type="button" data-set="${c.k}" data-row="${r.kind}:${esc(r.id)}" aria-pressed="${r.tipo === c.k}" title="${c.name}" aria-label="${c.name}">${symIcon(c.k, r.tipo === c.k)}</button></td>`).join('');
      const desc = isX ? `<input data-xf="desc" data-x="${esc(r.id)}" value="${esc(r.desc)}" placeholder="Describe la actividad" aria-label="Descripción">`
                       : `<div style="padding:6px 7px"><span class="mono" style="font-weight:600">T${esc(r.id)}</span> ${esc(r.desc)}</div>`;
      const time = isX ? `<input class="t" data-xf="time" data-x="${esc(r.id)}" value="${esc(r.ref.time)}" style="text-align:right" inputmode="decimal" aria-label="Tiempo">`
                       : `<div class="num" style="text-align:right;padding:6px 7px">${fmt(r.time)}</div>`;
      const dist = isX ? `<input class="t" data-xf="dist" data-x="${esc(r.id)}" value="${esc(r.ref.dist)}" style="text-align:right" inputmode="decimal" aria-label="Distancia">`
                       : `<input class="t" data-tdist="${esc(r.id)}" value="${esc(C.dist[r.id] ?? '')}" style="text-align:right" inputmode="decimal" aria-label="Distancia">`;
      const pos = isX ? `<select data-xf="after" data-x="${esc(r.id)}" aria-label="Posición">${opts.replace(`value="${esc(r.ref.after || '')}"`, `value="${esc(r.ref.after || '')}" selected`)}</select>` : '<span class="muted" style="font-size:.8rem;padding-left:7px">Tarea de la línea</span>';
      const del = isX ? `<button class="btn ghost" data-xdel="${esc(r.id)}" aria-label="Eliminar actividad">×</button>` : '';
      const rk = `${r.kind}:${esc(r.id)}`;
      const inf = (f, w, ph, al) => `<td style="width:${w}px"><input data-info="${f}" data-row="${rk}" value="${esc(r[f])}" placeholder="${ph}"${al ? ' class="t" style="text-align:right" inputmode="decimal"' : ''} aria-label="${f}"></td>`;
      return `<tr class="${isX ? 'extra' : ''} ${r.tipo ? '' : 'unset'}"><td class="num" style="text-align:right;padding-right:8px">${i + 1}</td><td style="min-width:220px">${desc}</td>${symCells}${inf('cant', 60, '1', true)}<td style="width:84px">${time}</td><td style="width:80px">${dist}</td>${inf('obs', 170, '')}${inf('resp', 130, '')}${inf('mejora', 190, '')}<td style="width:150px">${pos}</td><td>${del}</td></tr>`;
    }).join('') + '</tbody>';
  let tTot = 0, dTot = 0, tMissing = false;
  CTYPES.forEach(c => { const o = s[c.k]; tTot += o.t; dTot += o.d; if (o.n > o.tKnown && c.k !== 'A') tMissing = true; });
  const sumRows = cursoSumRows(s, tTot, dTot);
  const propCell = r => `<input class="t" data-prop="${r.key}" value="${esc(C.prop[r.key] ?? '')}" inputmode="decimal" style="text-align:right;width:54px;padding:4px 6px" aria-label="Propuesto ${r.label}">`;
  const editingProp = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.prop !== undefined;
  if (tableToo || !editingProp) {
    $('#curSum').innerHTML = `<thead><tr><th>Actividad</th><th class="n">Actual</th><th class="n">Propuesto</th><th class="n">Economía</th></tr></thead><tbody>` +
      sumRows.map(r => `<tr${r.total ? ' class="tot"' : ''}><td>${r.sym ? symIcon(r.sym, true, 20, 16) : ''}${r.label}</td><td class="n">${fmt(r.actual)}</td><td class="n" style="padding:2px 4px">${propCell(r)}</td><td class="n">${r.eco === '' ? '—' : fmt(r.eco)}</td></tr>`).join('') + '</tbody>';
  } else {
    sumRows.forEach(r => { const tr = $(`#curSum [data-prop="${r.key}"]`); if (tr) tr.closest('tr').lastElementChild.textContent = r.eco === '' ? '—' : fmt(r.eco); });
  }
  renderCursoFormato(rows, sumRows);
  const va = s.O.t, nva = s.T.t + s.D.t + s.A.t + s.I.t;
  $('#curSumNote').innerHTML = (unset ? `${unset} actividad(es) sin clasificar no se cuentan. ` : '') +
    (tTot > 0 ? `Las operaciones representan el <b>${fmt(100 * va / tTot, 1)} %</b> del tiempo; transportes, inspecciones, demoras y almacenamientos suman ${fmt(nva)} ${u}. ` : '') +
    (tMissing ? 'Algunas actividades no tienen tiempo registrado.' : '');
  if (tableToo) $$('[data-meta]').forEach(el => { if (document.activeElement !== el) el.value = C.meta[el.dataset.meta] || ''; });
}

function cursoSumRows(s, tTot, dTot) {
  const P = S.curso.prop, pv = k => { const v = num(P[k]); return isFinite(v) ? v : ''; };
  const out = SUM_ORDER.map(k => ({ key: k, sym: k, label: CTYPES.find(c => c.k === k).name, actual: s[k].n }));
  out.push({ key: 'dist', label: 'Distancia (m)', actual: dTot }, { key: 'time', label: `Tiempo total (${S.unidad})`, actual: tTot, total: true });
  out.forEach(r => { r.prop = pv(r.key); r.eco = r.prop === '' ? '' : r.actual - r.prop; });
  return out;
}
/** Vista con el formato de la plantilla del curso (encabezado, resumen y tabla). */
function renderCursoFormato(rows, sumRows) {
  const M = S.curso.meta, u = S.unidad;
  const box = (opts, val) => opts.map(o => `${o === val ? '☒' : '☐'} ${o}`).join('&nbsp;&nbsp; ');
  const f = (l, v) => `<div class="fl">${l}</div><div class="fv">${esc(v || '') || '&nbsp;'}</div>`;
  const fecha = M.fecha ? new Date(M.fecha + 'T12:00').toLocaleDateString('es-EC') : '';
  const head = `<table class="fmt-head"><tbody>
    <tr><td>${f('Objeto y nivel del análisis', M.objeto || S.producto)}</td><td><div class="fl">Tipo</div><div class="fv">${box(['Operario', 'Material', 'Equipo'], M.diagrama)}</div></td><td><div class="fl">Hoja núm.</div><div class="fv">${esc(M.hoja || '')} de ${esc(M.hojaDe || '')}</div></td></tr>
    <tr><td>${f('Proceso analizado', M.proceso)}</td><td><div class="fl">Método</div><div class="fv">${box(['Actual', 'Propuesto'], M.metodo)}</div></td><td>${f('Producto / código', M.producto)}</td></tr>
    <tr><td>${f('Localización', M.lugar)}</td><td>${f('Operador(es)', M.operadores)}</td><td><div style="display:grid;grid-template-columns:1fr auto;gap:8px"><div>${f('Elaborado por', M.elaboro)}</div><div>${f('Fecha', fecha)}</div></div></td></tr>
    <tr><td>${f('Aprobó', M.aprobo)}</td><td>${f('Comentarios', M.comentarios)}</td><td>${f('Revisión', M.revision)}</td></tr></tbody></table>`;
  const sum = `<table class="fmt-sum"><thead><tr><th colspan="4" style="text-align:center">RESUMEN DE ACTIVIDADES</th></tr><tr><th>Actividad</th><th class="n">Actual</th><th class="n">Propuesto</th><th class="n">Economía</th></tr></thead><tbody>` +
    sumRows.map(r => `<tr${r.total ? ' class="tot"' : ''}><td>${r.sym ? symIcon(r.sym, true, 18, 14) : ''} ${r.label}</td><td class="n">${fmt(r.actual)}</td><td class="n">${r.prop === '' ? '' : fmt(r.prop)}</td><td class="n">${r.eco === '' ? '' : fmt(r.eco)}</td></tr>`).join('') + '</tbody></table>';
  const body = `<table class="fmt-act"><thead><tr><th class="n">N.º</th><th>Descripción de la actividad</th><th class="n">Cantidad</th><th class="n">Distancia (m)</th><th>Tipo de actividad</th><th style="text-align:center">Símbolo</th><th class="n">Tiempo (${u})</th><th>Observaciones</th><th>Responsable</th><th>Mejora propuesta</th></tr></thead><tbody>` +
    rows.map((r, i) => `<tr><td class="n">${i + 1}</td><td>${esc(r.desc)}</td><td class="n">${esc(r.cant)}</td><td class="n">${isFinite(r.dist) ? fmt(r.dist) : ''}</td><td>${r.tipo ? CTYPES.find(c => c.k === r.tipo).name : '<span style="color:var(--warn)">Sin clasificar</span>'}</td><td style="text-align:center;line-height:0">${r.tipo ? symIcon(r.tipo, true, 24, 18) : ''}</td><td class="n">${isFinite(r.time) ? fmt(r.time) : ''}</td><td>${esc(r.obs)}</td><td>${esc(r.resp)}</td><td>${esc(r.mejora)}</td></tr>`).join('') + '</tbody></table>';
  $('#curFormato').innerHTML = `<div class="fmt-title">CURSOGRAMA ANALÍTICO / DIAGRAMA DE FLUJO DE PROCESO</div><div class="fmt-top"><div class="tbl-wrap" style="border:0">${head}</div><div class="tbl-wrap" style="border:0">${sum}</div></div><div class="tbl-wrap" style="margin-top:12px">${body}</div>`;
}

function suggestType(desc) {
  const d = String(desc || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/inspecc|revis|control|verific|calidad|medir|medicion|prueba|chequeo/.test(d)) return 'I';
  if (/transport|llevar|trasladar|traslado|mover|acarre|enviar|conducir|distribuir a/.test(d)) return 'T';
  if (/espera|demora|secado|reposo|enfri|cola|pausa/.test(d)) return 'D';
  if (/almacen|bodega|guardar|stock|deposit|archivar/.test(d)) return 'A';
  return 'O';
}

function bindCurso() {
  const tb = $('#curTable');
  tb.addEventListener('click', e => {
    const b = e.target.closest('[data-set]');
    if (b) {
      const [kind, id] = b.dataset.row.split(/:(.*)/s);
      if (kind === 'task') S.curso.tipos[id] = b.dataset.set;
      else { const x = S.curso.extras.find(z => z.id === id); if (x) x.tipo = b.dataset.set; }
      save(); renderCurso(); return;
    }
    const d = e.target.closest('[data-xdel]');
    if (d) { S.curso.extras = S.curso.extras.filter(z => z.id !== d.dataset.xdel); save(); renderCurso(); }
  });
  tb.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.tdist !== undefined) { S.curso.dist[t.dataset.tdist] = t.value; save(); refreshCursoLight(); return; }
    if (t.dataset.info) {
      const [kind, id] = t.dataset.row.split(/:(.*)/s);
      if (kind === 'task') { S.curso.info[id] = S.curso.info[id] || {}; S.curso.info[id][t.dataset.info] = t.value; }
      else { const x = S.curso.extras.find(z => z.id === id); if (x) x[t.dataset.info] = t.value; }
      save(); refreshCursoLight(); return;
    }
    if (t.dataset.xf && t.tagName === 'INPUT') { const x = S.curso.extras.find(z => z.id === t.dataset.x); if (x) { x[t.dataset.xf] = t.value; save(); refreshCursoLight(); } }
  });
  tb.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.xf === 'after') { const x = S.curso.extras.find(z => z.id === t.dataset.x); if (x) { x.after = t.value; save(); renderCurso(); } }
  });
  $('#curAdd').onclick = () => {
    ensureCurso();
    const id = 'x' + Date.now().toString(36);
    S.curso.extras.push({ id, after: '__end', tipo: 'T', desc: '', time: '', dist: '', cant: '1', obs: '', resp: '', mejora: '' });
    save(); renderCurso();
    const inp = tb.querySelector(`[data-xf="desc"][data-x="${id}"]`); inp && inp.focus();
  };
  $('#curSuggest').onclick = () => {
    const { rows } = cursoSequence(); let k = 0;
    rows.forEach(r => { if (r.tipo) return; const t = suggestType(r.desc); k++; if (r.kind === 'task') S.curso.tipos[r.id] = t; else r.ref.tipo = t; });
    save(); renderCurso(); toast(k ? `Se propuso el tipo de ${k} actividad(es). Revísalas.` : 'Todas las actividades ya están clasificadas.');
  };
  $('#curSvg').onclick = () => {
    const s = $('#curChart svg'); if (!s) return; const css = getComputedStyle(document.documentElement);
    download('cursograma.svg', s.outerHTML.replace(/var\(--([a-z0-9-]+)\)/g, (_, v) => css.getPropertyValue('--' + v).trim() || '#000'), 'image/svg+xml');
  };
  $('#curPrint').onclick = () => {
    renderCurso();
    document.body.classList.add('print-cur');
    const off = () => { document.body.classList.remove('print-cur'); window.removeEventListener('afterprint', off); };
    window.addEventListener('afterprint', off);
    try { window.print(); } catch (e) { off(); }
    setTimeout(off, 1500);
  };
  $('#curMetaFields').innerHTML = CMETA.map(([k, l]) => k === 'fecha'
      ? `<div class="field"><label for="cm-${k}">${l}</label><input id="cm-${k}" data-meta="${k}" type="date"></div>`
      : `<div class="field"><label for="cm-${k}">${l}</label><input id="cm-${k}" data-meta="${k}" type="text"></div>`).join('');
  $('#v-cursograma').addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.meta !== undefined) { ensureCurso(); S.curso.meta[el.dataset.meta] = el.value; save(); refreshCursoLight(); }
    if (el.dataset.prop !== undefined) { ensureCurso(); S.curso.prop[el.dataset.prop] = el.value; save(); refreshCursoLight(); }
  });
  $('#v-cursograma').addEventListener('change', e => { if (e.target.dataset.meta !== undefined) { S.curso.meta[e.target.dataset.meta] = e.target.value; save(); refreshCursoLight(); } });
}
let cursoT;
function refreshCursoLight() {   // redibuja gráfico y resumen sin reconstruir la tabla (no pierde el foco)
  clearTimeout(cursoT);
  cursoT = setTimeout(() => renderCurso(false), 200);
}


// ---------------- nuevo proyecto ----------------
function blankState(keepProyecto) {
  const d = defaultState();
  return Object.assign(d, {
    producto: '', unidad: S.unidad || 's', cmode: 'dado', cDado: '', demanda: '', horas: 8, turnos: 1, pausas: 0, nObj: '',
    methods: S.methods, kpis: S.kpis, iters: S.iters, kSesgo: S.kSesgo, seed: S.seed, costoHora: '',
    tasks: [{ id: '1', desc: '', time: '', preds: '' }], bom: [], notas: '', plano: null, curso: emptyCurso(),
    proyecto: keepProyecto ? Object.assign({}, S.proyecto) : Object.fromEntries(PROY_FIELDS.map(([k]) => [k, ''])),
  });
}
function openNewDialog() { $('#newDlg').hidden = false; $('#newKeep').focus(); }
function closeNewDialog() { $('#newDlg').hidden = true; }
function newProject() {
  S = blankState($('#newKeep').checked); R = null; stale = false;
  save(); dirty = false;
  syncInputs(); renderTasks(); renderBom(); showPlano(); renderResults(); renderProyecto(); closeNewDialog(); go('datos');
  toast('Proyecto nuevo en blanco');
}
// ---------------- navegación ----------------
const VIEWS = ['datos', 'resultados', 'diagramas', 'cursograma', 'producto', 'metodo'];
function go(v) {
  if (!VIEWS.includes(v)) v = 'datos';
  VIEWS.forEach(x => { $('#v-' + x).hidden = x !== v; });
  $$('nav.steps button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === v)));
  try { history.replaceState(null, '', '#' + v); } catch (e) { /* sin historial */ }
  if (v === 'diagramas' && !R) renderDiagrams();
  if (v === 'cursograma') renderCurso();
  if (v === 'producto') renderBom();
  window.scrollTo({ top: 0 });
}

function applyExample(key) {
  const e = EJEMPLOS[key]; if (!e) return;
  Object.assign(S, { producto: e.producto, unidad: e.unidad, cmode: e.cmode, cDado: e.cDado, horas: e.horas, turnos: e.turnos, pausas: e.pausas, demanda: e.demanda,
    tasks: e.tasks.map(([id, desc, time, preds]) => ({ id: String(id), desc, time: String(time), preds })), bom: e.bom.map(([c, d, q, u, p = '', t = '']) => ({ c, d, q: String(q), u, p, t })), notas: e.notas, curso: cursoFor(key) });
  if (key === 'camiseta' && typeof SAMPLE_DXF !== 'undefined') S.plano = { name: 'Plano_Camiseta_TallaM.dxf', type: 'dxf', data: SAMPLE_DXF };
  save(); R = null; stale = false; syncInputs(); renderTasks(); renderBom(); showPlano(); renderResults(); dirty = false; go('datos'); toast('Ejemplo cargado');
}
function syncInputs() { syncProyecto(); ['producto', 'unidad', 'seed', 'cDado', 'horas', 'turnos', 'pausas', 'demanda', 'nObj', 'iters', 'kSesgo', 'costoHora', 'notas'].forEach(id => { $('#' + id).value = S[id] ?? ''; }); bindParamsChecks(); }
function bindParamsChecks() { $$('#methodChecks input').forEach(i => { i.checked = !!S.methods[i.dataset.m]; }); $$('#kpiChecks input').forEach(i => { i.checked = !!S.kpis[i.dataset.k]; }); }

// ---------------- inicio ----------------
function init() {
  S = defaultState();
  load();
  if (!S.plano && typeof SAMPLE_DXF !== 'undefined' && S.producto && /camiseta/i.test(S.producto)) S.plano = { name: 'Plano_Camiseta_TallaM.dxf', type: 'dxf', data: SAMPLE_DXF };
  ensureCurso(); ensureProyecto(); bindProyecto(); renderProyecto(); bindParams(); bindTasks(); bindBom(); bindCurso(); bindProdViz(); renderTasks(); renderBom(); showPlano(); renderResults();
  $$('nav.steps button').forEach(b => b.onclick = () => go(b.dataset.view));
  $('#btnRun').onclick = run;
  $('#ejemplo').onchange = e => { applyExample(e.target.value); e.target.value = ''; };
  $('#btnExcel').onclick = async () => {
    if (typeof ExcelJS !== 'undefined') { try { await exportExcelPro(); return; } catch (e) { console.error(e); toast('Se exportó el Excel en formato simple.'); } }
    exportExcel();
  }; $('#btnTemplate').onclick = exportTemplate;
  $('#btnImport').onclick = () => $('#fileImport').click();
  $('#fileImport').onchange = e => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; };
  $('#btnSave').onclick = async () => {
    const name = (S.producto || 'balanceo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40);
    await download(`Proyecto_${name}.json`, JSON.stringify(S, null, 1), 'application/json'); dirty = false;
  };
  $('#btnNew').onclick = openNewDialog;
  $('#newCancel').onclick = closeNewDialog;
  $('#newOk').onclick = newProject;
  $('#newDlg').addEventListener('click', e => { if (e.target.id === 'newDlg') closeNewDialog(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#newDlg').hidden) closeNewDialog(); });
  $('#clearBom').onclick = () => {
    const b = $('#clearBom');
    if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = '¿Seguro? Pulsa otra vez'; setTimeout(() => { b.dataset.confirm = ''; b.textContent = 'Vaciar lista'; }, 3000); return; }
    b.dataset.confirm = ''; b.textContent = 'Vaciar lista'; S.bom = []; save(); renderBom(); toast('Lista de materiales vacía');
  };
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  // Ctrl+P o el menú del navegador: aplica el mismo formato que el botón Imprimir / PDF de la sección visible
  window.addEventListener('beforeprint', () => {
    if (document.body.classList.contains('print-cur') || document.body.classList.contains('print-prod')) return;
    const v = (location.hash || '').slice(1);
    const vis = !$('#v-cursograma').hidden ? 'cursograma' : !$('#v-producto').hidden ? 'producto' : v;
    if (vis === 'cursograma') { renderCurso(); document.body.classList.add('print-cur', 'print-auto'); }
    else if (vis === 'producto') { renderProdViz(); document.body.classList.add('print-prod', 'print-auto'); }
  });
  window.addEventListener('afterprint', () => { if (document.body.classList.contains('print-auto')) document.body.classList.remove('print-cur', 'print-prod', 'print-auto'); });
  $('#btnOpen').onclick = () => $('#fileOpen').click();
  $('#fileOpen').onchange = e => {
    const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
    rd.onload = () => { try { const o = JSON.parse(rd.result); if (!Array.isArray(o.tasks)) throw new Error('el archivo no tiene tareas'); S = Object.assign(defaultState(), o); if (!o.curso) S.curso = emptyCurso(); save(); R = null; syncInputs(); renderTasks(); renderBom(); showPlano(); renderResults(); dirty = false; go('datos'); toast('Proyecto abierto'); } catch (err) { toast('No se pudo abrir: ' + err.message); } };
    rd.readAsText(f); e.target.value = '';
  };
  $('#btnPlano').onclick = () => $('#filePlano').click();
  $('#filePlano').onchange = e => { if (e.target.files[0]) loadPlanoFile(e.target.files[0]); e.target.value = ''; };
  $('#btnPlanoDel').onclick = () => { S.plano = null; save(); showPlano(); };
  $('#btnPlanoEj').onclick = () => { if (typeof SAMPLE_DXF !== 'undefined') { S.plano = { name: 'Plano_Camiseta_TallaM.dxf', type: 'dxf', data: SAMPLE_DXF }; save(); showPlano(); } };
  const pb = $('#planoBox');
  ['dragenter', 'dragover'].forEach(t => pb.addEventListener(t, e => { e.preventDefault(); pb.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => pb.addEventListener(t, e => { e.preventDefault(); pb.classList.remove('over'); }));
  pb.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) loadPlanoFile(f); });
  $('#dlPrec').onclick = () => { const s = $('#precChart svg'); if (!s) return; const css = getComputedStyle(document.documentElement);
    let t = s.outerHTML.replace(/var\(--([a-z0-9-]+)\)/g, (_, v) => css.getPropertyValue('--' + v).trim() || '#000'); download('diagrama_precedencias.svg', t, 'image/svg+xml'); };
  go((location.hash || '#datos').slice(1));
  // primera vista: calcular el ejemplo para que la herramienta muestre resultados
  run({ silent: true });
  booting = false; dirty = false;
}
document.addEventListener('DOMContentLoaded', init);
})();
