import { useState } from "react";
import { Link, useParams } from "react-router";
import { ActionIcon, Anchor, Box, Button, Divider, Group, Image, Loader, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useLocaleConfig } from "@/lib/locale";
import { formatCents } from "@/lib/money";

// Vatrate label, e.g. 2500 → "25%".
function ratePct(bps: number): string {
  return `${bps / 100}%`;
}

export function CartPage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const { cart, loading, setQuantity, remove, clear, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);

  if (loading && !cart) return <Loader />;

  const empty = !cart || cart.items.length === 0;
  const totals = cart?.totals;

  const onApply = async () => {
    if (!code.trim()) return;
    setApplying(true);
    const ok = await applyCoupon(code.trim());
    setApplying(false);
    if (ok) setCode("");
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
          <Paper withBorder p="md" radius="md" style={{ flex: "1 1 280px", maxWidth: 360 }}>
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

              {totals && (
                <>
                  <Row label="Subtotal" value={formatCents(totals.itemsSubtotal)} />
                  {totals.discountTotal > 0 && <Row label="Discount" value={`−${formatCents(totals.discountTotal)}`} accent />}
                  <Row label="Net" value={formatCents(totals.netTotal)} dim />
                  {totals.taxSummary.map((t) => (
                    <Row key={t.rateBps} label={`VAT ${ratePct(t.rateBps)}`} value={formatCents(t.vat)} dim />
                  ))}
                  <Divider my="xs" />
                  <Group justify="space-between">
                    <Text fw={700}>Total</Text>
                    <Text fw={700} fz="lg">{formatCents(totals.grossTotal)}</Text>
                  </Group>
                  <Text c="dimmed" fz="xs">VAT included. Shipping calculated at checkout.</Text>
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
