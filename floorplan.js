/* =========================================================================
   WorkplaceFinder – SVG-Renderer für Etagengrundrisse
   ========================================================================= */
(function () {
  'use strict';
  const WPF = window.WPF;

  const RISK = '#8B0000';
  const MUTE_DESK = '#E4E4E4';
  const MUTE_ROOM = '#EFEFEF';
  const FURN = 'rgba(255,255,255,.85)';

  const r1 = (n) => Math.round(n * 10) / 10;
  const rectAttr = (r) => `x="${r1(r.x)}" y="${r1(r.y)}" width="${r1(Math.max(0, r.w))}" height="${r1(Math.max(0, r.h))}"`;

  /**
   * ctx = {
   *   mode: 'util' | 'risk' | 'wc' | 'dept' | 'low' | 'mute',
   *   stats, thr, wc: {from,to,every}, deptFocus, idPrefix
   * }
   */
  WPF.renderFloor = function (F, ctx) {
    const [vw, vh] = F.viewBox;
    const S = ctx.stats;
    const mode = ctx.mode;
    const pre = ctx.idPrefix || 'p';
    const muted = mode === 'mute';
    const out = [];

    out.push(`<svg class="plan plan--${mode}" viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Grundriss Etage ${F.floorNo}">`);
    out.push(`<defs>
      <pattern id="${pre}-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="#cfcfcf" stroke-width="1.2"/>
      </pattern>
    </defs>`);

    // --- Gebäudehülle (Trick: Strichzeichnung + Füllung darüber = Aussenkontur)
    out.push('<g class="shell">');
    F.wings.forEach((w) => out.push(`<rect ${rectAttr(w)} fill="none" stroke="#2b2b2b" stroke-width="4"/>`));
    F.wings.forEach((w) => out.push(`<rect ${rectAttr(w)} fill="#fff"/>`));
    // Fensterteilung (dezente Punkte entlang der Fassade)
    F.wings.forEach((w) => {
      for (let x = w.x + 14; x < w.x + w.w - 6; x += 28) {
        out.push(`<circle cx="${x}" cy="${w.y + 1}" r="1.1" fill="#9a9a9a"/><circle cx="${x}" cy="${w.y + w.h - 1}" r="1.1" fill="#9a9a9a"/>`);
      }
    });
    if (F.shape === 'ring') {
      out.push(`<text class="courtyard" x="${vw / 2}" y="${vh / 2 + 4}" text-anchor="middle">INNENHOF</text>`);
    }
    out.push('</g>');

    // --- Abteilungszonen
    out.push('<g class="zones">');
    F.zones.forEach((z) => {
      const dp = WPF.DEPARTMENTS[z.dept];
      const focus = ctx.deptFocus && ctx.deptFocus !== z.dept;
      const tint = mode === 'dept' ? dp.color : 'transparent';
      const op = mode === 'dept' ? (focus ? 0.03 : 0.1) : 0;
      out.push(`<rect class="zone hit" data-kind="zone" data-id="${z.id}" ${rectAttr({ x: z.rect.x + 2, y: z.rect.y + 2, w: z.rect.w - 4, h: z.rect.h - 4 })}
        fill="${tint}" fill-opacity="${op}" stroke="${mode === 'dept' ? dp.color : '#d9d9d9'}" stroke-opacity="${focus ? 0.25 : 0.9}" stroke-dasharray="3 3" stroke-width="0.8" rx="3"/>`);
      const lx = z.rect.x + 7, ly = z.rect.y + 13;
      out.push(`<g class="zone-label${focus ? ' dim' : ''}" pointer-events="none">
        <rect x="${lx - 3}" y="${ly - 8.5}" width="${dp.code.length * 5.6 + 6}" height="11" rx="2" fill="${mode === 'dept' ? dp.color : '#fff'}" stroke="${mode === 'dept' ? 'none' : '#cfcfcf'}" stroke-width=".6"/>
        <text x="${lx}" y="${ly}" class="zone-code" fill="${mode === 'dept' ? '#fff' : '#777'}">${dp.code}</text></g>`);
    });
    out.push('</g>');

    // --- Kerne (Treppen, Lift)
    out.push('<g class="cores">');
    F.cores.forEach((c) => {
      out.push(`<rect ${rectAttr(c.stairs)} fill="url(#${pre}-hatch)" stroke="#bdbdbd" stroke-width=".8"/>`);
      out.push(`<rect ${rectAttr(c.lift)} fill="#f4f4f4" stroke="#bdbdbd" stroke-width=".8"/>`);
      const L = c.lift;
      out.push(`<path d="M${r1(L.x + 3)} ${r1(L.y + 3)}L${r1(L.x + L.w - 3)} ${r1(L.y + L.h - 3)}M${r1(L.x + L.w - 3)} ${r1(L.y + 3)}L${r1(L.x + 3)} ${r1(L.y + L.h - 3)}" stroke="#c9c9c9" stroke-width=".8"/>`);
    });
    out.push('</g>');

    // --- Räume
    out.push('<g class="rooms">');
    F.rooms.forEach((r) => {
      const st = S.rooms[r.id];
      let fill = MUTE_ROOM, op = 1, cls = '';
      if (mode === 'util' || mode === 'low') fill = WPF.utilColor(st.util);
      if (mode === 'low' && st.util >= 30) op = 0.25;
      if (mode === 'dept' || mode === 'risk' || mode === 'wc' || muted) fill = MUTE_ROOM;
      const colored = fill !== MUTE_ROOM;
      out.push(`<g class="room hit${cls}" data-kind="room" data-id="${r.id}" opacity="${op}">`);
      out.push(`<rect ${rectAttr(r.rect)} rx="2" fill="${fill}" stroke="${colored ? 'rgba(0,0,0,.18)' : '#cfcfcf'}" stroke-width=".8"/>`);
      out.push(furniture(r, colored ? FURN : '#cdcdcd'));
      out.push('</g>');
      if (mode === 'low' && st.util < 30) {
        out.push(`<rect class="flag-box" ${rectAttr({ x: r.rect.x - 3, y: r.rect.y - 3, w: r.rect.w + 6, h: r.rect.h + 6 })} fill="none" stroke="#EB0000" stroke-width="1.6"/>`);
      }
    });
    out.push('</g>');

    // --- Toiletten
    out.push('<g class="toilets">');
    const wcVals = F.toilets.map((t) => WPF.wcWindow(S.toilets[t.id], ctx.wc.from, ctx.wc.to));
    const wcMax = Math.max(1, ...wcVals);
    F.toilets.forEach((t, i) => {
      const val = wcVals[i];
      const alerts = WPF.wcAlerts(S.toilets[t.id], ctx.wc.from, ctx.wc.to, ctx.wc.every);
      const isWc = mode === 'wc';
      const fill = isWc ? WPF.wcColor(val / wcMax) : '#F3F1EE';
      const R = t.rect;
      const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
      out.push(`<g class="toilet hit" data-kind="wc" data-id="${t.id}">`);
      out.push(`<rect ${rectAttr(R)} rx="2" fill="${fill}" stroke="${isWc ? 'rgba(0,0,0,.2)' : '#cbc6bf'}" stroke-width=".8"/>`);
      if (isWc) {
        out.push(`<text x="${r1(cx)}" y="${r1(cy - 2)}" class="wc-count" text-anchor="middle" fill="${val / wcMax > 0.55 ? '#fff' : '#333'}">${val}</text>`);
        out.push(`<text x="${r1(cx)}" y="${r1(cy + 9)}" class="wc-sub" text-anchor="middle" fill="${val / wcMax > 0.55 ? '#fff' : '#777'}">WC ${t.gender}</text>`);
      } else {
        out.push(`<text x="${r1(cx)}" y="${r1(cy + 3)}" class="wc-label" text-anchor="middle">WC ${t.gender}</text>`);
      }
      out.push('</g>');
      if (alerts.length && !muted && (isWc || mode === 'util')) {
        const ax = R.x + R.w - 4, ay = R.y + 4;
        out.push(`<g class="alert" pointer-events="none"><circle class="pulse" cx="${r1(ax)}" cy="${r1(ay)}" r="5" fill="#EB0000"/><circle cx="${r1(ax)}" cy="${r1(ay)}" r="4" fill="#EB0000" stroke="#fff" stroke-width="1"/></g>`);
      }
    });
    out.push('</g>');

    // --- Arbeitsplätze
    out.push('<g class="desks">');
    const marks = [];
    F.desks.forEach((d) => {
      const st = S.desks[d.id];
      const risk = WPF.isRisk(st, ctx.thr);
      const focusDim = ctx.deptFocus && ctx.deptFocus !== d.dept;
      let fill = MUTE_DESK, op = 1;
      if (mode === 'util') fill = risk ? RISK : WPF.utilColor(st.util);
      else if (mode === 'risk') fill = risk ? RISK : MUTE_DESK;
      else if (mode === 'dept') fill = WPF.DEPARTMENTS[d.dept].color;
      else if (mode === 'low') { fill = WPF.utilColor(st.util); op = st.util < 30 ? 1 : 0.25; }
      if (focusDim) op = Math.min(op, 0.18);
      const R = d.rect;
      out.push(`<g class="desk hit" data-kind="desk" data-id="${d.id}" opacity="${op}">
        <circle cx="${r1(d.chair.x)}" cy="${r1(d.chair.y)}" r="3.4" fill="${muted ? '#dedede' : fill}" fill-opacity="${muted ? 1 : 0.55}"/>
        <rect ${rectAttr(R)} rx="1.5" fill="${fill}"/></g>`);
      if (mode === 'low' && st.util < 30) {
        marks.push(`<rect ${rectAttr({ x: R.x - 1.5, y: R.y - 1.5, w: R.w + 3, h: R.h + 3 })} fill="none" stroke="#EB0000" stroke-width="1" pointer-events="none"/>`);
      }
      if (risk && (mode === 'util' || mode === 'risk' || mode === 'dept') && !focusDim) {
        const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
        if (mode === 'dept') {
          marks.push(`<g pointer-events="none"><circle cx="${r1(R.x + R.w)}" cy="${r1(R.y)}" r="4" fill="${RISK}" stroke="#fff" stroke-width=".8"/><text x="${r1(R.x + R.w)}" y="${r1(R.y + 2.6)}" class="bang bang--sm" text-anchor="middle">!</text></g>`);
        } else {
          marks.push(`<text x="${r1(cx)}" y="${r1(cy + 3.6)}" class="bang" text-anchor="middle" pointer-events="none">!</text>`);
        }
      }
    });
    out.push('</g>');
    out.push(`<g class="marks">${marks.join('')}</g>`);
    out.push('<g class="overlay"></g>');
    out.push('</svg>');
    return out.join('');
  };

  function furniture(r, col) {
    const R = r.rect;
    const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
    const s = [];
    if (r.type === 'meeting') {
      const long = R.w > R.h;
      const tw = long ? R.w * 0.55 : R.w * 0.32, th = long ? R.h * 0.32 : R.h * 0.55;
      s.push(`<rect x="${r1(cx - tw / 2)}" y="${r1(cy - th / 2)}" width="${r1(tw)}" height="${r1(th)}" rx="${r1(Math.min(tw, th) / 2)}" fill="${col}"/>`);
      const n = Math.max(2, Math.floor(r.cap / 2));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        if (long) {
          const x = cx - tw / 2 + t * tw;
          s.push(`<circle cx="${r1(x)}" cy="${r1(cy - th / 2 - 4)}" r="2" fill="${col}"/><circle cx="${r1(x)}" cy="${r1(cy + th / 2 + 4)}" r="2" fill="${col}"/>`);
        } else {
          const y = cy - th / 2 + t * th;
          s.push(`<circle cx="${r1(cx - tw / 2 - 4)}" cy="${r1(y)}" r="2" fill="${col}"/><circle cx="${r1(cx + tw / 2 + 4)}" cy="${r1(y)}" r="2" fill="${col}"/>`);
        }
      }
    } else if (r.type === 'focus' || r.type === 'phone') {
      s.push(`<rect x="${r1(cx - 6)}" y="${r1(cy - 4)}" width="12" height="8" rx="1" fill="${col}"/><circle cx="${r1(cx)}" cy="${r1(cy + 8)}" r="2.2" fill="${col}"/>`);
    } else if (r.type === 'collab') {
      const long = R.w > R.h;
      const n = Math.max(1, Math.floor((long ? R.w : R.h) / 34));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = long ? R.x + t * R.w : cx, y = long ? cy : R.y + t * R.h;
        s.push(`<rect x="${r1(x - 8)}" y="${r1(y - 4)}" width="16" height="8" rx="4" fill="${col}"/>`);
      }
    } else if (r.type === 'lounge') {
      const cols = Math.max(2, Math.floor(R.w / 42)), rows = Math.max(2, Math.floor(R.h / 46));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const x = R.x + ((i + 0.5) / cols) * R.w, y = R.y + ((j + 0.5) / rows) * R.h;
        s.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="7" fill="${col}"/>`);
        [0, 1, 2].forEach((k) => {
          const a = (k / 3) * Math.PI * 2 + 0.5;
          s.push(`<circle cx="${r1(x + Math.cos(a) * 12)}" cy="${r1(y + Math.sin(a) * 12)}" r="2.2" fill="${col}"/>`);
        });
      }
    }
    return s.join('');
  }

  WPF.centerOf = function (r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
})();
