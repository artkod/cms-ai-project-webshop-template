import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Alert, Anchor, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { Heart } from "lucide-react";
import type { CatalogProduct, ProductCard } from "@cms/storefront";
import { getLocalWishlist } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useLocaleConfig } from "@/lib/locale";
import { useCustomer } from "@/lib/customer";
import { useWishlist } from "@/lib/wishlist";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { useCategoryTree } from "@/components/shop/catalogUrls";

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist page (Phase L5.6) — the customer's saved products. Renders for both
// account (server-persisted) and guest (local) wishlists via the WishlistProvider.
// We fetch the cards once per (mode, locale) and then filter the display by the
// LIVE `ids` set, so removing an item (the heart on each card) hides it instantly
// without a refetch. The product cards carry the same heart overlay as the shop,
// so this page IS the remove UI.
// ─────────────────────────────────────────────────────────────────────────────

// A guest wishlist holds bare ids — resolve each product to a card-shaped object
// (mirrors the server's toCard so the grid renders identically).
function detailToCard(p: CatalogProduct): ProductCard {
  const prices = p.variants.map((v) => v.effectivePrice);
  const cheapest = p.variants.reduce<CatalogProduct["variants"][number] | undefined>(
    (best, v) => (best === undefined || v.effectivePrice < best.effectivePrice ? v : best),
    undefined,
  );
  return {
    id: p.id,
    type: p.type,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    image: p.gallery[0] ?? null,
    currency: "EUR",
    price: prices.length ? Math.min(...prices) : 0,
    priceMax: prices.length ? Math.max(...prices) : 0,
    compareAt: cheapest?.compareAt ?? null,
    onSale: p.variants.some((v) => v.onSale),
    inStock: p.variants.some((v) => v.inStock),
    sellable: p.variants.some((v) => v.sellable),
    variantCount: p.variants.length,
    primaryCategoryId: p.primaryCategoryId,
  };
}

export function WishlistPage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const { customer } = useCustomer();
  const { ids, persisted, ready } = useWishlist();
  const categories = useCategoryTree(loc);

  const [cards, setCards] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch cards once per (persisted, locale) — read the id snapshot fresh inside.
  // Display is then filtered by the live `ids` set (so removals reflect at once).
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        if (persisted) {
          const res = await storefront.getWishlist({ locale: loc });
          if (alive) setCards(res.products);
        } else {
          const current = getLocalWishlist();
          const resolved = await Promise.all(
            current.map((id) =>
              storefront
                .getProduct(id, { locale: loc })
                .then(detailToCard)
                .catch(() => null),
            ),
          );
          if (alive) setCards(resolved.filter((c): c is ProductCard => c !== null));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [ready, persisted, loc]);

  const display = cards.filter((c) => ids.includes(c.id));

  if (!ready || loading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  return (
    <Stack maw={1140} mx="auto" gap="lg">
      <Group justify="space-between" align="center">
        <Title order={2}>
          <Group gap="xs" align="center">
            <Heart size={24} /> Wishlist
          </Group>
        </Title>
        <Anchor component={Link} to={customer ? `/${loc}/account` : `/${loc}/shop`} fz="sm">
          {customer ? "← Back to account" : "← Continue shopping"}
        </Anchor>
      </Group>

      {/* Guest note — their wishlist is device-local until they sign in + verify. */}
      {!persisted && (
        <Alert color="blue" variant="light">
          Your wishlist is saved on this device.{" "}
          <Anchor component={Link} to={`/${loc}/account`}>
            Sign in
          </Anchor>{" "}
          (and verify your email) to keep it across devices.
        </Alert>
      )}

      {display.length === 0 ? (
        <Alert color="gray" variant="light" icon={<Heart size={18} />}>
          Your wishlist is empty. Tap the heart on any product to save it here.{" "}
          <Anchor component={Link} to={`/${loc}/shop`}>
            Browse the shop
          </Anchor>
          .
        </Alert>
      ) : (
        <>
          <Text c="dimmed" fz="sm">
            {display.length} saved item{display.length === 1 ? "" : "s"}
          </Text>
          <ProductGrid locale={loc} products={display} categories={categories} />
        </>
      )}
    </Stack>
  );
}
