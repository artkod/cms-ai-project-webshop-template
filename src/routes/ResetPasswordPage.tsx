import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Alert, Anchor, Button, Group, Loader, Stack, Text, TextInput, Title } from "@mantine/core";
import { XCircle } from "lucide-react";
import { storefront } from "@/lib/storefront";
import { useCustomer } from "@/lib/customer";
import { useLocaleConfig, useStrings } from "@/lib/locale";

// ─────────────────────────────────────────────────────────────────────────────
// Password-reset landing page (Phase L5.2). The reset email links to
// /{locale}/account/reset-password/:token. We look the token up first (to render
// the email + validate it), then let the user set a new password. A successful
// reset auto-logs-in (and marks the email verified server-side), so we redirect
// to the account page.
// ─────────────────────────────────────────────────────────────────────────────

export function ResetPasswordPage() {
  const { locale, token } = useParams<{ locale: string; token: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const navigate = useNavigate();
  const { t } = useStrings();
  const { resetPassword } = useCustomer();

  const [lookup, setLookup] = useState<"pending" | "valid" | "invalid">("pending");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const match = password === confirm;
  const canSubmit = password.length >= 8 && match;

  useEffect(() => {
    if (!token) {
      setLookup("invalid");
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const info = await storefront.getTokenInfo(token);
        if (!alive) return;
        if (info.type !== "reset") {
          setLookup("invalid");
          return;
        }
        setEmail(info.email);
        setLookup("valid");
      } catch {
        if (alive) setLookup("invalid");
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const onSubmit = async () => {
    if (!token) return;
    setBusy(true);
    const ok = await resetPassword(token, password);
    setBusy(false);
    if (ok) navigate(`/${loc}/account`);
  };

  return (
    <Stack maw={440} mx="auto" gap="lg" py="xl">
      <Title order={2}>{t("shop.auth.chooseNewPassword")}</Title>

      {lookup === "pending" && (
        <Group gap="sm">
          <Loader size="sm" />
          <Text c="dimmed">{t("shop.auth.checkingLink")}</Text>
        </Group>
      )}

      {lookup === "invalid" && (
        <Alert color="red" variant="light" icon={<XCircle size={18} />} title={t("shop.auth.linkInvalidTitle")}>
          <Stack gap="sm" align="flex-start">
            <Text fz="sm">{t("shop.auth.resetLinkInvalid")}</Text>
            <Anchor component={Link} to={`/${loc}/account/forgot-password`} fz="sm">{t("shop.auth.requestNewLink")}</Anchor>
          </Stack>
        </Alert>
      )}

      {lookup === "valid" && (
        <Stack>
          <Text c="dimmed" fz="sm">{t("shop.auth.settingPasswordFor")} <b>{email}</b>.</Text>
          <TextInput
            label={t("shop.auth.newPassword")}
            type="password"
            description={t("shop.auth.atLeast8")}
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            autoComplete="new-password"
          />
          <TextInput
            label={t("shop.auth.confirmPassword")}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.currentTarget.value)}
            autoComplete="new-password"
            error={confirm.length > 0 && !match ? t("shop.auth.passwordsDontMatch") : undefined}
          />
          <Button onClick={() => void onSubmit()} loading={busy} disabled={!canSubmit}>
            {t("shop.auth.setNewPassword")}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
