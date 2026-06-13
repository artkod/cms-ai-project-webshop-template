import { Link, useParams } from "react-router";
import { Stack, Title, Text, Button } from "@mantine/core";
import { useLocaleConfig, useStrings } from "@/lib/locale";

export function NotFound() {
  const { locale: localeParam } = useParams<{ locale?: string }>();
  const { defaultLocale } = useLocaleConfig();
  const locale = localeParam ?? defaultLocale;
  const { t } = useStrings();
  const tx = (key: string, fb: string) => {
    const v = t(key);
    return v === key ? fb : v;
  };

  return (
    <Stack align="center" gap="md" py={60}>
      <Title order={1}>404</Title>
      <Text c="dimmed">{tx("notfound.text", "The page you’re looking for doesn’t exist.")}</Text>
      <Button component={Link} to={`/${locale}/`}>
        {tx("notfound.home", "Go home")}
      </Button>
    </Stack>
  );
}
