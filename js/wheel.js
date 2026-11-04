// iOS-ähnliches Scroll-Rad per CSS scroll-snap.
export const ITEM_H = 44;

export function createWheel({ values, value, label, format = (v) => String(v).padStart(2, '0') }) {
  const col = document.createElement('div');
  col.className = 'wheel-col';
  const cap = document.createElement('div');
  cap.className = 'wheel-label';
  cap.textContent = label;
  const wrap = document.createElement('div');
  wrap.className = 'wheel-wrap';
  const wheel = document.createElement('div');
  wheel.className = 'wheel';
  const pad = () => Object.assign(document.createElement('div'), { className: 'wheel-pad' });
  wheel.append(pad());
  const items = values.map((v, i) => {
    const it = document.createElement('div');
    it.className = 'wheel-item';
    it.textContent = format(v);
    it.addEventListener('click', () => wheel.scrollTo({ top: i * ITEM_H, behavior: 'smooth' }));
    wheel.append(it);
    return it;
  });
  wheel.append(pad());
  wrap.append(wheel);
  col.append(cap, wrap);

  const index = () => Math.min(values.length - 1, Math.max(0, Math.round(wheel.scrollTop / ITEM_H)));
  let sel = -1;
  let raf = 0;
  const mark = () => {
    raf = 0;
    const i = index();
    if (i === sel) return;
    items[sel]?.classList.remove('sel');
    items[i].classList.add('sel');
    sel = i;
  };
  wheel.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(mark); }, { passive: true });

  return {
    root: col,
    get value() { return values[index()]; },
    /** Nach dem Einhängen ins DOM aufrufen, sonst ist scrollTop wirkungslos. */
    show() {
      const i = Math.max(0, values.indexOf(value));
      wheel.scrollTop = i * ITEM_H;
      mark();
    },
  };
}
