/* =========================================================================
   WorkplaceFinder – Datenmodell & Simulation
   Alle Werte sind FIKTIV und werden deterministisch (seeded) zufällig erzeugt.
   ========================================================================= */
(function () {
  'use strict';
  const WPF = (window.WPF = window.WPF || {});

  /* ---------- Seeded Random ---------------------------------------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function makeRng(key) {
    const r = mulberry32(hashStr(String(key)));
    return {
      next: r,
      range: (a, b) => a + (b - a) * r(),
      int: (a, b) => Math.floor(a + (b - a + 1) * r()),
      pick: (arr) => arr[Math.floor(r() * arr.length)],
      chance: (p) => r() < p,
      normal: (m = 0, s = 1) => {
        let u = 0; while (u === 0) u = r();
        const v = r();
        return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      },
      weighted: (items, weights) => {
        const tot = weights.reduce((a, b) => a + b, 0);
        let x = r() * tot;
        for (let i = 0; i < items.length; i++) { x -= weights[i]; if (x <= 0) return items[i]; }
        return items[items.length - 1];
      },
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  WPF.makeRng = makeRng;
  WPF.clamp = clamp;

  /* ---------- Abteilungen ------------------------------------------------- */
  // sit = Neigung zu langen Sitzphasen, meet = Besprechungen, focus = Fokusräume, prod = Basis-Produktivität (fiktiv)
  WPF.DEPARTMENTS = {
    HR:   { code: 'HR',   name: 'Human Resources',          color: '#B5739D', sit: 0.55, meet: 0.35, focus: 0.15, prod: 101 },
    IT:   { code: 'IT',   name: 'IT & Digital',             color: '#4E7FBF', sit: 0.86, meet: 0.20, focus: 0.38, prod: 103 },
    FIN:  { code: 'FIN',  name: 'Finanzen & Controlling',   color: '#C9893B', sit: 0.80, meet: 0.15, focus: 0.25, prod: 99 },
    ORG:  { code: 'ORG',  name: 'Organisation & Strategie', color: '#6E9E75', sit: 0.50, meet: 0.50, focus: 0.20, prod: 102 },
    CR:   { code: 'CR',   name: 'Client Relations',         color: '#C25B56', sit: 0.45, meet: 0.48, focus: 0.10, prod: 103 },
    LEG:  { code: 'LEG',  name: 'Recht & Compliance',       color: '#7A6BA8', sit: 0.76, meet: 0.20, focus: 0.45, prod: 98 },
    COM:  { code: 'COM',  name: 'Kommunikation',            color: '#4E9BA6', sit: 0.55, meet: 0.35, focus: 0.20, prod: 100 },
    CREM: { code: 'CREM', name: 'Corporate Real Estate',    color: '#A89A4A', sit: 0.50, meet: 0.40, focus: 0.20, prod: 101 },
    OPS:  { code: 'OPS',  name: 'Operations',               color: '#7D7D7D', sit: 0.66, meet: 0.25, focus: 0.10, prod: 97 },
    PRO:  { code: 'PRO',  name: 'Einkauf',                  color: '#5F6FA0', sit: 0.70, meet: 0.20, focus: 0.20, prod: 99 },
  };

  /* ---------- Gebäude / Grundrisse ----------------------------------------
     Ein Grundriss besteht aus "Flügeln" (wings). Jeder Flügel wird entlang
     seiner Längsachse mit Modulen gefüllt: desks | pod | core | lounge.
     Gewichte bestimmen die relative Modulbreite.                            */
  WPF.BUILDINGS = {
    aarepark: {
      key: 'aarepark', name: 'Aarepark', city: 'Olten',
      concept: 'Activity Based Working', shape: 'L',
      viewBox: [1200, 710],
      wings: [
        { x: 40, y: 30, w: 600, h: 170, dir: 'h', modules: [['desks', 2.2], ['core', 1.15], ['pod', 1.0], ['lounge', 1.6]] },
        { x: 40, y: 200, w: 170, h: 300, dir: 'v', modules: [['core', 1.1], ['pod', 1.0], ['desks', 1.25]] },
        { x: 40, y: 500, w: 1120, h: 180, dir: 'h', modules: [['desks', 1.3], ['pod', 0.9], ['desks', 1.5], ['core', 1.1], ['desks', 1.5], ['pod', 0.9], ['desks', 1.5], ['core', 1.1], ['desks', 1.2], ['pod', 0.9], ['desks', 1.0]] },
      ],
      floors: {
        1: ['CR', 'CR', 'CR', 'CR', 'COM', 'COM', 'OPS', 'OPS'],
        2: ['HR', 'HR', 'FIN', 'FIN', 'FIN', 'LEG', 'LEG', 'LEG'],
        3: ['IT', 'IT', 'IT', 'IT', 'ORG', 'ORG', 'CREM', 'CREM'],
        4: ['ORG', 'HR', 'IT', 'IT', 'CR', 'CR', 'PRO', 'PRO'],
      },
    },
    wankdorf: {
      key: 'wankdorf', name: 'Wankdorf', city: 'Bern',
      concept: 'Desk Sharing (dicht)', shape: 'ring',
      viewBox: [1200, 710],
      wings: [
        { x: 40, y: 30, w: 1120, h: 160, dir: 'h', modules: [['core', 1.1], ['desks', 2], ['pod', 0.8], ['desks', 2], ['desks', 2], ['core', 1.1], ['desks', 2]] },
        { x: 40, y: 190, w: 160, h: 320, dir: 'v', modules: [['desks', 1.5], ['pod', 0.8], ['desks', 1.5]] },
        { x: 1000, y: 190, w: 160, h: 320, dir: 'v', modules: [['desks', 1.5], ['core', 1.1], ['desks', 1.2]] },
        { x: 40, y: 510, w: 1120, h: 170, dir: 'h', modules: [['desks', 2], ['pod', 0.8], ['desks', 2], ['lounge', 1.2], ['desks', 2], ['core', 1.1], ['desks', 2]] },
      ],
      floors: {
        1: ['CR', 'CR', 'COM', 'COM', 'OPS', 'OPS', 'CR', 'CR', 'OPS', 'OPS', 'PRO', 'PRO'],
        2: ['IT', 'IT', 'IT', 'IT', 'FIN', 'FIN', 'IT', 'IT', 'FIN', 'FIN', 'LEG', 'LEG'],
        3: ['HR', 'HR', 'ORG', 'ORG', 'CREM', 'CREM', 'HR', 'HR', 'IT', 'IT', 'IT', 'IT'],
        4: ['ORG', 'ORG', 'CR', 'CR', 'LEG', 'LEG', 'COM', 'COM', 'HR', 'HR', 'FIN', 'FIN'],
      },
    },
  };

  WPF.ROOM_TYPES = {
    meeting: { label: 'Besprechungsraum', short: 'Besprechung' },
    focus:   { label: 'Fokusraum',        short: 'Fokus' },
    phone:   { label: 'Telefonbox',       short: 'Fokus' },
    collab:  { label: 'Kollaborationszone', short: 'Kollaboration' },
    lounge:  { label: 'Lounge / Café',    short: 'Lounge' },
  };

  /* ---------- Layout-Generator -------------------------------------------- */
  const layoutCache = {};
  WPF.getFloor = function (bk, floorNo) {
    const key = bk + '-' + floorNo;
    if (!layoutCache[key]) layoutCache[key] = layoutFloor(bk, floorNo);
    return layoutCache[key];
  };

  function layoutFloor(bk, floorNo) {
    const B = WPF.BUILDINGS[bk];
    const rng = makeRng(`layout-${bk}-${floorNo}`);
    const deptSeq = B.floors[floorNo].slice();
    const F = {
      building: bk, floorNo, viewBox: B.viewBox, shape: B.shape,
      wings: B.wings, desks: [], rooms: [], toilets: [], cores: [], zones: [], clusters: [],
    };
    let deskNo = 0, roomNo = 0, coreNo = 0;

    B.wings.forEach((wing) => {
      const horiz = wing.dir === 'h';
      const L = horiz ? wing.w : wing.h;
      const D = horiz ? wing.h : wing.w;
      const R = (u, v, du, dv) => horiz
        ? { x: wing.x + u, y: wing.y + v, w: du, h: dv }
        : { x: wing.x + v, y: wing.y + u, w: dv, h: du };
      const P = (u, v) => horiz ? { x: wing.x + u, y: wing.y + v } : { x: wing.x + v, y: wing.y + u };
      const pad = 10, gap = 8;
      const tot = wing.modules.reduce((s, m) => s + m[1], 0);
      const unit = (L - 2 * pad - gap * (wing.modules.length - 1)) / tot;
      let u = pad;
      const deskMods = [];

      wing.modules.forEach(([type, wgt]) => {
        const du = wgt * unit;
        if (type === 'desks') {
          const dept = deptSeq.shift() || 'OPS';
          const mod = { dept, rect: R(u, 0, du, D), desks: [] };
          const DW = 21, DD = 15, CG = 12, cw = 2 * DW;
          const n = Math.max(1, Math.floor((du + CG) / (cw + CG)));
          const used = n * cw + (n - 1) * CG;
          const u0 = u + (du - used) / 2;
          [[0, D / 2], [D / 2, D]].forEach(([v0, v1]) => {
            const vTop = (v0 + v1) / 2 - DD;
            for (let i = 0; i < n; i++) {
              const cu = u0 + i * (cw + CG);
              const cluster = { id: 'c' + F.clusters.length, dept, desks: [], center: P(cu + DW, vTop + DD) };
              for (let r = 0; r < 2; r++) {
                for (let c = 0; c < 2; c++) {
                  if (rng.chance(0.05)) continue;
                  deskNo++;
                  const desk = {
                    id: `${floorNo}.${String(deskNo).padStart(3, '0')}`, no: deskNo, dept,
                    rect: R(cu + c * DW + 0.8, vTop + r * DD + 0.8, DW - 1.6, DD - 1.6),
                    chair: P(cu + c * DW + DW / 2, r === 0 ? vTop - 5 : vTop + 2 * DD + 5),
                    cluster: cluster.id,
                  };
                  cluster.desks.push(desk.id);
                  mod.desks.push(desk);
                  F.desks.push(desk);
                }
              }
              if (cluster.desks.length) F.clusters.push(cluster);
            }
          });
          deskMods.push(mod);
        } else if (type === 'pod') {
          const pat = rng.pick(['A', 'B', 'C']);
          const m = 2;
          const room = (t, u1, v1, du1, dv1, cap) => {
            roomNo++;
            F.rooms.push({
              id: `${floorNo}.${String(roomNo).padStart(2, '0')}`, type: t, cap,
              rect: R(u1 + m, v1 + m, du1 - 2 * m, dv1 - 2 * m),
              horiz,
            });
          };
          if (pat === 'A') {
            room('meeting', u, 0, du, D * 0.46, rng.int(6, 10));
            room('focus', u, D * 0.46, du / 2, D * 0.26, 1);
            room('focus', u + du / 2, D * 0.46, du / 2, D * 0.26, 1);
            room('collab', u, D * 0.72, du, D * 0.28, rng.int(4, 6));
          } else if (pat === 'B') {
            room('collab', u, 0, du, D * 0.38, rng.int(4, 8));
            room('meeting', u, D * 0.38, du, D * 0.4, rng.int(6, 8));
            room('phone', u, D * 0.78, du / 2, D * 0.22, 1);
            room('phone', u + du / 2, D * 0.78, du / 2, D * 0.22, 1);
          } else {
            room('meeting', u, 0, du / 2, D * 0.5, 4);
            room('meeting', u + du / 2, 0, du / 2, D * 0.5, 4);
            room('focus', u, D * 0.5, du / 2, D * 0.25, 1);
            room('focus', u + du / 2, D * 0.5, du / 2, D * 0.25, 1);
            room('collab', u, D * 0.75, du, D * 0.25, rng.int(3, 5));
          }
        } else if (type === 'core') {
          coreNo++;
          const cid = `${floorNo}.${coreNo}`;
          const m = 2;
          ['D', 'H'].forEach((g, gi) => {
            F.toilets.push({
              id: `WC ${cid} ${g}`, core: cid, gender: g,
              name: g === 'D' ? 'WC-Anlage Damen' : 'WC-Anlage Herren',
              rect: R(u + gi * du / 2 + m, 0 + m, du / 2 - 2 * m, D * 0.48 - 2 * m),
            });
          });
          F.cores.push({
            id: cid,
            stairs: R(u + m, D * 0.52 + m, du * 0.6 - 2 * m, D * 0.48 - 2 * m),
            lift: R(u + du * 0.6 + m, D * 0.52 + m, du * 0.4 - 2 * m, D * 0.3 - 2 * m),
            rect: R(u, 0, du, D),
          });
        } else if (type === 'lounge') {
          roomNo++;
          F.rooms.push({
            id: `${floorNo}.${String(roomNo).padStart(2, '0')}`, type: 'lounge', cap: rng.int(14, 22),
            rect: R(u + 3, 3, du - 6, D - 6), horiz,
          });
        }
        u += du + gap;
      });

      // Abteilungszonen: aufeinanderfolgende Desk-Module derselben Abteilung zusammenfassen
      let run = null;
      deskMods.forEach((mod) => {
        if (run && run.dept === mod.dept) {
          const x1 = Math.min(run.rect.x, mod.rect.x), y1 = Math.min(run.rect.y, mod.rect.y);
          const x2 = Math.max(run.rect.x + run.rect.w, mod.rect.x + mod.rect.w);
          const y2 = Math.max(run.rect.y + run.rect.h, mod.rect.y + mod.rect.h);
          run.rect = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
          run.desks.push(...mod.desks.map((d) => d.id));
        } else {
          run = { id: 'z' + F.zones.length, dept: mod.dept, rect: { ...mod.rect }, desks: mod.desks.map((d) => d.id) };
          F.zones.push(run);
        }
      });
    });

    F.deskById = Object.fromEntries(F.desks.map((d) => [d.id, d]));
    F.roomById = Object.fromEntries(F.rooms.map((r) => [r.id, r]));
    F.toiletById = Object.fromEntries(F.toilets.map((t) => [t.id, t]));
    F.zoneById = Object.fromEntries(F.zones.map((z) => [z.id, z]));
    F.depts = [...new Set(F.desks.map((d) => d.dept))];
    return F;
  }

  /* ---------- Simulation der Belegung ------------------------------------- */
  WPF.PERIODS = {
    today: { label: 'Heute', sd: 1.0, days: 1 },
    d7:    { label: 'Ø 7 Tage', sd: 0.55, days: 5 },
    d90:   { label: 'Ø 90 Tage', sd: 0.3, days: 63 },
  };
  WPF.REF_HOURS = 10;                // Bezugszeit 08:00–18:00
  WPF.DESK_SLOTS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const DESK_W = [0.55, 0.85, 0.95, 0.9, 0.45, 0.7, 0.9, 0.85, 0.65, 0.35];
  const DESK_W_SUM = DESK_W.reduce((a, b) => a + b, 0);
  WPF.WC_SLOTS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const WC_W = [0.3, 0.8, 1.0, 1.1, 0.9, 0.7, 1.25, 1.0, 0.9, 0.8, 0.5, 0.25];
  const WC_W_SUM = WC_W.reduce((a, b) => a + b, 0);
  const ROOM_BASE = { meeting: [52, 18], focus: [55, 18], phone: [45, 18], collab: [27, 11], lounge: [40, 14] };

  const simCache = {};
  WPF.getStats = function (bk, floorNo, periodKey) {
    const key = `${bk}-${floorNo}-${periodKey}`;
    if (!simCache[key]) simCache[key] = simulate(WPF.getFloor(bk, floorNo), periodKey);
    return simCache[key];
  };

  WPF.currentSlot = function () {
    const h = new Date().getHours();
    return clamp(h, 8, 17) - 8;
  };

  function simulate(F, periodKey) {
    const P = WPF.PERIODS[periodKey];
    const base = makeRng(`base-${F.building}-${F.floorNo}`);
    const per = makeRng(`per-${F.building}-${F.floorNo}-${periodKey}`);
    const slotNow = WPF.currentSlot();
    const desks = {}, rooms = {}, toilets = {};

    F.desks.forEach((d) => {
      const dp = WPF.DEPARTMENTS[d.dept];
      const ghost = base.chance(0.08);          // unattraktive Plätze
      const sitter = base.chance(0.07);         // "Dauersitzer"
      let h = base.normal(2.4 + dp.sit * 6, 1.2);
      if (ghost) h *= 0.25;
      h = clamp(h + per.normal(0, 1.2 * P.sd), 0.2, 9.6);
      const ratio = clamp(0.26 + dp.sit * 0.44 + base.normal(0, 0.11) + (sitter ? 0.3 : 0), 0.15, 0.97);
      const longest = clamp(h * ratio + per.normal(0, 0.5 * P.sd), 0.1, h);
      const profile = DESK_W.map((w) => clamp((w * h) / DESK_W_SUM * (1 + per.normal(0, 0.12)), 0, 1));
      const breaks = Math.max(0, Math.round((h - longest) / 0.9 + per.normal(0, 0.6)));
      desks[d.id] = {
        hours: h, util: (h / WPF.REF_HOURS) * 100, longest, profile, breaks,
        live: per.next() < profile[slotNow],
        sensor: 'Elsys EMS Desk',
      };
    });

    F.rooms.forEach((r) => {
      const [m, s] = ROOM_BASE[r.type];
      let u = base.normal(m, s);
      u = clamp(u + per.normal(0, 8 * P.sd), 4, 96);
      const hours = (u / 100) * WPF.REF_HOURS;
      const profile = DESK_W.map((w) => clamp((w * hours) / DESK_W_SUM * (1 + per.normal(0, 0.2)), 0, 1));
      const avgPersons = r.cap === 1 ? 1 : clamp(Math.round(r.cap * base.range(0.3, 0.7)), 1, r.cap);
      rooms[r.id] = {
        util: u, hours, profile, avgPersons,
        live: per.next() < profile[slotNow],
        sensor: r.type === 'meeting' || r.type === 'lounge' ? 'TeraBee People Counting' : 'Elsys ERS Eye',
      };
    });

    const people = F.desks.length;
    F.toilets.forEach((t) => {
      const loc = base.range(0.7, 1.4);          // Lage (nahe Lounge/Eingang → höher)
      const perDay = (people / F.toilets.length) * 3.6 * loc * (1 + per.normal(0, 0.12 * P.sd));
      const hourly = WC_W.map((w) => Math.max(0, Math.round((perDay * w) / WC_W_SUM * (1 + per.normal(0, 0.22 * P.sd)))));
      toilets[t.id] = { hourly, perDay: hourly.reduce((a, b) => a + b, 0), sensor: 'TeraBee People Counting (Türsturz)' };
    });

    return { desks, rooms, toilets, period: periodKey };
  }

  /* ---------- Abgeleitete Kennzahlen -------------------------------------- */
  WPF.isRisk = (ds, thr) => ds.longest >= thr;
  WPF.riskDays = function (ds, thr, periodKey) {
    const P = WPF.PERIODS[periodKey];
    const p = 1 / (1 + Math.exp(-(ds.longest - thr) * 1.8));
    return Math.round(p * P.days);
  };

  WPF.wcWindow = function (ts, from, to) {
    let sum = 0;
    WPF.WC_SLOTS.forEach((h, i) => { if (h >= from && h < to) sum += ts.hourly[i]; });
    return sum;
  };
  // Zeitpunkte, an denen die Reinigung benachrichtigt wird (alle N Eintritte im Zeitfenster)
  WPF.wcAlerts = function (ts, from, to, every) {
    const out = [];
    let cum = 0, next = every;
    WPF.WC_SLOTS.forEach((h, i) => {
      if (h < from || h >= to) return;
      const n = ts.hourly[i];
      if (!n) return;
      while (cum + n >= next) {
        const frac = (next - cum) / n;
        const mins = Math.min(59, Math.round(frac * 60));
        out.push(`${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
        next += every;
      }
      cum += n;
    });
    return out;
  };

  WPF.productivity = function (bk, dept) {
    const r = makeRng(`prod-${bk}-${dept}`);
    const dp = WPF.DEPARTMENTS[dept];
    let p = dp.prod + r.normal(0, 2.2);
    if (bk === 'aarepark') p += dp.focus * 11 + dp.meet * 6 - 4;
    else p += -dp.focus * 7 + 2;
    return Math.round(p);
  };

  WPF.deptSummary = function (F, S, thr) {
    const out = {};
    F.desks.forEach((d) => {
      const s = S.desks[d.id];
      const o = (out[d.dept] = out[d.dept] || { dept: d.dept, desks: 0, util: 0, hours: 0, risk: 0, longest: 0 });
      o.desks++; o.util += s.util; o.hours += s.hours; o.longest += s.longest;
      if (WPF.isRisk(s, thr)) o.risk++;
    });
    Object.values(out).forEach((o) => {
      o.util /= o.desks; o.hours /= o.desks; o.longest /= o.desks;
      o.riskShare = o.risk / o.desks;
      o.prod = WPF.productivity(F.building, o.dept);
    });
    return out;
  };

  // Layout-Kennzahl: Plätze in Besprechung/Fokus/Kollaboration je Arbeitsplatz
  WPF.layoutMetrics = function (bk) {
    let desks = 0, seats = 0, focus = 0, meeting = 0;
    Object.keys(WPF.BUILDINGS[bk].floors).forEach((f) => {
      const F = WPF.getFloor(bk, +f);
      desks += F.desks.length;
      F.rooms.forEach((r) => {
        seats += r.cap;
        if (r.type === 'focus' || r.type === 'phone') focus++;
        if (r.type === 'meeting') meeting++;
      });
    });
    return { desks, seatsPerDesk: seats / desks, focusPer10: (focus / desks) * 10, meetingPer10: (meeting / desks) * 10 };
  };

  WPF.compareDepartments = function (periodKey, thr) {
    const rows = {};
    Object.keys(WPF.BUILDINGS).forEach((bk) => {
      Object.keys(WPF.BUILDINGS[bk].floors).forEach((f) => {
        const F = WPF.getFloor(bk, +f);
        const S = WPF.getStats(bk, +f, periodKey);
        const sum = WPF.deptSummary(F, S, thr);
        Object.values(sum).forEach((o) => {
          const row = (rows[o.dept] = rows[o.dept] || {});
          const c = (row[bk] = row[bk] || { desks: 0, utilSum: 0, risk: 0, floors: [] });
          c.desks += o.desks; c.utilSum += o.util * o.desks; c.risk += o.risk; c.floors.push(+f);
        });
      });
    });
    Object.entries(rows).forEach(([dept, row]) => {
      Object.entries(row).forEach(([bk, c]) => {
        c.util = c.utilSum / c.desks; c.riskShare = c.risk / c.desks; c.prod = WPF.productivity(bk, dept);
      });
    });
    return rows;
  };

  /* ---------- Farbskalen -------------------------------------------------- */
  const UTIL_STOPS = [[20, [46, 111, 216]], [35, [31, 166, 194]], [50, [35, 174, 115]], [65, [154, 154, 58]], [80, [210, 56, 46]]];
  WPF.utilColor = function (v) {
    v = clamp(v, 20, 80);
    for (let i = 1; i < UTIL_STOPS.length; i++) {
      const [v1, c1] = UTIL_STOPS[i];
      const [v0, c0] = UTIL_STOPS[i - 1];
      if (v <= v1) {
        const t = (v - v0) / (v1 - v0);
        const c = c0.map((x, k) => Math.round(x + (c1[k] - x) * t));
        return `rgb(${c[0]},${c[1]},${c[2]})`;
      }
    }
    return 'rgb(210,56,46)';
  };
  WPF.UTIL_GRADIENT = 'linear-gradient(90deg,' + UTIL_STOPS.map(([v, c]) => `rgb(${c}) ${((v - 20) / 60) * 100}%`).join(',') + ')';
  WPF.wcColor = function (t) { // t: 0..1 → hellgrau → SBB-Rot
    t = clamp(t, 0, 1);
    const a = [238, 236, 234], b = [235, 0, 0];
    const c = a.map((x, k) => Math.round(x + (b[k] - x) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  };

  WPF.fmtH = (h) => {
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return mm === 60 ? `${hh + 1} h 00` : `${hh} h ${String(mm).padStart(2, '0')}`;
  };
})();
