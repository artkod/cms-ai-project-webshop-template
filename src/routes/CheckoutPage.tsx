import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Alert, Anchor, Box, Button, Checkbox, Divider, Group, Loader, Paper, Radio, Select, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Info } from "lucide-react";
import { StorefrontError, trackBeginCheckout, trackPurchase, type CheckoutMode, type CheckoutPreview, type OrderAddress, type StorefrontAddress } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useCart } from "@/lib/cart";
import { useCustomer } from "@/lib/customer";
import { useLocaleConfig, useStrings } from "@/lib/locale";
import { formatCents } from "@/lib/money";
import { countryOptions } from "@/lib/countries";

// ─────────────────────────────────────────────────────────────────────────────
// Checkout (Phase L4.5).
//
// Enter an address → see DESTINATION tax (the totals re-tax at the ship-to country
// when the shop collects under OSS; a non-EU destination is a zero-rated export;
// otherwise the home rate still applies) → place the order → land on the pending-
// order page. A cart with any inquiry-only item is a QUOTE request (no payment);
// the button + result copy reflect that.
// ─────────────────────────────────────────────────────────────────────────────

function ratePct(bps: number): string {
  return `${bps / 100}%`;
}

function checkoutErrorMessage(err: StorefrontError, t: (key: string) => string): string {
  const known = ["cart_empty", "insufficient_stock", "coupon_exhausted", "payment_method_unavailable"];
  return known.includes(err.code ?? "") ? t(`shop.checkout.err.${err.code}`) : t("shop.checkout.err.default");
}

export function CheckoutPage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const navigate = useNavigate();
  const { t } = useStrings();
  const { cart, setShipping, refresh, shippingOptions, loadShipping } = useCart();
  const { customer } = useCustomer();
  // Full EU + common intl. ship-to list, localized (HR home / EU / export zones).
  const countryData = useMemo(() => countryOptions(loc, t), [loc, t]);

  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  // The chosen payment mode (L7.4) — initialised from the preview's default, kept in
  // the offered set as the cart/shipping changes.
  const [paymentMethod, setPaymentMethod] = useState<CheckoutMode | null>(null);
  // GDPR marketing opt-in (L9.6). Only an AFFIRMATIVE tick is sent (a consent
  // record); leaving the box unticked sends nothing — an ignored checkbox is not
  // an explicit refusal.
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  // Show field-level errors only after a failed submit attempt — not while typing.
  const [showErrors, setShowErrors] = useState(false);

  // Saved addresses (L5.4) — only for a logged-in + verified customer. The default
  // shipping address prefills the form; the picker lets them choose another.
  const [saved, setSaved] = useState<StorefrontAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const prefilledRef = useRef(false);

  // Address form. `country` drives the destination tax + shipping zone — changing
  // it updates the cart so the preview re-taxes at the destination.
  const [form, setForm] = useState<OrderAddress & { email: string; note: string }>({
    name: "", line1: "", line2: "", city: "", postalCode: "",
    country: cart?.shipping.country ?? "HR", phone: "", email: "", note: "",
  });
  // Billing address (R2-G). For a SHIPPABLE cart the primary block above is the
  // shipping address and billing defaults to "same as shipping"; unticking reveals a
  // separate billing block. For a NON-SHIPPABLE (digital/service-only) cart the
  // primary block IS the billing address (no shipping is collected).
  const [billingSame, setBillingSame] = useState(true);
  const [billing, setBilling] = useState<OrderAddress>({
    name: "", line1: "", line2: "", city: "", postalCode: "", country: "HR", phone: "",
  });
  const setB = (k: keyof OrderAddress) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    setBilling((b) => ({ ...b, [k]: value }));
  };

  const reloadPreview = useCallback(async () => {
    try {
      setPreview(await storefront.previewCheckout({ locale: loc }));
    } catch {
      /* keep the last preview on a hiccup */
    } finally {
      setLoading(false);
    }
  }, [loc]);

  // Re-preview whenever the cart changes (contents / destination / coupon / method).
  useEffect(() => {
    void reloadPreview();
  }, [reloadPreview, cart?.id, cart?.itemCount, cart?.shipping.country, cart?.shipping.method?.id, cart?.coupons.map((c) => c.discountId).join(",")]);

  // Load the delivery options for the cart's destination (the full picker lives on
  // the cart page; checkout needs them to auto-select + require a method).
  useEffect(() => {
    if (cart && cart.itemCount > 0) void loadShipping(cart.shipping.country);
  }, [cart?.itemCount, cart?.shipping.country, loadShipping]); // eslint-disable-line react-hooks/exhaustive-deps

  // A delivery method is REQUIRED to check out. If none is chosen yet, auto-select the
  // first non-pickup-point method (pickup/locker methods need a point picked on the
  // cart page, so they're never auto-selected). The ref guards against a double-fire
  // while the async setShipping settles.
  const autoPickedRef = useRef(false);
  useEffect(() => {
    if (!preview || preview.isQuote || preview.cart.items.length === 0) return;
    // Digital/service-only cart (L9.5) — no shipping at all; nothing to auto-select.
    if (!preview.cart.requiresShipping) return;
    if (preview.cart.shipping.method) {
      autoPickedRef.current = false;
      return;
    }
    if (autoPickedRef.current) return;
    const first = shippingOptions?.methods.find((m) => !m.requiresPickupPoint);
    if (first) {
      autoPickedRef.current = true;
      void setShipping({ methodId: first.methodId });
    }
  }, [preview, shippingOptions, setShipping]);

  // Keep the chosen payment method valid: when the offered set changes, fall back to
  // the preview's default if the current pick is no longer offered.
  useEffect(() => {
    if (!preview || preview.isQuote) return;
    setPaymentMethod((cur) => (cur && preview.paymentMethods.includes(cur) ? cur : preview.defaultPaymentMethod));
  }, [preview]);

  // Picking a method: COD drives the cart's COD surcharge, so toggle the cart flag
  // then re-preview to reflect the surcharge in the totals.
  const onPaymentMethod = async (m: CheckoutMode) => {
    setPaymentMethod(m);
    const cod = m === "cod";
    if (cod !== (cart?.shipping.codSelected ?? false)) {
      await setShipping({ codSelected: cod });
      await reloadPreview();
    }
  };

  // Keep the form country in sync with the cart's stored ship-to.
  useEffect(() => {
    if (cart?.shipping.country) setForm((f) => (f.country === cart.shipping.country ? f : { ...f, country: cart.shipping.country }));
  }, [cart?.shipping.country]);

  // Load saved addresses for a verified customer; prefill the default shipping
  // address once (the `prefilledRef` guard avoids clobbering edits / StrictMode
  // double-invoke). Prefill the email from the account too.
  useEffect(() => {
    if (!customer?.emailVerified) return;
    let alive = true;
    (async () => {
      try {
        const rows = await storefront.listAddresses();
        if (!alive) return;
        setSaved(rows);
        if (!prefilledRef.current && rows.length > 0) {
          prefilledRef.current = true;
          const def = rows.find((r) => r.isDefaultShipping) ?? rows[0];
          setSelectedAddressId(def.id);
          fillFromAddress(def);
          if (def.country !== (cart?.shipping.country ?? "HR")) await setShipping({ country: def.country });
        }
      } catch {
        /* not verified / network — leave the form blank */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.emailVerified, customer?.id]);

  // Prefill the contact email from the logged-in account.
  useEffect(() => {
    if (customer?.email) setForm((f) => (f.email ? f : { ...f, email: customer.email }));
  }, [customer?.email]);

  function fillFromAddress(a: StorefrontAddress) {
    setForm((f) => ({
      ...f,
      name: a.name,
      line1: a.line1,
      line2: a.line2 ?? "",
      city: a.city,
      postalCode: a.postalCode,
      country: a.country,
      phone: a.phone ?? "",
    }));
  }

  const onSelectSaved = async (id: string | null) => {
    setSelectedAddressId(id);
    if (!id) return; // "Enter a new address"
    const a = saved.find((r) => r.id === id);
    if (!a) return;
    fillFromAddress(a);
    if (a.country !== form.country) await setShipping({ country: a.country });
  };

  const onCountry = async (country: string) => {
    setForm((f) => ({ ...f, country }));
    await setShipping({ country }); // re-zones shipping + re-taxes the preview
  };

  // Capture the value BEFORE setForm — React nulls out `e.currentTarget` after the
  // event dispatch, and the functional updater can run later (and twice in
  // StrictMode), so reading it inside the updater throws "reading 'value' of null".
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.currentTarget.value;
    setForm((f) => ({ ...f, [k]: value }));
  };

  // GA4 begin_checkout (L9.6) — once per checkout visit with a payable cart;
  // consent-gated inside the SDK (drops silently pre-consent).
  const beganRef = useRef(false);
  useEffect(() => {
    if (beganRef.current || !preview || preview.isQuote || preview.cart.items.length === 0) return;
    beganRef.current = true;
    trackBeginCheckout(
      preview.cart.items.map((l) => ({ id: l.variantId, name: l.name || l.sku || l.variantId, priceCents: l.unitPrice, quantity: l.quantity })),
      preview.cart.totals.grossTotal,
    );
  }, [preview]);

  const totals = preview?.cart.totals;
  const isQuote = preview?.isQuote ?? false;
  const empty = !preview || preview.cart.items.length === 0;
  // A mixed inquiry cart also has buyable items (which must be removed to pay for them).
  const mixed = isQuote && !!preview && preview.cart.items.some((l) => l.purchasable);
  const offeredMethods = preview?.paymentMethods ?? [];
  // A payable cart with no offered method (e.g. a COD-only product without a COD-eligible
  // shipping method) can't be placed until the shopper changes shipping.
  const noPayableMethod = !!preview && !isQuote && !empty && offeredMethods.length === 0;
  const addressValid = !!form.name.trim() && !!form.line1.trim() && !!form.city.trim() && !!form.postalCode.trim() && /.+@.+\..+/.test(form.email);
  const paymentValid = isQuote || (!!paymentMethod && offeredMethods.includes(paymentMethod));
  // A delivery method is mandatory for a payable order (auto-selected above when one
  // exists; this still blocks a zone where only a pickup-point method is offered until
  // the shopper picks it + a point on the cart page).
  // Digital/service-only cart (L9.5) needs no shipping method.
  const cartRequiresShipping = preview?.cart.requiresShipping ?? true;
  const hasShipping = !cartRequiresShipping || !!preview?.cart.shipping.method;
  const needsShipping = !isQuote && !empty && cartRequiresShipping && !preview?.cart.shipping.method;
  // A separate billing block is shown only for a shippable cart with "same as
  // shipping" unticked; validate it too when present.
  const billingBlockShown = cartRequiresShipping && !billingSame;
  const billingValid = !billingBlockShown
    || (!!billing.name.trim() && !!billing.line1.trim() && !!billing.city.trim() && !!billing.postalCode.trim());
  // The button stays CLICKABLE with an invalid address — clicking surfaces the
  // per-field errors (a disabled button announces nothing to AT). It's disabled
  // only for states the form can't fix here (empty cart / no shipping / no method).
  const canAttempt = !empty && (isQuote || (hasShipping && paymentValid));

  const place = async () => {
    if (!addressValid || !billingValid) {
      // Surface the per-field errors (aria-invalid + inline messages) instead of
      // relying on the disabled button alone.
      setShowErrors(true);
      return;
    }
    setPlacing(true);
    try {
      const { email, note, ...address } = form;
      // A non-shippable cart collects only a billing address; a shippable cart sends
      // the shipping address + (optionally) a distinct billing address.
      const addresses: { shippingAddress?: OrderAddress; billingAddress?: OrderAddress } = cartRequiresShipping
        ? { shippingAddress: address as OrderAddress, ...(billingSame ? {} : { billingAddress: billing }) }
        : { billingAddress: address as OrderAddress };
      const order = await storefront.startCheckout(
        {
          email,
          ...addresses,
          note: note.trim() || undefined,
          ...(paymentMethod && !isQuote ? { paymentMethod } : {}),
          // Only an affirmative tick writes a consent record (L9.6).
          ...(marketingOptIn ? { marketingConsent: true } : {}),
        },
        { locale: loc },
      );
      // GA4 purchase (L9.6) — the order id is the GA-side dedup key too.
      if (!order.isQuote) {
        trackPurchase(
          String(order.orderNumber ?? order.id),
          order.items.map((i) => ({ id: i.variantId ?? i.id, name: i.name, priceCents: i.unitPrice, quantity: i.quantity })),
          order.totals.grossTotal,
        );
      }
      await refresh(); // the cart was cleared server-side
      navigate(`/${loc}/order/${order.token}`);
    } catch (e) {
      notifications.show({ color: "red", message: checkoutErrorMessage(e as StorefrontError, t) });
    } finally {
      setPlacing(false);
    }
  };

  if (loading && !preview) return <Loader />;

  if (empty) {
    return (
      <Stack>
        <Title order={1}>{t("shop.checkout.title")}</Title>
        <Text c="dimmed">{t("shop.checkout.empty")}</Text>
        <Anchor component={Link} to={`/${loc}/shop`}>{t("shop.checkout.continueShopping")}</Anchor>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Title order={1}>{isQuote ? t("shop.checkout.sendInquiry") : t("shop.checkout.title")}</Title>

      {isQuote && (
        <Alert color="blue" icon={<Info size={16} />}>
          {mixed ? (
            <>{t("shop.checkout.mixedQuotePrefix")} <b>{t("shop.checkout.quoteRequest")}</b> {t("shop.checkout.mixedQuoteSuffix")}</>
          ) : (
            <>{t("shop.checkout.inquiryPrefix")} <b>{t("shop.checkout.quoteRequest")}</b>{t("shop.checkout.inquirySuffix")}</>
          )}
        </Alert>
      )}

      <Group align="flex-start" gap="xl" wrap="wrap">
        {/* Address form */}
        <Stack gap="sm" style={{ flex: "1 1 420px" }}>
          {saved.length > 0 && (
            <Select
              label={t("shop.checkout.useSavedAddress")}
              data={[
                ...saved.map((a) => ({ value: a.id, label: `${a.label || a.name} — ${a.line1}, ${a.city}` })),
                { value: "", label: t("shop.checkout.enterNewAddress") },
              ]}
              value={selectedAddressId ?? ""}
              onChange={(v) => onSelectSaved(v || null)}
              comboboxProps={{ withinPortal: true }}
            />
          )}

          <Title order={2} size="h4">{t("shop.checkout.contact")}</Title>
          {/* `error` renders inline text + aria-invalid + aria-describedby (Mantine),
              shown only after a failed submit attempt (L9.6 a11y). */}
          <TextInput
            label={t("shop.checkout.email")}
            type="email"
            required
            value={form.email}
            onChange={set("email")}
            placeholder={t("shop.checkout.emailPlaceholder")}
            error={showErrors && !/.+@.+\..+/.test(form.email) ? t("shop.checkout.enterValidEmail") : undefined}
          />

          <Title order={2} size="h4" mt="sm">{cartRequiresShipping ? t("shop.checkout.shippingAddress") : t("shop.checkout.billingAddress")}</Title>
          <TextInput label={t("shop.checkout.fullName")} required value={form.name} onChange={set("name")} error={showErrors && !form.name.trim() ? t("shop.checkout.fullNameRequired") : undefined} />
          <TextInput label={t("shop.checkout.address")} required value={form.line1} onChange={set("line1")} error={showErrors && !form.line1.trim() ? t("shop.checkout.addressRequired") : undefined} />
          <TextInput label={t("shop.checkout.addressLine2")} value={form.line2} onChange={set("line2")} />
          <Group grow>
            <TextInput label={t("shop.checkout.city")} required value={form.city} onChange={set("city")} error={showErrors && !form.city.trim() ? t("shop.checkout.cityRequired") : undefined} />
            <TextInput label={t("shop.checkout.postalCode")} required value={form.postalCode} onChange={set("postalCode")} error={showErrors && !form.postalCode.trim() ? t("shop.checkout.postalRequired") : undefined} />
          </Group>
          <Select
            label={t("shop.checkout.country")}
            data={countryData} searchable
            value={form.country}
            onChange={(v) => v && onCountry(v)}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
          <TextInput label={t("shop.checkout.phone")} value={form.phone} onChange={set("phone")} />

          {/* Billing address (R2-G) — only meaningful when a shipping address is
              collected; a non-shippable cart's single block is already the billing one. */}
          {cartRequiresShipping && (
            <>
              <Checkbox
                mt="xs"
                label={t("shop.checkout.billingSame")}
                checked={billingSame}
                onChange={(e) => {
                  const same = e.currentTarget.checked;
                  setBillingSame(same);
                  // Prefill from a saved default-billing address the first time it's split.
                  if (!same && !billing.line1.trim()) {
                    const def = saved.find((r) => r.isDefaultBilling);
                    if (def) setBilling({ name: def.name, line1: def.line1, line2: def.line2 ?? "", city: def.city, postalCode: def.postalCode, country: def.country, phone: def.phone ?? "" });
                  }
                }}
              />
              {!billingSame && (
                <Stack gap="sm">
                  <Title order={2} size="h4" mt="xs">{t("shop.checkout.billingAddress")}</Title>
                  <TextInput label={t("shop.checkout.fullName")} required value={billing.name} onChange={setB("name")} error={showErrors && !billing.name.trim() ? t("shop.checkout.fullNameRequired") : undefined} />
                  <TextInput label={t("shop.checkout.address")} required value={billing.line1} onChange={setB("line1")} error={showErrors && !billing.line1.trim() ? t("shop.checkout.addressRequired") : undefined} />
                  <TextInput label={t("shop.checkout.addressLine2")} value={billing.line2} onChange={setB("line2")} />
                  <Group grow>
                    <TextInput label={t("shop.checkout.city")} required value={billing.city} onChange={setB("city")} error={showErrors && !billing.city.trim() ? t("shop.checkout.cityRequired") : undefined} />
                    <TextInput label={t("shop.checkout.postalCode")} required value={billing.postalCode} onChange={setB("postalCode")} error={showErrors && !billing.postalCode.trim() ? t("shop.checkout.postalRequired") : undefined} />
                  </Group>
                  <Select label={t("shop.checkout.country")} data={countryData} searchable value={billing.country} onChange={(v) => v && setBilling((b) => ({ ...b, country: v }))} allowDeselect={false} comboboxProps={{ withinPortal: true }} />
                  <TextInput label={t("shop.checkout.phone")} value={billing.phone} onChange={setB("phone")} />
                </Stack>
              )}
            </>
          )}

          <Textarea label={t("shop.checkout.orderNote")} value={form.note} onChange={set("note")} autosize minRows={2} />
          {/* GDPR marketing opt-in (L9.6): unticked by default; only an affirmative
              tick is recorded (a consent record keyed by the checkout email). */}
          <Checkbox
            label={t("shop.checkout.marketingOptIn")}
            description={t("shop.checkout.marketingHint")}
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.currentTarget.checked)}
          />
          <Anchor component={Link} to={`/${loc}/cart`} fz="sm">{t("shop.checkout.backToCart")}</Anchor>
        </Stack>

        {/* Summary */}
        <Paper withBorder p="md" radius="md" style={{ flex: "1 1 280px", maxWidth: 380 }}>
          <Stack gap="xs">
            <Title order={2} size="h4">{t("shop.checkout.orderSummary")}</Title>
            {preview!.cart.items.map((line) => (
              <Group key={line.variantId} justify="space-between" wrap="nowrap" gap="xs">
                <Text fz="sm" lineClamp={1}>{line.quantity} × {line.name || line.sku || line.variantId}</Text>
                {line.purchasable ? (
                  <Text fz="sm">{formatCents(line.lineTotal)}</Text>
                ) : (
                  <Text fz="sm" c="dimmed">{t("shop.checkout.onRequest")}</Text>
                )}
              </Group>
            ))}
            <Divider my="xs" />
            {isQuote && (
              <Text c="dimmed" fz="xs">{t("shop.checkout.noQuoteTotal")}</Text>
            )}
            {!isQuote && totals && (
              <>
                <Row label={t("shop.checkout.subtotal")} value={formatCents(totals.itemsSubtotal)} />
                {totals.discountTotal > 0 && <Row label={t("shop.checkout.discount")} value={`−${formatCents(totals.discountTotal)}`} accent />}
                {preview!.cart.shipping.method && (
                  <Row
                    label={`Shipping (${preview!.cart.shipping.method.name})`}
                    value={preview!.cart.shipping.freeByCoupon || preview!.cart.shipping.free ? t("shop.checkout.free") : formatCents(totals.shipping?.gross ?? 0)}
                  />
                )}
                {totals.surcharge && <Row label={t("shop.checkout.cashOnDelivery")} value={formatCents(totals.surcharge.gross)} />}
                {totals.taxTotal > 0 && <Row label={t("shop.checkout.net")} value={formatCents(totals.netTotal)} dim />}
                {totals.taxSummary
                  .filter((row) => row.vat > 0)
                  .map((row) => (
                    <Row key={row.rateBps} label={`${t("shop.checkout.vat")} ${ratePct(row.rateBps)} (${preview!.cart.shipping.country})`} value={formatCents(row.vat)} dim />
                  ))}
                <Divider my="xs" />
                <Group justify="space-between">
                  <Text fw={700}>{isQuote ? t("shop.checkout.estimatedTotal") : t("shop.checkout.total")}</Text>
                  <Text fw={700} fz="lg">{formatCents(totals.grossTotal)}</Text>
                </Group>
                {preview!.cart.vatRegistered === false ? (
                  <Text c="dimmed" fz="xs">{t("shop.checkout.vatExempt")}</Text>
                ) : totals.taxTotal > 0 ? (
                  <Text c="dimmed" fz="xs">{t("shop.checkout.vatShownFor")} {preview!.cart.shipping.country}.</Text>
                ) : (
                  <Text c="dimmed" fz="xs">{t("shop.checkout.noVat")}</Text>
                )}
              </>
            )}

            {/* Payment method (L7.4) — only for a payable cart. COD appears only when the
                chosen shipping method is COD-eligible. */}
            {!isQuote && offeredMethods.length > 0 && (
              <>
                <Divider my="xs" />
                <Radio.Group
                  label={t("shop.checkout.paymentMethod")}
                  value={paymentMethod ?? ""}
                  onChange={(v) => void onPaymentMethod(v as CheckoutMode)}
                >
                  <Stack gap={6} mt={6}>
                    {offeredMethods.map((m) => (
                      <Radio key={m} value={m} label={t(`shop.pay.${m}`)} description={t(`shop.pay.${m}.help`)} />
                    ))}
                  </Stack>
                </Radio.Group>
              </>
            )}
            {noPayableMethod && (
              <Alert color="orange" icon={<Info size={16} />}>
                {t("shop.checkout.noPayableMethod")}
              </Alert>
            )}
            {needsShipping && !noPayableMethod && (
              <Alert color="orange" icon={<Info size={16} />}>
                {t("shop.checkout.chooseDelivery")}{" "}
                <Anchor component={Link} to={`/${loc}/cart`}>{t("shop.checkout.selectOnCart")}</Anchor>.
              </Alert>
            )}

            <Button mt="sm" size="md" onClick={place} loading={placing} disabled={!canAttempt}>
              {isQuote ? t("shop.checkout.sendInquiry") : t("shop.checkout.placeOrder")}
            </Button>
            {!addressValid && !noPayableMethod && !needsShipping && <Text c="dimmed" fz="xs">{t("shop.checkout.fillToContinue")}</Text>}
          </Stack>
        </Paper>
      </Group>
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
