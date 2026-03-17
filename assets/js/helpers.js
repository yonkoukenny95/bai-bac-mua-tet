export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function deepClone(value) {
  return structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function trimText(value) {
  return String(value ?? '').trim();
}

export function getRankOptions(playerCount) {
  if (playerCount === 2) return ['first', 'last'];
  if (playerCount === 3) return ['first', 'second', 'last'];
  return ['first', 'second', 'third', 'last'];
}

export function sortPlayersByScore(players) {
  return [...players].sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name, 'vi'));
}

export function computeRanks(players) {
  return sortPlayersByScore(players).map((player, index) => ({ ...player, standing: index + 1 }));
}

export function formatSignedNumber(value) {
  const num = toNumber(value, 0);
  return num > 0 ? `+${num}` : `${num}`;
}

export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function nowIso() {
  return new Date().toISOString();
}
