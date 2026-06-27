import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Anchor, Badge, Box, Breadcrumbs, Button, Group, Image, Loader, NumberInput, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CatalogProduct, CatalogVariant } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useLocaleConfig, usePageAlternates } from "@/lib/locale";
import { useCart } from "@/lib/cart";
import { formatCents } from "@/lib/money";
import { useDocumentSeo, useJsonLd } from "@/lib/seo";
import { useCategoryTree, categoryChain, categoryHref } from "@/components/shop/catalogUrls";
import { WishlistButton } from "@/components/shop/WishlistButton";

// Find the variant matching the current option selection (all axes chosen). For a
// simple product (no options) the lone variant is always returned.
function findVariant(product: CatalogProduct, selection: Record<string, string>): CatalogVariant | undefined {
  if (product.options.length === 0) return product.variants[0];
  return product.variants.find((v) => product.options.every((o) => v.optionValues[o.id] === selection[o.id]));
}

// Product detail page. Reached two ways: standalone via `/shop/:idOrSlug` (fetches
// by id/slug), or through the by-slug commerce resolver at the product's REAL
// canonical URL, where PageView passes the already-resolved product as a prop.
export function ProductPage({ product: productProp }: { product?: CatalogProduct } = {}) {
  const { locale, idOrSlug } = useParams<{ locale: string; idOrSlug: string }>();
  const { defaultLocale, settings } = useLocaleConfig();
  const { setAlternates } = usePageAlternates();
  const loc = locale ?? defaultLocale;
  const { add } = useCart();
  const categories = useCategoryTree(loc);

  const [product, setProduct] = useState<CatalogProduct | null | "404">(productProp ?? null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  // Seed the option selection from the first variant so a valid variant is always
  // chosen (and the price/availability block renders immediately).
  function seedSelection(p: CatalogProduct) {
    const seed: Record<string, string> = {};
    const first = p.variants[0];
    if (first) for (const o of p.options) seed[o.id] = first.optionValues[o.id];
    setSelection(seed);
  }

  useEffect(() => {
    setQty(1);
    if (productProp) {
      setProduct(productProp);
      seedSelection(productProp);
      return;
    }
    let alive = true;
    setProduct(null);
    storefront
      .getProduct(idOrSlug!, { locale: loc })
      .then((p) => {
        if (!alive) return;
        setProduct(p);
        seedSelection(p);
      })
      .catch(() => alive && setProduct("404"));
    return () => {
      alive = false;
    };
  }, [idOrSlug, loc, productProp]);

  const resolved = product && product !== "404" ? product : null;

  // SEO + JSON-LD (schema.org/Product, ready-made by the catalog API — L2.5).
  useDocumentSeo(
    resolved
      ? {
          title: resolved.name,
          metaTitle: resolved.metaTitle,
          metaDescription: resolved.metaDescription || resolved.shortDescription,
          ogImageUrl: resolved.ogImage?.cdnUrl || resolved.gallery[0]?.cdnUrl,
        }
      : null,
    settings,
  );
  useJsonLd(resolved?.jsonLd ?? null);

  // Per-locale alternates for the language switcher — a product resolves by its
  // last URL segment, so `/{loc}/{slug}` reaches it in another language.
  useEffect(() => {
    if (!resolved) return;
    const alt: Record<string, { active: boolean; slug: string }> = {};
    for (const [l, a] of Object.entries(resolved.alternates ?? {})) alt[l] = { active: true, slug: a.slug };
    setAlternates(Object.keys(alt).length ? alt : null);
    return () => setAlternates(null);
  }, [resolved, setAlternates]);

  const variant = useMemo(() => (resolved ? findVariant(resolved, selection) : undefined), [resolved, selection]);

  if (product === null) return <Loader />;
  if (product === "404") {
    return (
      <Stack>
        <Title order={2}>Product not found</Title>
        <Anchor component={Link} to={`/${loc}/shop`}>
          ← Back to shop
        </Anchor>
      </Stack>
    );
  }

  const onAdd = async () => {
    if (!variant) return;
    setAdding(true);
    const ok = await add(variant.id, qty);
    setAdding(false);
    // Only confirm on success — on an out-of-stock/unavailable error the cart already
    // showed the error toast (no double toast).
    if (ok) notifications.show({ color: "teal", message: `Added ${qty} × ${product.name} to cart.` });
  };

  // Breadcrumb from the primary category's slug chain (canonical links).
  const chain = product.primaryCategoryId ? categoryChain(product.primaryCategoryId, categories) : [];
  const crumbs = [
    <Anchor key="shop" component={Link} to={`/${loc}/shop`} fz="sm">
      Shop
    </Anchor>,
    ...chain.map((c) => {
      const href = categoryHref(loc, c.id, categories);
      return href ? (
        <Anchor key={c.id} component={Link} to={href} fz="sm">
          {c.label}
        </Anchor>
      ) : (
        <Text key={c.id} fz="sm" c="dimmed">
          {c.label}
        </Text>
      );
    }),
    <Text key="self" fz="sm" c="dimmed">
      {product.name}
    </Text>,
  ];

  return (
    <Stack gap="lg">
      <Breadcrumbs separator="›">{crumbs}</Breadcrumbs>
      <Group align="flex-start" gap="xl" wrap="wrap">
        <Box style={{ flex: "1 1 320px", maxWidth: 460 }}>
          <Box style={{ aspectRatio: "1 / 1", background: "var(--mantine-color-gray-1)", borderRadius: 8, overflow: "hidden" }}>
            {product.gallery[0] ? (
              <Image src={product.gallery[0].cdnUrl} alt={product.name} h="100%" w="100%" fit="cover" />
            ) : (
              <Group justify="center" align="center" h="100%">
                <Text c="dimmed">No image</Text>
              </Group>
            )}
          </Box>
        </Box>

        <Stack gap="md" style={{ flex: "1 1 320px" }}>
          <Title order={1}>{product.name}</Title>
          {product.shortDescription && <Text c="dimmed">{product.shortDescription}</Text>}

          {product.options.map((o) => (
            <div key={o.id}>
              <Text fw={600} fz="sm" mb={4}>
                {o.name}
              </Text>
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
                <Text fz="xl" fw={700}>
                  {formatCents(variant.effectivePrice)}
                </Text>
                {variant.onSale && variant.compareAt && (
                  <Text c="dimmed" td="line-through">
                    {formatCents(variant.compareAt)}
                  </Text>
                )}
                {variant.onSale && <Badge color="red">Sale</Badge>}
              </Group>
              <Group gap="xs">
                {variant.inStock ? (
                  <Badge color="teal" variant="light">
                    In stock{variant.available !== null ? ` (${variant.available})` : ""}
                  </Badge>
                ) : variant.sellable ? (
                  <Badge color="yellow" variant="light">
                    Available on backorder
                  </Badge>
                ) : (
                  <Badge color="gray" variant="light">
                    Out of stock
                  </Badge>
                )}
                {variant.sku && (
                  <Text c="dimmed" fz="xs">
                    SKU: {variant.sku}
                  </Text>
                )}
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
                <Button onClick={onAdd} loading={adding} disabled={!variant.sellable}>
                  Add to cart
                </Button>
                <WishlistButton productId={product.id} mode="button" />
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
