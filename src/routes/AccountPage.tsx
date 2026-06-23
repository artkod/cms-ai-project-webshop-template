import { useState } from "react";
import { Link, useParams } from "react-router";
import { Alert, Anchor, Badge, Button, Group, Loader, Paper, Stack, Tabs, Text, TextInput, Title } from "@mantine/core";
import { LogOut, ShoppingCart } from "lucide-react";
import { useCustomer } from "@/lib/customer";
import { useCart } from "@/lib/cart";
import { useLocaleConfig } from "@/lib/locale";

// ─────────────────────────────────────────────────────────────────────────────
// Account page (Phase L5.1) — the clickable surface for the customer auth realm:
// register / login / logout, plus a live note about the guest-cart merge so it's
// observable. Logged out → Sign in / Create account tabs. Logged in → profile +
// sign out. Verification, address book, B2B, wishlist land in L5.2–L5.6.
// ─────────────────────────────────────────────────────────────────────────────

export function AccountPage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const { customer, loading, register, login, logout } = useCustomer();
  const { itemCount } = useCart();

  // Form state.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);

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
            <Group gap="xs">
              <Text fz="sm">Email verified:</Text>
              <Badge size="sm" variant="light" color={customer.emailVerified ? "teal" : "yellow"}>
                {customer.emailVerified ? "verified" : "not verified"}
              </Badge>
            </Group>
          </Stack>
        </Paper>

        <Group>
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
    const ok = await register({ email, password, firstName: firstName || undefined, lastName: lastName || undefined });
    setBusy(false);
    if (ok) {
      setPassword("");
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
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="register" pt="md">
          <Stack>
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
            <Button onClick={() => void onRegister()} loading={busy} disabled={!email || password.length < 8}>
              Create account
            </Button>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Text c="dimmed" fz="xs" ta="center">
        Guest checkout is always available — an account is optional.{" "}
        <Anchor component={Link} to={`/${loc}/shop`}>Continue shopping</Anchor>
      </Text>
    </Stack>
  );
}
