/* 12-drag.js — przeciąganie zaklęcia (myszą) na księgę postaci na regale.
   Pod kursorem wisi karteczka (kartka z zeszytu na spinaczu), która buja się na boki jak wahadło
   (sprężyna z tłumieniem; kąt zależy od prędkości ruchu w poziomie). Źródła: listy w księgach klas,
   w Kompendium i w księdze postaci. Cele: księgi postaci, pusta „Nowa postać”
   i księgi własnych klas (zaklęcie trafia wtedy na listę klasy). Źródłem może być też księga Własnych zaklęć.
   Ograniczenie: zaklęcie musi być na liście klasy postaci (Book.fitsClass); niepasujące księgi są przygaszone,
   a upuszczenie na nie kończy się „odmownym” potrząśnięciem grzbietu i powrotem karteczki. */
'use strict';

const Drag = (() => {
  const THRESHOLD = 6;           // px ruchu, po których zaczyna się przeciąganie (krótsze to zwykłe kliknięcie)
  let st = null;                  // stan bieżącego przeciągania
  let suppressClick = false;

  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Zaklęcie pod wskaźnikiem w obsługiwanych listach. */
  function sourceOf(target) {
    if (target.closest('button, input, select, textarea, a, label')) return null;
    const row = target.closest('#sh-list .spell-row, #list .spell-row');
    if (row) return { id: row.dataset.id, el: row };
    const nm = target.closest('#cb-left .book-row, #hb-left .book-row');
    const open = nm && nm.querySelector('.nm[data-open]');
    if (open) return { id: open.dataset.open, el: nm };
    return null;
  }

  /* Postrzępiona dolna krawędź (losowa, stała dla danej karteczki). */
  function tornClip() {
    const pts = ['0% 0%', '100% 0%', '100% 86%'];
    for (let x = 96; x > 0; x -= 4 + Math.random() * 4) pts.push(`${x.toFixed(1)}% ${(84 + Math.random() * 9).toFixed(1)}%`);
    pts.push('0% 90%');
    return `polygon(${pts.join(',')})`;
  }

  function noteHtml(sp, ver) {
    const holes = Array.from({ length: 7 }, () => '<i></i>').join('');
    const clip = '<svg class="dn-clip" viewBox="0 0 24 60" aria-hidden="true"><path d="M8 44V12a6 6 0 0 1 12 0v36a9 9 0 0 1-18 0V16" fill="none" stroke="#8d949c" stroke-width="2.6" stroke-linecap="round"/><path d="M8 44V12a6 6 0 0 1 12 0v36a9 9 0 0 1-18 0V16" fill="none" stroke="#e3e7ea" stroke-width="1" stroke-linecap="round" transform="translate(-.6 -.6)"/></svg>';
    return `<div class="dn-sheet dn-back" style="clip-path:${tornClip()}"></div>
      <div class="dn-sheet dn-front" style="clip-path:${tornClip()}">
        <span class="dn-holes">${holes}</span>
        <span class="dn-name">${esc(sp.n)}</span>
        <span class="dn-meta" style="--sc:${schoolVar(sp.s)}">${esc(Rules.levelLabel(sp, ver))}</span>
      </div>${clip}`;
  }

  /* ---------- cele upuszczenia ---------- */
  function classify(sp) {
    const s = Store.cur();
    $$('.bookcase .spine').forEach(b => {
      const [kind, id] = b.dataset.key.split(':');
      b.classList.remove('drop-ok', 'drop-no', 'drop-has', 'drop-off');
      if (kind === 'char') {
        const ch = s.chars.find(c => c.id === id);
        if (!ch) return;
        b.classList.add(ch.spells[sp.id] ? 'drop-has' : Book.fitsClass(ch, sp) ? 'drop-ok' : 'drop-no');
      } else if (kind === 'newchar') b.classList.add('drop-ok');
      else if (kind === 'class' && Data.customClass(Store.app.ver, id)) b.classList.add(Data.customClass(Store.app.ver, id).spells.includes(sp.id) ? 'drop-has' : 'drop-ok');
      else b.classList.add('drop-off');
    });
    $('.bookcase')?.classList.add('dragging');
  }
  function unclassify() {
    $$('.bookcase .spine').forEach(b => b.classList.remove('drop-ok', 'drop-no', 'drop-has', 'drop-off', 'drop-over'));
    $('.bookcase')?.classList.remove('dragging');
  }

  /* Opis dla celu pod kursorem. */
  function verdict(spine, sp) {
    if (!spine) return null;
    const [kind, id] = spine.dataset.key.split(':');
    const ver = Store.app.ver, s = Store.cur();
    if (kind === 'newchar') {
      const cls = newCharClass(sp);
      return cls ? { ok: true, text: `Nowa postać (${Data.cls(ver, cls).n}) z tym zaklęciem` } : { ok: false, text: 'To zaklęcie nie należy do żadnej klasy' };
    }
    if (kind === 'class') {
      const cc = Data.customClass(ver, id);
      if (!cc) return { ok: false, text: 'Tu nie można dodawać zaklęć', quiet: true };
      return cc.spells.includes(sp.id) ? { ok: false, text: `${cc.n} ma już to zaklęcie na liście`, has: true } : { ok: true, text: `Dodaj do listy klasy: ${cc.n}` };
    }
    if (kind !== 'char') return { ok: false, text: 'Tu nie można dodawać zaklęć', quiet: true };
    const ch = s.chars.find(c => c.id === id);
    if (!ch) return null;
    if (ch.spells[sp.id]) return { ok: false, text: `${ch.name} ma już to zaklęcie`, has: true };
    if (!Book.fitsClass(ch, sp)) return { ok: false, text: `${Rules.casting(ch, ver).clsName} nie ma tego zaklęcia na liście klasy` };
    return { ok: true, text: `Dodaj do: ${ch.name}` };
  }
  /* Klasa nowej postaci: klasa otwartej księgi (jeśli zaklęcie do niej należy), inaczej pierwsza z listy zaklęcia. */
  function newCharClass(sp) {
    const o = Store.app.open;
    if (o && o.kind === 'class' && Data.inClass(Store.app.ver, o.id, sp)) return o.id;
    const ver = Store.app.ver;
    return (sp.c || []).find(c => Data.cls(ver, c)) || null;
  }

  function spineAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('.bookcase .spine') : null;
  }

  function setOver(spine) {
    if (st.over === spine) return;
    if (st.over) { st.over.classList.remove('drop-over'); st.over.dispatchEvent(new PointerEvent('pointerleave')); }
    st.over = spine;
    const tip = st.tip;
    if (!spine) { tip.hidden = true; return; }
    const v = verdict(spine, st.sp);
    if (!v || v.quiet) { tip.hidden = true; return; }
    spine.classList.add('drop-over');
    spine.dispatchEvent(new PointerEvent('pointerenter')); // fizyka regału: księga się unosi
    tip.textContent = v.text;
    tip.className = 'drop-tip' + (v.ok ? '' : ' no');
    tip.hidden = false;
    const r = spine.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
    tip.style.top = (r.bottom + 8) + 'px';
  }

  /* ---------- przebieg ---------- */
  function down(e) {
    if (e.button !== 0 || e.pointerType === 'touch' || !Store.app.open) return;
    if (!$('.bookcase.compact')) return;
    const src = sourceOf(e.target);
    if (!src) return;
    const sp = Data.spell(Store.app.ver, Store.cur(), src.id);
    if (!sp) return;
    st = { sp, src, x0: e.clientX, y0: e.clientY, started: false };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('keydown', key, true); // przed głównym skrótem Esc (odkładanie księgi)
  }

  function start(e) {
    st.started = true;
    document.body.classList.add('is-dragging');
    const note = document.createElement('div');
    note.className = 'drag-note';
    note.innerHTML = noteHtml(st.sp, Store.app.ver);
    document.body.appendChild(note);
    const tip = document.createElement('div');
    tip.className = 'drop-tip'; tip.hidden = true;
    document.body.appendChild(tip);
    Object.assign(st, { note, tip, x: e.clientX, y: e.clientY, px: e.clientX, vx: 0, a: 0, va: 0, over: null, raf: 0, sc: 1, inCase: false });
    st.src.el.classList.add('drag-src');
    classify(st.sp);
    loop();
  }

  function move(e) {
    if (!st) return;
    if (!st.started) {
      if (Math.hypot(e.clientX - st.x0, e.clientY - st.y0) < THRESHOLD) return;
      start(e);
    }
    st.x = e.clientX; st.y = e.clientY;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    st.inCase = !!(el && el.closest('.bookcase'));
    setOver(spineAt(e.clientX, e.clientY));
  }

  /* Fizyka karteczki: kąt dąży do wartości zależnej od prędkości w poziomie (wahadło na spinaczu). */
  function loop() {
    if (!st || !st.note) return;
    const dt = 1 / 60;
    const vxNow = (st.x - st.px); st.px = st.x;
    st.vx += (vxNow - st.vx) * 0.35;                       // wygładzona prędkość (px na klatkę)
    const target = reduced() ? 0 : clamp(st.vx * 1.6, -32, 32);
    st.va += (140 * (target - st.a) - 7 * st.va) * dt;     // sprężyna z małym tłumieniem – kołysanie
    st.a += st.va * dt;
    // nad regałem karteczka maleje, żeby nie zasłaniać ksiąg, w które się celuje
    st.sc += ((st.inCase ? 0.5 : 1) - st.sc) * (reduced() ? 1 : 0.25);
    st.note.style.transform = `translate(${st.x}px, ${st.y}px) rotate(${st.a.toFixed(2)}deg) scale(${st.sc.toFixed(3)})`;
    st.note.style.opacity = (0.55 + 0.45 * (st.sc - 0.5) / 0.5).toFixed(3); // nad regałem półprzezroczysta
    // przewijanie strony, gdy karteczka zbliża się do górnej krawędzi (regał jest na górze)
    if (st.y < 70 && window.scrollY > 0) window.scrollBy(0, -Math.ceil((70 - st.y) / 5));
    st.raf = requestAnimationFrame(loop);
  }

  function cleanup() {
    if (!st) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('keydown', key, true);
    if (st.started) {
      cancelAnimationFrame(st.raf);
      if (st.over) st.over.dispatchEvent(new PointerEvent('pointerleave'));
      st.tip.remove();
      st.src.el.classList.remove('drag-src');
      unclassify();
      document.body.classList.remove('is-dragging');
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
    }
  }

  /* Karteczka wraca na swoje miejsce na liście. */
  function flyBack(note, srcEl) {
    const r = srcEl.getBoundingClientRect();
    const a = note.animate([{ transform: note.style.transform, opacity: 1 },
      { transform: `translate(${r.left + 40}px, ${r.top + r.height / 2}px) rotate(0deg) scale(.4)`, opacity: 0 }],
      { duration: reduced() ? 1 : 320, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' });
    a.finished.then(() => note.remove(), () => note.remove());
  }
  /* Karteczka wpada w grzbiet. */
  function flyInto(note, spine, tilt, then) {
    const r = spine.getBoundingClientRect();
    const a = note.animate([{ transform: note.style.transform, opacity: 1 },
      { transform: `translate(${r.left + r.width / 2}px, ${r.top + 8}px) rotate(${tilt > 0 ? 25 : -25}deg) scale(.35)`, opacity: 1, offset: .6 },
      { transform: `translate(${r.left + r.width / 2}px, ${r.top + r.height * 0.45}px) rotate(0deg) scale(.08)`, opacity: 0 }],
      { duration: reduced() ? 1 : 380, easing: 'cubic-bezier(.4,0,.7,1)', fill: 'forwards' });
    a.finished.then(() => { note.remove(); then(); }, () => { note.remove(); then(); });
  }
  function shake(spine) {
    spine.classList.remove('nope'); void spine.offsetWidth; spine.classList.add('nope');
    setTimeout(() => spine.classList.remove('nope'), 500);
  }

  function up(e) {
    if (!st) return;
    if (!st.started) { cleanup(); st = null; return; }
    const { note, sp, src } = st;
    const cur_tilt = st.a;
    const spine = spineAt(e.clientX, e.clientY);
    const v = verdict(spine, sp);
    const key = spine && spine.dataset.key;
    cleanup();
    st = null;
    if (!v || v.quiet) { flyBack(note, src.el); return; }
    if (!v.ok) {
      shake(spine);
      flyBack(note, src.el);
      Toast.show(v.has ? v.text + '.' : `${v.text}: ${sp.n}.`);
      return;
    }
    const [kind, id] = key.split(':');
    const tilt = cur_tilt;
    flyInto(note, spine, tilt, () => {
      const target = Bookcase.spineEl(key);
      if (kind === 'newchar') { createWith(sp); return; }
      if (kind === 'class') { if (Classes.addSpell(id, sp)) Bookcase.bump(key); return; }
      const ch = Store.cur().chars.find(c => c.id === id);
      if (!ch) return;
      Book.addTo(ch, sp, added => { if (added) Bookcase.bump(key); else if (target) shake(target); });
    });
  }

  /* Upuszczenie na „Nową postać”: postać z klasą pasującą do zaklęcia i tym zaklęciem w księdze. */
  function createWith(sp) {
    const ver = Store.app.ver;
    const cls = newCharClass(sp);
    if (!cls) return;
    const n = Store.cur().chars.length + 1;
    const ch = newChar(ver, { name: 'Postać ' + n, cls });
    const cast = Rules.casting(ch, ver);
    ch.spells[sp.id] = { prep: sp.l > 0 && cast.mode === 'prepared', always: false };
    Store.commit(s => { s.chars.push(ch); }, { render: false, undo: `Utworzono ${ch.name} (${cast.clsName}) z zaklęciem ${sp.n}.` });
    App.render();
    Bookcase.bump('char:' + ch.id);
  }

  function key(e) {
    if (e.key !== 'Escape' || !st || !st.started) return;
    e.preventDefault(); e.stopPropagation();
    const { note, src } = st;
    cleanup(); st = null;
    flyBack(note, src.el);
  }

  function init() {
    document.addEventListener('pointerdown', down);
    // po przeciągnięciu nie traktuj puszczenia przycisku jako kliknięcia w wiersz
    document.addEventListener('click', e => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; } }, true);
    // przeglądarka nie powinna zaczynać własnego przeciągania tekstu z listy
    document.addEventListener('dragstart', e => { if (sourceOf(e.target)) e.preventDefault(); });
  }

  return { init };
})();
