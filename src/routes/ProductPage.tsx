import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Anchor, Badge, Box, Button, Group, Image, Loader, NumberInput, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CatalogProduct, CatalogVariant } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useLocaleConfig } from "@/lib/locale";
import { useCart } from "@/lib/cart";
import { formatCents } from "@/lib/money";

// Find the variant matching the current option selection (all axes chosen). For a
// simple product (no options) the lone variant is always returned.
function findVariant(product: CatalogProduct, selection: Record<string, string>): CatalogVariant | undefined {
  if (product.options.length === 0) return product.variants[0];
  return product.variants.find((v) => product.options.every((o) => v.optionValues[o.id] === selection[o.id]));
}

export function ProductPage() {
  const { locale, idOrSlug } = useParams<{ locale: string; idOrSlug: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const { add } = useCart();

  const [product, setProduct] = useState<CatalogProduct | null | "404">(null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let alive = true;
    setProduct(null);
    storefront
      .getProduct(idOrSlug!, { locale: loc })
      .then((p) => {
        if (!alive) return;
        setProduct(p);
        // Seed the selection from the first variant so a valid variant is always chosen.
        const seed: Record<string, string> = {};
        const first = p.variants[0];
        if (first) for (const o of p.options) seed[o.id] = first.optionValues[o.id];
        setSelection(seed);
      })
      .catch(() => alive && setProduct("404"));
    return () => {
      alive = false;
    };
  }, [idOrSlug, loc]);

  const variant = useMemo(() => (product && product !== "404" ? findVariant(product, selection) : undefined), [product, selection]);

  if (product === null) return <Loader />;
  if (product === "404") {
    return (
      <Stack>
        <Title order={2}>Product not found</Title>
        <Anchor component={Link} to={`/${loc}/shop`}>← Back to shop</Anchor>
      </Stack>
    );
  }

  const onAdd = async () => {
    if (!variant) return;
    setAdding(true);
    await add(variant.id, qty);
    setAdding(false);
    notifications.show({ color: "teal", message: `Added ${qty} × ${product.name} to cart.` });
  };

  return (
    <Stack gap="lg">
      <Anchor component={Link} to={`/${loc}/shop`} fz="sm">← Back to shop</Anchor>
      <Group align="flex-start" gap="xl" wrap="wrap">
        <Box style={{ flex: "1 1 320px", maxWidth: 460 }}>
          <Box style={{ aspectRatio: "1 / 1", background: "var(--mantine-color-gray-1)", borderRadius: 8, overflow: "hidden" }}>
            {product.gallery[0] ? (
              <Image src={product.gallery[0].cdnUrl} alt={product.name} h="100%" w="100%" fit="cover" />
            ) : (
              <Group justify="center" align="center" h="100%"><Text c="dimmed">No image</Text></Group>
            )}
          </Box>
        </Box>

        <Stack gap="md" style={{ flex: "1 1 320px" }}>
          <Title order={1}>{product.name}</Title>
          {product.shortDescription && <Text c="dimmed">{product.shortDescription}</Text>}

          {product.options.map((o) => (
            <div key={o.id}>
              <Text fw={600} fz="sm" mb={4}>{o.name}</Text>
              <Group gap="xs">
                {o.values.map((val) => (
                  <Button
                    key={val.id}
                    size="xs"
                    variant={selection[o.id] === val.id ? "filled" : "default"}
                    onClick={() => setSelection((s) => ({ ...s, [o.id]: val.id }))}
                  >
                    {val.value}
                  </Button>
                ))}
              </Group>
            </div>
          ))}

          {variant ? (
            <>
              <Group gap="sm" align="baseline">
                <Text fz="xl" fw={700}>{formatCents(variant.effectivePrice)}</Text>
                {variant.onSale && variant.compareAt && <Text c="dimmed" td="line-through">{formatCents(variant.compareAt)}</Text>}
                {variant.onSale && <Badge color="red">Sale</Badge>}
              </Group>
              <Group gap="xs">
                {variant.inStock ? (
                  <Badge color="teal" variant="light">In stock{variant.available !== null ? ` (${variant.available})` : ""}</Badge>
                ) : variant.sellable ? (
                  <Badge color="yellow" variant="light">Available on backorder</Badge>
                ) : (
                  <Badge color="gray" variant="light">Out of stock</Badge>
                )}
                {variant.sku && <Text c="dimmed" fz="xs">SKU: {variant.sku}</Text>}
              </Group>
              <Group gap="sm" align="flex-end">
                <NumberInput
                  label="Quantity"
                  min={1}
                  max={variant.backorder || variant.available === null ? undefined : variant.available}
                  value={qty}
                  onChange={(v) => setQty(Math.max(1, Number(v) || 1))}
                  w={110}
                />
                <Button onClick={onAdd} loading={adding} disabled={!variant.sellable}>Add to cart</Button>
              </Group>
            </>
          ) : (
            <Text c="dimmed">Select all options to see price + availability.</Text>
          )}
        </Stack>
      </Group>
    </Stack>
  );
}
