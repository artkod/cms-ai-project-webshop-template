import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Alert, Anchor, Badge, Button, Divider, Group, Loader, Paper, SegmentedControl, Stack, Tabs, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Heart, LogIn, LogOut, MailCheck, MapPin, Package, ShoppingCart } from "lucide-react";
import { useCustomer } from "@/lib/customer";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useLocaleConfig, useStrings } from "@/lib/locale";
import { isValidOib } from "@cms/storefront";

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
  const { count: wishlistCount } = useWishlist();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useStrings();

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
      notifications.show({ color: "red", message: t(`shop.oauth.err.${error}`) !== `shop.oauth.err.${error}` ? t(`shop.oauth.err.${error}`) : t("shop.oauth.err.oauth_failed") });
    } else if (searchParams.get("linked")) {
      notifications.show({ color: "teal", message: t("shop.oauth.linked") });
    } else {
      notifications.show({ color: "teal", message: t("shop.oauth.signedIn") });
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
  const [authTab, setAuthTab] = useState<string | null>("login");
  const [attempted, setAttempted] = useState(false); // show required-field errors only after a submit attempt

  // Change-password form (logged-in, verified only).
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const newPwMatch = newPw === newPw2;
  const canChangePw = curPw.length > 0 && newPw.length >= 8 && newPwMatch;

  // Registration validation (L5.5). ALL visible fields are required; we validate
  // ONLY on submit (never while typing) — `attempted` gates the per-field errors,
  // which then update live as the user fixes them. The OIB checksum is the same
  // check the API runs (isValidOib), so a bad OIB is caught here, not server-side.
  const isBusiness = accountType === "business";
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function validateRegister(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = t("shop.account.required");
    if (!lastName.trim()) e.lastName = t("shop.account.required");
    if (!email.trim()) e.email = t("shop.account.required");
    else if (!EMAIL_RE.test(email.trim())) e.email = t("shop.account.invalidEmail");
    if (!password) e.password = t("shop.account.required");
    else if (password.length < 8) e.password = t("shop.account.min8");
    if (confirm !== password) e.confirm = t("shop.account.passwordsDontMatch");
    if (isBusiness) {
      if (!company.trim()) e.company = t("shop.account.required");
      const oibFilled = oib.trim() !== "";
      const vatFilled = vatId.trim() !== "";
      if (!oibFilled && !vatFilled) e.taxId = t("shop.account.provideTaxId");
      if (oibFilled && !isValidOib(oib.trim())) e.oib = t("shop.account.invalidOib");
      if (vatFilled && (vatId.trim().length < 4 || vatId.trim().length > 20)) e.vatId = t("shop.account.invalidVatId");
    }
    return e;
  }
  const errors: Record<string, string> = attempted ? validateRegister() : {};

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
        <Title order={2}>{t("shop.account.myAccount")}</Title>
        <Paper withBorder p="lg" radius="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600} fz="lg">{name}</Text>
              <Badge variant="light" color={customer.type === "business" ? "grape" : "teal"}>
                {customer.type === "business" ? t("shop.account.typeBusiness") : t("shop.account.typePersonal")}
              </Badge>
            </Group>
            <Text c="dimmed" fz="sm">{customer.email}</Text>
            {customer.company && <Text fz="sm">{customer.company}</Text>}
            <Group gap="xs">
              <Text fz="sm">{t("shop.account.emailVerified")}</Text>
              <Badge size="sm" variant="light" color={customer.emailVerified ? "teal" : "yellow"}>
                {customer.emailVerified ? t("shop.account.verified") : t("shop.account.notVerified")}
              </Badge>
            </Group>
            {/* B2B approval state (L5.5) — only an approved business is on B2B terms. */}
            {customer.type === "business" && (
              <Group gap="xs">
                <Text fz="sm">{t("shop.account.businessPricing")}</Text>
                <Badge size="sm" variant="light" color={customer.b2bApproved ? "teal" : customer.approvalStatus === "rejected" ? "red" : "yellow"}>
                  {customer.b2bApproved ? t("shop.account.b2bActive") : customer.approvalStatus === "rejected" ? t("shop.account.b2bNotApproved") : t("shop.account.b2bPending")}
                </Badge>
              </Group>
            )}
          </Stack>
        </Paper>

        {customer.type === "business" && !customer.b2bApproved && customer.approvalStatus !== "rejected" && (
          <Alert color="blue" variant="light" title={t("shop.account.b2bPendingTitle")}>
            <Text fz="sm">
              {t("shop.account.b2bPendingBody")}
            </Text>
          </Alert>
        )}

        {!customer.emailVerified && (
          <Alert color="yellow" variant="light" icon={<MailCheck size={18} />} title={t("shop.account.verifyTitle")}>
            <Stack gap="xs" align="flex-start">
              <Text fz="sm">
                {t("shop.account.verifyBodyPrefix")} <b>{customer.email}</b>{t("shop.account.verifyBodySuffix")}
              </Text>
              <Button size="xs" variant="light" color="yellow" loading={resendBusy} onClick={() => void onResend()}>
                {t("shop.account.resendVerification")}
              </Button>
            </Stack>
          </Alert>
        )}

        {/* Change password — a verification-gated account feature (L5.2). */}
        <Paper withBorder p="lg" radius="md">
          <Stack gap="sm">
            <Text fw={600}>{t("shop.account.changePassword")}</Text>
            {customer.emailVerified ? (
              <>
                <TextInput
                  label={t("shop.account.currentPassword")}
                  type="password"
                  value={curPw}
                  onChange={(e) => setCurPw(e.currentTarget.value)}
                  autoComplete="current-password"
                />
                <TextInput
                  label={t("shop.account.newPassword")}
                  type="password"
                  description={t("shop.account.atLeast8")}
                  value={newPw}
                  onChange={(e) => setNewPw(e.currentTarget.value)}
                  autoComplete="new-password"
                />
                <TextInput
                  label={t("shop.account.confirmNewPassword")}
                  type="password"
                  value={newPw2}
                  onChange={(e) => setNewPw2(e.currentTarget.value)}
                  autoComplete="new-password"
                  error={newPw2.length > 0 && !newPwMatch ? t("shop.account.passwordsDontMatch") : undefined}
                />
                <Button onClick={() => void onChangePassword()} loading={pwBusy} disabled={!canChangePw} w="fit-content">
                  {t("shop.account.updatePassword")}
                </Button>
              </>
            ) : (
              <Text c="dimmed" fz="sm">{t("shop.account.verifyToChangePassword")}</Text>
            )}
          </Stack>
        </Paper>

        <Divider />
        <Group>
          <Button
            component={Link}
            to={`/${loc}/account/orders`}
            variant="light"
            leftSection={<Package size={16} />}
          >
            {t("shop.account.myOrders")}
          </Button>
          <Button
            component={Link}
            to={`/${loc}/account/addresses`}
            variant="light"
            leftSection={<MapPin size={16} />}
          >
            {t("shop.account.addressBook")}
          </Button>
          <Button
            component={Link}
            to={`/${loc}/account/wishlist`}
            variant="light"
            leftSection={<Heart size={16} />}
          >
            {t("shop.account.wishlist")} ({wishlistCount})
          </Button>
          <Button
            component={Link}
            to={`/${loc}/cart`}
            variant="light"
            leftSection={<ShoppingCart size={16} />}
          >
            {t("shop.account.viewCart")} ({itemCount})
          </Button>
          <Button color="red" variant="subtle" leftSection={<LogOut size={16} />} onClick={() => void logout()}>
            {t("shop.account.signOut")}
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
    setAttempted(true);
    if (Object.keys(validateRegister()).length > 0) return; // show field errors, don't hit the API
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
      <Title order={2}>{t("shop.account.title")}</Title>
      {itemCount > 0 && (
        <Alert color="teal" variant="light">
          {t("shop.account.cartMovePrefix")} {itemCount} {itemCount === 1 ? t("shop.account.cartMoveOne") : t("shop.account.cartMoveOther")}
        </Alert>
      )}
      <Tabs value={authTab} onChange={setAuthTab}>
        <Tabs.List grow>
          <Tabs.Tab value="login">{t("shop.account.signIn")}</Tabs.Tab>
          <Tabs.Tab value="register">{t("shop.account.createAccount")}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="login" pt="md">
          <Stack>
            <TextInput
              label={t("shop.account.email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              autoComplete="email"
            />
            <TextInput
              label={t("shop.account.password")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              autoComplete="current-password"
            />
            <Button onClick={() => void onLogin()} loading={busy} disabled={!email || !password}>
              {t("shop.account.signIn")}
            </Button>
            <Anchor component={Link} to={`/${loc}/account/forgot-password`} fz="sm" ta="center">
              {t("shop.account.forgotPassword")}
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
                { label: t("shop.account.personal"), value: "personal" },
                { label: t("shop.account.businessB2B"), value: "business" },
              ]}
            />
            {accountType === "business" && (
              <>
                <TextInput
                  label={t("shop.account.company")}
                  value={company}
                  onChange={(e) => setCompany(e.currentTarget.value)}
                  autoComplete="organization"
                  error={errors.company}
                />
                <Group grow align="flex-start">
                  <TextInput
                    label={t("shop.account.oib")}
                    description={t("shop.account.oib11")}
                    value={oib}
                    onChange={(e) => setOib(e.currentTarget.value)}
                    error={errors.oib ?? errors.taxId}
                    inputMode="numeric"
                  />
                  <TextInput
                    label={t("shop.account.vatId")}
                    description={t("shop.account.vatIdExample")}
                    value={vatId}
                    onChange={(e) => setVatId(e.currentTarget.value)}
                    error={errors.vatId}
                  />
                </Group>
                <Text c="dimmed" fz="xs">
                  {t("shop.account.b2bHint")}
                </Text>
              </>
            )}
            <Group grow align="flex-start">
              <TextInput label={t("shop.account.firstName")} value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} autoComplete="given-name" error={errors.firstName} />
              <TextInput label={t("shop.account.lastName")} value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} autoComplete="family-name" error={errors.lastName} />
            </Group>
            <TextInput
              label={t("shop.account.email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              autoComplete="email"
              error={errors.email}
            />
            <TextInput
              label={t("shop.account.password")}
              type="password"
              description={t("shop.account.atLeast8")}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              autoComplete="new-password"
              error={errors.password}
            />
            <TextInput
              label={t("shop.account.confirmPassword")}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.currentTarget.value)}
              autoComplete="new-password"
              error={errors.confirm}
            />
            <Button onClick={() => void onRegister()} loading={busy}>
              {t("shop.account.createAccount")}
            </Button>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Social login is for personal accounts only — a B2B account needs the
          company/OIB/VAT-ID + approval flow, so it must be created via the form. */}
      {authTab === "register" && accountType === "business" ? (
        <Text c="dimmed" fz="xs" ta="center">{t("shop.account.businessMustUseForm")}</Text>
      ) : oauthProviders.length > 0 && (
        <Stack gap="sm">
          <Divider label={t("shop.account.or")} labelPosition="center" />
          {oauthProviders.map((p) => (
            <Button
              key={p}
              variant="default"
              leftSection={<LogIn size={16} />}
              onClick={() => startOAuth(p, loc)}
            >
              {t(`shop.oauth.${p}`)}
            </Button>
          ))}
        </Stack>
      )}

      <Text c="dimmed" fz="xs" ta="center">
        {t("shop.account.guestCheckout")}{" "}
        <Anchor component={Link} to={`/${loc}/shop`}>{t("shop.account.continueShopping")}</Anchor>
      </Text>
    </Stack>
  );
}
