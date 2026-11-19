// Jalali <-> Gregorian conversion (jalaali algorithm), Tehran-time helpers.
const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;

function jalCal(jy: number) {
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14, jp = breaks[0], jm = 0, jump = 0, n, i;
  for (i = 1; i < bl; i++) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}
function g2d(gy: number, gm: number, gd: number) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}
export function toJalali(gy: number, gm: number, gd: number) {
  const jdn = g2d(gy, gm, gd);
  const g = d2g(jdn).gy;
  let jy = g - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(g, 3, r.march);
  let k = jdn - jdn1f, jm, jd;
  if (k >= 0) {
    if (k <= 185) { jm = 1 + div(k, 31); jd = mod(k, 31) + 1; return { jy, jm, jd }; }
    k -= 186;
  } else {
    jy -= 1; k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30); jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}
export function toGregorian(jy: number, jm: number, jd: number) {
  const r = jalCal(jy);
  return d2g(g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1);
}
export const isJalaliLeap = (jy: number) => jalCal(jy).leap === 0;
export const jalaliMonthLength = (jy: number, jm: number) => (jm <= 6 ? 31 : jm <= 11 ? 30 : isJalaliLeap(jy) ? 30 : 29);

export const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
export const WEEKDAYS_SAT = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

const TZ = 'Asia/Tehran';
/** Y-M-D of an instant as seen in Tehran */
export function tehranParts(d: Date) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d).split('-').map(Number);
  return { gy: p[0], gm: p[1], gd: p[2] };
}
export function jalaliOf(d: Date) {
  const { gy, gm, gd } = tehranParts(d);
  return toJalali(gy, gm, gd);
}
/** "YYYY-MM-DD" (Gregorian) -> Date at noon Tehran time (avoids day shifts) */
export function isoToDate(iso: string) {
  return new Date(`${iso}T12:00:00+03:30`);
}
export function dateToIso(d: Date) {
  const { gy, gm, gd } = tehranParts(d);
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}
export const faNum = (n: number | string) => String(n).replace(/\d/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[+c]);
export function formatJalali(d: Date | null | undefined) {
  if (!d) return '—';
  const j = jalaliOf(d);
  return `${faNum(j.jd)} ${MONTHS[j.jm - 1]} ${faNum(j.jy)}`;
}
export function formatJalaliShort(d: Date | null | undefined) {
  if (!d) return '—';
  const j = jalaliOf(d);
  return faNum(`${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`);
}
export function formatTime(d: Date) {
  return faNum(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(d));
}
/** Saturday=0 … Friday=6 for a Gregorian date */
export function weekdaySat(gy: number, gm: number, gd: number) {
  const wd = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay(); // Sun=0
  return (wd + 1) % 7;
}
/** Midnight (Tehran) at the start of the day containing `d` */
export function startOfTehranDay(d = new Date()) {
  return new Date(isoToDate(dateToIso(d)).getTime() - 12 * 3600 * 1000);
}
