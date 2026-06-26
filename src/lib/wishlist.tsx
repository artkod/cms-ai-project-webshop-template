import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { notifications } from "@mantine/notifications";
import {
  StorefrontError,
  getLocalWishlist,
  addLocalWishlist,
  removeLocalWishlist,
  clearLocalWishlist,
} from "@cms/storefront";
import { storefront } from "./storefront";
import { useCustomer } from "./customer";

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist context for the dev storefront (Phase L5.6).
//
// A PRODUCT-level wishlist. Two modes, picked from the customer auth state:
//   • persisted (logged-in + email-verified) → the server wishlist
//     (`/api/commerce/customers/wishlist`, the verification-gated account feature).
//   • local (guest OR logged-in-but-unverified) → the SDK's localStorage wishlist.
//
// On entering persisted mode we MERGE any local ids up to the server once per
// verified session (oldest-first so newest-first order is preserved), then clear
// local — mirroring the guest-cart merge. Mounted INSIDE <CustomerProvider> so it
// can read who's logged in.
// ─────────────────────────────────────────────────────────────────────────────

interface WishlistValue {
  /** Wishlisted product ids, newest first. Source of truth for heart/toggle state. */
  ids: string[];
  count: number;
  /** False until the first load/merge settles (so the page can show a spinner). */
  ready: boolean;
  /** Server-persisted (logged-in + verified) vs local (guest / unverified). */
  persisted: boolean;
  isWishlisted: (productId: string) => boolean;
  toggle: (productId: string) => Promise<void>;
}

const Ctx = createContext<WishlistValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { customer } = useCustomer();
  // Server mode iff logged in AND verified — matches the API's gate exactly.
  const persisted = !!customer?.emailVerified;
  const [ids, setIds] = useState<string[]>(() => getLocalWishlist());
  const [ready, setReady] = useState(false);
  // Guard: merge local→server at most once per verified session.
  const mergedFor = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setReady(false);
      if (persisted && customer) {
        try {
          if (mergedFor.current !== customer.id) {
            const local = getLocalWishlist();
            if (local.length) {
              // Add oldest-first so the server's newest-first order matches local.
              for (const id of [...local].reverse()) {
                try {
                  await storefront.addToWishlist(id);
                } catch {
                  /* skip an individual failure (e.g. product gone) — keep merging */
                }
              }
              clearLocalWishlist();
            }
            mergedFor.current = customer.id;
          }
          const res = await storefront.getWishlist();
          if (alive) setIds(res.productIds);
        } catch {
          // Network / not-actually-verified — fall back to an empty server view.
          if (alive) setIds([]);
        } finally {
          if (alive) setReady(true);
        }
      } else {
        // Guest / unverified → local store.
        mergedFor.current = null;
        if (alive) {
          setIds(getLocalWishlist());
          setReady(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [persisted, customer?.id]);

  const isWishlisted = useCallback((productId: string) => ids.includes(productId), [ids]);

  const toggle = useCallback(
    async (productId: string) => {
      const currentlyIn = ids.includes(productId);
      if (persisted) {
        try {
          const next = currentlyIn
            ? await storefront.removeFromWishlist(productId)
            : await storefront.addToWishlist(productId);
          setIds(next);
          notifications.show({
            color: currentlyIn ? "gray" : "teal",
            message: currentlyIn ? "Removed from your wishlist." : "Saved to your wishlist.",
          });
        } catch (e) {
          const err = e as StorefrontError;
          notifications.show({
            color: "red",
            message:
              err.code === "email_not_verified"
                ? "Verify your email to save your wishlist to your account."
                : "Couldn't update your wishlist. Please try again.",
          });
        }
      } else {
        const next = currentlyIn ? removeLocalWishlist(productId) : addLocalWishlist(productId);
        setIds(next);
        notifications.show({
          color: currentlyIn ? "gray" : "teal",
          message: currentlyIn ? "Removed from your wishlist." : "Saved to your wishlist (on this device).",
        });
      }
    },
    [ids, persisted],
  );

  const value: WishlistValue = { ids, count: ids.length, ready, persisted, isWishlisted, toggle };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWishlist(): WishlistValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWishlist must be used inside <WishlistProvider>");
  return v;
}
