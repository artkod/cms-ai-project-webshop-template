import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ActionIcon, Alert, Anchor, Badge, Box, Button, Divider, Group, Image, Loader, Paper, Radio, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { Info, Minus, Plus, Trash2, X } from "lucide-react";
import type { ShippingRate } from "@cms/storefront";
import { useCart } from "@/lib/cart";
import { useLocaleConfig, useStrings } from "@/lib/locale";
import { formatCents } from "@/lib/money";
import { countryOptions, isExport } from "@/lib/countries";

// Vatrate label, e.g. 2500 → "25%".
function ratePct(bps: number): string {
  return `${bps / 100}%`;
}

export function CartPage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const { t } = useStrings();
  const loc = locale ?? defaultLocale;
  const { cart, loading, shippingOptions, setQuantity, remove, clear, applyCoupon, removeCoupon, loadShipping, setShipping } = useCart();
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  // Inline pickup-point entry: when a pickup-point method is chosen we reveal a
  // field (standing in for the carrier's locker picker) before applying it.
  const [pickupForMethod, setPickupForMethod] = useState<string | null>(null);
  const [pickupName, setPickupName] = useState("");

  const empty = !cart || cart.items.length === 0;
  // Inquiry routing (design §9 / L7.4): any inquiry-only line makes the WHOLE cart a
  // quote request — no payment, no delivery, no cost calculation. `mixed` = it also
  // has buyable items (which must be removed to check out + pay for them).
  const isInquiry = !!cart && cart.items.some((l) => !l.purchasable);
  const hasPurchasable = !!cart && cart.items.some((l) => l.purchasable);
  const mixed = isInquiry && hasPurchasable;
  // A cart needs delivery only when it has ≥1 physical line (server `requiresShipping`).
  // A digital/service-only cart is never shipped, so no delivery picker is shown.
  const needsShipping = !!cart && !isInquiry && cart.requiresShipping;

  // Load shipping options whenever a SHIPPABLE cart gains contents / changes
  // destination — skipped for an inquiry or a non-shippable (digital/service) cart.
  useEffect(() => {
    if (!empty && needsShipping) void loadShipping(cart?.shipping.country);
  }, [empty, needsShipping, cart?.shipping.country, loadShipping]);

  // A delivery method is mandatory for a shippable cart — auto-select the first
  // non-pickup method when none is chosen yet (mirrors the checkout page), so the cart
  // total always includes delivery and a shopper can't proceed paying for shipping by
  // simply not picking one. Pickup/locker methods need a point, so they aren't auto-set.
  useEffect(() => {
    if (empty || !needsShipping) return;
    if (cart?.shipping.method) return;
    const first = shippingOptions?.methods.find((m) => !m.requiresPickupPoint);
    if (first) void setShipping({ methodId: first.methodId });
  }, [empty, needsShipping, cart?.shipping.method, shippingOptions, setShipping]);

  // Full EU + common intl. ship-to list, localized (HR home / EU / export zones).
  // Declared before the early return below so hook order stays stable.
  const countryData = useMemo(() => countryOptions(loc, t), [loc, t]);

  if (loading && !cart) return <Loader />;

  const totals = cart?.totals;
  const shipping = cart?.shipping;
  // Tag VAT rows/note with the ship-to country when it isn't home (HR) — under OSS
  // the cart is taxed at the destination rate, so make that visible.
  const destLabel = cart && cart.taxDestination && cart.taxDestination !== "HR" ? ` (${cart.taxDestination})` : "";
  // A non-EU destination is an export → the server zero-rates VAT; say so explicitly
  // instead of the generic "no VAT" note.
  const isExportDest = isExport(cart?.taxDestination ?? shipping?.country);

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
      <Title order={1}>{t("shop.cart.title")}</Title>

      {empty ? (
        <Stack>
          <Text c="dimmed">{t("shop.cart.empty")}</Text>
          <Anchor component={Link} to={`/${loc}/shop`}>{t("shop.cart.continueShopping")}</Anchor>
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
                      <ActionIcon variant="subtle" color="gray" onClick={() => remove(line.variantId)} aria-label={t("shop.cart.remove")}>
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>
                    <Group gap="xs" align="baseline">
                      {line.purchasable ? (
                        <>
                          <Text fz="sm">{formatCents(line.unitPrice)}</Text>
                          {line.onSale && <Text fz="xs" c="dimmed" td="line-through">{formatCents(line.regularPrice)}</Text>}
                        </>
                      ) : (
                        <Badge color="blue" variant="light" size="sm">{t("shop.cart.inquiryPriceOnRequest")}</Badge>
                      )}
                    </Group>
                    <Group justify="space-between">
                      <Group gap={4}>
                        <ActionIcon variant="default" onClick={() => setQuantity(line.variantId, line.quantity - 1)} aria-label={t("shop.cart.decrease")}>
                          <Minus size={14} />
                        </ActionIcon>
                        <Text w={28} ta="center">{line.quantity}</Text>
                        <ActionIcon
                          variant="default"
                          onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                          disabled={line.maxQuantity !== null && line.quantity >= line.maxQuantity}
                          aria-label={t("shop.cart.increase")}
                        >
                          <Plus size={14} />
                        </ActionIcon>
                        {line.maxQuantity !== null && line.quantity >= line.maxQuantity && (
                          <Text c="dimmed" fz="xs" ml={6}>{t("shop.cart.max")} {line.maxQuantity}</Text>
                        )}
                      </Group>
                      {line.purchasable ? (
                        <Text fw={600}>{formatCents(line.lineTotal)}</Text>
                      ) : (
                        <Text fw={600} fz="sm" c="dimmed">{t("shop.cart.onRequest")}</Text>
                      )}
                    </Group>
                  </Stack>
                </Group>
              </Paper>
            ))}
            <Group>
              <Button variant="subtle" color="gray" size="xs" onClick={() => clear()}>{t("shop.cart.clear")}</Button>
              <Anchor component={Link} to={`/${loc}/shop`} fz="sm">{t("shop.cart.continueShopping")}</Anchor>
            </Group>
          </Stack>

          {/* Summary */}
          <Paper withBorder p="md" radius="md" style={{ flex: "1 1 280px", maxWidth: 380 }}>
            <Stack gap="xs">
              {/* No "business pricing" badge (Sandro, 2026-08-27): an approved business
                  simply sees ITS prices — `cart.b2b` is true even without a price list,
                  so the badge promised a discount that often wasn't there. */}
              <Title order={2} size="h4">{t("shop.cart.summary")}</Title>

              {isInquiry ? (
                <>
                  <Alert color="blue" icon={<Info size={16} />}>
                    {mixed
                      ? t("shop.cart.mixedInquiryNote")
                      : t("shop.cart.inquiryNote")}
                  </Alert>
                  <Button component={Link} to={`/${loc}/checkout`} mt="xs" size="md" fullWidth>
                    {t("shop.cart.sendInquiry")}
                  </Button>
                </>
              ) : (
                <>
              {/* Coupons (multi-coupon stacking) — each applied coupon with its own
                  remove ×; the add box stays open so a second combinable code can be
                  entered. A non-stackable coupon sits alone and the server rejects a
                  second one with a friendly "can't be combined" message. */}
              {cart!.coupons.map((c) => (
                <Group key={c.discountId} justify="space-between">
                  <Text fz="sm">{t("shop.cart.coupon")} <b>{c.code}</b></Text>
                  <Group gap={4}>
                    <Text fz="sm" c="teal">{c.freeShipping ? t("shop.cart.freeShipping") : `−${formatCents(c.amount)}`}</Text>
                    <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => removeCoupon(c.discountId)} aria-label={t("shop.cart.removeCoupon")}>
                      <X size={14} />
                    </ActionIcon>
                  </Group>
                </Group>
              ))}
              {/* When more than one coupon is applied, each discount is calculated on
                  the original subtotal (additive), not one after another. */}
              {cart!.coupons.length > 1 && (
                <Text fz="xs" c="dimmed">{t("shop.cart.couponsAdditive")}</Text>
              )}
              {/* A lone NON-stackable coupon can't combine with anything — instead of
                  silently hiding the add box (which reads as broken), explain why. For
                  a stackable coupon (or an empty cart) the add box stays open so a
                  second combinable code can be entered. */}
              {cart!.coupons.length === 1 && !cart!.coupons[0].stackable ? (
                <Text fz="xs" c="dimmed">{t("shop.cart.couponSolo")}</Text>
              ) : (
                <Group gap="xs" align="flex-end">
                  <TextInput
                    label={cart!.coupons.length ? t("shop.cart.addAnotherCoupon") : t("shop.cart.couponCode")}
                    value={code}
                    onChange={(e) => setCode(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === "Enter" && onApply()}
                    style={{ flex: 1 }}
                  />
                  <Button onClick={onApply} loading={applying} variant="light">{t("shop.cart.apply")}</Button>
                </Group>
              )}

              {/* Shipping — only for a cart with a physical line. A digital/service-only
                  cart is never delivered, so no destination or method picker shows. */}
              {needsShipping && (<>
              <Divider my="xs" />

              <Title order={3} size="h5">{t("shop.cart.shipping")}</Title>
              <Select
                label={t("shop.cart.shipTo")}
                data={countryData}
                searchable
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
                          <Radio value={m.methodId} label={m.name + (m.requiresPickupPoint ? t("shop.cart.pickupSuffix") : "")} />
                          <Text fz="sm" c={m.free ? "teal" : undefined}>{m.free ? t("shop.cart.free") : formatCents(m.amount)}</Text>
                        </Group>
                        {pickupForMethod === m.methodId && (
                          <Group gap="xs" align="flex-end" mt={4} pl={28}>
                            <TextInput label={t("shop.cart.pickupPoint")} placeholder="BoxNow Zagreb Centar" value={pickupName} onChange={(e) => setPickupName(e.currentTarget.value)} style={{ flex: 1 }} />
                            <Button size="xs" onClick={onConfirmPickup} disabled={!pickupName.trim()}>{t("shop.cart.use")}</Button>
                          </Group>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Radio.Group>
              ) : (
                <Text c="dimmed" fz="xs">{t("shop.cart.noShippingMethods")}</Text>
              )}
              {shipping?.method?.requiresPickupPoint && shipping.pickupPoint && (
                <Text c="dimmed" fz="xs">{t("shop.cart.pickup")}: {(shipping.pickupPoint as { name?: string }).name}</Text>
              )}
              </>)}

              {/* Payment method (incl. Cash on Delivery + its surcharge) is chosen
                  in checkout, not here — see L4.5/L7.4. The COD surcharge engine
                  already feeds the totals; this cart stage only picks shipping. */}

              <Divider my="xs" />

              {totals && (
                <>
                  <Row label={t("shop.cart.subtotal")} value={formatCents(totals.itemsSubtotal)} />
                  {totals.discountTotal > 0 && <Row label={t("shop.cart.discount")} value={`−${formatCents(totals.discountTotal)}`} accent />}
                  {shipping?.method && (
                    <Row label={`${t("shop.cart.shipping")} (${shipping.method.name})`} value={shipping.freeByCoupon || shipping.free ? t("shop.cart.free") : formatCents(totals.shipping?.gross ?? 0)} />
                  )}
                  {totals.surcharge && <Row label={t("shop.cart.cashOnDelivery")} value={formatCents(totals.surcharge.gross)} />}
                  {/* VAT breakdown. When the shop isn't VAT-registered (or nothing is
                      taxed) there's no VAT at all — say so plainly instead of a
                      misleading "VAT 0% / VAT included". Otherwise show one row per
                      real rate group, tagged with the destination when it's not home. */}
                  {totals.taxTotal > 0 && <Row label={t("shop.cart.net")} value={formatCents(totals.netTotal)} dim />}
                  {totals.taxSummary
                    .filter((t) => t.vat > 0)
                    .map((row) => (
                      <Row key={row.rateBps} label={`${t("shop.cart.vat")} ${ratePct(row.rateBps)}${destLabel} · ${t("shop.cart.taxBase")} ${formatCents(row.net)}`} value={formatCents(row.vat)} dim />
                    ))}
                  <Divider my="xs" />
                  <Group justify="space-between">
                    <Text fw={700}>{t("shop.cart.total")}</Text>
                    <Text fw={700} fz="lg">{formatCents(totals.grossTotal)}</Text>
                  </Group>
                  {cart?.vatRegistered === false ? (
                    <Text c="dimmed" fz="xs">{t("shop.cart.vatExempt")}</Text>
                  ) : totals.taxTotal > 0 ? (
                    <Text c="dimmed" fz="xs">{t("shop.cart.vatIncluded")}{destLabel}.</Text>
                  ) : isExportDest ? (
                    <Text c="dimmed" fz="xs">{t("shop.cart.vatExport")}{destLabel}.</Text>
                  ) : cart?.b2b ? (
                    <Text c="dimmed" fz="xs">{t("shop.cart.vatReverse")}{destLabel}.</Text>
                  ) : (
                    <Text c="dimmed" fz="xs">{t("shop.cart.noVat")}</Text>
                  )}
                  <Button component={Link} to={`/${loc}/checkout`} mt="xs" size="md" fullWidth>
                    {t("shop.cart.checkout")}
                  </Button>
                </>
              )}
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
