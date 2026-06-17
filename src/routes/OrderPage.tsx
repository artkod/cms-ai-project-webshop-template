import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Alert, Anchor, Badge, Divider, Group, Loader, Paper, Stack, Text, Title } from "@mantine/core";
import { CheckCircle2, FileText } from "lucide-react";
import { StorefrontError, type Order } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useLocaleConfig } from "@/lib/locale";
import { formatCents } from "@/lib/money";

// ─────────────────────────────────────────────────────────────────────────────
// Pending-order page (Phase L4.5).
//
// The post-checkout landing — fetched by the order's unguessable public token. The
// order is PENDING (no payment yet — that's L6); a quote shows quote messaging.
// Everything here is a SNAPSHOT (the order never joins the live catalog).
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

  useEffect(() => {
    if (!token) return;
    storefront
      .getOrder(token)
      .then(setOrder)
      .catch((e) => {
        if (e instanceof StorefrontError && e.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [token]);

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

  return (
    <Stack gap="lg" maw={720}>
      <Alert color={order.isQuote ? "blue" : "teal"} icon={order.isQuote ? <FileText size={18} /> : <CheckCircle2 size={18} />}>
        {order.isQuote ? (
          <Text>Your <b>quote request</b> #{order.orderNumber} has been received. We'll email a quote to <b>{order.email}</b>.</Text>
        ) : (
          <Text>Thank you! Order <b>#{order.orderNumber}</b> is placed and awaiting payment. A confirmation will go to <b>{order.email}</b>.</Text>
        )}
      </Alert>

      <Group gap="xs">
        <Title order={2}>Order #{order.orderNumber}</Title>
        <Badge color={order.isQuote ? "blue" : "yellow"} variant="light">{order.status.lifecycle}</Badge>
        <Badge color="gray" variant="light">{order.status.paymentStatus}</Badge>
      </Group>

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
          <Row label="Net" value={formatCents(t.netTotal)} dim />
          {t.taxSummary.map((r) => (
            <Row key={r.rateBps} label={`VAT ${ratePct(r.rateBps)}${order.taxDestination ? ` (${order.taxDestination})` : ""}`} value={formatCents(r.vat)} dim />
          ))}
          <Divider my="xs" />
          <Group justify="space-between">
            <Text fw={700}>{order.isQuote ? "Estimated total" : "Total"}</Text>
            <Text fw={700} fz="lg">{formatCents(t.grossTotal)}</Text>
          </Group>
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

      <Anchor component={Link} to={`/${loc}/shop`}>← Continue shopping</Anchor>
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
