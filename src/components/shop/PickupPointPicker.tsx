import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Badge, Button, Group, Loader, Modal, ScrollArea, SegmentedControl,
  Stack, Text, TextInput, UnstyledButton,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { Accessibility, AlertTriangle, MapPin, Search } from "lucide-react";
import type { PickupPointOption, PickupPointType, ShippingRate } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useStrings } from "@/lib/locale";

// ─────────────────────────────────────────────────────────────────────────────
// GLS paketomat / ParcelShop picker (core DECISIONS 235).
//
// Searches the CMS's OWN synced copy of the carrier catalog
// (`GET /api/commerce/pickup-points`) — never the carrier directly — so it is
// cheap enough to query while the shopper types, and it keeps working when the
// carrier's feed is down.
//
// On pick we send ONLY the point's carrier id: the server resolves the name and
// address from its catalog and stores that, so nothing here can influence the
// address the parcel is shipped to.
//
// Opening hours arrive RAW (`[dayNumber, open, close]`, 1 = Monday) and are
// formatted here — the endpoint is shared-cached, so it must stay
// locale-independent. There is no map: `lat`/`lon` are already on the wire, so
// one can be dropped in later without touching the API.
// ─────────────────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 250;
const PAGE_SIZE = 25;

type TypeFilter = "all" | PickupPointType;

/** "00:00–24:00" reads as 0–24; a day the point never opens is closed. */
function dayHours(p: PickupPointOption, day: number, t: (k: string) => string): string {
  const row = p.hours.find(([d]) => d === day);
  if (!row) return t("shop.pickup.closed");
  const [, open, close] = row;
  if (open === "00:00" && close === "24:00") return t("shop.pickup.open24");
  return `${open}–${close}`;
}

/** Collapse the week into ranges of equal days: "Mon–Fri 08:00–20:00 · Sat 08:00–14:00". */
function hoursSummary(p: PickupPointOption, t: (k: string) => string): string {
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

  // A fresh open starts from a clean search.
  useEffect(() => {
    if (!opened) return;
    setQuery("");
    setType("all");
    setOffset(0);
    setAttempt((n) => n + 1);
  }, [opened]);

  // One debounced, abortable request per settled query — a fast typist fires one
  // fetch, not fifteen.
  useEffect(() => {
    if (!opened) return;
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
  }, [opened, method.methodId, country, query, type, offset, attempt]);

  // Editing the search or the type filter restarts paging.
  const onSearch = (v: string) => { setQuery(v); setOffset(0); };
  const onType = (v: string) => { setType(v as TypeFilter); setOffset(0); };

  const choose = async (p: PickupPointOption) => {
    setPicking(p.id);
    try {
      await onPick(p);
    } finally {
      setPicking(null);
    }
  };

  const typeData = useMemo(() => ([
    { value: "all", label: t("shop.pickup.typeAll") },
    { value: "parcel-locker", label: t("shop.pickup.typeLocker") },
    { value: "parcel-shop", label: t("shop.pickup.typeShop") },
  ]), [t]);

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
        <SegmentedControl fullWidth size="xs" data={typeData} value={type} onChange={onType} />

        {stale && (
          <Alert color="yellow" icon={<AlertTriangle size={16} />} variant="light">
            {t("shop.pickup.stale")}
          </Alert>
        )}
        {failed && (
          <Alert color="red" icon={<AlertTriangle size={16} />} variant="light">
            <Group justify="space-between" wrap="nowrap">
              <Text fz="sm">{t("shop.pickup.loadError")}</Text>
              <Button size="xs" variant="light" onClick={() => setAttempt((n) => n + 1)}>
                {t("shop.pickup.retry")}
              </Button>
            </Group>
          </Alert>
        )}

        {loading && points.length === 0 ? (
          <Group justify="center" py="lg"><Loader size="sm" /></Group>
        ) : points.length === 0 ? (
          <Text c="dimmed" fz="sm" py="md">{t("shop.pickup.noResults")}</Text>
        ) : (
          <Stack gap={4}>
            {points.map((p) => {
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
                      <Badge size="xs" variant="light">
                        {p.type === "parcel-locker" ? t("shop.pickup.typeLocker") : t("shop.pickup.typeShop")}
                      </Badge>
                      {picking === p.id && <Loader size="xs" />}
                    </Group>
                  </Group>
                </UnstyledButton>
              );
            })}
            {points.length < total && (
              <Button variant="subtle" size="xs" loading={loading} onClick={() => setOffset(points.length)}>
                {t("shop.pickup.loadMore")}
              </Button>
            )}
            <Text fz="xs" c="dimmed" ta="center">{t("shop.pickup.count").replace("{{shown}}", String(points.length)).replace("{{total}}", String(total))}</Text>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
