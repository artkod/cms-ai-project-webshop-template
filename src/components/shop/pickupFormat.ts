import type { PickupPointOption } from "@cms/storefront";

// ─────────────────────────────────────────────────────────────────────────────
// Opening-hours formatting, shared by the pickup-point LIST and MAP panes
// (core DECISIONS 235/236).
//
// Hours arrive RAW (`[dayNumber, open, close]`, 1 = Monday) because
// `GET /api/commerce/pickup-points` is shared-cached and therefore has to stay
// locale-independent. It lives in its own module so the map's Leaflet popups —
// which are plain DOM, not React — can render exactly the same summary as the
// list rows without importing the picker (which imports the map).
// ─────────────────────────────────────────────────────────────────────────────

type T = (key: string) => string;

/** "00:00–24:00" reads as 0–24; a day the point never opens is closed. */
export function dayHours(p: PickupPointOption, day: number, t: T): string {
  const row = p.hours.find(([d]) => d === day);
  if (!row) return t("shop.pickup.closed");
  const [, open, close] = row;
  if (open === "00:00" && close === "24:00") return t("shop.pickup.open24");
  return `${open}–${close}`;
}

/** Collapse the week into ranges of equal days: "Mon–Fri 08:00–20:00 · Sat 08:00–14:00". */
export function hoursSummary(p: PickupPointOption, t: T): string {
  if (!p.hours.length) return "";
  const days = [1, 2, 3, 4, 5, 6, 7];
  const spans: Array<{ from: number; to: number; label: string }> = [];
  for (const d of days) {
    const label = dayHours(p, d, t);
    const last = spans[spans.length - 1];
    if (last && last.label === label) last.to = d;
    else spans.push({ from: d, to: d, label });
  }
  const closed = t("shop.pickup.closed");
  // A 24/7 locker collapses to a single span — say it once, without day names.
  if (spans.length === 1) return spans[0].label === closed ? "" : spans[0].label;
  return spans
    .filter((s) => s.label !== closed)
    .map((s) => {
      const from = t(`shop.pickup.days.${s.from}`);
      const to = t(`shop.pickup.days.${s.to}`);
      return `${s.from === s.to ? from : `${from}–${to}`} ${s.label}`;
    })
    .join(" · ");
}

/** The translated label for a point's kind — same token in both panes. */
export function typeLabel(p: PickupPointOption, t: T): string {
  return p.type === "parcel-locker" ? t("shop.pickup.typeLocker") : t("shop.pickup.typeShop");
}
