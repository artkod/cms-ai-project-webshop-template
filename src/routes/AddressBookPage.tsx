import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  Alert, Anchor, Badge, Button, Card, Checkbox, Group, Loader, Modal, Stack, Text, TextInput, Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { StorefrontError, type StorefrontAddress, type CreateAddressInput } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useCustomer } from "@/lib/customer";
import { useLocaleConfig } from "@/lib/locale";

// ─────────────────────────────────────────────────────────────────────────────
// Address book (Phase L5.4) — manage a logged-in + verified customer's saved
// addresses: add / edit / delete + pick the default shipping/billing address.
// A verification-gated account feature (the API enforces it; this page mirrors the
// gate with a friendly prompt). The saved default prefills checkout (CheckoutPage).
// ─────────────────────────────────────────────────────────────────────────────

const COUNTRY_OPTIONS = [
  { value: "HR", label: "Croatia (HR)" },
  { value: "DE", label: "Germany (DE)" },
  { value: "IT", label: "Italy (IT)" },
  { value: "AT", label: "Austria (AT)" },
  { value: "SI", label: "Slovenia (SI)" },
  { value: "US", label: "United States (US)" },
];

type FormState = {
  label: string;
  name: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};

const EMPTY_FORM: FormState = {
  label: "", name: "", line1: "", line2: "", city: "", postalCode: "",
  country: "HR", phone: "", isDefaultShipping: false, isDefaultBilling: false,
};

function toForm(a: StorefrontAddress): FormState {
  return {
    label: a.label ?? "",
    name: a.name,
    line1: a.line1,
    line2: a.line2 ?? "",
    city: a.city,
    postalCode: a.postalCode,
    country: a.country,
    phone: a.phone ?? "",
    isDefaultShipping: a.isDefaultShipping,
    isDefaultBilling: a.isDefaultBilling,
  };
}

function toInput(f: FormState): CreateAddressInput {
  return {
    label: f.label.trim() || undefined,
    name: f.name.trim(),
    line1: f.line1.trim(),
    line2: f.line2.trim() || undefined,
    city: f.city.trim(),
    postalCode: f.postalCode.trim(),
    country: f.country,
    phone: f.phone.trim() || undefined,
    isDefaultShipping: f.isDefaultShipping,
    isDefaultBilling: f.isDefaultBilling,
  };
}

export function AddressBookPage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const { customer, loading: customerLoading } = useCustomer();

  const [addresses, setAddresses] = useState<StorefrontAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, modal] = useDisclosure(false);
  const [editing, setEditing] = useState<StorefrontAddress | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const verified = !!customer?.emailVerified;

  const reload = useCallback(async () => {
    if (!verified) {
      setLoading(false);
      return;
    }
    try {
      setAddresses(await storefront.listAddresses());
    } catch {
      /* leave as-is */
    } finally {
      setLoading(false);
    }
  }, [verified]);

  useEffect(() => {
    if (!customerLoading) void reload();
  }, [customerLoading, reload]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, isDefaultShipping: addresses.length === 0, isDefaultBilling: addresses.length === 0 });
    modal.open();
  };
  const openEdit = (a: StorefrontAddress) => {
    setEditing(a);
    setForm(toForm(a));
    modal.open();
  };

  const canSave = !!form.name.trim() && !!form.line1.trim() && !!form.city.trim() && !!form.postalCode.trim() && form.country.length === 2;

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await storefront.updateAddress(editing.id, { ...toInput(form), label: form.label.trim() || null });
        notifications.show({ color: "teal", message: "Address updated." });
      } else {
        await storefront.createAddress(toInput(form));
        notifications.show({ color: "teal", message: "Address saved." });
      }
      modal.close();
      await reload();
    } catch (e) {
      const err = e as StorefrontError;
      notifications.show({
        color: "red",
        message: err.code === "email_not_verified" ? "Verify your email first to save addresses." : "Couldn't save the address. Please check the fields and try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (a: StorefrontAddress, role: "shipping" | "billing") => {
    try {
      await storefront.updateAddress(a.id, role === "shipping" ? { isDefaultShipping: true } : { isDefaultBilling: true });
      await reload();
    } catch {
      notifications.show({ color: "red", message: "Couldn't update the default address." });
    }
  };

  const remove = async (id: string) => {
    try {
      await storefront.deleteAddress(id);
      setConfirmDeleteId(null);
      notifications.show({ color: "gray", message: "Address removed." });
      await reload();
    } catch {
      notifications.show({ color: "red", message: "Couldn't remove the address." });
    }
  };

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    setForm((f) => ({ ...f, [k]: value }));
  };

  if (customerLoading || loading) {
    return (
      <Group justify="center" py="xl"><Loader /></Group>
    );
  }

  // Not logged in → send them to the account page to sign in.
  if (!customer) {
    return (
      <Stack maw={560} mx="auto" gap="md">
        <Title order={2}>Address book</Title>
        <Alert color="blue" variant="light">
          Please <Anchor component={Link} to={`/${loc}/account`}>sign in</Anchor> to manage your saved addresses.
        </Alert>
      </Stack>
    );
  }

  // Logged in but unverified → verification gate (mirrors the API).
  if (!verified) {
    return (
      <Stack maw={560} mx="auto" gap="md">
        <Title order={2}>Address book</Title>
        <Alert color="yellow" variant="light" title="Verify your email">
          Saving addresses is an account feature — please verify your email first. You can still check out as a guest
          by entering an address at checkout. <Anchor component={Link} to={`/${loc}/account`}>Go to your account</Anchor>.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack maw={640} mx="auto" gap="lg">
      <Group justify="space-between">
        <Title order={2}>Address book</Title>
        <Button leftSection={<Plus size={16} />} onClick={openCreate}>Add address</Button>
      </Group>

      {addresses.length === 0 ? (
        <Alert color="gray" variant="light" icon={<MapPin size={18} />}>
          You haven't saved any addresses yet. Add one and it'll prefill at checkout.
        </Alert>
      ) : (
        <Stack gap="sm">
          {addresses.map((a) => (
            <Card key={a.id} withBorder radius="md" padding="md">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={4}>
                  <Group gap="xs">
                    <Text fw={600}>{a.label || a.name}</Text>
                    {a.isDefaultShipping && <Badge size="xs" color="teal" variant="light">Default shipping</Badge>}
                    {a.isDefaultBilling && <Badge size="xs" color="grape" variant="light">Default billing</Badge>}
                  </Group>
                  <Text fz="sm">{a.name}</Text>
                  <Text fz="sm" c="dimmed">
                    {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.postalCode} {a.city}, {a.country}
                  </Text>
                  {a.phone && <Text fz="sm" c="dimmed">{a.phone}</Text>}
                  <Group gap="xs" mt={6}>
                    {!a.isDefaultShipping && (
                      <Anchor fz="xs" onClick={() => void setDefault(a, "shipping")}>Set default shipping</Anchor>
                    )}
                    {!a.isDefaultBilling && (
                      <Anchor fz="xs" onClick={() => void setDefault(a, "billing")}>Set default billing</Anchor>
                    )}
                  </Group>
                </Stack>
                <Stack gap="xs" align="flex-end">
                  <Button size="compact-sm" variant="subtle" leftSection={<Pencil size={14} />} onClick={() => openEdit(a)}>
                    Edit
                  </Button>
                  {confirmDeleteId === a.id ? (
                    <Group gap={4}>
                      <Button size="compact-sm" color="red" onClick={() => void remove(a.id)}>Confirm</Button>
                      <Button size="compact-sm" variant="default" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                    </Group>
                  ) : (
                    <Button size="compact-sm" variant="subtle" color="red" leftSection={<Trash2 size={14} />} onClick={() => setConfirmDeleteId(a.id)}>
                      Delete
                    </Button>
                  )}
                </Stack>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Anchor component={Link} to={`/${loc}/account`} fz="sm">← Back to account</Anchor>

      <Modal opened={opened} onClose={modal.close} title={editing ? "Edit address" : "Add address"} centered>
        <Stack gap="sm">
          <TextInput label="Label (optional)" placeholder="Home, Work…" value={form.label} onChange={set("label")} />
          <TextInput label="Full name" required value={form.name} onChange={set("name")} />
          <TextInput label="Address" required value={form.line1} onChange={set("line1")} />
          <TextInput label="Address line 2" value={form.line2} onChange={set("line2")} />
          <Group grow>
            <TextInput label="City" required value={form.city} onChange={set("city")} />
            <TextInput label="Postal code" required value={form.postalCode} onChange={set("postalCode")} />
          </Group>
          <TextInput
            label="Country (ISO-2)"
            required
            list="address-countries"
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.currentTarget.value.toUpperCase().slice(0, 2) }))}
          />
          <datalist id="address-countries">
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </datalist>
          <TextInput label="Phone" value={form.phone} onChange={set("phone")} />
          <Checkbox
            label="Default shipping address"
            checked={form.isDefaultShipping}
            onChange={(e) => setForm((f) => ({ ...f, isDefaultShipping: e.currentTarget.checked }))}
          />
          <Checkbox
            label="Default billing address"
            checked={form.isDefaultBilling}
            onChange={(e) => setForm((f) => ({ ...f, isDefaultBilling: e.currentTarget.checked }))}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={modal.close}>Cancel</Button>
            <Button onClick={() => void save()} loading={saving} disabled={!canSave}>
              {editing ? "Save changes" : "Add address"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
