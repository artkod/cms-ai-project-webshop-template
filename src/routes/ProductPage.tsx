import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Anchor, Badge, Box, Breadcrumbs, Button, Group, Image, Loader, NumberInput, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { trackAddToCart, trackViewItem, type CatalogProduct, type CatalogVariant } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useLocaleConfig, usePageAlternates, useStrings } from "@/lib/locale";
import { useCart } from "@/lib/cart";
import { formatCents } from "@/lib/money";
import { useDocumentSeo, useJsonLd } from "@/lib/seo";
import { useCategoryTree, categoryChain, categoryHref } from "@/components/shop/catalogUrls";
import { WishlistButton } from "@/components/shop/WishlistButton";
import { ReviewsSection } from "@/components/shop/ReviewsSection";
import { BackInStockForm } from "@/components/shop/BackInStockForm";

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
  const { t } = useStrings();
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

  // GA4 view_item (L9.6) — consent-gated inside the SDK (drops silently pre-consent).
  useEffect(() => {
    if (!resolved) return;
    const first = resolved.variants[0];
    trackViewItem({ id: first?.id ?? resolved.id, name: resolved.name, priceCents: first?.effectivePrice ?? 0 });
  }, [resolved]);

  if (product === null) return <Loader />;
  if (product === "404") {
    return (
      <Stack>
        <Title order={2}>{t("shop.product.notFound")}</Title>
        <Anchor component={Link} to={`/${loc}/shop`}>
          {t("shop.product.backToShop")}
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
    if (ok) {
      trackAddToCart({ id: variant.id, name: product.name, priceCents: variant.effectivePrice, quantity: qty });
      notifications.show({ color: "teal", message: `${qty} × ${product.name} → ${product.purchasable ? t("shop.product.addedToCart") : t("shop.product.addedToInquiry")}` });
    }
  };

  // Breadcrumb from the primary category's slug chain (canonical links).
  const chain = product.primaryCategoryId ? categoryChain(product.primaryCategoryId, categories) : [];
  const crumbs = [
    <Anchor key="shop" component={Link} to={`/${loc}/shop`} fz="sm">
      {t("shop.nav.shop")}
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
                <Text c="dimmed">{t("shop.catalog.noImage")}</Text>
              </Group>
            )}
          </Box>
        </Box>

        <Stack gap="md" style={{ flex: "1 1 320px" }}>
          <Title order={1}>{product.name}</Title>
          {product.shortDescription && <Text c="dimmed">{product.shortDescription}</Text>}

          {/* Option axes as labelled groups of toggle buttons (aria-pressed) — the
              group's name is announced with each value (L9.6 a11y). */}
          {product.options.map((o) => (
            <div key={o.id} role="group" aria-label={o.label}>
              <Text fw={600} fz="sm" mb={4} aria-hidden>
                {o.label}
              </Text>
              <Group gap="xs">
                {o.values.map((val) => (
                  <Button
                    key={val.id}
                    size="xs"
                    variant={selection[o.id] === val.id ? "filled" : "default"}
                    aria-pressed={selection[o.id] === val.id}
                    aria-label={`${o.label}: ${val.label}`}
                    onClick={() => setSelection((s) => ({ ...s, [o.id]: val.id }))}
                  >
                    {val.label}
                  </Button>
                ))}
              </Group>
            </div>
          ))}

          {variant ? (
            <>
              {/* Inquiry-only products hide the price ("on request") — they're sold
                  via a quote, not direct checkout (L7.4). */}
              {product.purchasable ? (
                <Stack gap={2}>
                  <Group gap="sm" align="baseline">
                    <Text fz="xl" fw={700}>
                      {formatCents(variant.effectivePrice)}
                    </Text>
                    {/* On sale: strike the REGULAR list price (not the Omnibus low). */}
                    {variant.onSale && variant.price > variant.effectivePrice && (
                      <Text c="dimmed" td="line-through">
                        {formatCents(variant.price)}
                      </Text>
                    )}
                    {variant.onSale && <Badge color="red">{t("shop.badge.sale")}</Badge>}
                  </Group>
                  {/* EU Omnibus: the lowest price applied in the 30 days before this
                      reduction (compareAt), shown as an explicit labelled note. */}
                  {variant.compareAt != null && (
                    <Text fz="xs" c="dimmed">
                      {t("shop.product.lowestPrice")}: {formatCents(variant.compareAt)}
                    </Text>
                  )}
                </Stack>
              ) : (
                <Group gap="sm" align="center">
                  <Text fz="xl" fw={700} c="dimmed">{t("shop.product.priceOnRequest")}</Text>
                  <Badge color="blue" variant="light">{t("shop.badge.inquiryOnly")}</Badge>
                </Group>
              )}
              <Group gap="xs">
                {variant.inStock ? (
                  <Badge color="teal" variant="light">
                    {t("shop.product.inStockCount")}{variant.available !== null ? ` (${variant.available})` : ""}
                  </Badge>
                ) : variant.sellable ? (
                  <Badge color="yellow" variant="light">
                    {t("shop.badge.backorderAvailable")}
                  </Badge>
                ) : (
                  <Badge color="gray" variant="light">
                    {t("shop.badge.outOfStock")}
                  </Badge>
                )}
                {variant.sku && (
                  <Text c="dimmed" fz="xs">
                    {t("shop.product.sku")}: {variant.sku}
                  </Text>
                )}
              </Group>
              {/* Back-in-stock (L9.2): out of stock + no backorder → subscribe form. */}
              {!variant.sellable && <BackInStockForm productId={product.id} variantId={variant.id} locale={loc} />}
              <Group gap="sm" align="flex-end">
                <NumberInput
                  label={t("shop.product.quantity")}
                  min={1}
                  max={variant.backorder || variant.available === null ? undefined : variant.available}
                  value={qty}
                  onChange={(v) => setQty(Math.max(1, Number(v) || 1))}
                  w={110}
                />
                <Button onClick={onAdd} loading={adding} disabled={!variant.sellable}>
                  {product.purchasable ? t("shop.product.addToCart") : t("shop.product.addToInquiry")}
                </Button>
                <WishlistButton productId={product.id} mode="button" />
              </Group>
            </>
          ) : (
            <Text c="dimmed">{t("shop.product.selectOptions")}</Text>
          )}
        </Stack>
      </Group>

      {/* Reviews (L9.1): approved reviews + aggregate + verified-customer submit. */}
      <ReviewsSection productId={product.id} locale={loc} />
    </Stack>
  );
}
