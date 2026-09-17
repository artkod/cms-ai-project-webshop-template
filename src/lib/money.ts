// Format integer EUR cents (the money unit everywhere in commerce — design §10)
// as a localized currency string, e.g. 12500 → "125,00 €".
export function formatCents(cents: number, currency = "EUR", locale = "hr-HR"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

// Format an ISO date ("2026-09-10") the way a Croatian price tag reads it:
// "10. 9. 2026." — used by the anchor-price line, which must name the day the
// reference price belongs to (NN 101/2026). Parsed as a plain calendar date, so
// no timezone can shift it a day either way.
export function formatIsoDate(iso: string, locale = "hr-HR"): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", year: "numeric" }).format(new Date(y, m - 1, d));
}
