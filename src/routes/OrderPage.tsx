import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Alert, Anchor, Badge, Button, Divider, Group, Loader, NumberInput, Paper, Stack, Text, Textarea, Title } from "@mantine/core";
import { CheckCircle2, CreditCard, FileText, Check, X, RotateCcw, Package, Download } from "lucide-react";
import { StorefrontError, type InitiatePaymentResult, type Order, type OrderReturnsResult } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useLocaleConfig, useStrings } from "@/lib/locale";
import { humanizeStatus } from "@/lib/shopStrings";
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

// Fulfillment axis → badge colour + a friendly progress message shown on the order
// page (L7 fulfillment reflection). `unfulfilled` shows nothing (order just placed).
const FULFILLMENT_COLOR: Record<string, string> = {
  unfulfilled: "gray", reserved: "blue", preparing: "blue", partially_shipped: "yellow",
  shipped: "teal", delivered: "teal", returned: "gray",
};
// Fulfillment statuses that carry a shopper-facing progress message (i18n key
// `shop.order.fulfill.<status>`). Others (unfulfilled/reserved) show nothing.
const FULFILLMENT_MSG_STATUSES = new Set(["preparing", "partially_shipped", "shipped", "delivered", "returned"]);

export function OrderPage() {
  const { locale, token } = useParams<{ locale: string; token: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const { t } = useStrings();
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
        ? t("shop.order.acceptError.stock")
        : t("shop.order.acceptError.generic"));
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
      setQuoteError(t("shop.order.declineError"));
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
      setPayError(t("shop.order.payStartError"));
    } finally {
      setInitiating(false);
    }
  };

  if (loading) return <Loader />;
  if (notFound || !order) {
    return (
      <Stack>
        <Title order={1}>{t("shop.order.notFound")}</Title>
        <Text c="dimmed">{t("shop.order.notFoundBody")}</Text>
        <Anchor component={Link} to={`/${loc}/shop`}>{t("shop.order.continueShopping")}</Anchor>
      </Stack>
    );
  }

  const totals = order.totals;
  const addr = order.shippingAddress;
  // A non-shippable (digital/service) order has no shipping address — show billing.
  const billAddr = order.billingAddress;
  // `authorized` = a manual-capture HOLD (card OK'd, not yet charged); `paid` = charged.
  const authorized = order.status.paymentStatus === "authorized";
  const isPaid = order.status.paymentStatus === "paid" || authorized;

  return (
    <Stack gap="lg" maw={720}>
      <Alert color={order.isQuote ? "blue" : isPaid ? "teal" : "yellow"} icon={order.isQuote ? <FileText size={18} /> : <CheckCircle2 size={18} />}>
        {order.isQuote ? (
          <Text>{t("shop.order.quoteReceivedPrefix")} <b>{t("shop.order.quoteRequest")}</b> #{order.orderNumber} {t("shop.order.quoteReceivedMid")} <b>{order.email}</b>.</Text>
        ) : authorized ? (
          <Text>{t("shop.order.authorizedPrefix")} <b>{t("shop.order.authorized")}</b> {t("shop.order.authorizedMid")} <b>#{order.orderNumber}</b> {t("shop.order.authorizedSuffix")} <b>{order.email}</b>.</Text>
        ) : isPaid ? (
          <Text>{t("shop.order.paidPrefix")} <b>#{order.orderNumber}</b> {t("shop.order.paidMid")} <b>{order.email}</b>.</Text>
        ) : (
          <Text>{t("shop.order.placedPrefix")} <b>#{order.orderNumber}</b> {t("shop.order.placedMid")} <b>{order.email}</b>.</Text>
        )}
      </Alert>

      <Group gap="xs">
        <Title order={2}>{t("shop.order.orderNo")} #{order.orderNumber}</Title>
        <Badge color={order.isQuote ? "blue" : "yellow"} variant="light">{humanizeStatus(loc, order.status.lifecycle)}</Badge>
        <Badge color={isPaid ? "teal" : "gray"} variant="light">{humanizeStatus(loc, order.status.paymentStatus)}</Badge>
        {!order.isQuote && order.status.fulfillmentStatus !== "unfulfilled" && (
          <Badge color={FULFILLMENT_COLOR[order.status.fulfillmentStatus] ?? "gray"} variant="light">
            {humanizeStatus(loc, order.status.fulfillmentStatus)}
          </Badge>
        )}
        {/* Fiscal receipt/invoice PDF (L8.4) — downloadable once the order is fiscalized
            (the flag is true even while the JIR is pending; the ZKI receipt is valid). */}
        {order.invoiceAvailable && (
          <Button
            component="a"
            href={storefront.orderInvoicePdfUrl(order.token)}
            target="_blank"
            rel="noreferrer"
            variant="light"
            size="xs"
            leftSection={<FileText size={15} />}
          >
            {t("shop.order.invoicePdf")}
          </Button>
        )}
      </Group>

      {/* Digital downloads (L9.5) — tokenized, expiring links minted when the
          order was paid, plus any assigned license keys. */}
      {(order.downloads?.length ?? 0) > 0 && (
        <Paper withBorder p="md" radius="md">
          <Group gap="xs" mb="sm">
            <Download size={18} />
            <Title order={4}>{t("shop.order.yourDownloads")}</Title>
          </Group>
          <Stack gap="sm">
            {order.downloads!.map((d) => (
              <div key={d.orderItemId}>
                <Group gap="sm">
                  <Text fw={600}>{d.name}</Text>
                  {d.expired ? (
                    <Badge color="gray" variant="light">{t("shop.order.linkExpired")}</Badge>
                  ) : (
                    <Button
                      component="a"
                      href={storefront.downloadUrl(d.url)}
                      size="xs"
                      variant="light"
                      leftSection={<Download size={14} />}
                    >
                      {t("shop.order.download")} {d.filename}
                    </Button>
                  )}
                </Group>
                {!d.expired && (
                  <Text fz="xs" c="dimmed">
                    {t("shop.order.linkValidUntil")} {new Date(d.expiresAt).toLocaleString()}
                  </Text>
                )}
                {d.licenseKeys.length > 0 && (
                  <Text fz="sm" mt={4}>
                    {d.licenseKeys.length > 1 ? t("shop.order.licenseKeys") : t("shop.order.licenseKey")}:{" "}
                    {d.licenseKeys.map((k) => (
                      <Text key={k} component="span" ff="monospace" fw={600} mr="sm">
                        {k}
                      </Text>
                    ))}
                  </Text>
                )}
              </div>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Fulfillment progress (L7) — reflects the admin's fulfillment actions
          (preparing → shipped → delivered) so the shopper sees where their order is. */}
      {!order.isQuote && FULFILLMENT_MSG_STATUSES.has(order.status.fulfillmentStatus) && (
        <Alert color={order.status.fulfillmentStatus === "returned" ? "gray" : "teal"} icon={<Package size={18} />}>
          {t(`shop.order.fulfill.${order.status.fulfillmentStatus}`)}
        </Alert>
      )}

      {/* Quote accept / decline (L7.5) — a SENT quote the customer can act on. On
          accept the quote freezes prices + reserves stock and becomes payable (the
          payment block below then appears); on decline it's cancelled. */}
      {order.isQuote && order.quoteStatus === "sent" && (
        <Paper withBorder p="md" radius="md">
          <Group gap="xs" mb="sm">
            <FileText size={18} />
            <Title order={4}>{t("shop.order.quoteReadyTitle")}</Title>
          </Group>
          <Text fz="sm" mb="sm">
            {t("shop.order.quoteReviewPrefix")}
            {order.validUntil ? <>, {t("shop.order.quoteValidUntil")} <b>{new Date(order.validUntil).toLocaleDateString()}</b></> : null}.{" "}
            {t("shop.order.quoteReviewSuffix")}
          </Text>
          {quoteError && <Text fz="sm" c="red" mb="xs">{quoteError}</Text>}
          <Group>
            <Button leftSection={<Check size={16} />} onClick={() => void acceptQuote()} loading={quoteBusy}>
              {t("shop.order.acceptQuote")}
            </Button>
            <Button variant="light" color="red" leftSection={<X size={16} />} onClick={() => void declineQuote()} loading={quoteBusy}>
              {t("shop.order.decline")}
            </Button>
          </Group>
        </Paper>
      )}

      {order.isQuote && order.quoteStatus === "declined" && (
        <Alert color="gray">{t("shop.order.declinedNote")} <Anchor component={Link} to={`/${loc}/shop`}>{t("shop.account.continueShopping")}</Anchor>.</Alert>
      )}

      {/* Payment (L6.2 + L7.4 modes) — while awaiting_payment + not a quote. The UI
          branches on the order's resolved payment mode: card (Stripe) for pay_now,
          bank-transfer instructions + deadline for bank_transfer, pay-on-delivery for cod. */}
      {payable && (
        <Paper withBorder p="md" radius="md">
          <Group gap="xs" mb="sm">
            <CreditCard size={18} />
            <Title order={4}>{t("shop.order.payment")}</Title>
          </Group>
          {order.paymentMethod === "bank_transfer" ? (
            <Stack gap={4}>
              <Text fz="sm">
                {t("shop.order.bankTransferPrefix")} <b>{t("shop.order.bankTransfer")}</b> {t("shop.order.bankTransferMid")}
                {order.paymentDueAt ? <> {t("shop.order.by")} <b>{new Date(order.paymentDueAt).toLocaleDateString()}</b></> : null}.
              </Text>
              <Text fz="sm" c="dimmed">{t("shop.order.bankReserved")}</Text>
              <Group mt={4}>
                <Button
                  component="a"
                  href={storefront.orderProformaPdfUrl(order.token)}
                  target="_blank"
                  rel="noreferrer"
                  variant="light"
                  size="xs"
                  leftSection={<FileText size={15} />}
                >
                  {t("shop.order.downloadProforma")}
                </Button>
              </Group>
            </Stack>
          ) : order.paymentMethod === "cod" ? (
            <Text fz="sm">
              {t("shop.order.codPrefix")} <b>{t("shop.order.codPayInCash")}</b>
              {totals.surcharge ? <> {t("shop.order.codSurchargePrefix")} {formatCents(totals.surcharge.gross)} {t("shop.order.codSurchargeSuffix")}</> : null}{t("shop.order.codNoPaymentNow")}
            </Text>
          ) : confirming ? (
            <Group gap="xs">
              <Loader size="xs" />
              <Text fz="sm" c="dimmed">{t("shop.order.confirmingPayment")}</Text>
            </Group>
          ) : pay && pay.initiate.kind === "client_secret" ? (
            <Stack gap="xs">
              {cardManual && (
                <Text fz="sm" c="dimmed">
                  {t("shop.order.holdNotice")}
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
                {cardManual ? t("shop.order.authorizeIntro") : t("shop.order.payIntro")}
              </Text>
              {payError && <Text fz="sm" c="red">{payError}</Text>}
              <Button leftSection={<CreditCard size={16} />} onClick={() => void beginCardPayment()} loading={initiating}>
                {cardManual ? t("shop.order.authorizeCard") : t("shop.order.payByCard")}
              </Button>
            </Stack>
          ) : (
            <Text fz="sm" c="dimmed">{t("shop.order.followUpEmail")}</Text>
          )}
        </Paper>
      )}

      <Paper withBorder p="md" radius="md">
        <Stack gap="xs">
          <Title order={4}>{t("shop.order.items")}</Title>
          {order.items.map((line) => {
            // Per-line shipped state (only meaningful once something has shipped).
            const f = order.lineFulfillment?.find((x) => x.orderItemId === line.id);
            const showShip = !order.isQuote && !!f && (order.status.fulfillmentStatus === "partially_shipped" || order.status.fulfillmentStatus === "shipped" || order.status.fulfillmentStatus === "delivered");
            const shipText = !showShip || !f
              ? null
              : f.shipped >= f.ordered
              ? t("shop.order.shipped")
              : f.shipped > 0
              ? t("shop.order.shippedOf").replace("{n}", String(f.shipped)).replace("{total}", String(f.ordered))
              : t("shop.order.shipsSoon");
            return (
              <Group key={line.id} justify="space-between" wrap="nowrap" gap="xs">
                <div>
                  <Text fz="sm">{line.quantity} × {line.name || line.sku || line.variantId}</Text>
                  {shipText && (
                    <Text fz="xs" c={shipText === t("shop.order.shipsSoon") ? "dimmed" : "teal"}>{shipText}</Text>
                  )}
                </div>
                <Text fz="sm">{formatCents(line.gross)}</Text>
              </Group>
            );
          })}
          <Divider my="xs" />
          <Row label={t("shop.order.subtotal")} value={formatCents(totals.itemsSubtotal)} />
          {totals.discountTotal > 0 && <Row label={t("shop.order.discount")} value={`−${formatCents(totals.discountTotal)}`} accent />}
          {order.shippingMethod && <Row label={`Shipping (${order.shippingMethod.name})`} value={formatCents(totals.shipping?.gross ?? 0)} />}
          {totals.surcharge && <Row label={t("shop.order.cashOnDelivery")} value={formatCents(totals.surcharge.gross)} />}
          {totals.taxTotal > 0 && <Row label={t("shop.order.net")} value={formatCents(totals.netTotal)} dim />}
          {totals.taxSummary
            .filter((r) => r.vat > 0)
            .map((r) => (
              <Row key={r.rateBps} label={`${t("shop.order.vat")} ${ratePct(r.rateBps)}${order.taxDestination ? ` (${order.taxDestination})` : ""}`} value={formatCents(r.vat)} dim />
            ))}
          <Divider my="xs" />
          <Group justify="space-between">
            <Text fw={700}>{order.isQuote ? t("shop.order.estimatedTotal") : t("shop.order.total")}</Text>
            <Text fw={700} fz="lg">{formatCents(totals.grossTotal)}</Text>
          </Group>
          {totals.taxTotal === 0 && <Text c="dimmed" fz="xs" mt={4}>{t("shop.order.noVatCharged")}</Text>}
        </Stack>
      </Paper>

      {addr && (
        <Paper withBorder p="md" radius="md">
          <Title order={4} mb="xs">{t("shop.order.shippingTo")}</Title>
          <Text fz="sm">{addr.name}</Text>
          <Text fz="sm">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</Text>
          <Text fz="sm">{addr.postalCode} {addr.city}, {addr.country}</Text>
          {addr.phone && <Text fz="sm" c="dimmed">{addr.phone}</Text>}
          {order.shippingMethod && (
            <Text fz="sm" c="dimmed" mt="xs">
              {t("shop.order.method")}: {order.shippingMethod.name}
              {order.pickupPoint ? ` — ${(order.pickupPoint as { name?: string }).name ?? t("shop.order.pickupPoint")}` : ""}
            </Text>
          )}
        </Paper>
      )}

      {/* Billing address — shown when it differs from shipping, or when there is no
          shipping address at all (a digital/service order). */}
      {billAddr && (!addr || JSON.stringify(billAddr) !== JSON.stringify(addr)) && (
        <Paper withBorder p="md" radius="md">
          <Title order={4} mb="xs">{t("shop.order.billing")}</Title>
          <Text fz="sm">{billAddr.name}</Text>
          <Text fz="sm">{billAddr.line1}{billAddr.line2 ? `, ${billAddr.line2}` : ""}</Text>
          <Text fz="sm">{billAddr.postalCode} {billAddr.city}, {billAddr.country}</Text>
          {billAddr.phone && <Text fz="sm" c="dimmed">{billAddr.phone}</Text>}
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

      <Anchor component={Link} to={`/${loc}/shop`}>{t("shop.order.continueShopping")}</Anchor>
    </Stack>
  );
}

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
  const { t } = useStrings();
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
      setError(t("shop.order.selectItemReturn"));
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
          ? t("shop.order.returnNotEligible")
          : t("shop.order.returnSubmitError"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Group gap="xs" mb="sm">
        <RotateCcw size={18} />
        <Title order={4}>{t("shop.order.returns")}</Title>
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
                {t(`shop.status.${r.status}`)}
              </Badge>
            </Group>
          ))}
        </Stack>
      )}

      {/* Web returns turned off → point the shopper at the returns email instead. */}
      {returnsOff && eligible && data.returnsEmail && (
        <Text fz="sm" c="dimmed">
          {t("shop.order.returnsEmailPrefix")}{" "}
          <Anchor href={`mailto:${data.returnsEmail}`}>{data.returnsEmail}</Anchor>.
        </Text>
      )}

      {/* New return request (within window) */}
      {!returnsOff && eligible && lines.length > 0 && (
        !open ? (
          <Button variant="light" leftSection={<RotateCcw size={16} />} onClick={() => setOpen(true)}>
            {data.returns.length > 0 ? t("shop.order.requestAnotherReturn") : t("shop.order.requestReturn")}
          </Button>
        ) : (
          <Stack gap="xs">
            <Text fz="sm" c="dimmed">
              {t("shop.order.chooseHowMany")}
              {data.eligibility?.windowEndsAt
                ? <> — {t("shop.order.returnWindowCloses")} <b>{new Date(data.eligibility.windowEndsAt).toLocaleDateString()}</b></>
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
              label={t("shop.order.reasonOptional")} autosize minRows={2}
              value={reason} onChange={(e) => setReason(e.currentTarget.value)}
            />
            {error && <Text fz="sm" c="red">{error}</Text>}
            <Group>
              <Button onClick={() => void submit()} loading={busy}>{t("shop.order.submitReturn")}</Button>
              <Button variant="subtle" onClick={() => setOpen(false)} disabled={busy}>{t("shop.order.cancel")}</Button>
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
