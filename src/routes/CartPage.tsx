import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ActionIcon, Anchor, Box, Button, Divider, Group, Image, Loader, Paper, Radio, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { Minus, Plus, Trash2, X } from "lucide-react";
import type { ShippingRate } from "@cms/storefront";
import { useCart } from "@/lib/cart";
import { useLocaleConfig } from "@/lib/locale";
import { formatCents } from "@/lib/money";

// Vatrate label, e.g. 2500 → "25%".
function ratePct(bps: number): string {
  return `${bps / 100}%`;
}

// A small sample of destinations spanning the three shipping zones (HR / EU / INT)
// so the rate-per-zone behaviour is clickable without a full address form (L5.4).
const COUNTRY_OPTIONS = [
  { value: "HR", label: "Croatia (HR)" },
  { value: "DE", label: "Germany (EU)" },
  { value: "IT", label: "Italy (EU)" },
  { value: "US", label: "United States (intl.)" },
];

export function CartPage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const { cart, loading, shippingOptions, setQuantity, remove, clear, applyCoupon, removeCoupon, loadShipping, setShipping } = useCart();
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  // Inline pickup-point entry: when a pickup-point method is chosen we reveal a
  // field (standing in for the carrier's locker picker) before applying it.
  const [pickupForMethod, setPickupForMethod] = useState<string | null>(null);
  const [pickupName, setPickupName] = useState("");

  const empty = !cart || cart.items.length === 0;

  // Load shipping options whenever the cart gains contents / its destination changes.
  useEffect(() => {
    if (!empty) void loadShipping(cart?.shipping.country);
  }, [empty, cart?.shipping.country, loadShipping]);

  if (loading && !cart) return <Loader />;

  const totals = cart?.totals;
  const shipping = cart?.shipping;
  // Tag VAT rows/note with the ship-to country when it isn't home (HR) — under OSS
  // the cart is taxed at the destination rate, so make that visible.
  const destLabel = cart && cart.taxDestination && cart.taxDestination !== "HR" ? ` (${cart.taxDestination})` : "";

  const onApply = async () => {
    if (!code.trim()) return;
    setApplying(true);
    const ok = await applyCoupon(code.trim());
    setApplying(false);
    if (ok) setCode("");
  };

  const onPickMethod = async (m: ShippingRate) => {
    if (m.requiresPickupPoint) {
      // Reveal the pickup-point field; apply only once a point is entered.
      setPickupForMethod(m.methodId);
      setPickupName("");
      return;
    }
    setPickupForMethod(null);
    await setShipping({ methodId: m.methodId });
  };

  const onConfirmPickup = async () => {
    if (!pickupForMethod || !pickupName.trim()) return;
    await setShipping({ methodId: pickupForMethod, pickupPoint: { name: pickupName.trim() } });
    setPickupForMethod(null);
  };

  return (
    <Stack gap="lg">
      <Title order={1}>Your cart</Title>

      {empty ? (
        <Stack>
          <Text c="dimmed">Your cart is empty.</Text>
          <Anchor component={Link} to={`/${loc}/shop`}>← Continue shopping</Anchor>
        </Stack>
      ) : (
        <Group align="flex-start" gap="xl" wrap="wrap">
          {/* Lines */}
          <Stack gap="sm" style={{ flex: "1 1 420px" }}>
            {cart!.items.map((line) => (
              <Paper key={line.variantId} withBorder p="sm" radius="md">
                <Group wrap="nowrap" align="flex-start" gap="sm">
                  <Box style={{ width: 64, height: 64, flexShrink: 0, background: "var(--mantine-color-gray-1)", borderRadius: 6, overflow: "hidden" }}>
                    {line.image && <Image src={line.image.cdnUrl} alt={line.name} h="100%" w="100%" fit="cover" />}
                  </Box>
                  <Stack gap={4} style={{ flex: 1 }}>
                    <Group justify="space-between" wrap="nowrap">
                      <Text fw={600}>{line.name || line.sku || line.variantId}</Text>
                      <ActionIcon variant="subtle" color="gray" onClick={() => remove(line.variantId)} aria-label="Remove">
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>
                    <Group gap="xs" align="baseline">
                      <Text fz="sm">{formatCents(line.unitPrice)}</Text>
                      {line.onSale && <Text fz="xs" c="dimmed" td="line-through">{formatCents(line.regularPrice)}</Text>}
                    </Group>
                    <Group justify="space-between">
                      <Group gap={4}>
                        <ActionIcon variant="default" onClick={() => setQuantity(line.variantId, line.quantity - 1)} aria-label="Decrease">
                          <Minus size={14} />
                        </ActionIcon>
                        <Text w={28} ta="center">{line.quantity}</Text>
                        <ActionIcon
                          variant="default"
                          onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                          disabled={line.maxQuantity !== null && line.quantity >= line.maxQuantity}
                          aria-label="Increase"
                        >
                          <Plus size={14} />
                        </ActionIcon>
                        {line.maxQuantity !== null && line.quantity >= line.maxQuantity && (
                          <Text c="dimmed" fz="xs" ml={6}>max {line.maxQuantity}</Text>
                        )}
                      </Group>
                      <Text fw={600}>{formatCents(line.lineTotal)}</Text>
                    </Group>
                  </Stack>
                </Group>
              </Paper>
            ))}
            <Group>
              <Button variant="subtle" color="gray" size="xs" onClick={() => clear()}>Clear cart</Button>
              <Anchor component={Link} to={`/${loc}/shop`} fz="sm">← Continue shopping</Anchor>
            </Group>
          </Stack>

          {/* Summary */}
          <Paper withBorder p="md" radius="md" style={{ flex: "1 1 280px", maxWidth: 380 }}>
            <Stack gap="xs">
              <Title order={4}>Summary</Title>

              {/* Coupon */}
              {cart!.coupon ? (
                <Group justify="space-between">
                  <Text fz="sm">Coupon <b>{cart!.coupon.code}</b></Text>
                  <Group gap={4}>
                    <Text fz="sm" c="teal">−{formatCents(cart!.coupon.amount)}</Text>
                    <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => removeCoupon()} aria-label="Remove coupon">
                      <X size={14} />
                    </ActionIcon>
                  </Group>
                </Group>
              ) : (
                <Group gap="xs" align="flex-end">
                  <TextInput label="Coupon code" value={code} onChange={(e) => setCode(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && onApply()} style={{ flex: 1 }} />
                  <Button onClick={onApply} loading={applying} variant="light">Apply</Button>
                </Group>
              )}

              <Divider my="xs" />

              {/* Shipping */}
              <Title order={5}>Shipping</Title>
              <Select
                label="Ship to"
                data={COUNTRY_OPTIONS}
                value={shipping?.country ?? "HR"}
                onChange={(v) => v && setShipping({ country: v })}
                allowDeselect={false}
                comboboxProps={{ withinPortal: true }}
              />
              {shippingOptions && shippingOptions.methods.length > 0 ? (
                // The group's value reflects the committed selection OR a pending
                // pickup-point pick (so the radio highlights immediately, before the
                // point is entered). Selection is driven by the group's onChange —
                // never per-Radio (that fights Radio.Group's own control).
                <Radio.Group
                  value={pickupForMethod ?? shipping?.method?.id ?? ""}
                  onChange={(methodId) => {
                    const m = shippingOptions.methods.find((x) => x.methodId === methodId);
                    if (m) onPickMethod(m);
                  }}
                >
                  <Stack gap={6} mt={4}>
                    {shippingOptions.methods.map((m) => (
                      <Box key={m.methodId}>
                        <Group justify="space-between" wrap="nowrap">
                          <Radio value={m.methodId} label={m.name + (m.requiresPickupPoint ? " (pickup point)" : "")} />
                          <Text fz="sm" c={m.free ? "teal" : undefined}>{m.free ? "Free" : formatCents(m.amount)}</Text>
                        </Group>
                        {pickupForMethod === m.methodId && (
                          <Group gap="xs" align="flex-end" mt={4} pl={28}>
                            <TextInput label="Pickup point" placeholder="e.g. BoxNow Zagreb Centar" value={pickupName} onChange={(e) => setPickupName(e.currentTarget.value)} style={{ flex: 1 }} />
                            <Button size="xs" onClick={onConfirmPickup} disabled={!pickupName.trim()}>Use</Button>
                          </Group>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Radio.Group>
              ) : (
                <Text c="dimmed" fz="xs">No shipping methods available for this destination.</Text>
              )}
              {shipping?.method?.requiresPickupPoint && shipping.pickupPoint && (
                <Text c="dimmed" fz="xs">Pickup: {(shipping.pickupPoint as { name?: string }).name}</Text>
              )}

              {/* Payment method (incl. Cash on Delivery + its surcharge) is chosen
                  in checkout, not here — see L4.5/L7.4. The COD surcharge engine
                  already feeds the totals; this cart stage only picks shipping. */}

              <Divider my="xs" />

              {totals && (
                <>
                  <Row label="Subtotal" value={formatCents(totals.itemsSubtotal)} />
                  {totals.discountTotal > 0 && <Row label="Discount" value={`−${formatCents(totals.discountTotal)}`} accent />}
                  {shipping?.method && (
                    <Row label={`Shipping (${shipping.method.name})`} value={shipping.freeByCoupon || shipping.free ? "Free" : formatCents(totals.shipping?.gross ?? 0)} />
                  )}
                  {totals.surcharge && <Row label="Cash on delivery" value={formatCents(totals.surcharge.gross)} />}
                  {/* VAT breakdown. When the shop isn't VAT-registered (or nothing is
                      taxed) there's no VAT at all — say so plainly instead of a
                      misleading "VAT 0% / VAT included". Otherwise show one row per
                      real rate group, tagged with the destination when it's not home. */}
                  {totals.taxTotal > 0 && <Row label="Net" value={formatCents(totals.netTotal)} dim />}
                  {totals.taxSummary
                    .filter((t) => t.vat > 0)
                    .map((t) => (
                      <Row key={t.rateBps} label={`VAT ${ratePct(t.rateBps)}${destLabel}`} value={formatCents(t.vat)} dim />
                    ))}
                  <Divider my="xs" />
                  <Group justify="space-between">
                    <Text fw={700}>Total</Text>
                    <Text fw={700} fz="lg">{formatCents(totals.grossTotal)}</Text>
                  </Group>
                  {cart?.vatRegistered === false ? (
                    <Text c="dimmed" fz="xs">Prices are VAT-exempt — the shop is not in the VAT system.</Text>
                  ) : totals.taxTotal > 0 ? (
                    <Text c="dimmed" fz="xs">VAT included{destLabel}.</Text>
                  ) : (
                    <Text c="dimmed" fz="xs">No VAT applies to these items.</Text>
                  )}
                  <Button component={Link} to={`/${loc}/checkout`} mt="xs" size="md" fullWidth>
                    Proceed to checkout
                  </Button>
                </>
              )}
            </Stack>
          </Paper>
        </Group>
      )}
    </Stack>
  );
}

function Row({ label, value, dim, accent }: { label: string; value: string; dim?: boolean; accent?: boolean }) {
  return (
    <Group justify="space-between">
      <Text fz="sm" c={dim ? "dimmed" : undefined}>{label}</Text>
      <Text fz="sm" c={accent ? "teal" : dim ? "dimmed" : undefined}>{value}</Text>
    </Group>
  );
}
