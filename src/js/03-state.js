/* 03-state.js — stan aplikacji. Każda wersja zasad ma osobny stan i osobny klucz w localStorage.
   Klucze: dndsb:app (ustawienia), dndsb:ver:2014, dndsb:ver:2024. */
'use strict';

const Store = (() => {
  const KEY_APP = 'dndsb:app';
  const keyVer = v => 'dndsb:ver:' + v;
  const VERSIONS = ['2014', '2024'];
  let storageOk = true;

  const defaultFilters = () => ({ q: '', levels: [], schools: [], cls: '', conc: 'any', rit: 'any', src: 'all', noM: false, char: false });
  const defaultShelf = () => ({ cls: null, lvl: null, sel: null, q: '' });
  const defaultVS = () => ({ schema: 1, chars: [], active: null, homebrew: [], filters: defaultFilters(), sel: null, shelf: defaultShelf(), charView: {}, ribbons: {}, hbView: { lvl: null, sel: null }, classes: [] });
  const defaultApp = () => ({ ver: '2024', open: null, theme: 'auto' });

  function read(key) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; }
    catch (e) { storageOk = false; return null; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { storageOk = false; }
  }

  const app = Object.assign(defaultApp(), read(KEY_APP) || {});
  delete app.tab; // dawna nawigacja zakładkami; teraz nawigacją jest regał (app.open)
  const vs = {};
  for (const v of VERSIONS) {
    const loaded = read(keyVer(v));
    vs[v] = Object.assign(defaultVS(), loaded || {});
    vs[v].filters = Object.assign(defaultFilters(), vs[v].filters || {});
    vs[v].shelf = Object.assign(defaultShelf(), vs[v].shelf || {});
    vs[v].charView = vs[v].charView || {};
    vs[v].ribbons = vs[v].ribbons || {};
    vs[v].hbView = vs[v].hbView || { lvl: null, sel: null };
    vs[v].classes = vs[v].classes || [];
    migrateCustomClasses(vs[v], v);
  }

  /* Zabezpieczenie: postać przypisana do klasy, której nie ma ani w SRD, ani wśród własnych klas (np. po imporcie
     niepełnej kopii), dostaje jednorazową „Własną klasę” o tej samej nazwie i cesze, ze slotami według swojego
     poziomu (ręczne sloty). */
  function migrateCustomClasses(s, ver, known = s.classes || []) {
    const byId = Object.fromEntries(known.map(c => [c.id, c]));
    const srdCls = window.SRD[ver].classes;
    const eff = { full: l => l, halfUp: l => Math.ceil(l / 2), halfDown: l => (l >= 2 ? Math.ceil(l / 2) : 0), third: l => (l >= 3 ? Math.ceil(l / 3) : 0) };
    for (const ch of s.chars || []) {
      if (ch.cls === 'custom' || srdCls[ch.cls] || (s.classes || []).some(c => c.id === ch.cls)) continue;
      const cc = byId[ch.cls] || { n: 'Własna klasa', ab: ch.ab || 'INT', caster: 'none' };
      const L = Math.min(20, Math.max(1, Number(ch.lvl) || 1));
      let slots = Array(9).fill(0), pactN = 0, pactL = 1;
      if (cc.caster === 'pact') {
        const row = srdCls.warlock.t[String(L)].s, i = row.findIndex(x => x > 0);
        if (i >= 0) { pactN = row[i]; pactL = i + 1; }
      } else if (eff[cc.caster] && eff[cc.caster](L) > 0) slots = srdCls.wizard.t[String(eff[cc.caster](L))].s.slice();
      Object.assign(ch, { cls: 'custom', customName: cc.n, ab: cc.ab || 'INT', override: { slots, pactN, pactL } });
    }
    if (s.shelf && s.shelf.cls && !srdCls[s.shelf.cls] && !(s.classes || []).some(c => c.id === s.shelf.cls)) s.shelf.cls = null;
  }

  function cur() { return vs[app.ver]; }
  function save(v = app.ver) { write(keyVer(v), vs[v]); }
  function saveApp() { write(KEY_APP, app); }

  /* Zmiana stanu aktywnej wersji. opts.undo: tekst toastu z „Cofnij” (migawka całej wersji). */
  function commit(fn, opts = {}) {
    const v = app.ver;
    const snap = opts.undo ? JSON.stringify(vs[v]) : null;
    fn(vs[v]);
    save(v);
    if (opts.render !== false) App.render();
    if (opts.undo) {
      Toast.show(opts.undo, () => {
        vs[v] = JSON.parse(snap);
        save(v);
        if (app.ver !== v) { app.ver = v; saveApp(); }
        App.render();
        Toast.show('Cofnięto.');
      });
    } else if (opts.toast) {
      Toast.show(opts.toast);
    }
  }

  /* Podmiana stanu wersji (import / czyszczenie) z możliwością cofnięcia. */
  function replaceVersion(v, newState, undoMsg) {
    const snap = JSON.stringify(vs[v]);
    vs[v] = newState;
    save(v);
    App.render();
    Toast.show(undoMsg, () => { vs[v] = JSON.parse(snap); save(v); App.render(); Toast.show('Cofnięto.'); });
  }

  function activeChar(s = cur()) { return s.chars.find(c => c.id === s.active) || null; }

  return {
    app, vs, VERSIONS, cur, save, saveApp, commit, replaceVersion, activeChar, defaultVS, defaultFilters, migrateCustomClasses,
    get storageOk() { return storageOk; },
  };
})();

function newChar(ver, overrides = {}) {
  const first = Data.classes(ver)[0].id;
  return Object.assign({
    id: uid('ch'), name: 'Nowa postać', cls: first, lvl: 1, score: 16,
    ab: 'INT', customName: '', adj: { c: 0, s: 0 }, dcBonus: 0, atkBonus: 0,
    override: null, spells: {}, used: Array(9).fill(0), pactUsed: 0, arcUsed: [], conc: null, notes: '',
  }, overrides);
}
