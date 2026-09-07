import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import type { PickupPointOption } from "@cms/storefront";
import { hoursSummary, typeLabel } from "./pickupFormat";
import { boundsOf, locatedPoints, type LatLon } from "./pickupGeo";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "@/styles/components/pickup-map.scss";

// ─────────────────────────────────────────────────────────────────────────────
// Map pane of the pickup-point picker (core DECISIONS 236).
//
// Leaflet is driven IMPERATIVELY here rather than through react-leaflet: the
// clustering plugin is a Leaflet layer with no React binding, and 1.3k markers
// are cheaper to hand to it directly than to reconcile as elements. The whole
// Leaflet lifecycle is therefore confined to this file.
//
// This component is mounted only while the Map tab is open (the parent sets
// `keepMounted={false}`), which is also our click-to-load privacy stance: the
// OSM tile servers see a shopper's IP only if that shopper actually asks for a
// map. Nothing here talks to the carrier — the points come from the parent,
// which read them from our own synced catalog.
//
// Picking from a popup calls the SAME `onPick` as a list row, so the wire
// contract is unchanged: only the carrier id goes back, and the server rewrites
// the address from its own row (#235).
// ─────────────────────────────────────────────────────────────────────────────

// Croatia, roughly — the view before we know anything better.
const FALLBACK_CENTER: [number, number] = [45.1, 16.4];
const FALLBACK_ZOOM = 7;
const ORIGIN_ZOOM = 12;
const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

function markerIcon(type: string): L.DivIcon {
  return L.divIcon({
    className: "pickup-marker",
    html: `<span class="pickup-marker__dot pickup-marker__dot--${type}"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -7],
  });
}

export function PickupPointMap({ points, origin, onPick, t }: {
  points: PickupPointOption[];
  /** The shopper's position once they've allowed geolocation — else null. */
  origin: LatLon | null;
  onPick: (point: PickupPointOption) => void | Promise<void>;
  t: (key: string) => string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const originRef = useRef<L.CircleMarker | null>(null);
  // Held in refs so a changed callback or a re-render never forces us to rebuild
  // ~1.3k markers; the popup handlers read the current value at click time.
  const onPickRef = useRef(onPick);
  const tRef = useRef(t);
  onPickRef.current = onPick;
  tRef.current = t;

  // ── Map lifecycle: created once, destroyed on unmount ──────────────────────
  useEffect(() => {
    if (!boxRef.current) return;
    const map = L.map(boxRef.current, {
      center: FALLBACK_CENTER,
      zoom: FALLBACK_ZOOM,
      // The picker modal scrolls; a wheel that zooms the map instead of scrolling
      // the dialog is a well-known way to trap people. Ctrl/⌘+wheel still zooms.
      scrollWheelZoom: false,
      attributionControl: true,
    });
    L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);

    const cluster = L.markerClusterGroup({
      // 1.3k markers arrive in one go — chunk the insert so the modal doesn't
      // freeze on slower phones.
      chunkedLoading: true,
      maxClusterRadius: 60,
      showCoverageOnHover: false,
    });
    map.addLayer(cluster);

    mapRef.current = map;
    clusterRef.current = cluster;

    // The modal animates open, so the container has no final size yet on mount —
    // without this the map renders as a grey strip.
    const raf = requestAnimationFrame(() => map.invalidateSize());

    return () => {
      cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      originRef.current = null;
    };
  }, []);

  // ── Markers, rebuilt whenever the visible set changes (search / type filter) ─
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;

    cluster.clearLayers();
    const located = locatedPoints(points);
    const markers = located.map((p) => {
      const marker = L.marker([p.lat, p.lon], {
        icon: markerIcon(p.type),
        title: p.name,
      });
      // Bound lazily: building 1.3k popup DOM trees up front is wasted work when
      // a shopper opens one or two.
      marker.bindPopup(() => popupFor(p, onPickRef.current, tRef.current));
      return marker;
    });
    cluster.addLayers(markers);

    // Fit to what's on screen — but never fight the shopper's own position,
    // which the origin effect has already centred on.
    if (!origin) {
      const bounds = boundsOf(located);
      if (bounds) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
      else map.setView(FALLBACK_CENTER, FALLBACK_ZOOM);
    }
    // `origin` is deliberately not a dependency: it must not rebuild markers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  // ── "You are here" ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!origin) {
      originRef.current?.remove();
      originRef.current = null;
      return;
    }
    const at: [number, number] = [origin.lat, origin.lon];
    if (originRef.current) originRef.current.setLatLng(at);
    else {
      originRef.current = L.circleMarker(at, {
        radius: 7,
        weight: 3,
        color: "#fff",
        fillColor: "#2b6cb0",
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip(tRef.current("shop.pickup.youAreHere"));
    }
    map.setView(at, ORIGIN_ZOOM);
  }, [origin]);

  return (
    <div
      ref={boxRef}
      className="pickup-map"
      role="application"
      aria-label={t("shop.pickup.mapLabel")}
    />
  );
}

// Default export as well as named: the picker pulls this in with `React.lazy`,
// so Leaflet + its clustering plugin + their CSS land in a SEPARATE chunk that
// only a shopper who opens the Map tab ever downloads (#236).
export default PickupPointMap;

/** The popup card. Plain DOM — Leaflet popups are not a React tree. */
function popupFor(
  point: PickupPointOption,
  onPick: (p: PickupPointOption) => void | Promise<void>,
  t: (key: string) => string
): HTMLElement {
  const el = document.createElement("div");
  el.className = "pickup-popup";

  const name = document.createElement("div");
  name.className = "pickup-popup__name";
  name.textContent = point.name;
  el.appendChild(name);

  const meta = document.createElement("div");
  meta.className = "pickup-popup__meta";
  const hours = hoursSummary(point, t);
  meta.textContent = [
    `${point.address}, ${point.postalCode} ${point.city}`,
    typeLabel(point, t),
    hours,
  ]
    .filter(Boolean)
    .join(" · ");
  el.appendChild(meta);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pickup-popup__btn";
  btn.textContent = t("shop.pickup.choose");
  btn.addEventListener("click", () => {
    // The parent closes the modal on success; disabling here stops a double
    // submit in the window before it does.
    btn.disabled = true;
    void Promise.resolve(onPick(point)).finally(() => {
      btn.disabled = false;
    });
  });
  el.appendChild(btn);

  return el;
}
