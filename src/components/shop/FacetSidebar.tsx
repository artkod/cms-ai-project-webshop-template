import { Anchor, Box, Checkbox, Group, NumberInput, Radio, Stack, Text } from "@mantine/core";
import type { SearchFacets } from "@cms/storefront";
import type { CategoryMap } from "./catalogUrls";

// ─────────────────────────────────────────────────────────────────────────────
// Facet filter sidebar (L4.6 — the UI for the L2.3 faceted search).
//
// Renders the available refinements (category / type / option / price / in-stock)
// from the API's `facets` payload. Per the search provider, facet COUNTS reflect
// the whole text+active set BEFORE the facet filters, so the lists stay stable as
// you refine (the standard "available refinements" model) — the grid narrows, the
// options don't disappear. `category` + `type` are single-select (the API params
// are single-valued); option axes are multi-select (OR within an axis).
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogFilters {
  /** Category id (only meaningful when `showCategoryFacet` — a category landing locks its own category). */
  category: string | null;
  type: string | null;
  options: Record<string, string[]>;
  minPrice: number | null; // EUR cents
  maxPrice: number | null; // EUR cents
  inStock: boolean;
}

export const EMPTY_FILTERS: CatalogFilters = {
  category: null,
  type: null,
  options: {},
  minPrice: null,
  maxPrice: null,
  inStock: false,
};

export function hasActiveFilters(f: CatalogFilters): boolean {
  return (
    f.category != null ||
    f.type != null ||
    f.minPrice != null ||
    f.maxPrice != null ||
    f.inStock ||
    Object.values(f.options).some((v) => v.length > 0)
  );
}

const TYPE_LABELS: Record<string, string> = {
  physical: "Physical",
  digital: "Digital",
  service: "Service",
};

function centsToEuro(c: number | null): number | "" {
  return c == null ? "" : c / 100;
}
function euroToCents(v: number | string): number | null {
  if (v === "" || v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function FacetSidebar({
  facets,
  filters,
  onChange,
  categories,
  showCategoryFacet,
}: {
  facets: SearchFacets;
  filters: CatalogFilters;
  onChange: (next: CatalogFilters) => void;
  categories: CategoryMap;
  showCategoryFacet: boolean;
}) {
  const set = (partial: Partial<CatalogFilters>) => onChange({ ...filters, ...partial });

  const toggleOption = (axis: string, value: string, checked: boolean) => {
    const cur = filters.options[axis] ?? [];
    const next = checked ? [...cur, value] : cur.filter((v) => v !== value);
    const options = { ...filters.options };
    if (next.length) options[axis] = next;
    else delete options[axis];
    set({ options });
  };

  const showCategories = showCategoryFacet && facets.categories.length > 0;
  const showTypes = facets.types.length > 1; // a single type isn't a useful refinement
  const showOptions = facets.options.length > 0;
  const active = hasActiveFilters(filters);

  return (
    <Box w={240} style={{ flexShrink: 0 }}>
      <Group justify="space-between" mb="sm">
        <Text fw={700} fz="sm" tt="uppercase" c="dimmed">
          Filters
        </Text>
        {active && (
          <Anchor component="button" type="button" fz="xs" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear all
          </Anchor>
        )}
      </Group>

      <Stack gap="lg">
        {showCategories && (
          <Box>
            <Text fw={600} fz="sm" mb={6}>
              Category
            </Text>
            <Radio.Group
              value={filters.category ?? ""}
              onChange={(v) => set({ category: v || null })}
            >
              <Stack gap={6}>
                <Radio value="" label="All categories" size="xs" />
                {facets.categories.map((c) => (
                  <Radio
                    key={c.categoryId}
                    value={c.categoryId}
                    size="xs"
                    label={
                      <Group gap={6} wrap="nowrap">
                        <span>{categories.get(c.categoryId)?.label ?? "Category"}</span>
                        <Text component="span" c="dimmed" fz="xs">
                          ({c.count})
                        </Text>
                      </Group>
                    }
                  />
                ))}
              </Stack>
            </Radio.Group>
          </Box>
        )}

        {showTypes && (
          <Box>
            <Text fw={600} fz="sm" mb={6}>
              Type
            </Text>
            <Radio.Group value={filters.type ?? ""} onChange={(v) => set({ type: v || null })}>
              <Stack gap={6}>
                <Radio value="" label="All types" size="xs" />
                {facets.types.map((t) => (
                  <Radio
                    key={t.type}
                    value={t.type}
                    size="xs"
                    label={
                      <Group gap={6} wrap="nowrap">
                        <span>{TYPE_LABELS[t.type] ?? t.type}</span>
                        <Text component="span" c="dimmed" fz="xs">
                          ({t.count})
                        </Text>
                      </Group>
                    }
                  />
                ))}
              </Stack>
            </Radio.Group>
          </Box>
        )}

        {showOptions &&
          facets.options.map((axis) => (
            <Box key={axis.name}>
              <Text fw={600} fz="sm" mb={6}>
                {axis.name}
              </Text>
              <Stack gap={6}>
                {axis.values.map((val) => {
                  const checked = (filters.options[axis.name] ?? []).includes(val.value);
                  return (
                    <Checkbox
                      key={val.value}
                      size="xs"
                      checked={checked}
                      onChange={(e) => toggleOption(axis.name, val.value, e.currentTarget.checked)}
                      label={
                        <Group gap={6} wrap="nowrap">
                          <span>{val.value}</span>
                          <Text component="span" c="dimmed" fz="xs">
                            ({val.count})
                          </Text>
                        </Group>
                      }
                    />
                  );
                })}
              </Stack>
            </Box>
          ))}

        <Box>
          <Text fw={600} fz="sm" mb={6}>
            Price (€)
          </Text>
          <Group gap="xs" grow wrap="nowrap">
            <NumberInput
              size="xs"
              placeholder={facets.priceRange ? String(facets.priceRange.min / 100) : "Min"}
              min={0}
              value={centsToEuro(filters.minPrice)}
              onChange={(v) => set({ minPrice: euroToCents(v) })}
              hideControls
            />
            <NumberInput
              size="xs"
              placeholder={facets.priceRange ? String(facets.priceRange.max / 100) : "Max"}
              min={0}
              value={centsToEuro(filters.maxPrice)}
              onChange={(v) => set({ maxPrice: euroToCents(v) })}
              hideControls
            />
          </Group>
        </Box>

        <Checkbox
          size="xs"
          checked={filters.inStock}
          onChange={(e) => set({ inStock: e.currentTarget.checked })}
          label={
            <Group gap={6} wrap="nowrap">
              <span>In stock only</span>
              <Text component="span" c="dimmed" fz="xs">
                ({facets.inStock})
              </Text>
            </Group>
          }
        />
      </Stack>
    </Box>
  );
}
