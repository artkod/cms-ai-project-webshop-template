import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router";
import { notifications } from "@mantine/notifications";
import { StorefrontError, type Cart, type ShippingOptions, type SetShippingInput } from "@cms/storefront";
import { storefront } from "./storefront";
import { useLocaleConfig } from "./locale";

// ─────────────────────────────────────────────────────────────────────────────
// Cart context for the dev storefront (Phase L4.1).
//
// Wraps the server-side cart (the single money authority lives in the API — this
// only sends intent and renders what comes back). Keyed by the httpOnly cms_cart
// cookie, so a fresh load just calls getCart() and the server resolves the right
// cart. Every action returns the FULL recomputed cart, which we store as the new
// state; structured StorefrontError codes map to friendly toasts.
// ─────────────────────────────────────────────────────────────────────────────

interface CartValue {
  cart: Cart | null;
  loading: boolean;
  itemCount: number;
  shippingOptions: ShippingOptions | null;
  add: (variantId: string, quantity?: number) => Promise<void>;
  setQuantity: (variantId: string, quantity: number) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
  clear: () => Promise<void>;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => Promise<void>;
  loadShipping: (country?: string) => Promise<void>;
  setShipping: (input: SetShippingInput) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<CartValue | null>(null);

function cartErrorMessage(err: StorefrontError): string {
  switch (err.code) {
    case "not_purchasable":
      return "This product isn't available for purchase right now.";
    case "out_of_stock":
      return "Sorry — that item is out of stock.";
    case "coupon_not_found":
      return "That coupon code wasn't found.";
    case "coupon_not_applicable":
      return "That coupon can't be applied to your cart.";
    case "pickup_point_required":
      return "Please pick a pickup point for this method.";
    case "shipping_method_not_found":
      return "That shipping method is no longer available.";
    default:
      return "Something went wrong with your cart. Please try again.";
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const loc = locale ?? defaultLocale;
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [shippingOptions, setShippingOptions] = useState<ShippingOptions | null>(null);

  const apply = useCallback((next: Cart) => {
    setCart(next);
    for (const w of next.warnings ?? []) {
      if (w === "coupon_removed") {
        notifications.show({ color: "yellow", message: "Coupon removed — it's no longer valid for this cart." });
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      apply(await storefront.getCart({ locale: loc }));
    } catch {
      /* a network hiccup shouldn't blank the UI — keep the last known cart */
    } finally {
      setLoading(false);
    }
  }, [loc, apply]);

  // Load (and re-localize on locale change) the cart.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const guard = useCallback(
    async (fn: () => Promise<Cart>) => {
      try {
        apply(await fn());
      } catch (e) {
        notifications.show({ color: "red", message: cartErrorMessage(e as StorefrontError) });
      }
    },
    [apply],
  );

  const add = useCallback((variantId: string, quantity = 1) => guard(() => storefront.addCartItem(variantId, quantity, { locale: loc })), [guard, loc]);
  const setQuantity = useCallback((variantId: string, quantity: number) => guard(() => storefront.setCartItemQuantity(variantId, quantity, { locale: loc })), [guard, loc]);
  const remove = useCallback((variantId: string) => guard(() => storefront.removeCartItem(variantId, { locale: loc })), [guard, loc]);
  const clear = useCallback(() => guard(() => storefront.clearCart({ locale: loc })), [guard, loc]);
  const removeCoupon = useCallback(() => guard(() => storefront.removeCoupon({ locale: loc })), [guard, loc]);

  // Shipping: fetch the offerable methods for a destination (defaults to the
  // cart's stored country), and apply a selection (method/country/pickup/COD).
  const loadShipping = useCallback(
    async (country?: string) => {
      try {
        setShippingOptions(await storefront.getShippingMethods({ country, locale: loc }));
      } catch {
        /* a network hiccup shouldn't blank the options */
      }
    },
    [loc],
  );
  const setShipping = useCallback(
    async (input: SetShippingInput) => {
      await guard(() => storefront.setShipping(input, { locale: loc }));
      // Re-fetch options for the (possibly changed) destination so rates refresh.
      await loadShipping(input.country ?? undefined);
    },
    [guard, loc, loadShipping],
  );

  const applyCoupon = useCallback(
    async (code: string): Promise<boolean> => {
      try {
        apply(await storefront.applyCoupon(code, { locale: loc }));
        notifications.show({ color: "teal", message: "Coupon applied." });
        return true;
      } catch (e) {
        notifications.show({ color: "red", message: cartErrorMessage(e as StorefrontError) });
        return false;
      }
    },
    [apply, loc],
  );

  const value: CartValue = {
    cart,
    loading,
    itemCount: cart?.itemCount ?? 0,
    shippingOptions,
    add,
    setQuantity,
    remove,
    clear,
    applyCoupon,
    removeCoupon,
    loadShipping,
    setShipping,
    refresh,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be used inside <CartProvider>");
  return v;
}
