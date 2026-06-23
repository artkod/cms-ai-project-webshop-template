import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Alert, Anchor, Button, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { CheckCircle2, XCircle } from "lucide-react";
import { useCustomer } from "@/lib/customer";
import { useLocaleConfig } from "@/lib/locale";

// ─────────────────────────────────────────────────────────────────────────────
// Email-verification landing page (Phase L5.2). The verification email links to
// /{locale}/account/verify-email/:token. We consume the token on mount (no login
// required — it's token-authed). On success the account is verified; if the user
// is logged in here, the provider refreshes `me` so the badge flips.
// ─────────────────────────────────────────────────────────────────────────────

export function VerifyEmailPage() {
  const { locale, token } = useParams<{ locale: string; token: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const { verifyEmail } = useCustomer();
  const [state, setState] = useState<"pending" | "ok" | "error">("pending");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !token) return;
    ran.current = true; // StrictMode double-invoke guard (token is single-use)
    void (async () => {
      const ok = await verifyEmail(token);
      setState(ok ? "ok" : "error");
    })();
  }, [token, verifyEmail]);

  return (
    <Stack maw={480} mx="auto" gap="lg" py="xl">
      <Title order={2}>Email verification</Title>

      {state === "pending" && (
        <Group gap="sm">
          <Loader size="sm" />
          <Text c="dimmed">Verifying your email…</Text>
        </Group>
      )}

      {state === "ok" && (
        <Alert color="teal" variant="light" icon={<CheckCircle2 size={18} />} title="Email verified">
          <Stack gap="sm" align="flex-start">
            <Text fz="sm">Thanks! Your email address is confirmed and your account features are unlocked.</Text>
            <Button component={Link} to={`/${loc}/account`} size="sm">Go to my account</Button>
          </Stack>
        </Alert>
      )}

      {state === "error" && (
        <Alert color="red" variant="light" icon={<XCircle size={18} />} title="Couldn't verify">
          <Stack gap="sm" align="flex-start">
            <Text fz="sm">
              This verification link is invalid or has expired. Sign in and request a fresh link from your account page.
            </Text>
            <Anchor component={Link} to={`/${loc}/account`} fz="sm">Go to my account</Anchor>
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}
