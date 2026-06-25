import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Alert, Anchor, Badge, Button, Divider, Group, Loader, Paper, SegmentedControl, Stack, Tabs, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { LogIn, LogOut, MailCheck, MapPin, ShoppingCart } from "lucide-react";
import { useCustomer } from "@/lib/customer";
import { useCart } from "@/lib/cart";
import { useLocaleConfig } from "@/lib/locale";
import type { OAuthProviderId } from "@cms/storefront";

// Labels for the social-login buttons (L5.3).
const OAUTH_LABELS: Record<OAuthProviderId, string> = {
  google: "Continue with Google",
  apple: "Continue with Apple",
  stub: "Dev sign-in (stub)",
};

// Friendly copy for the callback's `?error=` codes.
const OAUTH_ERRORS: Record<string, string> = {
  oauth_failed: "Sign-in didn't complete. Please try again.",
  oauth_account_exists:
    "An account with this email already exists. Sign in with your password (or reset it), then you can connect this provider.",
  oauth_email_unverified: "The provider didn't share a verified email, so we couldn't sign you in.",
  account_disabled: "This account has been disabled.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Account page (Phase L5.1 + L5.2) — the clickable surface for the customer auth
// realm: register / login / logout, the guest-cart-merge note, PLUS (L5.2) the
// email-verification banner + resend, a verification-gated Change password form,
// and a Forgot-password link. Logged out → Sign in / Create account tabs. Logged
// in → profile + verify state + change password + sign out.
// ─────────────────────────────────────────────────────────────────────────────

export function AccountPage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const { customer, loading, register, login, logout, resendVerification, changePassword, oauthProviders, startOAuth } = useCustomer();
  const { itemCount } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();

  // Surface the social-login callback result (?error / ?connected / ?created /
  // ?linked) once, then strip it from the URL. The `handledRef` guard keys on the
  // exact query string so React StrictMode's dev double-invoke of this effect (both
  // runs see the same not-yet-stripped params) shows the toast only ONCE.
  const handledRef = useRef<string | null>(null);
  useEffect(() => {
    const error = searchParams.get("error");
    const ok = searchParams.get("connected") || searchParams.get("created") || searchParams.get("linked");
    if (!error && !ok) return;
    const key = searchParams.toString();
    if (handledRef.current === key) return;
    handledRef.current = key;
    if (error) {
      notifications.show({ color: "red", message: OAUTH_ERRORS[error] ?? OAUTH_ERRORS.oauth_failed });
    } else if (searchParams.get("linked")) {
      notifications.show({ color: "teal", message: "Signed in — this provider is now linked to your account." });
    } else {
      notifications.show({ color: "teal", message: "Signed in." });
    }
    const next = new URLSearchParams(searchParams);
    ["error", "connected", "created", "linked"].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Form state.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  // B2B registration (L5.5). A business needs a company + at least one tax id;
  // it's created pending approval and buys at B2C terms until an admin approves.
  const [accountType, setAccountType] = useState<"personal" | "business">("personal");
  const [company, setCompany] = useState("");
  const [oib, setOib] = useState("");
  const [vatId, setVatId] = useState("");

  // Change-password form (logged-in, verified only).
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const newPwMatch = newPw === newPw2;
  const canChangePw = curPw.length > 0 && newPw.length >= 8 && newPwMatch;

  // Confirm-password is a client-side typo guard only (never sent to the API).
  const passwordsMatch = password === confirm;
  const businessOk = accountType !== "business" || (!!company.trim() && (!!oib.trim() || !!vatId.trim()));
  const canRegister = !!email && password.length >= 8 && passwordsMatch && businessOk;

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  // ── Logged in ──────────────────────────────────────────────────────────────
  if (customer) {
    const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email;
    const onResend = async () => {
      setResendBusy(true);
      await resendVerification();
      setResendBusy(false);
    };
    const onChangePassword = async () => {
      setPwBusy(true);
      const ok = await changePassword(curPw, newPw);
      setPwBusy(false);
      if (ok) {
        setCurPw("");
        setNewPw("");
        setNewPw2("");
      }
    };
    return (
      <Stack maw={560} mx="auto" gap="lg">
        <Title order={2}>My account</Title>
        <Paper withBorder p="lg" radius="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600} fz="lg">{name}</Text>
              <Badge variant="light" color={customer.type === "business" ? "grape" : "teal"}>
                {customer.type}
              </Badge>
            </Group>
            <Text c="dimmed" fz="sm">{customer.email}</Text>
            {customer.company && <Text fz="sm">{customer.company}</Text>}
            <Group gap="xs">
              <Text fz="sm">Email verified:</Text>
              <Badge size="sm" variant="light" color={customer.emailVerified ? "teal" : "yellow"}>
                {customer.emailVerified ? "verified" : "not verified"}
              </Badge>
            </Group>
            {/* B2B approval state (L5.5) — only an approved business is on B2B terms. */}
            {customer.type === "business" && (
              <Group gap="xs">
                <Text fz="sm">Business pricing:</Text>
                <Badge size="sm" variant="light" color={customer.b2bApproved ? "teal" : customer.approvalStatus === "rejected" ? "red" : "yellow"}>
                  {customer.b2bApproved ? "active (net)" : customer.approvalStatus === "rejected" ? "not approved" : "pending approval"}
                </Badge>
              </Group>
            )}
          </Stack>
        </Paper>

        {customer.type === "business" && !customer.b2bApproved && customer.approvalStatus !== "rejected" && (
          <Alert color="blue" variant="light" title="Business account pending approval">
            <Text fz="sm">
              Your business account is awaiting approval. You can shop now at standard prices — once approved,
              net pricing and any assigned price list apply automatically at checkout.
            </Text>
          </Alert>
        )}

        {!customer.emailVerified && (
          <Alert color="yellow" variant="light" icon={<MailCheck size={18} />} title="Verify your email">
            <Stack gap="xs" align="flex-start">
              <Text fz="sm">
                We sent a verification link to <b>{customer.email}</b>. Verifying unlocks account features like
                changing your password — but you can keep shopping and checking out in the meantime.
              </Text>
              <Button size="xs" variant="light" color="yellow" loading={resendBusy} onClick={() => void onResend()}>
                Resend verification email
              </Button>
            </Stack>
          </Alert>
        )}

        {/* Change password — a verification-gated account feature (L5.2). */}
        <Paper withBorder p="lg" radius="md">
          <Stack gap="sm">
            <Text fw={600}>Change password</Text>
            {customer.emailVerified ? (
              <>
                <TextInput
                  label="Current password"
                  type="password"
                  value={curPw}
                  onChange={(e) => setCurPw(e.currentTarget.value)}
                  autoComplete="current-password"
                />
                <TextInput
                  label="New password"
                  type="password"
                  description="At least 8 characters"
                  value={newPw}
                  onChange={(e) => setNewPw(e.currentTarget.value)}
                  autoComplete="new-password"
                />
                <TextInput
                  label="Confirm new password"
                  type="password"
                  value={newPw2}
                  onChange={(e) => setNewPw2(e.currentTarget.value)}
                  autoComplete="new-password"
                  error={newPw2.length > 0 && !newPwMatch ? "Passwords don't match" : undefined}
                />
                <Button onClick={() => void onChangePassword()} loading={pwBusy} disabled={!canChangePw} w="fit-content">
                  Update password
                </Button>
              </>
            ) : (
              <Text c="dimmed" fz="sm">Verify your email to change your password.</Text>
            )}
          </Stack>
        </Paper>

        <Divider />
        <Group>
          <Button
            component={Link}
            to={`/${loc}/account/addresses`}
            variant="light"
            leftSection={<MapPin size={16} />}
          >
            Address book
          </Button>
          <Button
            component={Link}
            to={`/${loc}/cart`}
            variant="light"
            leftSection={<ShoppingCart size={16} />}
          >
            View cart ({itemCount})
          </Button>
          <Button color="red" variant="subtle" leftSection={<LogOut size={16} />} onClick={() => void logout()}>
            Sign out
          </Button>
        </Group>
      </Stack>
    );
  }

  // ── Logged out: Sign in / Create account ─────────────────────────────────────
  const onLogin = async () => {
    setBusy(true);
    await login({ email, password });
    setBusy(false);
  };
  const onRegister = async () => {
    setBusy(true);
    const ok = await register({
      email,
      password,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      ...(accountType === "business"
        ? { type: "business" as const, company: company.trim(), oib: oib.trim() || undefined, vatId: vatId.trim() || undefined }
        : {}),
    });
    setBusy(false);
    if (ok) {
      setPassword("");
      setConfirm("");
    }
  };

  return (
    <Stack maw={480} mx="auto" gap="lg">
      <Title order={2}>Account</Title>
      {itemCount > 0 && (
        <Alert color="teal" variant="light">
          You have {itemCount} item{itemCount === 1 ? "" : "s"} in your cart — sign in or create an account and it will move with you.
        </Alert>
      )}
      <Tabs defaultValue="login">
        <Tabs.List grow>
          <Tabs.Tab value="login">Sign in</Tabs.Tab>
          <Tabs.Tab value="register">Create account</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="login" pt="md">
          <Stack>
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              autoComplete="email"
            />
            <TextInput
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              autoComplete="current-password"
            />
            <Button onClick={() => void onLogin()} loading={busy} disabled={!email || !password}>
              Sign in
            </Button>
            <Anchor component={Link} to={`/${loc}/account/forgot-password`} fz="sm" ta="center">
              Forgot your password?
            </Anchor>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="register" pt="md">
          <Stack>
            <SegmentedControl
              fullWidth
              value={accountType}
              onChange={(v) => setAccountType(v as "personal" | "business")}
              data={[
                { label: "Personal", value: "personal" },
                { label: "Business (B2B)", value: "business" },
              ]}
            />
            {accountType === "business" && (
              <>
                <TextInput
                  label="Company"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.currentTarget.value)}
                  autoComplete="organization"
                />
                <Group grow>
                  <TextInput
                    label="OIB"
                    description="11 digits"
                    value={oib}
                    onChange={(e) => setOib(e.currentTarget.value)}
                  />
                  <TextInput
                    label="VAT ID"
                    description="e.g. HR12345678901"
                    value={vatId}
                    onChange={(e) => setVatId(e.currentTarget.value)}
                  />
                </Group>
                <Text c="dimmed" fz="xs">
                  Business accounts are reviewed before B2B pricing applies — you can shop at standard prices in the meantime.
                </Text>
              </>
            )}
            <Group grow>
              <TextInput label="First name" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} autoComplete="given-name" />
              <TextInput label="Last name" value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} autoComplete="family-name" />
            </Group>
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              autoComplete="email"
            />
            <TextInput
              label="Password"
              type="password"
              description="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              autoComplete="new-password"
            />
            <TextInput
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.currentTarget.value)}
              autoComplete="new-password"
              error={confirm.length > 0 && !passwordsMatch ? "Passwords don't match" : undefined}
            />
            <Button onClick={() => void onRegister()} loading={busy} disabled={!canRegister}>
              Create account
            </Button>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {oauthProviders.length > 0 && (
        <Stack gap="sm">
          <Divider label="or" labelPosition="center" />
          {oauthProviders.map((p) => (
            <Button
              key={p}
              variant="default"
              leftSection={<LogIn size={16} />}
              onClick={() => startOAuth(p, loc)}
            >
              {OAUTH_LABELS[p]}
            </Button>
          ))}
        </Stack>
      )}

      <Text c="dimmed" fz="xs" ta="center">
        Guest checkout is always available — an account is optional.{" "}
        <Anchor component={Link} to={`/${loc}/shop`}>Continue shopping</Anchor>
      </Text>
    </Stack>
  );
}
