// Ship-to country list for the storefront pickers (cart + checkout).
//
// Three shipping/tax zones (design §13 + §7):
//   HR  — home (domestic HR VAT)
//   EU  — EU member (cross-border: OSS destination rate when the shop collects,
//         else the HR home rate below the €10k threshold)
//   INT — outside the EU (export → 0% VAT; see the tax provider's `export` branch)
//
// This is a STOREFRONT presentation list, independent of the admin OSS rate table:
// the OSS table decides what RATE a chosen EU country is charged; this decides which
// countries the shopper can pick. Localized country names come from Intl.DisplayNames.

export type Zone = "HR" | "EU" | "INT";

// EU-27 (ISO-3166 alpha-2); HR is the home country, tagged HR not EU.
const EU_CODES = [
  "AT", "BE", "BG", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
] as const;

// A common set of non-EU destinations (extend as needed).
const INT_CODES = ["GB", "CH", "NO", "US", "CA", "AU", "RS", "BA"] as const;

export interface Country {
  code: string;
  zone: Zone;
}

// HR first, then EU, then INT — the display order before per-name sorting below.
export const COUNTRIES: Country[] = [
  { code: "HR", zone: "HR" },
  ...EU_CODES.map((code) => ({ code, zone: "EU" as Zone })),
  ...INT_CODES.map((code) => ({ code, zone: "INT" as Zone })),
];

const ZONE_OF = new Map<string, Zone>(COUNTRIES.map((c) => [c.code, c.zone]));

/** The shipping/tax zone of an ISO-2 country code (defaults to HR when unknown). */
export function zoneOf(code: string | null | undefined): Zone {
  return ZONE_OF.get((code || "HR").toUpperCase()) ?? "HR";
}

/** Whether a destination is an export (outside the EU) → zero-rated VAT. */
export function isExport(code: string | null | undefined): boolean {
  return zoneOf(code) === "INT";
}

const regionNamesCache = new Map<string, Intl.DisplayNames>();
function regionNames(locale: string): Intl.DisplayNames | null {
  try {
    let dn = regionNamesCache.get(locale);
    if (!dn) {
      dn = new Intl.DisplayNames([locale], { type: "region" });
      regionNamesCache.set(locale, dn);
    }
    return dn;
  } catch {
    return null;
  }
}

/**
 * Build the `{ value, label }[]` options for a Mantine Select, localized to `locale`
 * with a zone tag suffix (e.g. "Germany (EU)"). `t` supplies the zone-tag copy.
 * HR is pinned first; the EU and INT groups are each sorted by localized name.
 */
export function countryOptions(
  locale: string,
  t: (k: string) => string,
): { value: string; label: string }[] {
  const dn = regionNames(locale);
  const name = (code: string) => dn?.of(code) ?? code;
  const tag = (zone: Zone) =>
    zone === "HR" ? "HR" : zone === "EU" ? t("shop.country.eu") : t("shop.country.intl");
  const label = (c: Country) => `${name(c.code)} (${tag(c.zone)})`;

  const home = COUNTRIES.filter((c) => c.zone === "HR");
  const eu = COUNTRIES.filter((c) => c.zone === "EU").sort((a, b) => name(a.code).localeCompare(name(b.code), locale));
  const intl = COUNTRIES.filter((c) => c.zone === "INT").sort((a, b) => name(a.code).localeCompare(name(b.code), locale));
  return [...home, ...eu, ...intl].map((c) => ({ value: c.code, label: label(c) }));
}
