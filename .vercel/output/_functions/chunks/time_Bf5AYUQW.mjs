const LONDON_TZ = "Europe/London";
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
function isValidDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return utcDate.getUTCFullYear() === year && utcDate.getUTCMonth() === month - 1 && utcDate.getUTCDate() === day;
}
function normalizeToIsoDate(input) {
  const trimmed = input.trim();
  const isoMatch = trimmed.match(ISO_DATE_PATTERN);
  if (isoMatch) {
    const year2 = Number(isoMatch[1]);
    const month2 = Number(isoMatch[2]);
    const day2 = Number(isoMatch[3]);
    if (!isValidDateParts(year2, month2, day2)) return null;
    return `${String(year2).padStart(4, "0")}-${String(month2).padStart(2, "0")}-${String(day2).padStart(2, "0")}`;
  }
  const dmyMatch = trimmed.match(DMY_DATE_PATTERN);
  if (!dmyMatch) return null;
  const day = Number(dmyMatch[1]);
  const month = Number(dmyMatch[2]);
  const year = Number(dmyMatch[3]);
  if (!isValidDateParts(year, month, day)) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function londonDayOfWeekFromIsoDate(isoDate) {
  const isoMatch = isoDate.match(ISO_DATE_PATTERN);
  if (!isoMatch) return null;
  const year = Number(isoMatch[1]);
  const month = Number(isoMatch[2]);
  const day = Number(isoMatch[3]);
  if (!isValidDateParts(year, month, day)) return null;
  const middayUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TZ,
    weekday: "short"
  }).format(middayUtc);
  const dayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  return dayMap[weekday] ?? null;
}
function toUtcFromLondon(date, minutes) {
  const [year, month, day] = date.split("-").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, 0));
  const londonParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(utcGuess);
  const get = (type) => Number(londonParts.find((p) => p.type === type)?.value ?? "0");
  const diffMinutes = get("hour") * 60 + get("minute") - minutes;
  return new Date(utcGuess.getTime() - diffMinutes * 6e4);
}
function minutesInLondonDay(dateUtc) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TZ,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(dateUtc);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}
function londonDateKey(dateUtc) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(dateUtc);
}
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 6e4);
}

export { addMinutes as a, londonDateKey as b, londonDayOfWeekFromIsoDate as l, minutesInLondonDay as m, normalizeToIsoDate as n, toUtcFromLondon as t };
