/* 01-util.js — drobne narzędzia wspólne: DOM, escape, renderowanie opisów, toast z „Cofnij”. */
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function uid(prefix = 'id') {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function signed(n) { return (n >= 0 ? '+' : '−') + Math.abs(n); }

/* Formatowanie inline: ***x***, **x**, _x_ / *x* */
function mdInline(s) {
  return esc(s)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])_(.+?)_(?=[\s.,;:)]|$)/g, '$1<i>$2</i>')
    .replace(/(^|[\s(])\*(\S.*?)\*(?=[\s.,;:)]|$)/g, '$1<i>$2</i>');
}

/* Akapity opisu (tablica) -> HTML; obsługuje proste tabele markdown i listy „- ”. */
function mdBlocks(paras) {
  const out = [];
  let i = 0;
  while (i < paras.length) {
    const p = paras[i].trim();
    if (p.startsWith('|')) {
      const rows = [];
      while (i < paras.length && paras[i].trim().startsWith('|')) { rows.push(paras[i].trim()); i++; }
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const body = rows.filter(r => !/^\|[\s|:-]+\|?$/.test(r));
      const [head, ...rest] = body;
      out.push('<table><thead><tr>' + cells(head).map(c => `<th>${mdInline(c)}</th>`).join('') +
        '</tr></thead><tbody>' + rest.map(r => '<tr>' + cells(r).map(c => `<td>${mdInline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table>');
      continue;
    }
    if (/^[-•]\s/.test(p)) {
      const items = [];
      while (i < paras.length && /^[-•]\s/.test(paras[i].trim())) { items.push(paras[i].trim().replace(/^[-•]\s/, '')); i++; }
      out.push('<ul>' + items.map(t => `<li>${mdInline(t)}</li>`).join('') + '</ul>');
      continue;
    }
    // tabela zapisana w jednym akapicie z nowymi liniami
    if (p.includes('\n|')) { paras.splice(i, 1, ...p.split('\n')); continue; }
    // nagłówek wpleciony w akapit („Weather Sensor. You create…”) -> pogrubiony, jak w podręczniku
    const m = /^([A-Z][A-Za-z'’-]*(?: (?:[A-Z][A-Za-z'’-]*|of|the|and|or|to|a|an|in|on|with)){0,5})\. (?=[A-Z])/.exec(p);
    out.push(m && !p.startsWith('*') ? `<p><b><i>${esc(m[1])}.</i></b> ${mdInline(p.slice(m[0].length))}</p>` : `<p>${mdInline(p)}</p>`);
    i++;
  }
  return out.join('');
}

/* ---------- toast z opcjonalnym „Cofnij” ---------- */
const Toast = (() => {
  let timer = null;
  function show(msg, undoFn, ms = 9000) {
    const el = $('#toast');
    clearTimeout(timer);
    // otwarte okienko (dialog) leży w warstwie nad stroną; toast musi być w nim, żeby „Cofnij” było klikalne
    const dlg = $('#dlg');
    const host = dlg && dlg.open ? dlg : document.body;
    if (el.parentNode !== host) host.appendChild(el);
    el.innerHTML = `<span>${esc(msg)}</span>` + (undoFn ? '<button type="button">Cofnij</button>' : '');
    el.hidden = false;
    if (undoFn) {
      el.querySelector('button').onclick = () => { hide(); undoFn(); };
    }
    timer = setTimeout(hide, undoFn ? ms : 3500);
  }
  function hide() { $('#toast').hidden = true; clearTimeout(timer); }
  return { show, hide };
})();

/* ---------- dialog ---------- */
const Dlg = (() => {
  function open({ title, body, foot, wide = false, onOpen, kind = '' }) {
    const d = $('#dlg');
    d.className = wide ? 'wide' : '';
    d.dataset.kind = kind;
    const t = $('#toast');
    if (t && t.parentNode === d) document.body.appendChild(t); // nie kasuj toastu razem z treścią okienka
    const toastVisible = t && !t.hidden;
    d.innerHTML = `<div class="dlg-h"><h2>${esc(title)}</h2></div><div class="dlg-b">${body}</div><div class="dlg-f">${foot || ''}</div>`;
    if (!d.open) d.showModal();
    if (toastVisible) d.appendChild(t); // widoczny toast (np. z „Cofnij”) zostaje nad okienkiem
    if (onOpen) onOpen(d);
    return d;
  }
  function close() {
    const d = $('#dlg');
    d.dataset.kind = '';
    const t = $('#toast');
    if (t && t.parentNode === d) document.body.appendChild(t); // toast zostaje widoczny po zamknięciu okienka
    if (d.open) d.close();
  }
  /* Potwierdzenie akcji destrukcyjnej. */
  function confirm({ title, text, ok = 'Usuń', danger = true, onOk, onCancel }) {
    open({
      title,
      body: `<p style="margin:0">${text}</p>`,
      foot: `<button class="btn" data-x>Anuluj</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button>`,
      onOpen(d) {
        d.querySelector('[data-x]').onclick = () => { close(); if (onCancel) onCancel(); };
        d.querySelector('[data-ok]').onclick = () => { close(); onOk(); };
        d.querySelector('[data-x]').focus();
      },
    });
  }
  return { open, close, confirm };
})();

function download(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
