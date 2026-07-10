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
import { useLocaleConfig, useStrings } from "@/lib/locale";

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
  const { t } = useStrings();

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
        notifications.show({ color: "teal", message: t("shop.addr.updated") });
      } else {
        await storefront.createAddress(toInput(form));
        notifications.show({ color: "teal", message: t("shop.addr.saved") });
      }
      modal.close();
      await reload();
    } catch (e) {
      const err = e as StorefrontError;
      notifications.show({
        color: "red",
        message: err.code === "email_not_verified" ? t("shop.addr.verifyToSave") : t("shop.addr.saveError"),
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
      notifications.show({ color: "red", message: t("shop.addr.defaultError") });
    }
  };

  const remove = async (id: string) => {
    try {
      await storefront.deleteAddress(id);
      setConfirmDeleteId(null);
      notifications.show({ color: "gray", message: t("shop.addr.removed") });
      await reload();
    } catch {
      notifications.show({ color: "red", message: t("shop.addr.removeError") });
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
        <Title order={2}>{t("shop.addr.title")}</Title>
        <Alert color="blue" variant="light">
          {t("shop.orders.pleaseSignIn")} <Anchor component={Link} to={`/${loc}/account`}>{t("shop.orders.signIn")}</Anchor> {t("shop.addr.signInPrompt")}
        </Alert>
      </Stack>
    );
  }

  // Logged in but unverified → verification gate (mirrors the API).
  if (!verified) {
    return (
      <Stack maw={560} mx="auto" gap="md">
        <Title order={2}>{t("shop.addr.title")}</Title>
        <Alert color="yellow" variant="light" title={t("shop.addr.verifyTitle")}>
          {t("shop.addr.verifyBody")} <Anchor component={Link} to={`/${loc}/account`}>{t("shop.addr.goToAccount")}</Anchor>.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack maw={640} mx="auto" gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t("shop.addr.title")}</Title>
        <Button leftSection={<Plus size={16} />} onClick={openCreate}>{t("shop.addr.add")}</Button>
      </Group>

      {addresses.length === 0 ? (
        <Alert color="gray" variant="light" icon={<MapPin size={18} />}>
          {t("shop.addr.empty")}
        </Alert>
      ) : (
        <Stack gap="sm">
          {addresses.map((a) => (
            <Card key={a.id} withBorder radius="md" padding="md">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={4}>
                  <Group gap="xs">
                    <Text fw={600}>{a.label || a.name}</Text>
                    {a.isDefaultShipping && <Badge size="xs" color="teal" variant="light">{t("shop.addr.defaultShipping")}</Badge>}
                    {a.isDefaultBilling && <Badge size="xs" color="grape" variant="light">{t("shop.addr.defaultBilling")}</Badge>}
                  </Group>
                  <Text fz="sm">{a.name}</Text>
                  <Text fz="sm" c="dimmed">
                    {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.postalCode} {a.city}, {a.country}
                  </Text>
                  {a.phone && <Text fz="sm" c="dimmed">{a.phone}</Text>}
                  <Group gap="xs" mt={6}>
                    {!a.isDefaultShipping && (
                      <Anchor fz="xs" onClick={() => void setDefault(a, "shipping")}>{t("shop.addr.setDefaultShipping")}</Anchor>
                    )}
                    {!a.isDefaultBilling && (
                      <Anchor fz="xs" onClick={() => void setDefault(a, "billing")}>{t("shop.addr.setDefaultBilling")}</Anchor>
                    )}
                  </Group>
                </Stack>
                <Stack gap="xs" align="flex-end">
                  <Button size="compact-sm" variant="subtle" leftSection={<Pencil size={14} />} onClick={() => openEdit(a)}>
                    {t("shop.addr.edit")}
                  </Button>
                  {confirmDeleteId === a.id ? (
                    <Group gap={4}>
                      <Button size="compact-sm" color="red" onClick={() => void remove(a.id)}>{t("shop.addr.confirm")}</Button>
                      <Button size="compact-sm" variant="default" onClick={() => setConfirmDeleteId(null)}>{t("shop.addr.cancel")}</Button>
                    </Group>
                  ) : (
                    <Button size="compact-sm" variant="subtle" color="red" leftSection={<Trash2 size={14} />} onClick={() => setConfirmDeleteId(a.id)}>
                      {t("shop.addr.delete")}
                    </Button>
                  )}
                </Stack>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Anchor component={Link} to={`/${loc}/account`} fz="sm">{t("shop.addr.backToAccount")}</Anchor>

      <Modal opened={opened} onClose={modal.close} title={editing ? t("shop.addr.editTitle") : t("shop.addr.addTitle")} centered>
        <Stack gap="sm">
          <TextInput label={t("shop.addr.label")} placeholder={t("shop.addr.labelPlaceholder")} value={form.label} onChange={set("label")} />
          <TextInput label={t("shop.addr.fullName")} required value={form.name} onChange={set("name")} />
          <TextInput label={t("shop.addr.address")} required value={form.line1} onChange={set("line1")} />
          <TextInput label={t("shop.addr.addressLine2")} value={form.line2} onChange={set("line2")} />
          <Group grow>
            <TextInput label={t("shop.addr.city")} required value={form.city} onChange={set("city")} />
            <TextInput label={t("shop.addr.postalCode")} required value={form.postalCode} onChange={set("postalCode")} />
          </Group>
          <TextInput
            label={t("shop.addr.country")}
            required
            list="address-countries"
            value={form.country}
            onChange={(e) => {
              // Capture BEFORE setForm — React nulls e.currentTarget once the event
              // dispatch returns, and the functional updater can run later (twice in
              // StrictMode), so reading it inside the updater throws on null.
              const country = e.currentTarget.value.toUpperCase().slice(0, 2);
              setForm((f) => ({ ...f, country }));
            }}
          />
          <datalist id="address-countries">
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </datalist>
          <TextInput label={t("shop.addr.phone")} value={form.phone} onChange={set("phone")} />
          <Checkbox
            label={t("shop.addr.defaultShippingCheckbox")}
            checked={form.isDefaultShipping}
            onChange={(e) => {
              const checked = e.currentTarget.checked;
              setForm((f) => ({ ...f, isDefaultShipping: checked }));
            }}
          />
          <Checkbox
            label={t("shop.addr.defaultBillingCheckbox")}
            checked={form.isDefaultBilling}
            onChange={(e) => {
              const checked = e.currentTarget.checked;
              setForm((f) => ({ ...f, isDefaultBilling: checked }));
            }}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={modal.close}>{t("shop.addr.cancel")}</Button>
            <Button onClick={() => void save()} loading={saving} disabled={!canSave}>
              {editing ? t("shop.addr.saveChanges") : t("shop.addr.add")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
