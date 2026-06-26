import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Alert, Anchor, Badge, Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { FileText, Package, ShoppingBag } from "lucide-react";
import { type CustomerOrderSummary } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useCustomer } from "@/lib/customer";
import { useLocaleConfig } from "@/lib/locale";
import { formatCents } from "@/lib/money";

// ─────────────────────────────────────────────────────────────────────────────
// Order history (Phase L5.8) — the logged-in + verified customer's own orders,
// INCLUDING prior guest orders that were claimed the moment their email was
// verified ("guest → account claim", design §14). A verification-gated account
// feature (the API enforces it; this page mirrors the gate with a friendly
// prompt). Each row links to the existing per-order detail page (OrderPage).
// ─────────────────────────────────────────────────────────────────────────────

function paymentColor(status: string): string {
  if (status === "paid") return "teal";
  if (status === "voided" || status === "refunded") return "red";
  if (status === "draft") return "blue";
  return "yellow"; // awaiting_payment / authorized / partially_refunded
}

export function OrdersPage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const { customer, loading: customerLoading } = useCustomer();

  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const verified = !!customer?.emailVerified;

  const reload = useCallback(async () => {
    if (!verified) {
      setLoading(false);
      return;
    }
    try {
      setOrders(await storefront.listMyOrders());
    } catch {
      /* leave as-is */
    } finally {
      setLoading(false);
    }
  }, [verified]);

  useEffect(() => {
    if (!customerLoading) void reload();
  }, [customerLoading, reload]);

  if (customerLoading || loading) {
    return (
      <Group justify="center" py="xl"><Loader /></Group>
    );
  }

  // Not logged in → send them to the account page to sign in.
  if (!customer) {
    return (
      <Stack maw={560} mx="auto" gap="md">
        <Title order={2}>My orders</Title>
        <Alert color="blue" variant="light">
          Please <Anchor component={Link} to={`/${loc}/account`}>sign in</Anchor> to view your order history.
        </Alert>
      </Stack>
    );
  }

  // Logged in but unverified → verification gate (mirrors the API). Note this is
  // also where the claim happens: verifying associates any prior guest orders.
  if (!verified) {
    return (
      <Stack maw={560} mx="auto" gap="md">
        <Title order={2}>My orders</Title>
        <Alert color="yellow" variant="light" title="Verify your email">
          Your order history is an account feature — please verify your email first. Verifying also links any
          earlier orders you placed as a guest with this email. <Anchor component={Link} to={`/${loc}/account`}>Go to your account</Anchor>.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack maw={680} mx="auto" gap="lg">
      <Title order={2}>My orders</Title>

      {orders.length === 0 ? (
        <Alert color="gray" variant="light" icon={<ShoppingBag size={18} />}>
          You haven't placed any orders yet. <Anchor component={Link} to={`/${loc}/shop`}>Start shopping</Anchor>.
        </Alert>
      ) : (
        <Stack gap="sm">
          {orders.map((o) => (
            <Card
              key={o.id}
              component={Link}
              to={`/${loc}/order/${o.token}`}
              withBorder
              radius="md"
              padding="md"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={4}>
                  <Group gap="xs">
                    {o.isQuote ? <FileText size={16} /> : <Package size={16} />}
                    <Text fw={600}>
                      {o.isQuote ? "Quote" : "Order"} #{o.orderNumber}
                    </Text>
                    <Badge size="xs" color={o.isQuote ? "blue" : "gray"} variant="light">
                      {o.status.lifecycle}
                    </Badge>
                    <Badge size="xs" color={paymentColor(o.status.paymentStatus)} variant="light">
                      {o.status.paymentStatus}
                    </Badge>
                  </Group>
                  <Text fz="sm" c="dimmed">
                    {new Date(o.placedAt).toLocaleDateString()} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                  </Text>
                </Stack>
                <Text fw={600}>{formatCents(o.grandTotal)}</Text>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Anchor component={Link} to={`/${loc}/account`} fz="sm">← Back to account</Anchor>
    </Stack>
  );
}
