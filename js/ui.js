import { ICONS } from './icons.js';

/** Kleiner DOM-Helfer: h('div', { class, text, onclick, … }, ...kinder). */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'icon') el.insertAdjacentHTML('beforeend', ICONS[v]);
    else if (k === 'style') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function icon(name, cls = 'ico') {
  return h('span', { class: cls, icon: name });
}

/** Overlay mit Hintergrund-Abdunklung; build(close) liefert den Inhalt. */
export function openOverlay(build, { onDismiss } = {}) {
  const ov = h('div', { class: 'overlay' });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    ov.classList.remove('show');
    const done = () => ov.remove();
    ov.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 450);
  };
  ov.append(build(close));
  ov.addEventListener('click', (e) => {
    if (e.target === ov) { close(); onDismiss?.(); }
  });
  document.body.append(ov);
  void ov.offsetHeight;
  ov.classList.add('show');
  return { ov, close };
}

/**
 * Dialog. Button-Aktionen laufen synchron im Klick-Handler, damit sie noch als
 * Nutzergeste gelten (wichtig für Audio-Start auf iOS).
 */
export function dialog({ title, message, input = null, buttons = [{ label: 'OK', kind: 'primary' }], vertical = false }) {
  let field = null;
  const { ov } = openOverlay((close) => {
    if (input) {
      field = h('input', {
        class: 'dialog-input', type: 'text', value: input.value ?? '', placeholder: input.placeholder ?? '',
        maxlength: String(input.maxLength ?? 40), autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', enterkeyhint: 'done',
      });
      field.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); card.querySelector('.dbtn.primary')?.click(); }
      });
    }
    const card = h('div', { class: 'dialog-card', role: 'dialog', 'aria-modal': 'true' },
      title && h('div', { class: 'dialog-title', text: title }),
      message && h('div', { class: 'dialog-msg', text: message }),
      field,
      h('div', { class: 'dialog-btns' + (vertical ? ' vertical' : '') },
        buttons.map((b) => h('button', {
          class: 'dbtn' + (b.kind ? ' ' + b.kind : ''), text: b.label, type: 'button',
          onclick: () => { close(); b.action?.(field ? field.value.trim() : undefined); },
        }))));
    return card;
  });
  ov.classList.add('center');
  if (field) { field.focus(); field.select(); }
}

/** Bottom-Sheet mit Kopfzeile ABBRECHEN | Titel | FERTIG. */
export function sheet({ title, body, onDone, onShown }) {
  openOverlay((close) => h('div', { class: 'sheet' },
    h('div', { class: 'sheet-grip' }),
    h('div', { class: 'sheet-head' },
      h('button', { class: 'hbtn left', type: 'button', text: 'ABBRECHEN', onclick: close }),
      h('div', { class: 'sheet-title', text: title }),
      h('button', { class: 'hbtn right accent', type: 'button', text: 'FERTIG', onclick: () => { onDone(); close(); } })),
    body));
  onShown?.();
}

let toastTimer = 0;
export function toast(text) {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast', class: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

export function flash() {
  const f = document.getElementById('flash');
  if (!f) return;
  f.classList.remove('go');
  void f.offsetWidth;
  f.classList.add('go');
}
