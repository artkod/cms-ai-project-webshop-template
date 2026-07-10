import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Alert, Anchor, Badge, Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { FileText, Package, ShoppingBag } from "lucide-react";
import { type CustomerOrderSummary } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useCustomer } from "@/lib/customer";
import { useLocaleConfig, useStrings } from "@/lib/locale";
import { humanizeStatus } from "@/lib/shopStrings";
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
  const { t } = useStrings();

  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const verified = !!customer?.emailVerified;

  const reload = useCallback(async () => {
    if (!verified) {
      setLoading(false);
      return;
    }
    try {
      setOrders(await storefront.listMyOrders());
      setFailed(false);
    } catch {
      // Distinguish a load FAILURE from a genuinely empty history — otherwise a
      // 403 (session not verified server-side) or an SDK error silently looks
      // like "no orders yet", which is exactly what hides bugs.
      setFailed(true);
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
        <Title order={2}>{t("shop.orders.title")}</Title>
        <Alert color="blue" variant="light">
          {t("shop.orders.pleaseSignIn")} <Anchor component={Link} to={`/${loc}/account`}>{t("shop.orders.signIn")}</Anchor> {t("shop.orders.signInPrompt")}
        </Alert>
      </Stack>
    );
  }

  // Logged in but unverified → verification gate (mirrors the API). Note this is
  // also where the claim happens: verifying associates any prior guest orders.
  if (!verified) {
    return (
      <Stack maw={560} mx="auto" gap="md">
        <Title order={2}>{t("shop.orders.title")}</Title>
        <Alert color="yellow" variant="light" title={t("shop.orders.verifyTitle")}>
          {t("shop.orders.verifyBody")} <Anchor component={Link} to={`/${loc}/account`}>{t("shop.orders.goToAccount")}</Anchor>.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack maw={680} mx="auto" gap="lg">
      <Title order={2}>{t("shop.orders.title")}</Title>

      {failed ? (
        <Alert color="red" variant="light" title={t("shop.orders.loadFailedTitle")}>
          {t("shop.orders.loadFailedBody")}{" "}
          <Anchor onClick={() => { setLoading(true); void reload(); }}>{t("shop.orders.tryAgain")}</Anchor>.
        </Alert>
      ) : orders.length === 0 ? (
        <Alert color="gray" variant="light" icon={<ShoppingBag size={18} />}>
          {t("shop.orders.emptyBody")} <Anchor component={Link} to={`/${loc}/shop`}>{t("shop.orders.startShopping")}</Anchor>.
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
                      {o.isQuote ? t("shop.orders.quote") : t("shop.orders.order")} #{o.orderNumber}
                    </Text>
                    <Badge size="xs" color={o.isQuote ? "blue" : "gray"} variant="light">
                      {humanizeStatus(loc, o.status.lifecycle)}
                    </Badge>
                    <Badge size="xs" color={paymentColor(o.status.paymentStatus)} variant="light">
                      {humanizeStatus(loc, o.status.paymentStatus)}
                    </Badge>
                  </Group>
                  <Text fz="sm" c="dimmed">
                    {new Date(o.placedAt).toLocaleDateString()} · {o.itemCount} {o.itemCount === 1 ? t("shop.orders.itemOne") : t("shop.orders.itemOther")}
                  </Text>
                </Stack>
                <Text fw={600}>{formatCents(o.grandTotal)}</Text>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Anchor component={Link} to={`/${loc}/account`} fz="sm">{t("shop.orders.backToAccount")}</Anchor>
    </Stack>
  );
}
