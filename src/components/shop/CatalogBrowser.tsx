import { useEffect, useState } from "react";
import {
  Box,
  CloseButton,
  Group,
  Loader,
  Pagination,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { Search } from "lucide-react";
import type { CatalogSort, ProductListParams, ProductCard, SearchFacets } from "@cms/storefront";
import { ProductGrid } from "./ProductGrid";
import { FacetSidebar, EMPTY_FILTERS, type CatalogFilters } from "./FacetSidebar";
import type { CategoryMap } from "./catalogUrls";

// ─────────────────────────────────────────────────────────────────────────────
// Shared catalog browser (L4.6) — the search box + facet sidebar + sort control +
// paginated product grid. Powers both the main /shop listing (`listProducts`) and
// every category landing (`getCategory`), which differ only in their fetch fn and
// whether the category facet is shown. All filtering/sorting/relevance runs on the
// server (L2.2–L2.4); this component just wires the query + renders what comes back.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 24;

const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low → high" },
  { value: "price_desc", label: "Price: high → low" },
  { value: "name_asc", label: "Name: A → Z" },
  { value: "name_desc", label: "Name: Z → A" },
];

export interface CatalogFetchResult {
  data: ProductCard[];
  total: number;
  facets: SearchFacets;
}

export function CatalogBrowser({
  locale,
  categories,
  showCategoryFacet,
  fetchPage,
}: {
  locale: string;
  categories: CategoryMap;
  showCategoryFacet: boolean;
  fetchPage: (params: ProductListParams) => Promise<CatalogFetchResult>;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [sort, setSort] = useState<CatalogSort>("newest");
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<CatalogFetchResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Any change to the query (text / sort / filters) returns to the first page.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sort, filters]);

  // Re-run the search whenever the query, filters, or page change. `fetchPage` is
  // memoized by the parent so it only changes with the locale/category scope. The
  // controller aborts the in-flight request when a newer one supersedes it.
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setLoading(true);
    const params: ProductListParams = {
      locale,
      q: debouncedSearch.trim() || undefined,
      sort,
      category: showCategoryFacet ? filters.category ?? undefined : undefined,
      type: filters.type ?? undefined,
      options: Object.keys(filters.options).length ? filters.options : undefined,
      minPrice: filters.minPrice ?? undefined,
      maxPrice: filters.maxPrice ?? undefined,
      inStock: filters.inStock || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      signal: controller.signal,
    };
    fetchPage(params)
      .then((r) => {
        if (alive) {
          setResult(r);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setResult({ data: [], total: 0, facets: { categories: [], types: [], options: [], priceRange: null, inStock: 0 } });
          setLoading(false);
        }
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [locale, debouncedSearch, sort, filters, page, showCategoryFacet, fetchPage]);

  const facets: SearchFacets = result?.facets ?? { categories: [], types: [], options: [], priceRange: null, inStock: 0 };
  const total = result?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <TextInput
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          leftSection={<Search size={16} />}
          rightSection={search ? <CloseButton size="sm" onClick={() => setSearch("")} aria-label="Clear search" /> : null}
          w={320}
        />
        <Group gap="sm" wrap="nowrap">
          {!loading && (
            <Text c="dimmed" fz="sm">
              {total} {total === 1 ? "product" : "products"}
            </Text>
          )}
          <Select
            data={SORT_OPTIONS}
            value={sort}
            onChange={(v) => v && setSort(v as CatalogSort)}
            allowDeselect={false}
            w={190}
            aria-label="Sort products"
          />
        </Group>
      </Group>

      <Group align="flex-start" gap="xl" wrap="wrap">
        <FacetSidebar
          facets={facets}
          filters={filters}
          onChange={setFilters}
          categories={categories}
          showCategoryFacet={showCategoryFacet}
        />
        <Box style={{ flex: "1 1 420px", minWidth: 0 }}>
          {loading && !result ? (
            <Loader />
          ) : total === 0 ? (
            <Text c="dimmed" py="xl">
              No products match your filters.
            </Text>
          ) : (
            <Stack gap="lg" style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.15s" }}>
              <ProductGrid locale={locale} products={result!.data} categories={categories} />
              {pageCount > 1 && (
                <Group justify="center">
                  <Pagination total={pageCount} value={page} onChange={setPage} />
                </Group>
              )}
            </Stack>
          )}
        </Box>
      </Group>
    </Stack>
  );
}
