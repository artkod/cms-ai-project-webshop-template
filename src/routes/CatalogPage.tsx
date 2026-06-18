import { useCallback } from "react";
import { Link, useParams } from "react-router";
import { Anchor, Badge, Group, Stack, Text, Title } from "@mantine/core";
import type { ProductListParams } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useLocaleConfig } from "@/lib/locale";
import { CatalogBrowser, type CatalogFetchResult } from "@/components/shop/CatalogBrowser";
import { useCategoryTree, childCategories, categoryHref } from "@/components/shop/catalogUrls";

// Main storefront catalog (/shop) — search + facet filters + sort over the public
// catalog read API (L2.2–L2.5). The product cards link to each product's real
// canonical URL (resolved by the by-slug commerce resolver), not the /shop/:id
// shortcut. Top-level categories link to their canonical landing pages (CategoryPage).
export function CatalogPage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const categories = useCategoryTree(loc);
  const topCategories = childCategories(null, categories);

  const fetchPage = useCallback(
    async (params: ProductListParams): Promise<CatalogFetchResult> => {
      const r = await storefront.listProducts({ ...params, locale: loc });
      return { data: r.data, total: r.total, facets: r.facets };
    },
    [loc],
  );

  return (
    <Stack gap="lg">
      <Title order={1}>Shop</Title>

      {topCategories.length > 0 && (
        <Group gap="xs">
          <Text fz="sm" c="dimmed" mr={4}>
            Browse:
          </Text>
          {topCategories.map((c) => {
            const href = categoryHref(loc, c.id, categories);
            return href ? (
              <Anchor key={c.id} component={Link} to={href} underline="never">
                <Badge variant="light" color="teal" style={{ cursor: "pointer" }}>
                  {c.label}
                </Badge>
              </Anchor>
            ) : null;
          })}
        </Group>
      )}

      <CatalogBrowser locale={loc} categories={categories} showCategoryFacet fetchPage={fetchPage} />
    </Stack>
  );
}
