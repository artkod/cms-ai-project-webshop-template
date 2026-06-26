import { Link } from "react-router";
import { Badge, Box, Card, Group, Image, SimpleGrid, Stack, Text } from "@mantine/core";
import type { ProductCard } from "@cms/storefront";
import { formatCents } from "@/lib/money";
import { productHref, type CategoryMap } from "./catalogUrls";
import { WishlistButton } from "./WishlistButton";

// Product card grid. Each card links to the product's REAL canonical URL (resolved
// by the by-slug commerce resolver), built from the category tree + primary
// category. Prices are B2C gross (the same `presentVariant` math the admin shows).
export function ProductGrid({
  locale,
  products,
  categories,
}: {
  locale: string;
  products: ProductCard[];
  categories: CategoryMap;
}) {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, sm: 2, md: 3 }} spacing="lg">
      {products.map((p) => (
        <Card
          key={p.id}
          component={Link}
          to={productHref(locale, p, categories)}
          withBorder
          padding="md"
          radius="md"
          style={{ textDecoration: "none" }}
        >
          <Card.Section style={{ position: "relative" }}>
            <Box style={{ aspectRatio: "1 / 1", background: "var(--mantine-color-gray-1)" }}>
              {p.image ? (
                <Image src={p.image.cdnUrl} alt={p.name} h="100%" w="100%" fit="cover" />
              ) : (
                <Group justify="center" align="center" h="100%">
                  <Text c="dimmed" fz="sm">
                    No image
                  </Text>
                </Group>
              )}
            </Box>
            <Box style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}>
              <WishlistButton productId={p.id} mode="overlay" />
            </Box>
          </Card.Section>
          <Stack gap={4} mt="sm">
            <Text fw={600} lineClamp={2} c="dark">
              {p.name}
            </Text>
            <Group gap="xs" align="baseline">
              {/* Show only the current price — no struck-through "was" price and no
                  price-range max (user preference, L5.5). */}
              <Text fw={700}>{formatCents(p.price)}</Text>
            </Group>
            <Group gap="xs">
              {p.onSale && (
                <Badge color="red" size="sm">
                  Sale
                </Badge>
              )}
              {p.inStock ? (
                <Badge color="teal" variant="light" size="sm">
                  In stock
                </Badge>
              ) : p.sellable ? (
                <Badge color="yellow" variant="light" size="sm">
                  Backorder
                </Badge>
              ) : (
                <Badge color="gray" variant="light" size="sm">
                  Out of stock
                </Badge>
              )}
            </Group>
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  );
}
