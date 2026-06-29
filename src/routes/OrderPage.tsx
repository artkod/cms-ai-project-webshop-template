import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Alert, Anchor, Badge, Button, Divider, Group, Loader, NumberInput, Paper, Stack, Text, Textarea, Title } from "@mantine/core";
import { CheckCircle2, CreditCard, FileText, Check, X, RotateCcw } from "lucide-react";
import { StorefrontError, type InitiatePaymentResult, type Order, type OrderReturnsResult } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useLocaleConfig } from "@/lib/locale";
import { formatCents } from "@/lib/money";
import { StripePayment } from "@/components/shop/StripePayment";

// ─────────────────────────────────────────────────────────────────────────────
// Pending-order page (Phase L4.5 + payment L6.2).
//
// The post-checkout landing — fetched by the order's unguessable public token. A
// quote shows quote messaging. When the order is `awaiting_payment` and a card
// provider is configured, it offers in-page Stripe payment. The order flips to
// PAID off the Stripe WEBHOOK, never the browser result (design §11): after the
// card is confirmed we POLL the order until the webhook lands. Everything here is
// a SNAPSHOT (the order never joins the live catalog).
// ─────────────────────────────────────────────────────────────────────────────

function ratePct(bps: number): string {
  return `${bps / 100}%`;
}

export function OrderPage() {
  const { locale, token } = useParams<{ locale: string; token: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Returns / RMA (L7.6) — eligibility + existing requests, fetched once the order loads.
  const [returns, setReturns] = useState<OrderReturnsResult | null>(null);
  const refreshReturns = useCallback(() => {
    if (!token) return;
    storefront.getReturns(token).then(setReturns).catch(() => {});
  }, [token]);

  // Payment (L6.2) — only meaningful while awaiting_payment + not a quote.
  const [hasCardProvider, setHasCardProvider] = useState(false);
  // Manual capture (L6.4): confirming only AUTHORIZES a hold; the charge happens later
  // at dispatch. We tell the shopper so "Pay now" / "Payment received" aren't misleading.
  const [cardManual, setCardManual] = useState(false);
  const [pay, setPay] = useState<InitiatePaymentResult | null>(null);
  const [initiating, setInitiating] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const pollRef = useRef<number | null>(null);

  // Initial load.
  useEffect(() => {
    if (!token) return;
    storefront
      .getOrder(token)
      .then(setOrder)
      .catch((e) => {
        if (e instanceof StorefrontError && e.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
    refreshReturns();
  }, [token, refreshReturns]);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setConfirming(false);
  }, []);

  // Poll until the payment settles, then stop. Each tick calls the REFRESH endpoint,
  // which reconciles server-side (the server pulls Stripe's status) before returning
  // the order — so the status flips even with no inbound webhook tunnel (local dev).
  // In prod the webhook usually wins the race; this just confirms it.
  const startPolling = useCallback(() => {
    if (pollRef.current !== null) return;
    setConfirming(true);
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const o = token ? await storefront.refreshOrderPayment(token) : null;
        if (o) setOrder(o);
        if (o && o.status.paymentStatus !== "awaiting_payment") {
          stopPolling();
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      if (attempts >= 40) stopPolling(); // ~100s safety cap
    };
    pollRef.current = window.setInterval(() => void tick(), 2500);
    void tick();
  }, [token, stopPolling]);

  // Returning from a 3DS redirect: Stripe appends `redirect_status` to the return
  // URL. If we came back successfully, go straight to polling for the webhook.
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("redirect_status");
    if (status === "succeeded") startPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Is a card provider configured? (Only fetch once we know the order is payable.)
  const payable = !!order && !order.isQuote && order.status.paymentStatus === "awaiting_payment";
  useEffect(() => {
    if (!payable) return;
    let alive = true;
    storefront
      .listPaymentProviders()
      .then((ps) => {
        if (!alive) return;
        const stripe = ps.find((p) => p.provider === "stripe");
        setHasCardProvider(!!stripe);
        setCardManual(stripe?.captureMode === "manual");
      })
      .catch(() => {
        /* leave card payment hidden on error */
      });
    return () => {
      alive = false;
    };
  }, [payable]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Quote accept / decline (L7.5) — only while the quote is SENT to the customer.
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const acceptQuote = async () => {
    if (!token) return;
    setQuoteBusy(true);
    setQuoteError(null);
    try {
      setOrder(await storefront.acceptQuote(token));
    } catch (e) {
      setQuoteError(e instanceof StorefrontError && e.code === "insufficient_stock"
        ? "Some items are no longer in stock — we'll be in touch."
        : "Couldn't accept the quote. Please try again.");
    } finally {
      setQuoteBusy(false);
    }
  };
  const declineQuote = async () => {
    if (!token) return;
    setQuoteBusy(true);
    setQuoteError(null);
    try {
      setOrder(await storefront.declineQuote(token));
    } catch {
      setQuoteError("Couldn't decline the quote. Please try again.");
    } finally {
      setQuoteBusy(false);
    }
  };

  const beginCardPayment = async () => {
    if (!token) return;
    setInitiating(true);
    setPayError(null);
    try {
      setPay(await storefront.initiatePayment(token, "stripe"));
    } catch {
      setPayError("Couldn't start the payment. Please try again.");
    } finally {
      setInitiating(false);
    }
  };

  if (loading) return <Loader />;
  if (notFound || !order) {
    return (
      <Stack>
        <Title order={1}>Order not found</Title>
        <Text c="dimmed">We couldn't find that order.</Text>
        <Anchor component={Link} to={`/${loc}/shop`}>← Continue shopping</Anchor>
      </Stack>
    );
  }

  const t = order.totals;
  const addr = order.shippingAddress;
  // `authorized` = a manual-capture HOLD (card OK'd, not yet charged); `paid` = charged.
  const authorized = order.status.paymentStatus === "authorized";
  const isPaid = order.status.paymentStatus === "paid" || authorized;

  return (
    <Stack gap="lg" maw={720}>
      <Alert color={order.isQuote ? "blue" : isPaid ? "teal" : "yellow"} icon={order.isQuote ? <FileText size={18} /> : <CheckCircle2 size={18} />}>
        {order.isQuote ? (
          <Text>Your <b>quote request</b> #{order.orderNumber} has been received. We'll email a quote to <b>{order.email}</b>.</Text>
        ) : authorized ? (
          <Text>Your card is <b>authorized</b> for order <b>#{order.orderNumber}</b> — you won't be charged until it ships. A confirmation will go to <b>{order.email}</b>.</Text>
        ) : isPaid ? (
          <Text>Payment received — thank you! Order <b>#{order.orderNumber}</b> is confirmed. A receipt will go to <b>{order.email}</b>.</Text>
        ) : (
          <Text>Thank you! Order <b>#{order.orderNumber}</b> is placed and awaiting payment. A confirmation will go to <b>{order.email}</b>.</Text>
        )}
      </Alert>

      <Group gap="xs">
        <Title order={2}>Order #{order.orderNumber}</Title>
        <Badge color={order.isQuote ? "blue" : "yellow"} variant="light">{order.status.lifecycle}</Badge>
        <Badge color={isPaid ? "teal" : "gray"} variant="light">{order.status.paymentStatus}</Badge>
      </Group>

      {/* Quote accept / decline (L7.5) — a SENT quote the customer can act on. On
          accept the quote freezes prices + reserves stock and becomes payable (the
          payment block below then appears); on decline it's cancelled. */}
      {order.isQuote && order.quoteStatus === "sent" && (
        <Paper withBorder p="md" radius="md">
          <Group gap="xs" mb="sm">
            <FileText size={18} />
            <Title order={4}>Your quote is ready</Title>
          </Group>
          <Text fz="sm" mb="sm">
            Review the items and total below
            {order.validUntil ? <>, valid until <b>{new Date(order.validUntil).toLocaleDateString()}</b></> : null}.
            Accept to confirm and proceed to payment, or decline if it no longer suits you.
          </Text>
          {quoteError && <Text fz="sm" c="red" mb="xs">{quoteError}</Text>}
          <Group>
            <Button leftSection={<Check size={16} />} onClick={() => void acceptQuote()} loading={quoteBusy}>
              Accept quote
            </Button>
            <Button variant="light" color="red" leftSection={<X size={16} />} onClick={() => void declineQuote()} loading={quoteBusy}>
              Decline
            </Button>
          </Group>
        </Paper>
      )}

      {order.isQuote && order.quoteStatus === "declined" && (
        <Alert color="gray">You declined this quote. <Anchor component={Link} to={`/${loc}/shop`}>Continue shopping</Anchor>.</Alert>
      )}

      {/* Payment (L6.2 + L7.4 modes) — while awaiting_payment + not a quote. The UI
          branches on the order's resolved payment mode: card (Stripe) for pay_now,
          bank-transfer instructions + deadline for bank_transfer, pay-on-delivery for cod. */}
      {payable && (
        <Paper withBorder p="md" radius="md">
          <Group gap="xs" mb="sm">
            <CreditCard size={18} />
            <Title order={4}>Payment</Title>
          </Group>
          {order.paymentMethod === "bank_transfer" ? (
            <Stack gap={4}>
              <Text fz="sm">
                Pay by <b>bank transfer</b> using the details we'll email to {order.email}
                {order.paymentDueAt ? <> by <b>{new Date(order.paymentDueAt).toLocaleDateString()}</b></> : null}.
              </Text>
              <Text fz="sm" c="dimmed">Your order is reserved and ships once payment arrives.</Text>
            </Stack>
          ) : order.paymentMethod === "cod" ? (
            <Text fz="sm">
              You'll <b>pay in cash on delivery</b>
              {t.surcharge ? <> (incl. a {formatCents(t.surcharge.gross)} COD surcharge)</> : null}. No payment is needed now.
            </Text>
          ) : confirming ? (
            <Group gap="xs">
              <Loader size="xs" />
              <Text fz="sm" c="dimmed">Confirming your payment…</Text>
            </Group>
          ) : pay && pay.initiate.kind === "client_secret" ? (
            <Stack gap="xs">
              {cardManual && (
                <Text fz="sm" c="dimmed">
                  We'll only place a <b>hold</b> on your card now — you're charged when your order ships.
                </Text>
              )}
              <StripePayment
                publishableKey={pay.initiate.publishableKey}
                clientSecret={pay.initiate.clientSecret}
                onConfirmed={startPolling}
              />
            </Stack>
          ) : hasCardProvider ? (
            <Stack gap="xs" align="flex-start">
              <Text fz="sm" c="dimmed">
                {cardManual
                  ? "Authorize your card to confirm your order — you'll only be charged when it ships."
                  : "Pay securely by card to confirm your order."}
              </Text>
              {payError && <Text fz="sm" c="red">{payError}</Text>}
              <Button leftSection={<CreditCard size={16} />} onClick={() => void beginCardPayment()} loading={initiating}>
                {cardManual ? "Authorize card" : "Pay by card"}
              </Button>
            </Stack>
          ) : (
            <Text fz="sm" c="dimmed">We'll follow up by email with payment instructions.</Text>
          )}
        </Paper>
      )}

      <Paper withBorder p="md" radius="md">
        <Stack gap="xs">
          <Title order={4}>Items</Title>
          {order.items.map((line) => (
            <Group key={line.id} justify="space-between" wrap="nowrap" gap="xs">
              <Text fz="sm">{line.quantity} × {line.name || line.sku || line.variantId}</Text>
              <Text fz="sm">{formatCents(line.gross)}</Text>
            </Group>
          ))}
          <Divider my="xs" />
          <Row label="Subtotal" value={formatCents(t.itemsSubtotal)} />
          {t.discountTotal > 0 && <Row label="Discount" value={`−${formatCents(t.discountTotal)}`} accent />}
          {order.shippingMethod && <Row label={`Shipping (${order.shippingMethod.name})`} value={formatCents(t.shipping?.gross ?? 0)} />}
          {t.surcharge && <Row label="Cash on delivery" value={formatCents(t.surcharge.gross)} />}
          {t.taxTotal > 0 && <Row label="Net" value={formatCents(t.netTotal)} dim />}
          {t.taxSummary
            .filter((r) => r.vat > 0)
            .map((r) => (
              <Row key={r.rateBps} label={`VAT ${ratePct(r.rateBps)}${order.taxDestination ? ` (${order.taxDestination})` : ""}`} value={formatCents(r.vat)} dim />
            ))}
          <Divider my="xs" />
          <Group justify="space-between">
            <Text fw={700}>{order.isQuote ? "Estimated total" : "Total"}</Text>
            <Text fw={700} fz="lg">{formatCents(t.grossTotal)}</Text>
          </Group>
          {t.taxTotal === 0 && <Text c="dimmed" fz="xs" mt={4}>No VAT was charged on this order.</Text>}
        </Stack>
      </Paper>

      {addr && (
        <Paper withBorder p="md" radius="md">
          <Title order={4} mb="xs">Shipping to</Title>
          <Text fz="sm">{addr.name}</Text>
          <Text fz="sm">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</Text>
          <Text fz="sm">{addr.postalCode} {addr.city}, {addr.country}</Text>
          {addr.phone && <Text fz="sm" c="dimmed">{addr.phone}</Text>}
          {order.shippingMethod && (
            <Text fz="sm" c="dimmed" mt="xs">
              Method: {order.shippingMethod.name}
              {order.pickupPoint ? ` — ${(order.pickupPoint as { name?: string }).name ?? "pickup point"}` : ""}
            </Text>
          )}
        </Paper>
      )}

      {/* Returns / RMA (L7.6) — only for a delivered order. Shows existing requests
          and, while inside the return window, a form to request a new return. When
          the shop has web returns turned off, it shows the email-us message instead. */}
      {token && returns && (
        returns.returns.length > 0 ||
        (returns.eligibility?.eligible && returns.returnsEnabled) ||
        (returns.eligibility?.eligible && !returns.returnsEnabled && returns.returnsEmail)
      ) && (
        <ReturnsCard token={token} data={returns} onChange={(d) => setReturns(d)} />
      )}

      <Anchor component={Link} to={`/${loc}/shop`}>← Continue shopping</Anchor>
    </Stack>
  );
}

const RETURN_STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
};
const RETURN_STATUS_COLOR: Record<string, string> = {
  requested: "yellow",
  approved: "teal",
  rejected: "gray",
};

function ReturnsCard({
  token,
  data,
  onChange,
}: {
  token: string;
  data: OrderReturnsResult;
  onChange: (d: OrderReturnsResult) => void;
}) {
  const eligible = data.eligibility?.eligible ?? false;
  const returnsOff = !data.returnsEnabled;
  const lines = (data.eligibility?.lines ?? []).filter((l) => l.returnable > 0);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const submit = async () => {
    const picked = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (picked.length === 0) {
      setError("Select at least one item to return.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await storefront.requestReturn(token, { lines: picked, reason: reason || undefined });
      setQty({});
      setReason("");
      setOpen(false);
      onChange(await storefront.getReturns(token));
    } catch (e) {
      setError(
        e instanceof StorefrontError && e.code === "return_not_eligible"
          ? "This order is no longer eligible for a return."
          : "Couldn't submit the return. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Group gap="xs" mb="sm">
        <RotateCcw size={18} />
        <Title order={4}>Returns</Title>
      </Group>

      {/* Existing return requests */}
      {data.returns.length > 0 && (
        <Stack gap="xs" mb={eligible ? "md" : 0}>
          {data.returns.map((r) => (
            <Group key={r.id} justify="space-between" wrap="nowrap">
              <Text fz="sm">
                {r.items.map((it) => `${it.quantity} × ${it.name}`).join(", ")}
              </Text>
              <Badge color={RETURN_STATUS_COLOR[r.status] ?? "gray"} variant="light">
                {RETURN_STATUS_LABEL[r.status] ?? r.status}
              </Badge>
            </Group>
          ))}
        </Stack>
      )}

      {/* Web returns turned off → point the shopper at the returns email instead. */}
      {returnsOff && eligible && data.returnsEmail && (
        <Text fz="sm" c="dimmed">
          To request a return, please email us at{" "}
          <Anchor href={`mailto:${data.returnsEmail}`}>{data.returnsEmail}</Anchor>.
        </Text>
      )}

      {/* New return request (within window) */}
      {!returnsOff && eligible && lines.length > 0 && (
        !open ? (
          <Button variant="light" leftSection={<RotateCcw size={16} />} onClick={() => setOpen(true)}>
            Request a return
          </Button>
        ) : (
          <Stack gap="xs">
            <Text fz="sm" c="dimmed">
              Choose how many of each item to return
              {data.eligibility?.windowEndsAt
                ? <> — the return window closes on <b>{new Date(data.eligibility.windowEndsAt).toLocaleDateString()}</b></>
                : null}.
            </Text>
            {lines.map((l) => (
              <Group key={l.orderItemId} justify="space-between" wrap="nowrap">
                <Text fz="sm">{l.name}{l.sku ? ` (${l.sku})` : ""}</Text>
                <NumberInput
                  size="xs" w={80} min={0} max={l.returnable}
                  value={qty[l.orderItemId] ?? 0}
                  onChange={(v) => setQty((s) => ({ ...s, [l.orderItemId]: Number(v) || 0 }))}
                />
              </Group>
            ))}
            <Textarea
              label="Reason (optional)" autosize minRows={2}
              value={reason} onChange={(e) => setReason(e.currentTarget.value)}
            />
            {error && <Text fz="sm" c="red">{error}</Text>}
            <Group>
              <Button onClick={() => void submit()} loading={busy}>Submit return request</Button>
              <Button variant="subtle" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            </Group>
          </Stack>
        )
      )}
    </Paper>
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
