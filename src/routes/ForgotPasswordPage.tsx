import { useState } from "react";
import { Link, useParams } from "react-router";
import { Alert, Anchor, Button, Stack, Text, TextInput, Title } from "@mantine/core";
import { storefront } from "@/lib/storefront";
import { useLocaleConfig } from "@/lib/locale";

// ─────────────────────────────────────────────────────────────────────────────
// Forgot-password page (Phase L5.2). Posts the email to the anti-enumeration
// endpoint — the response is ALWAYS the same, so the page shows an identical
// "if an account exists, we've sent a link" confirmation whether or not the email
// is registered (never reveals account existence).
// ─────────────────────────────────────────────────────────────────────────────

export function ForgotPasswordPage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    setBusy(true);
    try {
      await storefront.forgotPassword(email);
    } catch {
      /* anti-enumeration: never surface an error from this endpoint */
    }
    setBusy(false);
    setSent(true);
  };

  return (
    <Stack maw={440} mx="auto" gap="lg" py="xl">
      <Title order={2}>Reset your password</Title>
      {sent ? (
        <Alert color="teal" variant="light" title="Check your inbox">
          <Stack gap="sm" align="flex-start">
            <Text fz="sm">
              If an account exists for <b>{email}</b>, we've sent a password-reset link. The link expires in 1 hour.
            </Text>
            <Anchor component={Link} to={`/${loc}/account`} fz="sm">Back to sign in</Anchor>
          </Stack>
        </Alert>
      ) : (
        <Stack>
          <Text c="dimmed" fz="sm">Enter your email and we'll send you a link to choose a new password.</Text>
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            autoComplete="email"
          />
          <Button onClick={() => void onSubmit()} loading={busy} disabled={!email}>
            Send reset link
          </Button>
          <Anchor component={Link} to={`/${loc}/account`} fz="sm" ta="center">
            Back to sign in
          </Anchor>
        </Stack>
      )}
    </Stack>
  );
}
