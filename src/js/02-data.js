/* 02-data.js — dostęp do danych SRD (window.SRD) i reguły: sloty, limity, DC, obrażenia. */
'use strict';

const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];
const ABILITIES = { STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution', INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma' };
const DAMAGE_TYPES = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];

function schoolVar(s) {
  return SCHOOLS.includes(s) ? `var(--${s.toLowerCase()})` : 'var(--homebrew)';
}

const Data = (() => {
  const cache = {};
  function srd(ver) { return window.SRD[ver]; }
  function srdMap(ver) {
    if (!cache[ver]) {
      cache[ver] = new Map(srd(ver).spells.map(s => [s.id, s]));
    }
    return cache[ver];
  }
  /* Wszystkie zaklęcia wersji: SRD + własne (homebrew z przekazanego stanu). */
  function spells(ver, vs) {
    const hb = (vs && vs.homebrew) || [];
    return hb.length ? srd(ver).spells.concat(hb).sort((a, b) => a.n.localeCompare(b.n)) : srd(ver).spells;
  }
  function spell(ver, vs, id) {
    return srdMap(ver).get(id) || ((vs && vs.homebrew) || []).find(h => h.id === id) || null;
  }
  /* Własne klasy (stan wersji, s.classes) w tym samym kształcie co klasy SRD: tabela 20 poziomów ze slotami
     wyliczonymi z typu czarującego tak jak w tabelach pojedynczych klas SRD (pełny czarujący = tabela Wizarda
     na poziomie „efektywnym”; pakt = tabela Warlocka) oraz z cantripami i przygotowanymi/znanymi zaklęciami
     wpisanymi przez użytkownika. Poziom efektywny (sprawdzony na klasach SRD):
       półczarujący od 1. poziomu – ⌈L/2⌉ (Paladin i Ranger 2024),
       półczarujący od 2. poziomu – ⌈L/2⌉ od L ≥ 2 (Paladin i Ranger 2014),
       jedna trzecia od 3. poziomu – ⌈L/3⌉ od L ≥ 3.
     To nie jest tabela multiclassingu (ta dotyczy postaci wieloklasowych i daje mniej slotów). */
  const CASTER_LEVEL = {
    full: l => l, halfUp: l => Math.ceil(l / 2), halfDown: l => (l >= 2 ? Math.ceil(l / 2) : 0),
    third: l => (l >= 3 ? Math.ceil(l / 3) : 0), pact: () => 0, none: () => 0,
  };
  function customList(ver) {
    const vs = typeof Store !== 'undefined' ? Store.vs[ver] : null; // Store (const) nie jest właściwością window
    return (vs && vs.classes) || [];
  }
  function buildCustom(ver, cc) {
    const wiz = srd(ver).classes.wizard.t, wl = srd(ver).classes.warlock.t;
    const t = {};
    for (let L = 1; L <= 20; L++) {
      const row = (cc.rows && cc.rows[L - 1]) || {};
      const cl = (CASTER_LEVEL[cc.caster] || CASTER_LEVEL.none)(L);
      const s = cc.caster === 'pact' ? wl[String(L)].s.slice() : cl > 0 ? wiz[String(cl)].s.slice() : Array(9).fill(0);
      const r = { c: Number(row.c) || 0, s };
      if (row.p !== '' && row.p != null) r[cc.mode === 'known' ? 'k' : 'p'] = Number(row.p) || 0;
      t[String(L)] = r;
    }
    return { n: cc.n, ab: cc.ab, mode: cc.mode, from: 1, t, pact: cc.caster === 'pact', custom: true, color: cc.color, emblem: cc.emblem };
  }
  function classes(ver) {
    const c = srd(ver).classes;
    return Object.keys(c).sort().map(id => ({ id, ...c[id] }))
      .concat(customList(ver).map(cc => ({ id: cc.id, ...buildCustom(ver, cc) })));
  }
  function cls(ver, id) {
    if (srd(ver).classes[id]) return srd(ver).classes[id];
    const cc = customList(ver).find(x => x.id === id);
    return cc ? buildCustom(ver, cc) : null;
  }
  function customClass(ver, id) { return customList(ver).find(x => x.id === id) || null; }
  /* Czy zaklęcie jest na liście klasy: SRD – pole c zaklęcia; własna klasa – jej lista lub c (własne zaklęcia). */
  function inClass(ver, clsId, sp) {
    if ((sp.c || []).includes(clsId)) return true;
    const cc = customClass(ver, clsId);
    return !!(cc && cc.spells.includes(sp.id));
  }
  return { srd, spells, spell, classes, cls, customClass, inClass };
})();

const Rules = (() => {
  const mod = score => Math.floor((Number(score) - 10) / 2);
  const prof = lvl => Math.ceil(clamp(lvl, 1, 20) / 4) + 1;

  function levelLabel(sp, ver) {
    if (sp.l === 0) return ver === '2014' ? `${sp.s} cantrip` : `${sp.s} Cantrip`;
    if (ver === '2014') {
      const o = { 1: '1st', 2: '2nd', 3: '3rd' }[sp.l] || sp.l + 'th';
      return `${o}-level ${sp.s.toLowerCase()}`;
    }
    return `Level ${sp.l} ${sp.s}`;
  }
  const lvlShort = l => (l === 0 ? 'Cantrip' : `Poz. ${l}`);

  /* Pełny obraz czarowania postaci. */
  /* Wkład klasy do poziomu czarującego przy multiklasie (zasady SRD): pełni czarujący – cały poziom,
     Paladin i Ranger – połowa (2014: w dół, 2024: w górę), własne klasy – według typu; Warlock (pakt) – 0
     (jego pact slots liczą się osobno). */
  const FULL_CASTERS = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard'];
  function casterLevel(ver, cls, L) {
    if (FULL_CASTERS.includes(cls)) return L;
    if (cls === 'paladin' || cls === 'ranger') return ver === '2014' ? Math.floor(L / 2) : Math.ceil(L / 2);
    const cc = Data.customClass(ver, cls);
    if (cc) return ({ full: L, halfUp: Math.ceil(L / 2), halfDown: Math.floor(L / 2), third: Math.floor(L / 3) })[cc.caster] || 0;
    return 0;
  }
  /* Klasy postaci: główna (ch.cls, ch.lvl, ch.score) i dodatkowe z multiklasy (ch.multi: [{cls, lvl, score}]). */
  function classesOf(ch, ver) {
    const parts = [{ cls: ch.cls, lvl: clamp(Number(ch.lvl) || 1, 1, 20), score: ch.score ?? 10, primary: true }];
    for (const m of ch.multi || []) {
      if (!m || !m.cls || m.cls === 'custom' || m.cls === ch.cls || !Data.cls(ver, m.cls)) continue;
      if (parts.some(p => p.cls === m.cls)) continue; // bez multiklasy w tę samą klasę
      parts.push({ cls: m.cls, lvl: clamp(Number(m.lvl) || 1, 1, 20), score: m.score ?? 10 });
    }
    return parts;
  }

  /* Pełny obraz czarowania postaci (także z multiklasą). */
  function casting(ch, ver) {
    const custom = ch.cls === 'custom';
    const parts = classesOf(ch, ver);
    const lvl = clamp(parts.reduce((a, p) => a + p.lvl, 0), 1, 20); // łączny poziom postaci
    const pb = prof(lvl);
    const adj = ch.adj || { c: 0, s: 0 };
    // dane każdej klasy osobno: cecha, DC, atak, cantripy, limit, sloty z jej własnej tabeli
    for (const p of parts) {
      const C = p.cls === 'custom' ? null : Data.cls(ver, p.cls);
      p.C = C;
      p.n = C ? C.n : (ch.customName || 'Własna klasa');
      p.ab = C ? C.ab : (ch.ab || 'INT');
      p.mod = mod(p.score);
      p.dc = 8 + pb + p.mod + (Number(ch.dcBonus) || 0);
      p.atk = pb + p.mod + (Number(ch.atkBonus) || 0);
      p.active = C ? p.lvl >= C.from : true;
      const row = C ? C.t[String(p.lvl)] : null;
      p.row = row;
      p.cantrips = C ? (row?.c || 0) : null;
      p.mode = C ? C.mode : 'prepared';
      p.limit = null;
      if (C) {
        if (C.mode === 'known') p.limit = row?.k || 0;
        else if (row && 'p' in row) p.limit = row.p;
        else if (C.prep) p.limit = p.active ? Math.max(1, p.mod + (C.prep === 'half' ? Math.floor(p.lvl / 2) : p.lvl)) : 0;
      }
    }
    const main = parts[0];
    const modes = new Set(parts.filter(p => p.C).map(p => p.mode));
    const sumOrNull = key => (parts.some(p => p[key] != null) ? parts.reduce((a, p) => a + (p[key] || 0), 0) : null);
    const res = {
      custom, lvl, ab: main.ab, mod: main.mod, pb, dc: main.dc, atk: main.atk,
      mode: modes.size === 1 && modes.has('known') ? 'known' : 'prepared', mixed: modes.size > 1,
      clsName: parts.length > 1 ? parts.map(p => `${p.n} ${p.lvl}`).join(' / ') : main.n,
      parts, multi: parts.length > 1,
      cantrips: sumOrNull('cantrips'), limit: sumOrNull('limit'),
      slots: Array(9).fill(0), pact: null, arcana: [], active: parts.some(p => p.active),
    };
    if (res.cantrips != null) res.cantrips += Number(adj.c) || 0;
    if (res.limit != null) res.limit += Number(adj.s) || 0;
    // sloty: jedna klasa czarująca – jej własna tabela; kilka – tabela multiklasy (= tabela pełnego czarującego)
    const casters = parts.filter(p => p.C && !p.C.pact && p.active && p.row && p.row.s.some(x => x > 0));
    if (casters.length === 1) res.slots = casters[0].row.s.slice();
    else if (casters.length > 1) {
      const cl = Math.min(20, casters.reduce((a, p) => a + casterLevel(ver, p.cls, p.lvl), 0));
      if (cl > 0) res.slots = Data.srd(ver).classes.wizard.t[String(cl)].s.slice();
      res.casterLevel = cl;
    }
    // pact slots (Warlock) – osobno, z poziomu Warlocka
    const pact = parts.find(p => p.C && p.C.pact);
    if (pact && pact.row) {
      const idx = pact.row.s.findIndex(n => n > 0);
      if (idx >= 0) res.pact = { n: pact.row.s[idx], lvl: idx + 1 };
      res.arcana = Object.entries(pact.C.arc || {}).filter(([k]) => pact.lvl >= Number(k)).map(([, v]) => v);
    }
    if (ch.override) {
      res.slots = ch.override.slots.map(n => Math.max(0, Number(n) || 0));
      res.pact = ch.override.pactN > 0 ? { n: Number(ch.override.pactN), lvl: clamp(Number(ch.override.pactL) || 1, 1, 5) } : null;
    }
    const maxStd = res.slots.reduce((mx, n, i) => (n > 0 ? i + 1 : mx), 0);
    res.maxLevel = Math.max(maxStd, res.pact ? res.pact.lvl : 0, ...res.arcana, 0);
    return res;
  }

  /* Obrażenia/leczenie przy danym slocie (lub poziomie postaci dla cantripów). */
  function effectAt(sp, slot, charLvl, m) {
    const out = [];
    const sub = s => (m === undefined ? s : s.replace(/\s*\+\s*MOD/, m === 0 ? '' : (m > 0 ? ` + ${m}` : ` − ${-m}`)));
    const pick = (tab, key) => {
      const keys = Object.keys(tab).map(Number).sort((a, b) => a - b);
      let best = keys[0];
      for (const k of keys) if (k <= key) best = k;
      return tab[String(best)];
    };
    if (sp.dm) {
      if (sp.dm.ch) out.push({ kind: 'dmg', dice: sub(pick(sp.dm.ch, charLvl || 1)), type: sp.dm.t });
      else if (sp.dm.sl) out.push({ kind: 'dmg', dice: sub(pick(sp.dm.sl, slot || sp.l)), type: sp.dm.t });
    }
    if (sp.he) out.push({ kind: 'heal', dice: sub(pick(sp.he, slot || sp.l)) });
    return out;
  }

  /* Tabela dla własnych zaklęć: baza + przyrost na każdy poziom slotu powyżej bazowego. */
  function buildUpcast(base, level, inc) {
    const tab = {};
    const from = Math.max(level, 1);
    const mInc = /^(\d+)d(\d+)$/.exec((inc || '').trim());
    const mBase = /^(\d+)d(\d+)(.*)$/.exec((base || '').trim());
    for (let s = from; s <= 9; s++) {
      const k = s - from;
      if (!mInc || k === 0) { tab[s] = base; continue; }
      const n = Number(mInc[1]) * k;
      tab[s] = mBase && mBase[2] === mInc[2] ? `${Number(mBase[1]) + n}d${mBase[2]}${mBase[3]}` : `${base} + ${n}d${mInc[2]}`;
    }
    return tab;
  }

  function onClassList(sp, ch) {
    if (!ch || ch.cls === 'custom' || sp.hb) return true;
    const ver = Store.app.ver;
    return classesOf(ch, ver).some(p => Data.inClass(ver, p.cls, sp)); // lista którejkolwiek z klas postaci
  }

  return { mod, prof, levelLabel, lvlShort, casting, classesOf, effectAt, buildUpcast, onClassList };
})();
