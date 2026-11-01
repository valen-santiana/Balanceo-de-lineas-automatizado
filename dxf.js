/* =====================================================================
   Visor DXF mínimo (AutoCAD R12–R2018, texto ASCII)
   Entidades: LINE, LWPOLYLINE, POLYLINE/VERTEX, CIRCLE, ARC, TEXT, MTEXT,
   INSERT, DIMENSION (bloque *D), SOLID. Devuelve un <svg>.
   ===================================================================== */
const DXF = (() => {
  const ACI = { 1: '#d33', 2: '#c9a300', 3: '#1a9a3a', 4: '#0aa', 5: '#2a5bd7', 6: '#b0c', 8: '#888', 9: '#aaa' };

  function pairs(text) {
    const L = text.split(/\r?\n/), out = [];
    for (let i = 0; i + 1 < L.length; i += 2) out.push([parseInt(L[i].trim(), 10), L[i + 1]]);
    return out;
  }
  function decode(s) {
    return s.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
            .replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±');
  }
  function mtextPlain(s) {
    return decode(s).replace(/\\P/g, ' ').replace(/\\[A-Za-z][^;\\]*;/g, '').replace(/[{}]/g, '').replace(/\\~/g, ' ');
  }

  function parse(text) {
    const P = pairs(text);
    const blocks = {}, layers = {}, entities = [];
    let i = 0, section = null, curBlock = null, layerRec = null;
    function readEntity(type) {
      const e = { type, codes: [] };
      i++;
      while (i < P.length && P[i][0] !== 0) { e.codes.push(P[i]); i++; }
      return e;
    }
    while (i < P.length) {
      const [c, v] = P[i];
      if (c === 0 && v === 'SECTION') { section = P[i + 1][1].trim(); i += 2; continue; }
      if (c === 0 && v === 'ENDSEC') { section = null; i++; continue; }
      if (section === 'TABLES' && c === 0 && v === 'LAYER') {
        const e = readEntity('LAYER'); const g = k => (e.codes.find(p => p[0] === k) || [])[1];
        const name = g(2); if (name) layers[name.trim()] = { color: Math.abs(+g(62) || 7), ltype: (g(6) || '').trim().toUpperCase() };
        continue;
      }
      if (section === 'BLOCKS') {
        if (c === 0 && v === 'BLOCK') { const e = readEntity('BLOCK'); const nm = (e.codes.find(p => p[0] === 2) || [])[1]; curBlock = { name: (nm || '').trim(), ents: [] }; blocks[curBlock.name] = curBlock; continue; }
        if (c === 0 && v === 'ENDBLK') { curBlock = null; readEntity('ENDBLK'); continue; }
        if (c === 0 && curBlock) { curBlock.ents.push(readEntity(v.trim())); continue; }
      }
      if (section === 'ENTITIES' && c === 0) { entities.push(readEntity(v.trim())); continue; }
      i++;
    }
    // POLYLINE + VERTEX -> lista
    function fold(list) {
      const out = [];
      for (let j = 0; j < list.length; j++) {
        const e = list[j];
        if (e.type === 'POLYLINE') {
          e.verts = [];
          while (list[j + 1] && list[j + 1].type === 'VERTEX') { j++; e.verts.push(list[j]); }
          if (list[j + 1] && list[j + 1].type === 'SEQEND') j++;
        }
        out.push(e);
      }
      return out;
    }
    Object.values(blocks).forEach(b => { b.ents = fold(b.ents); });
    return { blocks, layers, entities: fold(entities) };
  }

  function render(text, { fg = '#222' } = {}) {
    const D = parse(text);
    const svgParts = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const ext = (x, y) => { if (!isFinite(x) || !isFinite(y)) return; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

    function style(e, inherit) {
      const g = k => (e.codes.find(p => p[0] === k) || [])[1];
      const layer = (g(8) || '0').trim();
      const L = D.layers[layer] || { color: 7, ltype: '' };
      let col = g(62) !== undefined ? Math.abs(+g(62)) : L.color;
      if (col === 0 || col === 256) col = inherit || L.color;
      const stroke = ACI[col] || fg;
      const lt = ((g(6) || '').trim().toUpperCase()) || L.ltype;
      const dash = /DASH|HIDDEN/.test(lt) ? '4 2' : /CENTER|DOT/.test(lt) ? '8 2 1.5 2' : '';
      return { stroke, dash };
    }

    function draw(list, M, depth) {
      if (depth > 8) return;
      const tp = (x, y) => [M[0] * x + M[1] * y + M[4], M[2] * x + M[3] * y + M[5]];
      const scale = Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])) || 1;
      for (const e of list) {
        const g = k => { const p = e.codes.find(q => q[0] === k); return p ? p[1] : undefined; };
        const all = k => e.codes.filter(q => q[0] === k).map(q => q[1]);
        const n = k => parseFloat(g(k)) || 0;
        const st = style(e);
        const sa = `stroke="${st.stroke}" fill="none" vector-effect="non-scaling-stroke"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}`;
        switch (e.type) {
          case 'LINE': {
            const [a, b] = tp(n(10), n(20)), [c, d] = tp(n(11), n(21)); ext(a, b); ext(c, d);
            svgParts.push(`<line x1="${a}" y1="${-b}" x2="${c}" y2="${-d}" ${sa}/>`); break;
          }
          case 'LWPOLYLINE': case 'POLYLINE': {
            let pts = [];
            if (e.type === 'LWPOLYLINE') { const xs = all(10), ys = all(20); pts = xs.map((x, j) => tp(+x, +ys[j])); }
            else pts = e.verts.map(v => { const gv = k => parseFloat((v.codes.find(q => q[0] === k) || [0, 0])[1]); return tp(gv(10), gv(20)); });
            pts.forEach(p => ext(p[0], p[1]));
            const closed = (parseInt(g(70) || '0', 10) & 1) === 1;
            svgParts.push(`<${closed ? 'polygon' : 'polyline'} points="${pts.map(p => p[0] + ',' + -p[1]).join(' ')}" ${sa}/>`); break;
          }
          case 'CIRCLE': {
            const [a, b] = tp(n(10), n(20)), r = n(40) * scale; ext(a - r, b - r); ext(a + r, b + r);
            svgParts.push(`<circle cx="${a}" cy="${-b}" r="${r}" ${sa}/>`); break;
          }
          case 'ARC': {
            const cx = n(10), cy = n(20), r = n(40); let a0 = n(50), a1 = n(51); if (a1 < a0) a1 += 360;
            const P0 = tp(cx + r * Math.cos(a0 * Math.PI / 180), cy + r * Math.sin(a0 * Math.PI / 180));
            const P1 = tp(cx + r * Math.cos(a1 * Math.PI / 180), cy + r * Math.sin(a1 * Math.PI / 180));
            ext(...P0); ext(...P1);
            svgParts.push(`<path d="M${P0[0]},${-P0[1]} A${r * scale},${r * scale} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${P1[0]},${-P1[1]}" ${sa}/>`); break;
          }
          case 'SOLID': {
            const p = [[10, 20], [11, 21], [13, 23], [12, 22]].map(([a, b]) => tp(n(a), n(b)));
            svgParts.push(`<polygon points="${p.map(q => q[0] + ',' + -q[1]).join(' ')}" fill="${st.stroke}" stroke="none"/>`); break;
          }
          case 'TEXT': case 'MTEXT': {
            let s = e.type === 'TEXT' ? decode(g(1) || '') : mtextPlain(all(3).join('') + (g(1) || ''));
            if (!s.trim()) break;
            const h = n(40) * scale || 2.5;
            const ha = parseInt(g(72) || '0', 10), va = parseInt(g(73) || '0', 10);
            const att = parseInt(g(71) || '0', 10);
            let x = n(10), y = n(20);
            if (e.type === 'TEXT' && (ha || va) && g(11) !== undefined) { x = n(11); y = n(21); }
            const [a, b] = tp(x, y); ext(a, b);
            let anchor = 'start', base = 'auto';
            if (e.type === 'TEXT') { anchor = ha === 1 || ha === 4 ? 'middle' : ha === 2 ? 'end' : 'start'; base = va === 2 || ha === 4 ? 'middle' : va === 3 ? 'hanging' : 'auto'; }
            else { const col = (att - 1) % 3, row = Math.floor((att - 1) / 3); anchor = ['start', 'middle', 'end'][col] || 'start'; base = ['hanging', 'middle', 'auto'][row] || 'auto'; }
            const rot = -(n(50) + Math.atan2(M[2], M[0]) * 180 / Math.PI);
            svgParts.push(`<text x="${a}" y="${-b}" font-size="${h}" fill="${st.stroke}" text-anchor="${anchor}" dominant-baseline="${base}" font-family="Archivo, Arial, sans-serif"${rot ? ` transform="rotate(${rot} ${a} ${-b})"` : ''}>${esc(s)}</text>`);
            break;
          }
          case 'INSERT': case 'DIMENSION': {
            const B = D.blocks[(g(2) || '').trim()]; if (!B) break;
            if (e.type === 'DIMENSION') { draw(B.ents, M, depth + 1); break; }
            const sx = parseFloat(g(41) || '1'), sy = parseFloat(g(42) || '1'), r = n(50) * Math.PI / 180;
            const c = Math.cos(r), s = Math.sin(r), X = n(10), Y = n(20);
            const L = [c * sx, -s * sy, s * sx, c * sy, X, Y];        // local -> padre
            const N = [M[0] * L[0] + M[1] * L[2], M[0] * L[1] + M[1] * L[3], M[2] * L[0] + M[3] * L[2], M[2] * L[1] + M[3] * L[3],
                       M[0] * L[4] + M[1] * L[5] + M[4], M[2] * L[4] + M[3] * L[5] + M[5]];
            draw(B.ents, N, depth + 1); break;
          }
        }
      }
    }
    draw(D.entities, [1, 0, 0, 1, 0, 0], 0);
    if (!isFinite(minX)) return null;
    const pad = Math.max(maxX - minX, maxY - minY) * 0.02;
    const vb = [minX - pad, -maxY - pad, maxX - minX + 2 * pad, maxY - minY + 2 * pad];
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" stroke-width="1" style="width:100%;height:100%">${svgParts.join('')}</svg>`, viewBox: vb, count: svgParts.length };
  }
  return { render };
})();
