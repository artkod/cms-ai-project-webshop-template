import { Box, Button, Group, Text } from "@mantine/core";
import { useConsent } from "@/lib/consent";

// ─────────────────────────────────────────────────────────────────────────────
// Cookie-consent banner (Phase L9.6). Shows until the visitor decides; the
// decision persists in localStorage (SDK) and — for logged-in customers — as a
// server-side consent record. Accessible: a labelled region with real buttons,
// keyboard-reachable in normal tab order. Deliberately NOT a focus-trapping
// modal — EU guidance requires browsing to stay possible before a choice.
// ─────────────────────────────────────────────────────────────────────────────

export function CookieBanner() {
  const { bannerOpen, accept, decline } = useConsent();
  if (!bannerOpen) return null;

  return (
    <Box
      component="section"
      role="region"
      aria-label="Cookie consent"
      style={{
        position: "fixed",
        insetInline: 0,
        bottom: 0,
        zIndex: 300,
        background: "var(--mantine-color-body)",
        borderTop: "1px solid var(--mantine-color-gray-3)",
        boxShadow: "0 -4px 16px rgba(0, 0, 0, 0.08)",
        padding: "1rem",
      }}
    >
      <Group justify="space-between" wrap="wrap" gap="md" maw={1140} mx="auto">
        <Text fz="sm" style={{ flex: "1 1 24rem" }}>
          We use analytics cookies to understand how the shop is used. They are set only if you
          accept — declining keeps the shop fully functional.
        </Text>
        <Group gap="sm" wrap="nowrap">
          <Button variant="default" size="sm" onClick={decline}>
            Decline
          </Button>
          <Button size="sm" onClick={accept}>
            Accept analytics
          </Button>
        </Group>
      </Group>
    </Box>
  );
}
