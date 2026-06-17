import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Anchor, Badge, Box, Button, Card, Group, Image, Loader, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type { ProductCard } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useLocaleConfig } from "@/lib/locale";
import { formatCents } from "@/lib/money";

// Storefront catalog grid (reads the public /api/commerce/catalog/products via the
// SDK). Cards link to the product detail page where you pick a variant + add to
// cart. Only active, locale-named products come back (design §17).
export function CatalogPage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const [products, setProducts] = useState<ProductCard[] | null>(null);

  useEffect(() => {
    let alive = true;
    setProducts(null);
    storefront
      .listProducts({ locale: loc, limit: 48, sort: "newest" })
      .then((r) => alive && setProducts(r.data))
      .catch(() => alive && setProducts([]));
    return () => {
      alive = false;
    };
  }, [loc]);

  if (products === null) return <Loader />;

  return (
    <Stack gap="lg">
      <Title order={1}>Shop</Title>
      {products.length === 0 ? (
        <Text c="dimmed">No products yet — create an active product (with a name in this language) in the admin.</Text>
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, md: 4 }} spacing="lg">
          {products.map((p) => (
            <Card key={p.id} component={Link} to={`/${loc}/shop/${p.slug || p.id}`} withBorder padding="md" radius="md" style={{ textDecoration: "none" }}>
              <Card.Section>
                <Box style={{ aspectRatio: "1 / 1", background: "var(--mantine-color-gray-1)" }}>
                  {p.image ? (
                    <Image src={p.image.cdnUrl} alt={p.name} h="100%" w="100%" fit="cover" />
                  ) : (
                    <Group justify="center" align="center" h="100%">
                      <Text c="dimmed" fz="sm">No image</Text>
                    </Group>
                  )}
                </Box>
              </Card.Section>
              <Stack gap={4} mt="sm">
                <Text fw={600} lineClamp={2} c="dark">{p.name}</Text>
                <Group gap="xs" align="baseline">
                  <Text fw={700}>{formatCents(p.price)}</Text>
                  {p.priceMax > p.price && <Text c="dimmed" fz="sm">– {formatCents(p.priceMax)}</Text>}
                  {p.onSale && p.compareAt && (
                    <Text c="dimmed" fz="sm" td="line-through">{formatCents(p.compareAt)}</Text>
                  )}
                </Group>
                <Group gap="xs">
                  {p.onSale && <Badge color="red" size="sm">Sale</Badge>}
                  {p.inStock ? <Badge color="teal" variant="light" size="sm">In stock</Badge> : p.sellable ? <Badge color="yellow" variant="light" size="sm">Backorder</Badge> : <Badge color="gray" variant="light" size="sm">Out of stock</Badge>}
                </Group>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}
      <Anchor component={Link} to={`/${loc}/cart`} fz="sm">Go to cart →</Anchor>
    </Stack>
  );
}
