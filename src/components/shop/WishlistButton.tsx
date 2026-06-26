import { useState } from "react";
import { ActionIcon, Button, Tooltip } from "@mantine/core";
import { Heart } from "lucide-react";
import { useWishlist } from "@/lib/wishlist";

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist toggle (Phase L5.6). Two render modes:
//   • "overlay" — a round ActionIcon, for the top-right corner of a product card
//     (the card is a <Link>, so we preventDefault/stopPropagation to not navigate).
//   • "button"  — a labelled Button, for the product detail page.
// A filled heart = wishlisted. Works for guests (local) and accounts (persisted)
// transparently via the WishlistProvider.
// ─────────────────────────────────────────────────────────────────────────────

export function WishlistButton({ productId, mode = "overlay" }: { productId: string; mode?: "overlay" | "button" }) {
  const { isWishlisted, toggle } = useWishlist();
  const [busy, setBusy] = useState(false);
  const active = isWishlisted(productId);

  const onClick = async (e: React.MouseEvent) => {
    // The grid card is a <Link> — don't navigate when toggling the heart.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await toggle(productId);
    } finally {
      setBusy(false);
    }
  };

  const label = active ? "Remove from wishlist" : "Add to wishlist";

  if (mode === "button") {
    return (
      <Button
        variant={active ? "light" : "default"}
        color={active ? "red" : undefined}
        leftSection={<Heart size={16} fill={active ? "currentColor" : "none"} />}
        loading={busy}
        onClick={onClick}
      >
        {active ? "Saved" : "Save"}
      </Button>
    );
  }

  return (
    <Tooltip label={label} withArrow>
      <ActionIcon
        variant="white"
        color={active ? "red" : "gray"}
        radius="xl"
        size="lg"
        aria-label={label}
        loading={busy}
        onClick={onClick}
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}
      >
        <Heart size={18} fill={active ? "currentColor" : "none"} />
      </ActionIcon>
    </Tooltip>
  );
}
