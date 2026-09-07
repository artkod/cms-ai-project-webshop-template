import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Badge, Button, Group, Loader, Modal, ScrollArea, SegmentedControl,
  Stack, Tabs, Text, TextInput, UnstyledButton,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { Accessibility, AlertTriangle, List, LocateFixed, Map as MapIcon, MapPin, Search, X } from "lucide-react";
import type { PickupPointOption, PickupPointType, ShippingRate } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useStrings } from "@/lib/locale";
import { hoursSummary, typeLabel } from "./pickupFormat";
import { formatDistance, locatedPoints, sortByDistance, type LatLon } from "./pickupGeo";

// Leaflet and its clustering plugin are ~200 kB that a shopper who never opens
// the Map tab should not pay for — so the pane is a lazy chunk, fetched on the
// same click that decides to show a map at all.
const PickupPointMap = lazy(() => import("./PickupPointMap"));

// ─────────────────────────────────────────────────────────────────────────────
// GLS paketomat / ParcelShop picker (core DECISIONS 235; map pane #236).
//
// Searches the CMS's OWN synced copy of the carrier catalog
// (`GET /api/commerce/pickup-points`) — never the carrier directly — so it is
// cheap enough to query while the shopper types, and it keeps working when the
// carrier's feed is down.
//
// On pick we send ONLY the point's carrier id: the server resolves the name and
// address from its catalog and stores that, so nothing here can influence the
// address the parcel is shipped to. That holds for a marker popup exactly as it
// does for a list row — both call `choose()`.
//
// TWO fetch shapes over the same endpoint and the same query:
//   • LIST tab       — server-paged, 25 at a time (the original behaviour).
//   • MAP tab / near — the whole match set in ONE request (`limit` 2000, #236),
//     because a map cannot show page 1 of 13 and "nearest to me" cannot be
//     answered from a page. Distance is then computed in the browser, so the
//     shopper's coordinates never leave it.
// The map pane mounts only while its tab is open (`keepMounted={false}` on the
// `Tabs` PARENT — see the note at the JSX) — click-to-load, so OSM tile servers
// see an IP only for shoppers who ask for a map.
// ─────────────────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 250;
const PAGE_SIZE = 25;
/** Must stay ≤ the API's `PICKUP_QUERY_LIMIT_MAX`. HR is ~1.3k points. */
const FULL_LIMIT = 2000;
const GEO_TIMEOUT_MS = 10_000;

type TypeFilter = "all" | PickupPointType;
type Tab = "list" | "map";

export function PickupPointPicker({ opened, method, country, onClose, onPick }: {
  opened: boolean;
  /** The chosen shipping method — carries the id the server resolves the carrier from. */
  method: ShippingRate;
  country: string;
  onClose: () => void;
  onPick: (point: PickupPointOption) => void | Promise<void>;
}) {
  const { t } = useStrings();
  const fullScreen = useMediaQuery("(max-width: 48em)") ?? false;

  const [tab, setTab] = useState<Tab>("list");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [points, setPoints] = useState<PickupPointOption[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);
  const [failed, setFailed] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  // Bumped to force a refetch (retry) without changing the query.
  const [attempt, setAttempt] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // The whole match set, for the map and for distance sorting.
  const [fullPoints, setFullPoints] = useState<PickupPointOption[]>([]);
  const [fullTotal, setFullTotal] = useState(0);
  const [fullLoading, setFullLoading] = useState(false);
  const [fullFailed, setFullFailed] = useState(false);
  const fullAbortRef = useRef<AbortController | null>(null);

  // Geolocation is opt-in per open: we ask only when the shopper presses the
  // button, and we never persist or transmit the result.
  const [origin, setOrigin] = useState<LatLon | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);
  const [nearShown, setNearShown] = useState(PAGE_SIZE);

  // A fresh open starts from a clean search.
  useEffect(() => {
    if (!opened) return;
    setTab("list");
    setQuery("");
    setType("all");
    setOffset(0);
    setOrigin(null);
    setGeoDenied(false);
    setNearShown(PAGE_SIZE);
    setAttempt((n) => n + 1);
  }, [opened]);

  // Knowing where the shopper is turns the list into a nearest-first list, which
  // no longer matches server paging — so it is answered from `fullPoints`.
  const nearMode = origin !== null;
  const needsFull = opened && (tab === "map" || nearMode);

  // ── LIST: one debounced, abortable request per settled query ───────────────
  // Only while the list is actually showing: the map tab has its own query, and
  // running both would cost two requests per keystroke. Switching back refetches,
  // which the endpoint's `public, max-age=300` serves from the browser cache.
  useEffect(() => {
    if (!opened || nearMode || tab !== "list") return;
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setFailed(false);
      storefront
        .searchPickupPoints(
          {
            methodId: method.methodId,
            country,
            q: query.trim() || undefined,
            type: type === "all" ? undefined : type,
            limit: PAGE_SIZE,
            offset,
          },
          { signal: ctrl.signal },
        )
        .then((res) => {
          // Appending means "Load more"; a new search replaces the list.
          setPoints((prev) => (offset > 0 ? [...prev, ...res.points] : res.points));
          setTotal(res.total);
          setStale(res.stale);
        })
        .catch((err) => {
          if ((err as Error)?.name === "AbortError") return;
          setFailed(true);
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, nearMode, tab, method.methodId, country, query, type, offset, attempt]);

  // ── MAP / near: the whole match set in one request ─────────────────────────
  useEffect(() => {
    if (!needsFull) return;
    const timer = setTimeout(() => {
      fullAbortRef.current?.abort();
      const ctrl = new AbortController();
      fullAbortRef.current = ctrl;
      setFullLoading(true);
      setFullFailed(false);
      storefront
        .searchPickupPoints(
          {
            methodId: method.methodId,
            country,
            q: query.trim() || undefined,
            type: type === "all" ? undefined : type,
            limit: FULL_LIMIT,
          },
          { signal: ctrl.signal },
        )
        .then((res) => {
          setFullPoints(res.points);
          setFullTotal(res.total);
          setStale(res.stale);
        })
        .catch((err) => {
          if ((err as Error)?.name === "AbortError") return;
          setFullFailed(true);
        })
        .finally(() => setFullLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsFull, method.methodId, country, query, type, attempt]);

  // Editing the search or the type filter restarts paging.
  const onSearch = (v: string) => { setQuery(v); setOffset(0); setNearShown(PAGE_SIZE); };
  const onType = (v: string) => { setType(v as TypeFilter); setOffset(0); setNearShown(PAGE_SIZE); };

  const choose = async (p: PickupPointOption) => {
    setPicking(p.id);
    try {
      await onPick(p);
    } finally {
      setPicking(null);
    }
  };

  const locate = () => {
    if (origin) { // pressed again = "show all again"
      setOrigin(null);
      setNearShown(PAGE_SIZE);
      // Back to server paging from the top: the list still holds the pages the
      // shopper had loaded, so resuming at the old offset would append a page it
      // already shows.
      setOffset(0);
      return;
    }
    if (!navigator.geolocation) { setGeoDenied(true); return; }
    setLocating(true);
    setGeoDenied(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setNearShown(PAGE_SIZE);
        setLocating(false);
      },
      // Denied, unavailable or timed out are all the same to a shopper: the
      // search box still works, so this warns and never blocks.
      () => { setGeoDenied(true); setLocating(false); },
      { enableHighAccuracy: false, timeout: GEO_TIMEOUT_MS, maximumAge: 300_000 },
    );
  };

  const typeData = useMemo(() => ([
    { value: "all", label: t("shop.pickup.typeAll") },
    { value: "parcel-locker", label: t("shop.pickup.typeLocker") },
    { value: "parcel-shop", label: t("shop.pickup.typeShop") },
  ]), [t]);

  // Nearest-first, and only points we can measure — see `sortByDistance`.
  const nearPoints = useMemo(
    () => (origin ? sortByDistance(fullPoints, origin) : []),
    [origin, fullPoints],
  );

  // What the LIST tab actually renders, in either mode.
  const listRows: Array<PickupPointOption & { distanceKm?: number }> = nearMode
    ? nearPoints.slice(0, nearShown)
    : points;
  const listTotal = nearMode ? nearPoints.length : total;
  const listLoading = nearMode ? fullLoading : loading;
  const listFailed = nearMode ? fullFailed : failed;
  const canLoadMore = nearMode ? nearShown < nearPoints.length : points.length < total;
  const loadMore = () => (nearMode ? setNearShown((n) => n + PAGE_SIZE) : setOffset(points.length));

  // Honest about a truncated map: HR never hits 2000, a future EU-wide one might.
  const mapTruncated = fullTotal > fullPoints.length;
  const mapPlottable = locatedPoints(fullPoints).length;

  const retry = () => setAttempt((n) => n + 1);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("shop.pickup.title")}
      size="lg"
      fullScreen={fullScreen}
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack gap="sm">
        <TextInput
          leftSection={<Search size={15} />}
          placeholder={t("shop.pickup.searchPlaceholder")}
          value={query}
          onChange={(e) => onSearch(e.currentTarget.value)}
          data-autofocus
        />
        <Group gap="xs" wrap="nowrap" align="center">
          <SegmentedControl style={{ flex: 1 }} size="xs" data={typeData} value={type} onChange={onType} />
          <Button
            size="xs"
            variant={origin ? "filled" : "light"}
            loading={locating}
            leftSection={origin ? <X size={14} /> : <LocateFixed size={14} />}
            onClick={locate}
          >
            {origin ? t("shop.pickup.clearNearMe") : t("shop.pickup.nearMe")}
          </Button>
        </Group>

        {stale && (
          <Alert color="yellow" icon={<AlertTriangle size={16} />} variant="light">
            {t("shop.pickup.stale")}
          </Alert>
        )}
        {geoDenied && (
          <Alert color="yellow" icon={<AlertTriangle size={16} />} variant="light">
            {t("shop.pickup.geoDenied")}
          </Alert>
        )}

        {/* `keepMounted` belongs on the PARENT: on `Tabs.Panel` the prop only ever
            opts a panel back IN ("keep this one mounted even though the parent says
            no"), so `keepMounted={false}` there is silently a no-op and the map would
            mount hidden the moment the picker opens — fetching a tile from OSM for a
            shopper who never asked for a map. Verified in the browser (#236). */}
        <Tabs keepMounted={false} value={tab} onChange={(v) => setTab((v as Tab) ?? "list")}>
          <Tabs.List grow>
            <Tabs.Tab value="list" leftSection={<List size={14} />}>
              {t("shop.pickup.tabList")}
            </Tabs.Tab>
            <Tabs.Tab value="map" leftSection={<MapIcon size={14} />}>
              {t("shop.pickup.tabMap")}
            </Tabs.Tab>
          </Tabs.List>

          {/* ── LIST ─────────────────────────────────────────────────────── */}
          <Tabs.Panel value="list" pt="sm">
            <Stack gap="sm">
              {listFailed && (
                <Alert color="red" icon={<AlertTriangle size={16} />} variant="light">
                  <Group justify="space-between" wrap="nowrap">
                    <Text fz="sm">{t("shop.pickup.loadError")}</Text>
                    <Button size="xs" variant="light" onClick={retry}>
                      {t("shop.pickup.retry")}
                    </Button>
                  </Group>
                </Alert>
              )}

              {listLoading && listRows.length === 0 ? (
                <Group justify="center" py="lg"><Loader size="sm" /></Group>
              ) : listRows.length === 0 ? (
                <Text c="dimmed" fz="sm" py="md">{t("shop.pickup.noResults")}</Text>
              ) : (
                <Stack gap={4}>
                  {listRows.map((p) => {
                    const hours = hoursSummary(p, t);
                    return (
                      <UnstyledButton
                        key={p.id}
                        onClick={() => void choose(p)}
                        disabled={picking !== null}
                        p="xs"
                        style={{ borderRadius: 8, border: "1px solid var(--mantine-color-default-border)" }}
                      >
                        <Group justify="space-between" wrap="nowrap" align="flex-start">
                          <Stack gap={2}>
                            <Group gap={6} wrap="nowrap">
                              <MapPin size={14} />
                              <Text fw={600} fz="sm">{p.name}</Text>
                              {p.wheelchair && <Accessibility size={13} aria-label={t("shop.pickup.wheelchair")} />}
                            </Group>
                            <Text fz="xs" c="dimmed">{p.address}, {p.postalCode} {p.city}</Text>
                            {hours && <Text fz="xs" c="dimmed">{hours}</Text>}
                          </Stack>
                          <Group gap={6} wrap="nowrap">
                            {typeof p.distanceKm === "number" && (
                              <Badge size="xs" variant="light" color="blue">{formatDistance(p.distanceKm)}</Badge>
                            )}
                            <Badge size="xs" variant="light">{typeLabel(p, t)}</Badge>
                            {picking === p.id && <Loader size="xs" />}
                          </Group>
                        </Group>
                      </UnstyledButton>
                    );
                  })}
                  {canLoadMore && (
                    <Button variant="subtle" size="xs" loading={listLoading} onClick={loadMore}>
                      {t("shop.pickup.loadMore")}
                    </Button>
                  )}
                  <Text fz="xs" c="dimmed" ta="center">
                    {t("shop.pickup.count")
                      .replace("{{shown}}", String(listRows.length))
                      .replace("{{total}}", String(listTotal))}
                  </Text>
                </Stack>
              )}
            </Stack>
          </Tabs.Panel>

          {/* ── MAP (mounted only while open — click-to-load) ─────────────── */}
          <Tabs.Panel value="map" pt="sm">
            <Stack gap="xs">
              {fullFailed ? (
                <Alert color="red" icon={<AlertTriangle size={16} />} variant="light">
                  <Group justify="space-between" wrap="nowrap">
                    <Text fz="sm">{t("shop.pickup.loadError")}</Text>
                    <Button size="xs" variant="light" onClick={retry}>
                      {t("shop.pickup.retry")}
                    </Button>
                  </Group>
                </Alert>
              ) : fullLoading && fullPoints.length === 0 ? (
                <Group justify="center" py="xl"><Loader size="sm" /></Group>
              ) : (
                <>
                  <Suspense fallback={<Group justify="center" py="xl"><Loader size="sm" /></Group>}>
                    <PickupPointMap points={fullPoints} origin={origin} onPick={choose} t={t} />
                  </Suspense>
                  <Text fz="xs" c="dimmed" ta="center">
                    {t("shop.pickup.mapCount").replace("{{count}}", String(mapPlottable))}
                    {mapTruncated && ` · ${t("shop.pickup.mapTruncated")}`}
                  </Text>
                </>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Modal>
  );
}
