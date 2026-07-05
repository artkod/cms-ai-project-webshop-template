import { useState } from "react";
import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { storefront } from "@/lib/storefront";
import { useCustomer } from "@/lib/customer";

// Back-in-stock subscribe form (L9.2). Shown under the availability badge when
// the selected variant is out of stock and not sellable (no backorder). Guests
// type an email; a logged-in customer's email is prefilled. One pending
// subscription per (variant, email) — a repeat subscribe reports "already".

export function BackInStockForm({ productId, variantId, locale }: { productId: string; variantId: string; locale: string }) {
  const { customer } = useCustomer();
  const [email, setEmail] = useState(customer?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubscribe = async () => {
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    try {
      const res = await storefront.subscribeBackInStock(productId, { variantId, email: value, locale });
      setDone(true);
      notifications.show({
        color: "teal",
        message: res.already ? "You're already on the list — we'll email you when it's back." : "We'll email you when it's back in stock.",
      });
    } catch {
      notifications.show({ color: "red", message: "Couldn't subscribe. Check the email address and try again." });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Text fz="sm" c="teal">
        ✓ We'll let you know when it's back.
      </Text>
    );
  }

  return (
    <Stack gap={4}>
      <Text fz="sm" fw={600}>
        Get notified when it's back
      </Text>
      <Group gap="xs" align="flex-end">
        <TextInput
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          w={240}
          size="sm"
        />
        <Button size="sm" variant="light" onClick={onSubscribe} loading={busy} disabled={!email.trim()}>
          Notify me
        </Button>
      </Group>
    </Stack>
  );
}
