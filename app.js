/* =========================================================================
   WorkplaceFinder – Haupt-Dashboard (Grundriss, Filter, Kennzahlen, Vergleich)
   ========================================================================= */
(function () {
  'use strict';
  const WPF = window.WPF;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad2 = (n) => String(n).padStart(2, '0');
  const pct = (v) => `${Math.round(v)} %`;

  const state = (WPF.state = {
    building: 'aarepark',
    floor: 3,
    period: 'd90',
    mode: 'util',
    thr: 6,
    wc: { from: 8, to: 12, every: 25 },
    deptFocus: null,
  });

  const MODES = [
    { key: 'util', label: 'Auslastung', hint: 'Belegung aller Arbeitsplätze und Räume' },
    { key: 'risk', label: 'Gesundheitsrisiko', hint: 'Lange Sitzphasen ohne Unterbrechung' },
    { key: 'wc',   label: 'Toilettennutzung', hint: 'Eintritte je WC-Anlage im Zeitfenster' },
    { key: 'dept', label: 'Abteilungen', hint: 'Wer sitzt wo – inkl. Produktivitätsindex' },
    { key: 'low',  label: 'Unterauslastung', hint: 'Flächen unter 30 % Belegung' },
  ];

  /* ---------- Toolbar & Filter -------------------------------------------- */
  function buildControls() {
    $('#buildingButtons').innerHTML = Object.values(WPF.BUILDINGS)
      .map((b) => `<button class="tool-btn" data-building="${b.key}">${b.name} ${b.city}</button>`).join('');
    $('#periodButtons').innerHTML = Object.entries(WPF.PERIODS)
      .map(([k, p]) => `<button class="tool-btn" data-period="${k}">${p.label}</button>`).join('');
    $('#floorButtons').innerHTML = [1, 2, 3, 4]
      .map((f) => `<button class="floor-btn" data-floor="${f}" aria-label="Etage ${f}">${f}</button>`).join('');
    $('#modeList').innerHTML = MODES
      .map((m) => `<li><button class="mode-btn" data-mode="${m.key}"><span class="sq"></span><span><b>${m.label}</b><small>${m.hint}</small></span></button></li>`).join('');

    const hourOpts = (sel) => WPF.WC_SLOTS.concat([19]).map((h) => `<option value="${h}"${h === sel ? ' selected' : ''}>${pad2(h)}:00</option>`).join('');
    $('#wcFrom').innerHTML = hourOpts(state.wc.from);
    $('#wcTo').innerHTML = hourOpts(state.wc.to);

    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-building],[data-period],[data-floor],[data-mode],[data-dept]');
      if (!b) return;
      if (b.dataset.building) { state.building = b.dataset.building; state.deptFocus = null; }
      if (b.dataset.period) state.period = b.dataset.period;
      if (b.dataset.floor) { state.floor = +b.dataset.floor; state.deptFocus = null; }
      if (b.dataset.mode) state.mode = b.dataset.mode;
      if (b.dataset.dept) state.deptFocus = state.deptFocus === b.dataset.dept ? null : b.dataset.dept;
      render();
    });

    const thr = $('#thr');
    thr.addEventListener('input', () => { state.thr = +thr.value; render(); });
    const every = $('#wcEvery');
    every.addEventListener('input', () => { state.wc.every = +every.value; render(); });
    $('#wcFrom').addEventListener('change', (e) => {
      state.wc.from = +e.target.value;
      if (state.wc.to <= state.wc.from) state.wc.to = state.wc.from + 1;
      $('#wcTo').value = state.wc.to; render();
    });
    $('#wcTo').addEventListener('change', (e) => {
      state.wc.to = +e.target.value;
      if (state.wc.to <= state.wc.from) state.wc.from = state.wc.to - 1;
      $('#wcFrom').value = state.wc.from; render();
    });

    // Menü
    const menu = $('#menu'), btn = $('#menuBtn');
    btn.addEventListener('click', () => {
      const open = menu.hasAttribute('hidden');
      menu.toggleAttribute('hidden', !open);
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Close' : 'Menu';
    });
    $$('#menu a').forEach((a) => a.addEventListener('click', () => btn.click()));
  }

  /* ---------- Render ------------------------------------------------------ */
  function render() {
    const F = WPF.getFloor(state.building, state.floor);
    const S = WPF.getStats(state.building, state.floor, state.period);
    const B = WPF.BUILDINGS[state.building];

    $$('[data-building]').forEach((b) => b.classList.toggle('active', b.dataset.building === state.building));
    $$('[data-period]').forEach((b) => b.classList.toggle('active', b.dataset.period === state.period));
    $$('[data-floor]').forEach((b) => b.classList.toggle('active', +b.dataset.floor === state.floor));
    $$('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === state.mode));
    $('#thrVal').textContent = `${state.thr} h`;
    $('#wcEveryVal').textContent = `${state.wc.every}`;
    $('.param--risk').classList.toggle('is-active', state.mode === 'risk' || state.mode === 'util');
    $('.param--wc').classList.toggle('is-active', state.mode === 'wc' || state.mode === 'util');

    $('#mapTitle').innerHTML = `<b>${B.name} ${B.city}</b><span>Etage ${state.floor} · ${WPF.PERIODS[state.period].label} · ${B.concept}</span>`;
    $('#floorMap').innerHTML = WPF.renderFloor(F, { mode: state.mode, stats: S, thr: state.thr, wc: state.wc, deptFocus: state.deptFocus, idPrefix: 'main' });

    renderLegend();
    renderDeptChips(F);
    renderInsights(F, S);
    renderCaption(F, S);
    renderCompare();
    if (WPF.flows) WPF.flows.render();
  }
  WPF.render = render;

  function renderLegend() {
    const L = $('#legend');
    if (state.mode === 'util' || state.mode === 'low') {
      L.innerHTML = `<div class="lg-title">Legende</div>
        <div class="lg-row">Raum <b>Belegung, %</b></div><div class="lg-bar" style="background:${WPF.UTIL_GRADIENT}"></div><div class="lg-scale"><span>20</span><span>50</span><span>80</span></div>
        <div class="lg-row">Arbeitsplatz <b>Belegt, %</b></div><div class="lg-bar" style="background:${WPF.UTIL_GRADIENT}"></div><div class="lg-scale"><span>20</span><span>50</span><span>80</span></div>
        <div class="lg-key"><i class="k-risk">!</i>Sitzphase ≥ ${state.thr} h</div>
        ${state.mode === 'util' ? '<div class="lg-key"><i class="k-alert"></i>Reinigung benachrichtigt</div>' : '<div class="lg-key"><i class="k-box"></i>&lt; 30 % Belegung</div>'}`;
    } else if (state.mode === 'risk') {
      L.innerHTML = `<div class="lg-title">Legende</div>
        <div class="lg-key"><i class="k-risk">!</i>Längste Sitzphase ≥ ${state.thr} h</div>
        <div class="lg-key"><i class="k-mute"></i>Unauffällig</div>
        <p class="lg-note">Sensor erkennt durchgehende Präsenz ohne Unterbrechung (keine Pause ≥ 5 min).</p>`;
    } else if (state.mode === 'wc') {
      L.innerHTML = `<div class="lg-title">Legende</div>
        <div class="lg-row">WC <b>Eintritte ${pad2(state.wc.from)}–${pad2(state.wc.to)} Uhr</b></div>
        <div class="lg-bar" style="background:linear-gradient(90deg,${WPF.wcColor(0)},${WPF.wcColor(1)})"></div><div class="lg-scale"><span>wenig</span><span>viel</span></div>
        <div class="lg-key"><i class="k-alert"></i>Reinigung alle ${state.wc.every} Eintritte</div>`;
    } else if (state.mode === 'dept') {
      const F = WPF.getFloor(state.building, state.floor);
      L.innerHTML = `<div class="lg-title">Legende</div>` + F.depts.map((d) => {
        const dp = WPF.DEPARTMENTS[d];
        return `<div class="lg-key"><i style="background:${dp.color}"></i>${dp.name}</div>`;
      }).join('') + `<div class="lg-key"><i class="k-risk k-risk--sm">!</i>Gesundheitsrisiko</div>`;
    }
  }

  function renderDeptChips(F) {
    $('#deptList').innerHTML = F.depts.map((d) => {
      const dp = WPF.DEPARTMENTS[d];
      const on = state.deptFocus === d;
      return `<li><button class="dept-btn${on ? ' active' : ''}" data-dept="${d}"><i style="background:${dp.color}"></i>${dp.name}</button></li>`;
    }).join('');
  }

  function renderInsights(F, S) {
    const deskStats = F.desks.map((d) => S.desks[d.id]);
    const roomStats = F.rooms.map((r) => S.rooms[r.id]);
    const avg = (a, f) => a.reduce((s, x) => s + f(x), 0) / Math.max(1, a.length);
    const deskUtil = avg(deskStats, (s) => s.util);
    const roomUtil = avg(roomStats, (s) => s.util);
    const collab = F.rooms.filter((r) => r.type === 'collab').map((r) => S.rooms[r.id]);
    const riskN = deskStats.filter((s) => WPF.isRisk(s, state.thr)).length;
    const wcSum = F.toilets.reduce((s, t) => s + WPF.wcWindow(S.toilets[t.id], state.wc.from, state.wc.to), 0);
    const alerts = F.toilets.map((t) => ({ t, a: WPF.wcAlerts(S.toilets[t.id], state.wc.from, state.wc.to, state.wc.every) })).filter((x) => x.a.length);
    const live = state.period === 'today' ? deskStats.filter((s) => s.live).length : null;

    const summary = WPF.deptSummary(F, S, state.thr);
    const deptRows = Object.values(summary).sort((a, b) => b.riskShare - a.riskShare).map((o) => {
      const dp = WPF.DEPARTMENTS[o.dept];
      const flag = o.riskShare >= 0.2;
      return `<li class="${state.deptFocus && state.deptFocus !== o.dept ? 'dim' : ''}">
        <div class="dr-head"><span><i style="background:${dp.color}"></i>${dp.code}</span><span>${pct(o.util)}</span></div>
        <div class="dr-bar"><span style="width:${Math.min(100, o.util)}%;background:${WPF.utilColor(o.util)}"></span></div>
        <div class="dr-meta">${o.risk}/${o.desks} Risiko-Plätze · Prod.-Index ${o.prod}</div>
        ${flag ? `<div class="dr-flag">BGM: Rückenprävention ansprechen</div>` : ''}</li>`;
    }).join('');

    $('#insights').innerHTML = `
      <div class="kpi"><span class="kpi-label">Ø Belegung Arbeitsplätze</span><span class="kpi-val">${pct(deskUtil)}</span><span class="kpi-sub">Ziel Workplace 2030: 70 %</span></div>
      <div class="kpi"><span class="kpi-label">Ø Belegung Räume</span><span class="kpi-val">${pct(roomUtil)}</span><span class="kpi-sub">Kollaborationszonen: ${pct(avg(collab, (s) => s.util))}</span></div>
      ${live !== null ? `<div class="kpi"><span class="kpi-label">Jetzt belegt</span><span class="kpi-val">${live}<small>/${F.desks.length}</small></span><span class="kpi-sub">Arbeitsplätze, Echtzeit (simuliert)</span></div>` : ''}
      <div class="kpi kpi--risk"><span class="kpi-label">Gesundheitsrisiko</span><span class="kpi-val">${riskN}<small>/${F.desks.length}</small></span><span class="kpi-sub">Plätze mit Sitzphase ≥ ${state.thr} h</span></div>
      <div class="kpi"><span class="kpi-label">WC-Eintritte ${pad2(state.wc.from)}–${pad2(state.wc.to)} Uhr</span><span class="kpi-val">${wcSum}</span>
        <span class="kpi-sub">${alerts.length ? `${alerts.reduce((s, x) => s + x.a.length, 0)} Reinigungs-Benachrichtigungen` : 'Keine Benachrichtigung'}</span>
        ${alerts.length ? `<ul class="alert-list">${alerts.slice(0, 5).map((x) => `<li><span>${x.t.id}</span><span>${x.a.join(', ')}</span></li>`).join('')}</ul>` : ''}
      </div>
      <div class="kpi kpi--list"><span class="kpi-label">Abteilungen auf Etage ${state.floor}</span><ul class="dept-rows">${deptRows}</ul></div>`;
  }

  function renderCaption(F, S) {
    const low = F.rooms.filter((r) => r.type === 'collab' && S.rooms[r.id].util < 30).length;
    const msgs = {
      util: `Nicht jeder Arbeitsplatz wird gleich häufig genutzt. ${low} von ${F.rooms.filter((r) => r.type === 'collab').length} Kollaborationszonen liegen unter 30 % Belegung.`,
      risk: 'Dunkelrot markierte Plätze sind regelmässig über die Schwelle hinaus ohne Unterbrechung besetzt – Kandidaten für Angebote der betrieblichen Gesundheitsförderung (z. B. Rückenprävention, höhenverstellbare Tische, Bewegungspausen).',
      wc: 'Ein Personenzähler über der Tür jeder WC-Anlage zählt Eintritte. Ab der eingestellten Anzahl wird das Reinigungsteam automatisch benachrichtigt.',
      dept: 'Abteilungszonen zeigen, welche Nutzergruppen wo sitzen. So lassen sich Nutzungsmuster gleicher Abteilungen über Standorte und Layouts hinweg vergleichen.',
      low: 'Rot umrandete Flächen liegen im gewählten Zeitraum unter 30 % Belegung – Potenzial für Umnutzung oder Verdichtung.',
    };
    $('#caption').textContent = msgs[state.mode];
  }

  /* ---------- Standortvergleich ------------------------------------------- */
  function renderCompare() {
    const rows = WPF.compareDepartments(state.period, state.thr);
    const LA = WPF.layoutMetrics('aarepark'), LW = WPF.layoutMetrics('wankdorf');
    $('#layoutFacts').innerHTML = [['aarepark', LA], ['wankdorf', LW]].map(([bk, L]) => {
      const B = WPF.BUILDINGS[bk];
      return `<div class="fact"><b>${B.name} ${B.city}</b><span>${B.concept}</span>
        <dl><dt>Arbeitsplätze</dt><dd>${L.desks}</dd><dt>Raum-Sitzplätze je AP</dt><dd>${L.seatsPerDesk.toFixed(2)}</dd><dt>Fokusräume je 10 AP</dt><dd>${L.focusPer10.toFixed(2)}</dd></dl></div>`;
    }).join('');

    const cell = (c) => c
      ? `<td>${pct(c.util)}</td><td class="${c.riskShare >= 0.2 ? 'neg' : ''}">${pct(c.riskShare * 100)}</td><td>${c.prod}</td>`
      : '<td class="na">–</td><td class="na">–</td><td class="na">–</td>';
    const insights = [];
    const body = Object.keys(WPF.DEPARTMENTS).filter((d) => rows[d]).map((d) => {
      const dp = WPF.DEPARTMENTS[d], a = rows[d].aarepark, w = rows[d].wankdorf;
      let delta = '<td class="na">–</td>';
      if (a && w) {
        const diff = a.prod - w.prod;
        delta = `<td class="${diff >= 0 ? 'pos' : 'neg'}">${diff > 0 ? '+' : ''}${diff}</td>`;
        if (Math.abs(diff) >= 5) insights.push({ d, diff, a, w });
      }
      return `<tr><th><i style="background:${dp.color}"></i>${dp.name}</th>${cell(a)}${cell(w)}${delta}</tr>`;
    }).join('');
    $('#compareTable').innerHTML = `
      <thead><tr><th rowspan="2">Abteilung</th><th colspan="3">Aarepark Olten</th><th colspan="3">Wankdorf Bern</th><th rowspan="2">Δ Prod.</th></tr>
      <tr><th>Belegung</th><th>Risiko</th><th>Prod.</th><th>Belegung</th><th>Risiko</th><th>Prod.</th></tr></thead><tbody>${body}</tbody>`;

    insights.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
    $('#compareInsights').innerHTML = insights.slice(0, 3).map(({ d, diff, a, w }) => {
      const dp = WPF.DEPARTMENTS[d];
      const better = diff > 0 ? 'Aarepark' : 'Wankdorf';
      const worse = diff > 0 ? 'Wankdorf' : 'Aarepark';
      const hint = dp.focus >= 0.3 ? 'mehr Fokusräume / Rückzugsorte' : dp.meet >= 0.4 ? 'mehr Besprechungs- und Kollaborationsflächen' : 'Layout-Elemente des produktiveren Standorts';
      return `<li><b>${dp.name}:</b> gleiche Nutzergruppe, ${Math.abs(diff)} Punkte höherer Produktivitätsindex in ${better}. Hypothese: In ${worse} ${hint} testen (Pilotfläche, Vorher-/Nachher-Messung).</li>`;
    }).join('') || '<li>Keine deutlichen Unterschiede zwischen den Standorten.</li>';
  }

  /* ---------- Tooltip ----------------------------------------------------- */
  function bars(arr, labels, max = 1, color = '#111') {
    return `<div class="tt-bars">${arr.map((v, i) => `<span title="${labels[i]}"><i style="height:${Math.max(2, (v / max) * 100)}%;background:${color}"></i></span>`).join('')}</div>
      <div class="tt-axis"><span>${labels[0]}</span><span>${labels[labels.length - 1]}</span></div>`;
  }
  const row = (k, v, cls = '') => `<div class="tt-row ${cls}"><span>${k}</span><b>${v}</b></div>`;

  WPF.tooltipContent = function (kind, id, F, S) {
    const P = state.period;
    if (kind === 'desk') {
      const d = F.deskById[id], s = S.desks[id], dp = WPF.DEPARTMENTS[d.dept];
      const risk = WPF.isRisk(s, state.thr);
      const labels = WPF.DESK_SLOTS.map((h) => pad2(h));
      return `<div class="tt-type">Arbeitsplatz${state.period === 'today' ? ` · <em class="${s.live ? 'on' : ''}">${s.live ? 'belegt' : 'frei'}</em>` : ''}</div>
        <div class="tt-title">${d.id}</div>
        <div class="tt-dept"><i style="background:${dp.color}"></i>${dp.name}</div>
        ${row('Belegung', `${WPF.fmtH(s.hours)} / Tag`)}
        ${row('Auslastung', pct(s.util))}
        ${row('Längste Sitzphase', WPF.fmtH(s.longest), risk ? 'warn' : '')}
        ${row('Unterbrechungen', `${s.breaks} / Tag`)}
        ${P !== 'today' ? row(`Tage ≥ ${state.thr} h`, `${WPF.riskDays(s, state.thr, P)} / ${WPF.PERIODS[P].days}`, risk ? 'warn' : '') : ''}
        ${bars(s.profile, labels, 1, risk ? '#8B0000' : WPF.utilColor(s.util))}
        ${risk ? `<div class="tt-alert">! Erhöhtes Risiko (Bandscheibe/Rücken): Angebot der betrieblichen Gesundheitsförderung ansprechen.</div>` : ''}
        <div class="tt-foot">Sensor ${s.sensor} · ${WPF.PERIODS[P].label}</div>`;
    }
    if (kind === 'room') {
      const r = F.roomById[id], s = S.rooms[id];
      const zone = nearestZone(F, WPF.centerOf(r.rect));
      const dp = zone ? WPF.DEPARTMENTS[zone.dept] : null;
      const labels = WPF.DESK_SLOTS.map((h) => pad2(h));
      return `<div class="tt-type">${WPF.ROOM_TYPES[r.type].label}${state.period === 'today' ? ` · <em class="${s.live ? 'on' : ''}">${s.live ? 'belegt' : 'frei'}</em>` : ''}</div>
        <div class="tt-title">Raum ${r.id}</div>
        ${dp ? `<div class="tt-dept"><i style="background:${dp.color}"></i>Bereich ${dp.name}</div>` : ''}
        ${row('Belegung', `${WPF.fmtH(s.hours)} / Tag`)}
        ${row('Auslastung', pct(s.util), s.util < 30 ? 'warn' : '')}
        ${row('Kapazität', `${r.cap} ${r.cap === 1 ? 'Person' : 'Personen'}`)}
        ${r.cap > 1 ? row('Ø Personen bei Nutzung', s.avgPersons) : ''}
        ${bars(s.profile, labels, 1, WPF.utilColor(s.util))}
        ${s.util < 30 ? '<div class="tt-alert">Deutlich unterdurchschnittlich genutzt – Umnutzung prüfen.</div>' : ''}
        <div class="tt-foot">Sensor ${s.sensor} · ${WPF.PERIODS[P].label}</div>`;
    }
    if (kind === 'wc') {
      const t = F.toiletById[id], s = S.toilets[id];
      const win = WPF.wcWindow(s, state.wc.from, state.wc.to);
      const al = WPF.wcAlerts(s, state.wc.from, state.wc.to, state.wc.every);
      const hrs = state.wc.to - state.wc.from;
      const peakI = s.hourly.indexOf(Math.max(...s.hourly));
      const labels = WPF.WC_SLOTS.map((h) => pad2(h));
      const max = Math.max(...s.hourly);
      return `<div class="tt-type">Sanitär · Personenzähler</div>
        <div class="tt-title">${t.name}</div>
        <div class="tt-dept">${t.id}</div>
        ${row(`Eintritte ${pad2(state.wc.from)}–${pad2(state.wc.to)} Uhr`, win)}
        ${row('Ø pro Stunde', (win / hrs).toFixed(1))}
        ${row('Eintritte ganzer Tag', s.perDay)}
        ${row('Spitzenstunde', `${pad2(WPF.WC_SLOTS[peakI])}–${pad2(WPF.WC_SLOTS[peakI] + 1)} Uhr`)}
        ${bars(s.hourly.map((v, i) => v), labels, max, '#EB0000')}
        ${al.length ? `<div class="tt-alert">Reinigung benachrichtigt: ${al.join(', ')} Uhr<br>(Kontrolle Sauberkeit / Papier nachfüllen)</div>` : `<div class="tt-ok">Noch keine Benachrichtigung (Schwelle ${state.wc.every} Eintritte)</div>`}
        <div class="tt-foot">Sensor ${s.sensor} · ${WPF.PERIODS[P].label}</div>`;
    }
    if (kind === 'zone') {
      const z = F.zoneById[id], dp = WPF.DEPARTMENTS[z.dept];
      const sum = WPF.deptSummary(F, S, state.thr)[z.dept];
      return `<div class="tt-type">Abteilungszone</div>
        <div class="tt-title">${dp.name}</div>
        ${row('Arbeitsplätze in Zone', z.desks.length)}
        ${row('Ø Belegung (Abteilung)', pct(sum.util))}
        ${row('Ø längste Sitzphase', WPF.fmtH(sum.longest))}
        ${row('Risiko-Plätze', `${sum.risk} (${pct(sum.riskShare * 100)})`, sum.riskShare >= 0.2 ? 'warn' : '')}
        ${row('Produktivitätsindex*', sum.prod)}
        <div class="tt-foot">* fiktiv, 100 = Konzerndurchschnitt</div>`;
    }
    return '';
  };

  function nearestZone(F, p) {
    let best = null, bd = Infinity;
    F.zones.forEach((z) => {
      const c = WPF.centerOf(z.rect);
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bd) { bd = d; best = z; }
    });
    return best;
  }

  function initTooltip() {
    const tt = $('#tooltip');
    let current = null;
    const move = (e) => {
      const pad = 16, w = tt.offsetWidth, h = tt.offsetHeight;
      let x = e.clientX + pad, y = e.clientY + pad;
      if (x + w > window.innerWidth - 8) x = e.clientX - w - pad;
      if (y + h > window.innerHeight - 8) y = Math.max(8, window.innerHeight - h - 8);
      tt.style.transform = `translate(${x}px, ${y}px)`;
    };
    document.addEventListener('mousemove', (e) => {
      const hit = e.target.closest && e.target.closest('#floorMap .hit');
      if (!hit) {
        if (current) { tt.classList.remove('show'); current = null; }
        return;
      }
      const key = hit.dataset.kind + hit.dataset.id;
      if (key !== current) {
        current = key;
        const F = WPF.getFloor(state.building, state.floor);
        const S = WPF.getStats(state.building, state.floor, state.period);
        tt.innerHTML = WPF.tooltipContent(hit.dataset.kind, hit.dataset.id, F, S);
        tt.classList.add('show');
      }
      move(e);
    });
    window.addEventListener('scroll', () => { tt.classList.remove('show'); current = null; }, { passive: true });
  }

  function clock() {
    const d = new Date();
    $('#clock').textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())} · ${d.toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildControls();
    initTooltip();
    if (WPF.flows) WPF.flows.init();
    render();
    clock(); setInterval(clock, 30000);
  });
})();
