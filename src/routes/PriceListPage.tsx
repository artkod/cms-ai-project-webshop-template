import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Alert, Anchor, Badge, Card, Container, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { Download, FileSpreadsheet } from "lucide-react";
import { type PricePublicationFile } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useLocaleConfig, useStrings } from "@/lib/locale";
import { formatIsoDate } from "@/lib/money";

// ─────────────────────────────────────────────────────────────────────────────
// /cjenik — the published machine-readable price list (DECISIONS 245).
//
// "Odluka o objavi cjenika proizvoda i usluga" (NN 101/2026-1213, in force
// 2026-10-01) obliges a trader with a website to publish its price list as a
// .csv/.xml file, refresh the products file every working day by 08:00, and keep
// every published file reachable for 30 days. The API generates and serves the
// files; this page is the human-facing index a shop can point an inspector at
// and the anchor a price-comparison crawler follows.
//
// TWO THINGS MUST NOT HAPPEN to this route or to /api/commerce/price-publications
// (see CLAUDE.md): they must not be excluded in robots.txt, and they must not sit
// behind a bot challenge — the decree explicitly requires automated collection to
// be possible ("obvezno omogućava uporabu softverskih alata i automatiziranih
// programa za prikupljanje podataka o cijenama").
// ─────────────────────────────────────────────────────────────────────────────

export function PriceListPage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const dateLocale = loc === "hr" ? "hr-HR" : "en-GB";
  const { t } = useStrings();

  const [files, setFiles] = useState<PricePublicationFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void storefront
      .listPricePublications()
      .then((rows) => { if (alive) setFiles(rows); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const groups: { key: "products" | "services"; label: string; rows: PricePublicationFile[] }[] = [
    { key: "products", label: t("shop.priceList.products"), rows: files.filter((f) => f.kind === "products") },
    { key: "services", label: t("shop.priceList.services"), rows: files.filter((f) => f.kind === "services") },
  ];

  return (
    <Container size={860} py="xl">
      <Stack gap="lg">
        <Stack gap={6}>
          <Title order={1} fz={28}>{t("shop.priceList.title")}</Title>
          <Text c="dimmed">{t("shop.priceList.intro")}</Text>
        </Stack>

        {loading && <Loader size="sm" />}
        {!loading && failed && <Alert color="red">{t("shop.priceList.failed")}</Alert>}
        {!loading && !failed && files.length === 0 && (
          <Alert color="gray">{t("shop.priceList.empty")}</Alert>
        )}

        {groups.map((g) =>
          g.rows.length === 0 ? null : (
            <Stack key={g.key} gap="xs">
              <Title order={2} fz="lg">{g.label}</Title>
              {g.rows.map((f) => (
                <Card key={f.id} withBorder padding="md">
                  <Group justify="space-between" wrap="wrap" gap="sm">
                    <Stack gap={2} style={{ minWidth: 0 }}>
                      <Group gap="xs">
                        <FileSpreadsheet size={16} />
                        {/* The file name is the decree's own (outlet, storage number,
                            timestamp) — shown verbatim, never shortened. */}
                        <Anchor href={f.url} style={{ wordBreak: "break-all", fontSize: 13 }}>
                          {f.filename}
                        </Anchor>
                      </Group>
                      <Text fz="xs" c="dimmed">
                        {t("shop.priceList.validFor").replace("{{date}}", formatIsoDate(f.forDate, dateLocale))}
                        {" · "}
                        {t("shop.priceList.rows").replace("{{n}}", String(f.rowCount))}
                      </Text>
                    </Stack>
                    <Anchor href={f.url} download>
                      <Badge variant="light" leftSection={<Download size={12} />}>
                        {f.format.toUpperCase()}
                      </Badge>
                    </Anchor>
                  </Group>
                </Card>
              ))}
            </Stack>
          )
        )}
      </Stack>
    </Container>
  );
}
