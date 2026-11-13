/* =========================================================================
   WorkplaceFinder – Movement Flows
   Wechsel zwischen Arbeitsplätzen und Räumen – anonym, aggregiert.
   Methode A: Abgleich täglich rotierender, gehashter MAC-Adressen
   Methode B: Schätzung über Sensor-Korrelation (Sensor aus → Sensor an)
   ========================================================================= */
(function () {
  'use strict';
  const WPF = window.WPF;
  const $ = (s, el = document) => el.querySelector(s);
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtT = (sec) => `${pad2(Math.floor(sec / 3600))}:${pad2(Math.floor((sec % 3600) / 60))}:${pad2(sec % 60)}`;

  const fs = { method: 'mac', window: 120, k: 5, hour: 'all', playing: null };

  const CATS = ['desk', 'meeting', 'focus', 'collab', 'lounge', 'wc'];
  const CAT_LABEL = { desk: 'Arbeitsplatz', meeting: 'Besprechung', focus: 'Fokus', collab: 'Kollaboration', lounge: 'Lounge', wc: 'WC' };
  const CAT_COLOR = { desk: '#111111', meeting: '#2E6FD8', focus: '#1FA6C2', collab: '#23AE73', lounge: '#C9893B', wc: '#9A9A9A' };
  const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const H_ACT = [0.7, 1.0, 1.1, 1.0, 0.9, 1.0, 1.15, 1.0, 0.8, 0.5];
  const H_MEET = [0.6, 1.5, 1.3, 1.0, 0.3, 0.8, 1.5, 1.2, 0.8, 0.4];
  const H_LOUNGE = [0.8, 0.5, 0.9, 0.6, 2.6, 1.4, 0.5, 1.2, 0.5, 0.3];

  const cat = (t) => (t === 'phone' ? 'focus' : t);

  /* ---------- Simulation -------------------------------------------------- */
  const cache = {};
  function simulate(F) {
    const key = F.building + '-' + F.floorNo;
    if (cache[key]) return cache[key];
    const rng = WPF.makeRng('flows-' + key);
    const nodes = {};
    // Arbeitsplätze werden auf Ebene Abteilungszone aggregiert (Datenschutz + Lesbarkeit)
    const zoneOfDesk = {};
    F.zones.forEach((z) => {
      const ds = z.desks.map((id) => F.deskById[id]);
      const cx = ds.reduce((s, d) => s + d.rect.x + d.rect.w / 2, 0) / ds.length;
      const cy = ds.reduce((s, d) => s + d.rect.y + d.rect.h / 2, 0) / ds.length;
      nodes[z.id] = { id: z.id, cat: 'desk', x: cx, y: cy, dept: z.dept, label: `Zone ${WPF.DEPARTMENTS[z.dept].code} (Tisch ${ds[0].no}–${ds[ds.length - 1].no})` };
      z.desks.forEach((id) => (zoneOfDesk[id] = z.id));
    });
    F.rooms.forEach((r) => {
      const p = WPF.centerOf(r.rect);
      nodes['r' + r.id] = { id: 'r' + r.id, cat: cat(r.type), x: p.x, y: p.y, label: `${WPF.ROOM_TYPES[r.type].short} ${r.id}` };
    });
    F.toilets.forEach((t) => {
      const p = WPF.centerOf(t.rect);
      nodes['w' + t.id] = { id: 'w' + t.id, cat: 'wc', x: p.x, y: p.y, label: t.id };
    });
    const byCat = {};
    Object.values(nodes).forEach((n) => (byCat[n.cat] = byCat[n.cat] || []).push(n));

    const events = [];
    const hex = () => Math.floor(rng.next() * 0xffffff).toString(16).padStart(6, '0');
    HOURS.forEach((h, hi) => {
      const n = Math.round(F.desks.length * 0.55 * H_ACT[hi] * rng.range(0.85, 1.15));
      for (let i = 0; i < n; i++) {
        const desk = rng.pick(F.desks);
        const src = nodes[zoneOfDesk[desk.id]];
        const dp = WPF.DEPARTMENTS[src.dept];
        const tcat = rng.weighted(['meeting', 'focus', 'collab', 'lounge', 'wc'],
          [dp.meet * H_MEET[hi] * 1.4, dp.focus * 0.9, 0.22 * (hi === 2 || hi >= 6 ? 1.4 : 1), 0.3 * H_LOUNGE[hi], 0.45]);
        const cands = byCat[tcat] || byCat.wc;
        const tgt = rng.weighted(cands, cands.map((c) => 1 / (1 + Math.hypot(c.x - src.x, c.y - src.y) / 140)));
        const back = rng.chance(0.42);
        const from = back ? tgt : src, to = back ? src : tgt;
        const dist = Math.hypot(tgt.x - src.x, tgt.y - src.y);
        const delta = Math.round(8 + dist * 0.16 + Math.pow(rng.next(), 2) * 160);
        events.push({
          t: h * 3600 + rng.int(0, 3599), hour: h, from: from.id, to: to.id, dist, delta,
          desk: desk.no, back, dept: src.dept, mac: rng.chance(0.84) ? hex() : null, real: true,
        });
      }
      // zufällige Koinzidenzen (Sensor A aus, Sensor B an – aber unterschiedliche Personen)
      const m = Math.round(n * 0.35);
      const all = Object.values(nodes);
      for (let i = 0; i < m; i++) {
        const a = rng.pick(all), b = rng.pick(all);
        if (a === b) continue;
        events.push({
          t: h * 3600 + rng.int(0, 3599), hour: h, from: a.id, to: b.id, dist: Math.hypot(a.x - b.x, a.y - b.y),
          delta: rng.int(5, 600), dept: a.dept || b.dept || null, mac: null, real: false,
        });
      }
    });
    events.sort((a, b) => a.t - b.t);
    return (cache[key] = { nodes, events });
  }

  // Welche Wechsel erkennt die gewählte Methode – und mit welcher Konfidenz?
  function evaluate(sim) {
    if (fs.method === 'mac') {
      return sim.events.filter((e) => e.real && e.mac).map((e) => ({ ...e, conf: 0.99 }));
    }
    const w = fs.window;
    return sim.events.filter((e) => e.delta <= w).map((e) => {
      const timing = 1 - e.delta / (w * 1.6);
      const near = 1 / (1 + e.dist / 700);
      return { ...e, conf: WPF.clamp(0.2 + 0.8 * timing * (0.6 + 0.4 * near), 0.05, 0.95) };
    });
  }

  /* ---------- UI ---------------------------------------------------------- */
  function init() {
    const root = $('#flows');
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fmethod],[data-fplay]');
      if (!b) return;
      if (b.dataset.fmethod) fs.method = b.dataset.fmethod;
      if (b.dataset.fplay !== undefined) togglePlay();
      render();
    });
    $('#fWindow').addEventListener('input', (e) => { fs.window = +e.target.value; render(); });
    $('#fK').addEventListener('input', (e) => { fs.k = +e.target.value; render(); });
    $('#fHour').addEventListener('input', (e) => {
      const v = +e.target.value;
      fs.hour = v === 7 ? 'all' : v;
      render();
    });

    // Tooltip für Flüsse
    const tt = $('#tooltip');
    $('#flowMap').addEventListener('mousemove', (e) => {
      const hit = e.target.closest('[data-flow]');
      if (!hit) { tt.classList.remove('show'); return; }
      tt.innerHTML = hit.dataset.flow;
      tt.classList.add('show');
      const w = tt.offsetWidth;
      let x = e.clientX + 16; if (x + w > window.innerWidth - 8) x = e.clientX - w - 16;
      tt.style.transform = `translate(${x}px, ${e.clientY + 16}px)`;
    });
    $('#flowMap').addEventListener('mouseleave', () => tt.classList.remove('show'));
  }

  function togglePlay() {
    if (fs.playing) { clearInterval(fs.playing); fs.playing = null; return; }
    if (fs.hour === 'all' || fs.hour >= 17) fs.hour = 8;
    fs.playing = setInterval(() => {
      fs.hour = fs.hour === 'all' ? 8 : fs.hour + 1;
      if (fs.hour > 17) { clearInterval(fs.playing); fs.playing = null; fs.hour = 17; }
      render();
    }, 1800);
  }

  function render() {
    const st = WPF.state;
    const F = WPF.getFloor(st.building, st.floor);
    const S = WPF.getStats(st.building, st.floor, st.period);
    const sim = simulate(F);
    const det = evaluate(sim);
    const inHour = fs.hour === 'all' ? det : det.filter((e) => e.hour === fs.hour);
    const B = WPF.BUILDINGS[st.building];

    // Controls
    document.querySelectorAll('[data-fmethod]').forEach((b) => b.classList.toggle('active', b.dataset.fmethod === fs.method));
    $('#fWindow').disabled = fs.method === 'mac';
    $('.fparam--window').classList.toggle('is-off', fs.method === 'mac');
    $('#fWindowVal').textContent = fs.window >= 60 ? `${Math.floor(fs.window / 60)} min ${fs.window % 60 ? (fs.window % 60) + ' s' : ''}` : `${fs.window} s`;
    $('#fKVal').textContent = `≥ ${fs.k}`;
    $('#fHour').value = fs.hour === 'all' ? 7 : fs.hour;
    $('#fHourVal').textContent = fs.hour === 'all' ? 'Ganzer Tag' : `${pad2(fs.hour)}:00–${pad2(fs.hour + 1)}:00`;
    $('[data-fplay]').textContent = fs.playing ? '❚❚ Pause' : '▶ Tagesverlauf abspielen';
    $('#flowTitle').innerHTML = `<b>${B.name} ${B.city}</b><span>Etage ${st.floor} · ${fs.hour === 'all' ? '08:00–18:00' : `${pad2(fs.hour)}:00–${pad2(fs.hour + 1)}:00`} · ${fs.method === 'mac' ? 'MAC-Abgleich (pseudonymisiert)' : 'Schätzung über Sensor-Korrelation'}</span>`;

    // Aggregation nach Knotenpaaren
    const agg = {};
    inHour.forEach((e) => {
      const k = e.from + '>' + e.to;
      const a = (agg[k] = agg[k] || { from: e.from, to: e.to, n: 0, conf: 0 });
      a.n++; a.conf += e.conf;
    });
    const arcs = Object.values(agg).filter((a) => a.n >= fs.k).sort((a, b) => b.n - a.n);
    arcs.forEach((a) => (a.conf /= a.n));
    const hidden = Object.values(agg).filter((a) => a.n < fs.k).reduce((s, a) => s + a.n, 0);

    // Karte
    let svg = WPF.renderFloor(F, { mode: 'mute', stats: S, thr: st.thr, wc: st.wc, idPrefix: 'flow' });
    const maxN = Math.max(1, ...arcs.map((a) => a.n));
    const inflow = {};
    arcs.forEach((a) => { inflow[a.to] = (inflow[a.to] || 0) + a.n; inflow[a.from] = (inflow[a.from] || 0) + a.n; });
    const lay = [];
    arcs.slice(0, 70).forEach((a, i) => {
      const A = sim.nodes[a.from], Bn = sim.nodes[a.to];
      const mx = (A.x + Bn.x) / 2, my = (A.y + Bn.y) / 2;
      const dx = Bn.x - A.x, dy = Bn.y - A.y, len = Math.hypot(dx, dy) || 1;
      const off = Math.min(80, len * 0.22);
      const cx = mx - (dy / len) * off, cy = my + (dx / len) * off;
      const d = `M${A.x.toFixed(1)} ${A.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${Bn.x.toFixed(1)} ${Bn.y.toFixed(1)}`;
      const colCat = Bn.cat === 'desk' ? A.cat : Bn.cat;
      const col = CAT_COLOR[colCat];
      const w = 0.8 + (a.n / maxN) * 5;
      const tip = `<div class='tt-type'>Fluss · ${CAT_LABEL[A.cat]} → ${CAT_LABEL[Bn.cat]}</div><div class='tt-title'>${A.label} → ${Bn.label}</div>
        <div class='tt-row'><span>Erkannte Wechsel</span><b>${a.n}</b></div><div class='tt-row'><span>Ø Konfidenz</span><b>${Math.round(a.conf * 100)} %</b></div>
        ${A.dept ? `<div class='tt-row'><span>Abteilung</span><b>${WPF.DEPARTMENTS[A.dept].code}</b></div>` : ''}
        <div class='tt-foot'>Aggregiert, keine Einzelpersonen (k ≥ ${fs.k})</div>`;
      lay.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w.toFixed(2)}" stroke-opacity="${a.conf < 0.55 ? 0.35 : 0.6}" ${a.conf < 0.55 ? 'stroke-dasharray="4 3"' : ''} stroke-linecap="round" class="flow-arc" data-flow="${tip.replace(/"/g, '&quot;')}"/>`);
      if (i < 45) {
        const dur = (2.2 + len / 260).toFixed(2);
        lay.push(`<circle r="2.4" fill="${col}" pointer-events="none"><animateMotion dur="${dur}s" repeatCount="indefinite" begin="${(i * 0.17).toFixed(2)}s" path="${d}"/></circle>`);
      }
    });
    Object.entries(inflow).forEach(([id, n]) => {
      const N = sim.nodes[id];
      if (!N) return;
      lay.push(`<circle cx="${N.x.toFixed(1)}" cy="${N.y.toFixed(1)}" r="${(2 + Math.sqrt(n) * 1.1).toFixed(1)}" fill="#fff" stroke="${CAT_COLOR[N.cat]}" stroke-width="1.4" pointer-events="none"/>`);
    });
    svg = svg.replace('<g class="overlay"></g>', `<g class="overlay">${lay.join('')}</g>`);
    $('#flowMap').innerHTML = svg;
    $('#flowLegend').innerHTML = `<div class="lg-title">Ziel des Wechsels</div>` +
      CATS.filter((c) => c !== 'desk').map((c) => `<div class="lg-key"><i style="background:${CAT_COLOR[c]}"></i>${CAT_LABEL[c]}</div>`).join('') +
      `<div class="lg-key"><i class="k-line"></i>sicher</div><div class="lg-key"><i class="k-line k-line--dash"></i>unsicher (&lt; 55 %)</div>`;

    // KPIs
    const realTotal = sim.events.filter((e) => e.real && (fs.hour === 'all' || e.hour === fs.hour)).length;
    const tp = inHour.filter((e) => e.real).length;
    const fp = inHour.length - tp;
    const avgConf = inHour.reduce((s, e) => s + e.conf, 0) / Math.max(1, inHour.length);
    $('#flowKpis').innerHTML = `
      <div class="kpi"><span class="kpi-label">Erkannte Wechsel</span><span class="kpi-val">${inHour.length}</span><span class="kpi-sub">${hidden} in Flüssen &lt; k ausgeblendet</span></div>
      <div class="kpi"><span class="kpi-label">Ø Konfidenz</span><span class="kpi-val">${Math.round(avgConf * 100)} %</span><span class="kpi-sub">${fs.method === 'mac' ? 'Gerät an beiden Orten gesehen' : `Zeitfenster ${$('#fWindowVal').textContent}`}</span></div>
      <div class="kpi"><span class="kpi-label">Abdeckung</span><span class="kpi-val">${Math.round((tp / Math.max(1, realTotal)) * 100)} %</span><span class="kpi-sub">der tatsächlichen Wechsel (Demo-Ground-Truth)</span></div>
      <div class="kpi ${fp / Math.max(1, inHour.length) > 0.2 ? 'kpi--risk' : ''}"><span class="kpi-label">Fehlzuordnungen</span><span class="kpi-val">${Math.round((fp / Math.max(1, inHour.length)) * 100)} %</span><span class="kpi-sub">zufällige Koinzidenzen</span></div>`;

    renderMatrix(sim, inHour);
    renderFeed(sim, inHour);
    renderForecast(sim, det, F);
    renderPatterns(sim, det);
  }

  function renderMatrix(sim, evs) {
    const M = {};
    CATS.forEach((a) => { M[a] = {}; CATS.forEach((b) => (M[a][b] = 0)); });
    evs.forEach((e) => { M[sim.nodes[e.from].cat][sim.nodes[e.to].cat]++; });
    const max = Math.max(1, ...CATS.flatMap((a) => CATS.map((b) => M[a][b])));
    $('#flowMatrix').innerHTML = `<thead><tr><th>von \\ nach</th>${CATS.map((c) => `<th>${CAT_LABEL[c]}</th>`).join('')}</tr></thead><tbody>` +
      CATS.map((a) => `<tr><th>${CAT_LABEL[a]}</th>${CATS.map((b) => {
        const v = M[a][b], t = v / max;
        return `<td style="background:rgba(235,0,0,${(t * 0.85).toFixed(2)});color:${t > 0.5 ? '#fff' : '#111'}">${v || '·'}</td>`;
      }).join('')}</tr>`).join('') + '</tbody>';
  }

  function renderFeed(sim, evs) {
    const list = evs.slice(-14).reverse();
    $('#flowFeed').innerHTML = list.map((e) => {
      const A = sim.nodes[e.from], Bn = sim.nodes[e.to];
      const lab = (N, isDeskSide) => (N.cat === 'desk' && e.desk && isDeskSide ? `Tisch ${e.desk}` : N.label);
      const id = fs.method === 'mac' ? `<span class="mac">#${e.mac}</span>` : `<span class="mac">≈</span>`;
      return `<li><span class="t">${fmtT(e.t)}</span>${id}<span class="ev">${lab(A, true)} <em>aus</em> → ${lab(Bn, true)} <em>an</em></span><span class="meta">Δ ${e.delta} s · ${Math.round(e.conf * 100)} %</span></li>`;
    }).join('') || '<li class="empty">Keine Wechsel im gewählten Zeitraum.</li>';
  }

  function renderForecast(sim, det, F) {
    // Ist: Wechsel in Besprechungsräume je Stunde; Prognose: gewichteter Mittelwert aus Vorstunde + historischem Muster
    const cap = F.rooms.filter((r) => r.type === 'meeting').reduce((s, r) => s + r.cap, 0) || 1;
    const ist = HOURS.map((h) => det.filter((e) => e.hour === h && sim.nodes[e.to].cat === 'meeting').length);
    const scale = (v) => Math.min(100, (v / cap) * 100 * 1.6);
    const istP = ist.map(scale);
    const rng = WPF.makeRng('fc-' + F.building + F.floorNo + fs.method);
    const hist = istP.map((v) => WPF.clamp(v * rng.range(0.85, 1.15) + rng.normal(0, 4), 0, 100));
    const fc = istP.map((v, i) => (i === 0 ? hist[0] : 0.55 * istP[i - 1] + 0.45 * hist[i]));
    const cur = fs.hour === 'all' ? 17 : fs.hour;
    const W = 520, H = 190, pl = 30, pr = 10, pt = 12, pb = 24;
    const x = (i) => pl + (i / (HOURS.length - 1)) * (W - pl - pr);
    const y = (v) => pt + (1 - v / 100) * (H - pt - pb);
    const ci = HOURS.indexOf(cur);
    const pathIst = istP.slice(0, ci + 1).map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
    const pathFc = fc.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
    const grid = [0, 25, 50, 75, 100].map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="#eee"/><text x="${pl - 6}" y="${y(v) + 3}" text-anchor="end" class="ax">${v}</text>`).join('');
    const xl = HOURS.map((h, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="ax">${pad2(h)}</text>`).join('');
    const next = ci < HOURS.length - 1 ? Math.round(fc[ci + 1]) : null;
    $('#flowForecast').innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="chart">${grid}${xl}
      <rect x="${x(ci)}" y="${pt}" width="${W - pr - x(ci)}" height="${H - pt - pb}" fill="#fafafa"/>
      <path d="${pathFc}" fill="none" stroke="#EB0000" stroke-width="1.6" stroke-dasharray="5 4"/>
      <path d="${pathIst}" fill="none" stroke="#111" stroke-width="2"/>
      <line x1="${x(ci)}" x2="${x(ci)}" y1="${pt}" y2="${H - pb}" stroke="#111" stroke-width=".8"/>
      <circle cx="${x(ci)}" cy="${y(istP[ci])}" r="3.5" fill="#111"/></svg>
      <div class="chart-legend"><span><i class="k-line"></i>Ist</span><span><i class="k-line k-line--red"></i>Prognose</span>
      ${next !== null ? `<span class="fc-next">Prognose ${pad2(cur + 1)}:00 Uhr: <b>${next} %</b> Belegung Besprechungsräume</span>` : ''}</div>`;
  }

  function renderPatterns(sim, det) {
    const out = [];
    // 1. Peak Desk → Meeting
    const perH = HOURS.map((h) => det.filter((e) => e.hour === h && sim.nodes[e.from].cat === 'desk' && sim.nodes[e.to].cat === 'meeting').length);
    const top2 = perH.map((v, i) => [v, HOURS[i]]).sort((a, b) => b[0] - a[0]).slice(0, 2).map((x) => pad2(x[1]) + ':00').sort();
    out.push(`Spitzen der Wechsel <b>Arbeitsplatz → Besprechung</b> um ${top2.join(' und ')} Uhr – Besprechungsräume zu diesen Zeiten frühzeitig freigeben bzw. Buchungen prüfen.`);
    // 2. Abteilungen & Fokusräume
    const byDept = {};
    det.forEach((e) => {
      const A = sim.nodes[e.from], Bn = sim.nodes[e.to];
      if (A.cat !== 'desk' || !A.dept) return;
      const o = (byDept[A.dept] = byDept[A.dept] || { all: 0, focus: 0 });
      o.all++; if (Bn.cat === 'focus') o.focus++;
    });
    const ds = Object.entries(byDept).filter(([, o]) => o.all >= 8).map(([d, o]) => [d, o.focus / o.all]).sort((a, b) => b[1] - a[1]);
    if (ds.length >= 2) {
      const [hi, lo] = [ds[0], ds[ds.length - 1]];
      const f = lo[1] > 0 ? (hi[1] / lo[1]).toFixed(1) + '×' : 'deutlich';
      out.push(`<b>${WPF.DEPARTMENTS[hi[0]].name}</b> wechselt ${f} so häufig in Fokusräume wie <b>${WPF.DEPARTMENTS[lo[0]].name}</b> – Fokusräume näher an dieser Abteilung platzieren.`);
    }
    // 3. meistgenutztes Ziel
    const tgt = {};
    det.forEach((e) => { const N = sim.nodes[e.to]; if (N.cat !== 'desk') tgt[N.id] = (tgt[N.id] || 0) + 1; });
    const best = Object.entries(tgt).sort((a, b) => b[1] - a[1])[0];
    if (best) out.push(`Meistangesteuertes Ziel: <b>${sim.nodes[best[0]].label}</b> (${best[1]} Wechsel/Tag).`);
    // 4. Geschwindigkeit
    const quick = det.filter((e) => e.delta <= 60).length / Math.max(1, det.length);
    out.push(`${Math.round(quick * 100)} % der erkannten Wechsel erfolgen innerhalb von 60 s – kurze Wege, Zuordnung meist eindeutig.`);
    if (fs.method === 'est') out.push(`Grösseres Zeitfenster ⇒ mehr erkannte Wechsel, aber mehr Fehlzuordnungen. Schieberegler ausprobieren.`);
    $('#flowPatterns').innerHTML = out.map((s) => `<li>${s}</li>`).join('');
  }

  WPF.flows = { init, render };
})();
