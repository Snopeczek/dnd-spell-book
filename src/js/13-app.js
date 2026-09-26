/* 13-app.js — start aplikacji: przełącznik wersji, regał jako nawigacja (otwieranie i odkładanie ksiąg),
   nagłówek otwartej księgi, akcje z kart zaklęć, skróty klawiszowe. */
'use strict';

const App = (() => {
  const VIEWS = {
    class: el => ClassBook.render(el),
    compendium: el => Compendium.render(el),
    char: el => Book.render(el),
    homebrew: el => Homebrew.render(el),
    settings: el => Settings.render(el),
  };

  function applyTheme() {
    const t = Store.app.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  /* Otwarta księga, o ile nadal istnieje w aktywnej wersji. */
  function currentOpen() {
    const o = Store.app.open;
    if (!o || !VIEWS[o.kind]) return null;
    const ver = Store.app.ver, s = Store.cur();
    if (o.kind === 'class' && !Data.cls(ver, o.id)) return null;
    if (o.kind === 'char' && !s.chars.some(c => c.id === o.id)) return null;
    return o;
  }

  function headInfo(o) {
    const ver = Store.app.ver, s = Store.cur();
    switch (o.kind) {
      case 'class': {
        const n = ClassBook.spellsOf(ver, s, o.id).length;
        return { title: Data.cls(ver, o.id).n, color: ClassBook.cover(o.id), icon: ClassBook.emblem(o.id, ''), sub: `${n} ${plural(n, 'zaklęcie', 'zaklęcia', 'zaklęć')}` };
      }
      case 'compendium': return { title: 'Kompendium', color: '#6a5842', icon: Bookcase.svg(Bookcase.ICONS.compendium), sub: `wszystkie zaklęcia wersji ${ver}` };
      case 'char': {
        const ch = s.chars.find(c => c.id === o.id);
        const cast = Rules.casting(ch, ver);
        return { title: ch.name, color: Bookcase.charColor(ch), icon: Bookcase.charIcon(ch), sub: `${cast.clsName}, poziom ${cast.lvl}` };
      }
      case 'homebrew': return { title: 'Własne zaklęcia', color: '#4a5d50', icon: Bookcase.svg(Bookcase.ICONS.homebrew), sub: `wersja ${ver}` };
      case 'settings': return { title: 'Ustawienia i dane', color: '#3a3e47', icon: Bookcase.svg(Bookcase.ICONS.settings), sub: '' };
    }
    return null;
  }


  // Klik w pole formularza zatwierdza poprzednie pole (change → render), a render podmienia DOM, więc kliknięte
  // pole znika w trakcie kliknięcia i kursor ląduje „nigdzie”. Zapamiętujemy, w co kliknięto, i oddajemy tam fokus.
  let pendingFocus = null;
  function fieldSelector(t) {
    if (t.dataset && t.dataset.k) return `[data-k="${t.dataset.k}"]`;
    if (t.id) return '#' + CSS.escape(t.id);
    if (t.classList.length) return t.tagName.toLowerCase() + '.' + [...t.classList].map(c => CSS.escape(c)).join('.');
    return null;
  }
  document.addEventListener('pointerdown', e => {
    const t = e.target.closest && e.target.closest('input, textarea, select');
    pendingFocus = t && t.closest('#view, #bookhead') ? { el: t, sel: fieldSelector(t), at: Date.now() } : null;
  }, true);
  function restoreFocus() {
    const p = pendingFocus;
    if (!p || !p.sel || p.el.isConnected || Date.now() - p.at > 1000) return;
    pendingFocus = null;
    setTimeout(() => {
      const n = document.querySelector('#view ' + p.sel) || document.querySelector('#bookhead ' + p.sel);
      if (!n || document.activeElement === n) return;
      n.focus();
      if (n.tagName === 'TEXTAREA' || /^(text|search)$/.test(n.type)) { const L = n.value.length; n.setSelectionRange(L, L); }
    }, 0);
  }

  function render() { renderView(); restoreFocus(); }

  function renderView() {
    // Pole z niezatwierdzoną zmianą (np. imię wpisane przed wyborem klasy) zatwierdzamy przed przebudową widoku.
    // Inaczej innerHTML usuwa fokusowany element, jego „change” odpala render w trakcie renderu i Chrome rzuca NotFoundError.
    const fa = document.activeElement;
    if (fa && fa !== document.body && fa.closest && fa.closest('#view, #bookhead, #case')) { fa.blur(); if (!fa.isConnected) return; }
    const ver = Store.app.ver, s = Store.cur();
    $$('.ver-switch button').forEach(b => b.setAttribute('aria-checked', b.dataset.ver === ver));
    const d = Data.srd(ver);
    $('#attrib').innerHTML = `Wersja ${ver}: zawiera materiał z ${esc(d.srd)} autorstwa Wizards of the Coast LLC, na licencji
      <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noopener">CC BY 4.0</a>. Dane: 5e-bits/5e-database. <button type="button" class="linkbtn" data-settings>Pełna informacja o licencji</button>.`;

    const o = currentOpen();
    if (!o && Store.app.open) { Store.app.open = null; Store.saveApp(); }
    if (o && o.kind === 'char' && s.active !== o.id) { s.active = o.id; Store.save(); }
    if (o && o.kind === 'class' && s.shelf.cls !== o.id) { s.shelf = { cls: o.id, lvl: null, sel: null, q: '' }; Store.save(); }

    Bookcase.render($('#case'), o);
    document.body.classList.toggle('book-open', !!o);
    const head = $('#bookhead'), view = $('#view');
    const y = window.scrollY;
    if (o) {
      const h = headInfo(o);
      head.innerHTML = `<div class="bookhead" style="--cover:${h.color}">
        <button type="button" class="btn back" data-home title="Odłóż księgę na regał (Esc)">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Odłóż na regał</button>
        ${h.icon ? `<span class="bh-chip">${h.icon}</span>` : ''}
        <h2>${esc(h.title)}</h2>${h.sub ? `<span class="muted small">${esc(h.sub)}</span>` : ''}
      </div>`;
      $('[data-home]', head).onclick = () => home({ animate: true });
      if (o.kind === 'class' || o.kind === 'compendium' || o.kind === 'char' || o.kind === 'homebrew') VIEWS[o.kind](view); // mają własną rozkładówkę z zakładkami
      else {
        view.innerHTML = `<div class="openbook single" style="--cover:${h.color}"><div class="pages single"><div class="page" id="page"></div></div></div>`;
        VIEWS[o.kind]($('#page', view));
      }
      fitBookSoon();
      window.scrollTo(0, y);
    } else {
      head.innerHTML = '';
      view.innerHTML = `<p class="home-hint">Wybierz księgę z regału. Grubość księgi rośnie razem z liczbą zaklęć w środku.
        <span class="muted">Klawisz „/” otwiera Kompendium z wyszukiwarką.</span></p>`;
    }
  }

  function openBook(o) {
    Store.app.open = o; Store.saveApp();
    Dlg.close();
    window.scrollTo(0, 0);
    render();
  }

  /* Powrót na regał; animate – z animacją odkładania (przycisk, Esc, kliknięcie wysuniętej księgi). */
  function home(opts = {}) {
    const o = currentOpen();
    const go = () => {
      Store.app.open = null; Store.saveApp();
      Dlg.close();
      window.scrollTo(0, 0);
      render();
    };
    if (opts.animate && o) Bookcase.playClose(Bookcase.keyOf(o), go);
    else go();
  }

  /* Na szerokim ekranie księga ma stałą wysokość dopasowaną do okna; strony przewijają się w środku. */
  function fitBook() {
    const p = $('#view .pages');
    if (!p) return;
    if (window.innerWidth <= 1100) { p.style.height = ''; return; }
    const top = p.getBoundingClientRect().top + window.scrollY;
    const book = p.closest('.openbook');
    const bottomPad = book ? book.getBoundingClientRect().bottom - p.getBoundingClientRect().bottom : 20;
    // nigdy niższa niż kolumna zakładek (Karta + C + 1–9)
    const stack = book && book.querySelector('.bm-stack');
    const minH = Math.max(460, stack ? stack.scrollHeight + 16 : 0);
    p.style.height = Math.max(minH, Math.round(window.innerHeight - top - bottomPad - 14)) + 'px';
  }
  /* Regał zwija się do paska z przejściem CSS (~0,5 s), a wysokość księgi zależy od jego końcowej wysokości:
     dopasowanie teraz, po zakończeniu przejścia i na wszelki wypadek jeszcze raz chwilę później. */
  function fitBookSoon() {
    fitBook();
    const bc = $('.bookcase');
    if (bc) {
      const once = e => { if (e.target.classList.contains('spine')) { bc.removeEventListener('transitionend', once); fitBook(); } };
      bc.addEventListener('transitionend', once);
    }
    setTimeout(fitBook, 560);
  }

  function setVersion(v) {
    if (v === Store.app.ver) return;
    Store.save(); // zapis bieżącej wersji przed przełączeniem
    Store.app.ver = v; Store.saveApp();
    Dlg.close(); Toast.hide();
    render();
  }

  /* Akcje z kart zaklęć (data-act), niezależnie od miejsca, w którym karta jest wyświetlona. */
  function onAction(e) {
    if (e.target.closest('[data-settings]')) { Settings.open(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.act) {
      case 'add-book':
      case 'rm-book': {
        // karta w okienku odświeża się po zmianie, ale nie zastępuje okienka z ostrzeżeniem o limicie
        const wasCard = $('#dlg').open && $('#dlg').dataset.kind === 'card';
        Book.toggleSpell(id);
        if (wasCard && $('#dlg').dataset.kind === 'card') Book.openCard(id, 'book');
        break;
      }
      case 'copy-hb': Homebrew.copyFromSrd(id); break;
      case 'edit-hb': Homebrew.editor(id); break;
      case 'close-card': $('#detail')?.classList.remove('open'); break;
    }
  }

  function init() {
    applyTheme();
    $$('.ver-switch button').forEach(b => b.onclick = () => setVersion(b.dataset.ver));
    document.addEventListener('click', onAction);
    document.addEventListener('keydown', e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
      if ($('#dlg').open) return; // Esc w okienku obsługuje przeglądarka
      if (e.key === '/' && !typing) {
        e.preventDefault();
        if (Store.app.open?.kind !== 'compendium') openBook({ kind: 'compendium' });
        const q = $('#q'); if (q) { q.focus(); q.select(); }
      }
      if (e.key === 'Escape') {
        // karta zaklęcia jest nakładką tylko na wąskim ekranie; na szerokim Esc od razu odkłada księgę
        const det = $('#detail.open');
        if (det && getComputedStyle(det).position === 'fixed') det.classList.remove('open');
        else if (Store.app.open && !typing) home({ animate: true });
      }
    });
    $('#dlg').addEventListener('click', e => { if (e.target.id === 'dlg') Dlg.close(); });
    window.addEventListener('resize', debounce(fitBook, 120));
    Drag.init();
    render();
  }

  return { init, render, openBook, home, applyTheme, fitBook };
})();

App.init();
