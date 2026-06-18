import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Alert, Anchor, Box, Button, Divider, Group, Loader, Paper, Select, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Info } from "lucide-react";
import { StorefrontError, type CheckoutPreview, type OrderAddress } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useCart } from "@/lib/cart";
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
    default:
      return "Checkout failed. Please try again.";
  }
}

export function CheckoutPage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const navigate = useNavigate();
  const { cart, setShipping, refresh } = useCart();

  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

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

  // Re-preview whenever the cart changes (contents / destination / coupon).
  useEffect(() => {
    void reloadPreview();
  }, [reloadPreview, cart?.id, cart?.itemCount, cart?.shipping.country, cart?.coupon?.discountId]);

  // Keep the form country in sync with the cart's stored ship-to.
  useEffect(() => {
    if (cart?.shipping.country) setForm((f) => (f.country === cart.shipping.country ? f : { ...f, country: cart.shipping.country }));
  }, [cart?.shipping.country]);

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
  const canPlace = !!form.name.trim() && !!form.line1.trim() && !!form.city.trim() && !!form.postalCode.trim() && /.+@.+\..+/.test(form.email);

  const place = async () => {
    setPlacing(true);
    try {
      const { email, note, ...address } = form;
      const order = await storefront.startCheckout(
        { email, shippingAddress: address as OrderAddress, note: note.trim() || undefined },
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
            <Button mt="sm" size="md" onClick={place} loading={placing} disabled={!canPlace}>
              {isQuote ? "Request quote" : "Place order"}
            </Button>
            {!canPlace && <Text c="dimmed" fz="xs">Fill in your email + shipping address to continue.</Text>}
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
