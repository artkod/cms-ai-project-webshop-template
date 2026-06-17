// Format integer EUR cents (the money unit everywhere in commerce — design §10)
// as a localized currency string, e.g. 12500 → "125,00 €".
export function formatCents(cents: number, currency = "EUR", locale = "hr-HR"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}
