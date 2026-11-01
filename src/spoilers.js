const KEY = "anyar.book";
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw === null ? NaN : Number(raw);
    return Number.isInteger(v) && v >= 0 ? v : null;
  } catch {
    return null;
  }
}

let book = read();

export const hasChosenBook = () => book !== null;

export const currentBook = () => book ?? 0;

export const isRevealed = (since = 1) => since <= Math.max(currentBook(), 1);

export const hasFinished = (book) => book <= currentBook();

export function setBook(n) {
  book = n;
  try {
    localStorage.setItem(KEY, String(n));
  } catch {}
  for (const fn of listeners) fn(n);
}

export function onBookChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
