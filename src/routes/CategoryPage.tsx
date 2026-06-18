import { useCallback } from "react";
import { Link, useParams } from "react-router";
import { Anchor, Badge, Box, Breadcrumbs, Group, Stack, Text, Title } from "@mantine/core";
import type { ProductListParams } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useLocaleConfig } from "@/lib/locale";
import { useDocumentSeo, useJsonLd } from "@/lib/seo";
import { CatalogBrowser, type CatalogFetchResult } from "@/components/shop/CatalogBrowser";
import { useCategoryTree } from "@/components/shop/catalogUrls";
import type { CommerceCategoryRoute } from "@/lib/api";

// Category landing page (L4.6) — reached at the category's REAL canonical URL via
// the by-slug commerce resolver (L2.5). PageView passes the resolved category
// metadata (category + breadcrumb + children) inline; this page renders the
// breadcrumb + subcategory links and a faceted, sorted product grid scoped to the
// category (the products themselves come from `getCategory`, which also carries
// the per-category facets).
export function CategoryPage({ landing }: { landing: CommerceCategoryRoute }) {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale, settings } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const categories = useCategoryTree(loc);
  const { category, breadcrumb, children } = landing;

  // The category's own slug chain (root→self) — used to build the canonical URLs
  // of its breadcrumb ancestors + its subcategories, straight from the resolved
  // payload (no dependency on the tree fetch, so the header renders immediately).
  const selfSlugs = breadcrumb.map((b) => b.slug);
  const chainComplete = selfSlugs.every((s): s is string => !!s);
  const hrefForDepth = (depth: number): string | null => {
    const segs = selfSlugs.slice(0, depth + 1);
    return segs.every((s): s is string => !!s) ? `/${loc}/${segs.join("/")}` : null;
  };

  useDocumentSeo(
    {
      title: category.label,
      metaTitle: category.metaTitle,
      metaDescription: category.metaDescription || category.description,
      ogImageUrl: category.heroImage?.cdnUrl,
    },
    settings,
  );
  useJsonLd(landing.jsonLd);

  const fetchPage = useCallback(
    async (params: ProductListParams): Promise<CatalogFetchResult> => {
      const r = await storefront.getCategory(category.id, { ...params, locale: loc });
      return { data: r.products, total: r.total, facets: r.facets };
    },
    [category.id, loc],
  );

  const crumbs = [
    <Anchor key="shop" component={Link} to={`/${loc}/shop`} fz="sm">
      Shop
    </Anchor>,
    ...breadcrumb.map((b, i) => {
      const isSelf = i === breadcrumb.length - 1;
      const href = isSelf ? null : hrefForDepth(i);
      return href ? (
        <Anchor key={b.id} component={Link} to={href} fz="sm">
          {b.label}
        </Anchor>
      ) : (
        <Text key={b.id} fz="sm" c="dimmed">
          {b.label}
        </Text>
      );
    }),
  ];

  return (
    <Stack gap="lg">
      <Breadcrumbs separator="›">{crumbs}</Breadcrumbs>

      <Box>
        <Title order={1}>{category.label}</Title>
        {category.description && (
          <Text c="dimmed" mt="xs" maw={720}>
            {category.description}
          </Text>
        )}
      </Box>

      {children.length > 0 && chainComplete && (
        <Group gap="xs">
          <Text fz="sm" c="dimmed" mr={4}>
            Subcategories:
          </Text>
          {children.map((c) =>
            c.slug ? (
              <Anchor
                key={c.id}
                component={Link}
                to={`/${loc}/${[...selfSlugs, c.slug].join("/")}`}
                underline="never"
              >
                <Badge variant="light" color="teal" style={{ cursor: "pointer" }}>
                  {c.label}
                </Badge>
              </Anchor>
            ) : null,
          )}
        </Group>
      )}

      <CatalogBrowser locale={loc} categories={categories} showCategoryFacet={false} fetchPage={fetchPage} />
    </Stack>
  );
}
