import { useEffect, useState } from "react";
import { Loader, Title, Text, Stack, Anchor, List } from "@mantine/core";
import { Link, useParams } from "react-router";
import { getPages, type Page } from "@/lib/api";
import { useLocaleConfig, usePageAlternates } from "@/lib/locale";
import { useDocumentSeo } from "@/lib/seo";

// Minimal homepage for the test project: site title + a list of published
// pages. The real storefront homepage is built in Phase L (L2+). Home has no
// per-page SEO, so we render the site-wide defaults and clear alternates.
export function HomePage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale, settings } = useLocaleConfig();
  const activeLocale = locale ?? defaultLocale;
  const { setAlternates } = usePageAlternates();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  useDocumentSeo(null, settings);

  useEffect(() => {
    setAlternates(null);
  }, [setAlternates, activeLocale]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getPages({ locale: activeLocale })
      .then((p) => {
        if (alive) setPages(p);
      })
      .catch(() => {
        if (alive) setPages([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [activeLocale]);

  const siteTitle = settings?.siteTitle || "Webshop Template";

  if (loading) return <Loader />;

  return (
    <Stack gap="lg">
      <div>
        <Title order={1}>{siteTitle}</Title>
        <Text c="dimmed" mt="xs">
          Webshop test project for the cms-ai-core commerce module. This is the stock CMS
          frontend; the storefront is built out in Phase L (L2+).
        </Text>
      </div>
      {pages.length > 0 ? (
        <div>
          <Title order={3} mb="sm">
            Pages
          </Title>
          <List spacing="xs">
            {pages.map((p) => (
              <List.Item key={p.id}>
                <Anchor component={Link} to={`/${activeLocale}/${p.slug}`}>
                  {p.title}
                </Anchor>
              </List.Item>
            ))}
          </List>
        </div>
      ) : (
        <Text c="dimmed">No published pages yet — create one in the admin.</Text>
      )}
    </Stack>
  );
}
