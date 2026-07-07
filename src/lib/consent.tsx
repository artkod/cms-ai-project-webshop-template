import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getStoredConsent,
  initAnalytics,
  grantAnalyticsConsent,
  denyAnalyticsConsent,
  type ConsentDecision,
} from "@cms/storefront";
import { storefront } from "./storefront";
import { getSiteSettings } from "./api";
import { useCustomer } from "./customer";

// ─────────────────────────────────────────────────────────────────────────────
// Cookie-consent context (Phase L9.6).
//
// Owns the visitor's analytics-consent decision. The SDK persists it in
// localStorage and gates gtag.js + every GA4 event on it; this provider adds:
//   - boot: read the shop's GA4 id from CORE site settings (`getSiteSettings()
//     .ga4MeasurementId`) → `initAnalytics()` (loads gtag right away only for a
//     returning visitor with a stored grant);
//   - `accept()`/`decline()`: store the choice, (un)arm the SDK gate, and — for
//     a LOGGED-IN customer — best-effort record it server-side (GDPR consent
//     record, source `cookie_banner`). Guests stay client-side only.
//   - `decision === null` drives the banner's visibility; `reopen()` lets a
//     footer "Cookie settings" link re-surface it.
// ─────────────────────────────────────────────────────────────────────────────

interface ConsentValue {
  /** The stored decision; null = not decided yet (banner shows). */
  decision: ConsentDecision | null;
  /** True while the banner should be visible. */
  bannerOpen: boolean;
  accept: () => void;
  decline: () => void;
  /** Re-open the banner (footer "Cookie settings"). */
  reopen: () => void;
}

const Ctx = createContext<ConsentValue | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const { customer } = useCustomer();
  const [decision, setDecision] = useState<ConsentDecision | null>(() => getStoredConsent());
  const [bannerOpen, setBannerOpen] = useState<boolean>(() => getStoredConsent() === null);

  // Boot: read the GA4 id from CORE site settings and arm the SDK. A returning
  // visitor with a stored grant starts sending immediately; everyone else waits
  // for accept(). (GA4 is a core capability — not commerce; see docs/frontend-analytics.md.)
  useEffect(() => {
    let alive = true;
    getSiteSettings()
      .then((s) => alive && initAnalytics(s?.ga4MeasurementId))
      .catch(() => {
        /* settings unavailable → analytics simply stays off */
      });
    return () => {
      alive = false;
    };
  }, []);

  // Best-effort server-side record for a logged-in customer. Guests' choices
  // stay client-side (no identifiable subject) — checkout captures theirs.
  const recordServerSide = useCallback(
    (granted: boolean) => {
      if (!customer) return;
      void storefront.recordConsent({ kind: "analytics", granted }).catch(() => {
        /* never block the UI on the consent record */
      });
    },
    [customer],
  );

  const accept = useCallback(() => {
    grantAnalyticsConsent();
    setDecision(getStoredConsent());
    setBannerOpen(false);
    recordServerSide(true);
  }, [recordServerSide]);

  const decline = useCallback(() => {
    denyAnalyticsConsent();
    setDecision(getStoredConsent());
    setBannerOpen(false);
    recordServerSide(false);
  }, [recordServerSide]);

  const reopen = useCallback(() => setBannerOpen(true), []);

  return <Ctx.Provider value={{ decision, bannerOpen, accept, decline, reopen }}>{children}</Ctx.Provider>;
}

export function useConsent(): ConsentValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useConsent must be used inside <ConsentProvider>");
  return v;
}
