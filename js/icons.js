// Inline-SVG-Icons (statische Strings, keine Nutzerdaten).
const svg = (body, filled = false) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" ${filled
    ? 'fill="currentColor" stroke="none"'
    : 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;

export const ICONS = {
  tabata: svg('<path d="M13.5 2 4.5 13.5h6.5L9.5 22l9.5-12h-6.6z"/>', true),
  runden: svg('<path d="M17 2.5l3.5 3.5-3.5 3.5"/><path d="M3.5 11.5V10a4 4 0 0 1 4-4h13"/><path d="M7 21.5L3.5 18 7 14.5"/><path d="M20.5 12.5V14a4 4 0 0 1-4 4h-13"/>'),
  stoppuhr: svg('<circle cx="12" cy="13.5" r="8"/><path d="M12 13.5V9.5"/><path d="M9.5 2.5h5"/><path d="M12 2.5v3"/><path d="M18.5 6.5l1.6-1.6"/>'),
  mehr: svg('<circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/>', true),
  chevron: svg('<path d="M9 5l7 7-7 7"/>'),
  up: svg('<path d="M6 15l6-6 6 6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  dots: svg('<circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>', true),
  play: svg('<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/>', true),
  pause: svg('<rect x="5.5" y="4" width="4.5" height="16" rx="1.2"/><rect x="14" y="4" width="4.5" height="16" rx="1.2"/>', true),
  skip: svg('<path d="M4 5.2v13.6a1 1 0 0 0 1.55.83L15 13.2v5.3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-13a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v5.3L5.55 4.37A1 1 0 0 0 4 5.2z"/>', true),
  stop: svg('<path d="M6 6l12 12M18 6L6 18" stroke-width="3"/>'),
  sound: svg('<path d="M4 9.5h3.5L12.5 5v14l-5-4.5H4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.8 6.2a8 8 0 0 1 0 11.6"/>'),
};
