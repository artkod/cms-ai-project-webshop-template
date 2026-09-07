import { describe, expect, test } from "vitest";
import type { PickupPointOption } from "@cms/storefront";
import {
  boundsOf, distanceKm, formatDistance, locatedPoints, sortByDistance,
} from "@/components/shop/pickupGeo";

// ─────────────────────────────────────────────────────────────────────────────
// The pure half of the pickup-point map pane (#236). Leaflet itself is not
// covered here on purpose: it needs real layout, which jsdom does not do — the
// map is verified by hand in the dev storefront.
// ─────────────────────────────────────────────────────────────────────────────

const ZAGREB = { lat: 45.815, lon: 15.9819 };
const SPLIT = { lat: 43.5081, lon: 16.4402 };

function point(over: Partial<PickupPointOption> & { id: string }): PickupPointOption {
  return {
    provider: "gls",
    name: over.id,
    type: "parcel-locker",
    country: "HR",
    postalCode: "10000",
    city: "Zagreb",
    address: "Ilica 1",
    lat: null,
    lon: null,
    features: [],
    hours: [],
    pickupTime: null,
    wheelchair: false,
    ...over,
  };
}

describe("distanceKm", () => {
  test("matches the known Zagreb–Split great-circle distance", () => {
    // ~259 km as the crow flies; allow a couple of km for the spherical model.
    expect(distanceKm(ZAGREB, SPLIT)).toBeGreaterThan(255);
    expect(distanceKm(ZAGREB, SPLIT)).toBeLessThan(263);
  });

  test("is zero for the same spot and symmetric between two", () => {
    expect(distanceKm(ZAGREB, ZAGREB)).toBe(0);
    expect(distanceKm(ZAGREB, SPLIT)).toBeCloseTo(distanceKm(SPLIT, ZAGREB), 9);
  });
});

describe("locatedPoints", () => {
  test("drops points the feed never geocoded", () => {
    const kept = locatedPoints([
      point({ id: "a", lat: 45.8, lon: 16 }),
      point({ id: "b" }), // null/null — would otherwise land off West Africa
      point({ id: "c", lat: 45.8, lon: null }),
    ]);
    expect(kept.map((p) => p.id)).toEqual(["a"]);
  });

  test("drops NaN coordinates as well as nulls", () => {
    expect(locatedPoints([point({ id: "x", lat: Number.NaN, lon: 16 })])).toEqual([]);
  });
});

describe("sortByDistance", () => {
  test("orders nearest first and attaches the distance", () => {
    const sorted = sortByDistance(
      [
        point({ id: "split", lat: SPLIT.lat, lon: SPLIT.lon }),
        point({ id: "near", lat: 45.82, lon: 15.99 }),
        point({ id: "rijeka", lat: 45.327, lon: 14.442 }),
      ],
      ZAGREB,
    );
    expect(sorted.map((p) => p.id)).toEqual(["near", "rijeka", "split"]);
    expect(sorted[0].distanceKm).toBeLessThan(2);
  });

  test("excludes unlocated points rather than parking them at the end", () => {
    const sorted = sortByDistance([point({ id: "nowhere" }), point({ id: "here", lat: 45.8, lon: 16 })], ZAGREB);
    expect(sorted.map((p) => p.id)).toEqual(["here"]);
  });
});

describe("formatDistance", () => {
  test("metres below a kilometre, one decimal below ten, whole km above", () => {
    expect(formatDistance(0.42)).toBe("420 m");
    expect(formatDistance(3.14)).toBe("3.1 km");
    expect(formatDistance(42.6)).toBe("43 km");
  });

  test("returns empty for nonsense rather than 'NaN km'", () => {
    expect(formatDistance(Number.NaN)).toBe("");
    expect(formatDistance(-1)).toBe("");
  });
});

describe("boundsOf", () => {
  test("spans every point", () => {
    const b = boundsOf(
      locatedPoints([
        point({ id: "a", lat: 45.8, lon: 16.0 }),
        point({ id: "b", lat: 43.5, lon: 16.4 }),
        point({ id: "c", lat: 45.3, lon: 14.4 }),
      ]),
    );
    expect(b).toEqual([
      [43.5, 14.4],
      [45.8, 16.4],
    ]);
  });

  test("is null when there is nothing to fit", () => {
    expect(boundsOf([])).toBeNull();
  });
});
