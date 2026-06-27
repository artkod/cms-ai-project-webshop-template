import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Alert, Anchor, Box, Button, Divider, Group, Loader, Paper, Radio, Select, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Info } from "lucide-react";
import { StorefrontError, type CheckoutMode, type CheckoutPreview, type OrderAddress, type StorefrontAddress } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useCart } from "@/lib/cart";
import { useCustomer } from "@/lib/customer";
import { useLocaleConfig } from "@/lib/locale";
import { formatCents } from "@/lib/money";

// ─────────────────────────────────────────────────────────────────────────────
// Checkout (Phase L4.5).
//
// Enter an address → see DESTINATION tax (the totals re-tax at the ship-to country
// when the shop collects under OSS; otherwise the home rate still applies) → place
// the order → land on the pending-order page. A cart with any inquiry-only item is
// a QUOTE request (no payment); the button + result copy reflect that. No payment
// gateway yet (L6) — checkout creates the pending order and we show it.
// ─────────────────────────────────────────────────────────────────────────────

const COUNTRY_OPTIONS = [
  { value: "HR", label: "Croatia (HR)" },
  { value: "DE", label: "Germany (EU)" },
  { value: "IT", label: "Italy (EU)" },
  { value: "US", label: "United States (intl.)" },
];

// Payment-method labels + help (L7.4). Shown as a radio group at checkout from the
// preview's offered set; the COD option drives the cart's COD surcharge.
const PAYMENT_METHODS: Record<CheckoutMode, { label: string; help: string }> = {
  pay_now: { label: "Pay now (card)", help: "Pay securely by card on the next step." },
  bank_transfer: { label: "Bank transfer", help: "We'll email payment instructions; your order ships once payment arrives." },
  cod: { label: "Cash on delivery", help: "Pay in cash when your order is delivered (a surcharge applies)." },
};

function ratePct(bps: number): string {
  return `${bps / 100}%`;
}

function checkoutErrorMessage(err: StorefrontError): string {
  switch (err.code) {
    case "cart_empty":
      return "Your cart is empty.";
    case "insufficient_stock":
      return "Sorry — one of your items just went out of stock.";
    case "coupon_exhausted":
      return "Your coupon was just used up. Please remove it and try again.";
    case "payment_method_unavailable":
      return "That payment method isn't available for this cart. Please pick another option.";
    default:
      return "Checkout failed. Please try again.";
  }
}

export function CheckoutPage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const navigate = useNavigate();
  const { cart, setShipping, refresh, shippingOptions, loadShipping } = useCart();
  const { customer } = useCustomer();

  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  // The chosen payment mode (L7.4) — initialised from the preview's default, kept in
  // the offered set as the cart/shipping changes.
  const [paymentMethod, setPaymentMethod] = useState<CheckoutMode | null>(null);

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
  }, [reloadPreview, cart?.id, cart?.itemCount, cart?.shipping.country, cart?.shipping.method?.id, cart?.coupon?.discountId]);

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

  const totals = preview?.cart.totals;
  const isQuote = preview?.isQuote ?? false;
  const empty = !preview || preview.cart.items.length === 0;
  const offeredMethods = preview?.paymentMethods ?? [];
  // A payable cart with no offered method (e.g. a COD-only product without a COD-eligible
  // shipping method) can't be placed until the shopper changes shipping.
  const noPayableMethod = !!preview && !isQuote && !empty && offeredMethods.length === 0;
  const addressValid = !!form.name.trim() && !!form.line1.trim() && !!form.city.trim() && !!form.postalCode.trim() && /.+@.+\..+/.test(form.email);
  const paymentValid = isQuote || (!!paymentMethod && offeredMethods.includes(paymentMethod));
  // A delivery method is mandatory for a payable order (auto-selected above when one
  // exists; this still blocks a zone where only a pickup-point method is offered until
  // the shopper picks it + a point on the cart page).
  const hasShipping = !!preview?.cart.shipping.method;
  const needsShipping = !isQuote && !empty && !hasShipping;
  const canPlace = addressValid && paymentValid && !empty && (isQuote || hasShipping);

  const place = async () => {
    setPlacing(true);
    try {
      const { email, note, ...address } = form;
      const order = await storefront.startCheckout(
        {
          email,
          shippingAddress: address as OrderAddress,
          note: note.trim() || undefined,
          ...(paymentMethod && !isQuote ? { paymentMethod } : {}),
        },
        { locale: loc },
      );
      await refresh(); // the cart was cleared server-side
      navigate(`/${loc}/order/${order.token}`);
    } catch (e) {
      notifications.show({ color: "red", message: checkoutErrorMessage(e as StorefrontError) });
    } finally {
      setPlacing(false);
    }
  };

  if (loading && !preview) return <Loader />;

  if (empty) {
    return (
      <Stack>
        <Title order={1}>Checkout</Title>
        <Text c="dimmed">Your cart is empty.</Text>
        <Anchor component={Link} to={`/${loc}/shop`}>← Continue shopping</Anchor>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Title order={1}>{isQuote ? "Request a quote" : "Checkout"}</Title>

      {isQuote && (
        <Alert color="blue" icon={<Info size={16} />}>
          Your cart contains an inquiry-only item, so this is a <b>quote request</b>. No payment is taken now —
          we'll prepare a quote and follow up by email.
        </Alert>
      )}

      <Group align="flex-start" gap="xl" wrap="wrap">
        {/* Address form */}
        <Stack gap="sm" style={{ flex: "1 1 420px" }}>
          {saved.length > 0 && (
            <Select
              label="Use a saved address"
              data={[
                ...saved.map((a) => ({ value: a.id, label: `${a.label || a.name} — ${a.line1}, ${a.city}` })),
                { value: "", label: "Enter a new address" },
              ]}
              value={selectedAddressId ?? ""}
              onChange={(v) => onSelectSaved(v || null)}
              comboboxProps={{ withinPortal: true }}
            />
          )}

          <Title order={4}>Contact</Title>
          <TextInput label="Email" type="email" required value={form.email} onChange={set("email")} placeholder="you@example.com" />

          <Title order={4} mt="sm">Shipping address</Title>
          <TextInput label="Full name" required value={form.name} onChange={set("name")} />
          <TextInput label="Address" required value={form.line1} onChange={set("line1")} />
          <TextInput label="Address line 2" value={form.line2} onChange={set("line2")} />
          <Group grow>
            <TextInput label="City" required value={form.city} onChange={set("city")} />
            <TextInput label="Postal code" required value={form.postalCode} onChange={set("postalCode")} />
          </Group>
          <Select
            label="Country"
            data={COUNTRY_OPTIONS}
            value={form.country}
            onChange={(v) => v && onCountry(v)}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
          <TextInput label="Phone" value={form.phone} onChange={set("phone")} />
          <Textarea label="Order note" value={form.note} onChange={set("note")} autosize minRows={2} />
          <Anchor component={Link} to={`/${loc}/cart`} fz="sm">← Back to cart</Anchor>
        </Stack>

        {/* Summary */}
        <Paper withBorder p="md" radius="md" style={{ flex: "1 1 280px", maxWidth: 380 }}>
          <Stack gap="xs">
            <Title order={4}>Order summary</Title>
            {preview!.cart.items.map((line) => (
              <Group key={line.variantId} justify="space-between" wrap="nowrap" gap="xs">
                <Text fz="sm" lineClamp={1}>{line.quantity} × {line.name || line.sku || line.variantId}</Text>
                <Text fz="sm">{formatCents(line.lineTotal)}</Text>
              </Group>
            ))}
            <Divider my="xs" />
            {totals && (
              <>
                <Row label="Subtotal" value={formatCents(totals.itemsSubtotal)} />
                {totals.discountTotal > 0 && <Row label="Discount" value={`−${formatCents(totals.discountTotal)}`} accent />}
                {preview!.cart.shipping.method && (
                  <Row
                    label={`Shipping (${preview!.cart.shipping.method.name})`}
                    value={preview!.cart.shipping.freeByCoupon || preview!.cart.shipping.free ? "Free" : formatCents(totals.shipping?.gross ?? 0)}
                  />
                )}
                {totals.surcharge && <Row label="Cash on delivery" value={formatCents(totals.surcharge.gross)} />}
                {totals.taxTotal > 0 && <Row label="Net" value={formatCents(totals.netTotal)} dim />}
                {totals.taxSummary
                  .filter((t) => t.vat > 0)
                  .map((t) => (
                    <Row key={t.rateBps} label={`VAT ${ratePct(t.rateBps)} (${preview!.cart.shipping.country})`} value={formatCents(t.vat)} dim />
                  ))}
                <Divider my="xs" />
                <Group justify="space-between">
                  <Text fw={700}>{isQuote ? "Estimated total" : "Total"}</Text>
                  <Text fw={700} fz="lg">{formatCents(totals.grossTotal)}</Text>
                </Group>
                {preview!.cart.vatRegistered === false ? (
                  <Text c="dimmed" fz="xs">Prices are VAT-exempt — the shop is not in the VAT system.</Text>
                ) : totals.taxTotal > 0 ? (
                  <Text c="dimmed" fz="xs">VAT shown for {preview!.cart.shipping.country}.</Text>
                ) : (
                  <Text c="dimmed" fz="xs">No VAT applies to these items.</Text>
                )}
              </>
            )}

            {/* Payment method (L7.4) — only for a payable cart. COD appears only when the
                chosen shipping method is COD-eligible. */}
            {!isQuote && offeredMethods.length > 0 && (
              <>
                <Divider my="xs" />
                <Radio.Group
                  label="Payment method"
                  value={paymentMethod ?? ""}
                  onChange={(v) => void onPaymentMethod(v as CheckoutMode)}
                >
                  <Stack gap={6} mt={6}>
                    {offeredMethods.map((m) => (
                      <Radio key={m} value={m} label={PAYMENT_METHODS[m].label} description={PAYMENT_METHODS[m].help} />
                    ))}
                  </Stack>
                </Radio.Group>
              </>
            )}
            {noPayableMethod && (
              <Alert color="orange" icon={<Info size={16} />}>
                No payment method is available for this cart — your item requires cash on delivery, but the
                chosen shipping method doesn't support it. Pick a courier delivery method on the cart page.
              </Alert>
            )}
            {needsShipping && !noPayableMethod && (
              <Alert color="orange" icon={<Info size={16} />}>
                Choose a delivery method to continue.{" "}
                <Anchor component={Link} to={`/${loc}/cart`}>Select one on the cart page</Anchor>.
              </Alert>
            )}

            <Button mt="sm" size="md" onClick={place} loading={placing} disabled={!canPlace}>
              {isQuote ? "Request quote" : "Place order"}
            </Button>
            {!canPlace && !noPayableMethod && !needsShipping && <Text c="dimmed" fz="xs">Fill in your email + shipping address to continue.</Text>}
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
