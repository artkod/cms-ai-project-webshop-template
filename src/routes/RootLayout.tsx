import { useEffect, useState } from "react";
import { Container, Group, Anchor, Box, Text } from "@mantine/core";
import { Outlet, Link, useParams } from "react-router";
import { getMenu, type MenuItem } from "@/lib/api";
import { useLocaleConfig, PageAlternatesProvider, StringsProvider } from "@/lib/locale";
import { LanguageSwitcher } from "./LanguageSwitcher";

// Minimal shared layout for the test project: a header (site title + primary
// menu + language switcher), the routed content, and a footer (copyright +
// footer menu). The real storefront chrome (cart, search, etc.) is built in
// Phase L (L2+). Providers (alternates + strings) are kept so PageView /
// NotFound / LanguageSwitcher work unchanged.

function NavItem({ item }: { item: MenuItem }) {
  const href = item.url ?? "/";
  const external = item.target === "_blank" || href.startsWith("http");
  if (external) {
    return (
      <Anchor href={href} target="_blank" rel="noopener noreferrer">
        {item.label}
      </Anchor>
    );
  }
  return (
    <Anchor component={Link} to={href}>
      {item.label}
    </Anchor>
  );
}

export function RootLayout() {
  const { locale } = useParams<{ locale: string }>();
  const { settings, defaultLocale, availableLocales, setActiveLocale } = useLocaleConfig();
  const activeLocale = locale ?? defaultLocale;
  const [primaryItems, setPrimaryItems] = useState<MenuItem[]>([]);
  const [footerItems, setFooterItems] = useState<MenuItem[]>([]);

  // Tell the provider which locale to use for multilingual site settings.
  useEffect(() => {
    setActiveLocale(activeLocale);
  }, [activeLocale, setActiveLocale]);

  // Refetch menus whenever the active locale changes.
  useEffect(() => {
    getMenu("primary", activeLocale).then(setPrimaryItems).catch(() => setPrimaryItems([]));
    getMenu("footer", activeLocale).then(setFooterItems).catch(() => setFooterItems([]));
  }, [activeLocale]);

  // Favicon from site settings.
  useEffect(() => {
    if (!settings?.faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = settings.faviconUrl;
  }, [settings]);

  // Reflect active locale on <html lang> for accessibility & SEO.
  useEffect(() => {
    document.documentElement.lang = activeLocale;
  }, [activeLocale]);

  // Atom feed <link> tags — one per available locale for discovery tools.
  useEffect(() => {
    document.head.querySelectorAll("link[data-cms-feed='1']").forEach((el) => el.remove());
    for (const loc of availableLocales) {
      const link = document.createElement("link");
      link.rel = "alternate";
      link.type = "application/atom+xml";
      link.hreflang = loc;
      link.href = `/feed/${loc}.xml`;
      link.dataset.cmsFeed = "1";
      document.head.appendChild(link);
    }
  }, [availableLocales]);

  const siteTitle = settings?.siteTitle || "Webshop Template";
  const year = new Date().getFullYear();

  return (
    <PageAlternatesProvider>
      <StringsProvider locale={activeLocale}>
        <Box style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <Box component="header" style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
            <Container size={1140} py="md">
              <Group justify="space-between" wrap="nowrap">
                <Anchor component={Link} to={`/${activeLocale}/`} fw={700} fz="lg" underline="never" c="dark">
                  {siteTitle}
                </Anchor>
                <Group gap="lg" wrap="nowrap">
                  {primaryItems.map((item) => (
                    <NavItem key={item.id} item={item} />
                  ))}
                  <LanguageSwitcher />
                </Group>
              </Group>
            </Container>
          </Box>

          <Box component="main" style={{ flex: 1 }}>
            <Container size={1140} py="xl">
              <Outlet />
            </Container>
          </Box>

          <Box component="footer" style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
            <Container size={1140} py="lg">
              <Group justify="space-between" wrap="wrap" gap="md">
                <Text c="dimmed" fz="sm">
                  © {year} {siteTitle}.
                </Text>
                <Group gap="md">
                  {footerItems.map((item) => (
                    <NavItem key={item.id} item={item} />
                  ))}
                </Group>
              </Group>
            </Container>
          </Box>
        </Box>
      </StringsProvider>
    </PageAlternatesProvider>
  );
}
