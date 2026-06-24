import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { notifications } from "@mantine/notifications";
import { StorefrontError, type StorefrontCustomer, type RegisterInput, type LoginInput } from "@cms/storefront";
import { storefront } from "./storefront";
import { useCart } from "./cart";

// ─────────────────────────────────────────────────────────────────────────────
// Customer auth context for the dev storefront (Phase L5.1).
//
// Wraps the SEPARATE customer auth realm (cookie `cms_customer`, never the admin
// `cms_token`). On boot it asks the API who's logged in (`getCustomer`) and seeds
// a CSRF token. login/register set the httpOnly cookies server-side AND merge the
// guest cart into the customer cart (L4.2) — so both refresh the cart afterwards,
// making the merge observable in the header badge. Mounted INSIDE <CartProvider>
// so it can call cart.refresh().
// ─────────────────────────────────────────────────────────────────────────────

interface CustomerValue {
  customer: StorefrontCustomer | null;
  loading: boolean;
  register: (input: RegisterInput) => Promise<boolean>;
  login: (input: LoginInput) => Promise<boolean>;
  logout: () => Promise<void>;
  /** Re-fetch the current customer (e.g. after verifying email). */
  refresh: () => Promise<void>;
  /** Resend the verification email to the logged-in customer (L5.2). */
  resendVerification: () => Promise<boolean>;
  /** Confirm an email-verification token; refreshes `me` on success (L5.2). */
  verifyEmail: (token: string) => Promise<boolean>;
  /** Complete a password reset; auto-logs-in + merges the cart (L5.2). */
  resetPassword: (token: string, password: string) => Promise<boolean>;
  /** Change the logged-in customer's password (requires a verified email). */
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
}

const Ctx = createContext<CustomerValue | null>(null);

function authErrorMessage(err: StorefrontError): string {
  switch (err.code) {
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "account_disabled":
      return "This account has been disabled.";
    case "email_not_verified":
      return "Verify your email first to use this feature.";
    case "no_password_set":
      return "This account has no password yet — use “Forgot password” to set one.";
    case "invalid_or_expired":
      return "This link is invalid or has expired. Please request a new one.";
    case "email_taken":
      return "An account with this email already exists. Please sign in or reset your password.";
    case "validation_error":
      return "Please check your details and try again (password must be at least 8 characters).";
    case "csrf_invalid":
      return "Your session expired — please reload and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function CustomerProvider({ children }: { children: ReactNode }) {
  const { refresh: refreshCart } = useCart();
  const [customer, setCustomer] = useState<StorefrontCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  // Boot: resolve the current customer (if any) and seed the CSRF cookie so a
  // later logout (a CSRF-gated mutation) has its double-submit token ready.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [me] = await Promise.all([storefront.getCustomer(), storefront.getCsrfToken().catch(() => "")]);
        if (alive) setCustomer(me);
      } catch {
        /* not logged in / network — leave as null */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const register = useCallback(
    async (input: RegisterInput): Promise<boolean> => {
      try {
        const c = await storefront.register(input);
        setCustomer(c);
        await refreshCart(); // guest cart merged server-side → reflect it
        notifications.show({ color: "teal", message: "Welcome! Your account is ready." });
        return true;
      } catch (e) {
        // Existing-but-unverified email: the server silently re-sent a fresh
        // verification link. Not an error — guide the user to their inbox.
        if ((e as StorefrontError)?.code === "verification_resent") {
          notifications.show({
            color: "blue",
            message: "This email is already registered but not yet verified — we've sent a fresh verification link. Please check your inbox.",
          });
          return false;
        }
        notifications.show({ color: "red", message: authErrorMessage(e as StorefrontError) });
        return false;
      }
    },
    [refreshCart],
  );

  const login = useCallback(
    async (input: LoginInput): Promise<boolean> => {
      try {
        const c = await storefront.login(input);
        setCustomer(c);
        await refreshCart(); // guest cart merged into the account cart (L4.2)
        notifications.show({ color: "teal", message: "Signed in." });
        return true;
      } catch (e) {
        notifications.show({ color: "red", message: authErrorMessage(e as StorefrontError) });
        return false;
      }
    },
    [refreshCart],
  );

  const logout = useCallback(async () => {
    try {
      await storefront.logout();
    } catch {
      /* clearing client state is the important part */
    }
    setCustomer(null);
    await refreshCart(); // cart cookie now points at a fresh guest cart
    notifications.show({ color: "gray", message: "Signed out." });
  }, [refreshCart]);

  const refresh = useCallback(async () => {
    try {
      const me = await storefront.getCustomer();
      setCustomer(me);
    } catch {
      /* leave state as-is */
    }
  }, []);

  const resendVerification = useCallback(async (): Promise<boolean> => {
    try {
      const res = await storefront.resendVerification();
      notifications.show({
        color: "teal",
        message: res.alreadyVerified ? "Your email is already verified." : "Verification email sent — check your inbox.",
      });
      return true;
    } catch (e) {
      notifications.show({ color: "red", message: authErrorMessage(e as StorefrontError) });
      return false;
    }
  }, []);

  const verifyEmail = useCallback(
    async (token: string): Promise<boolean> => {
      try {
        await storefront.verifyEmail(token);
        await refresh(); // a logged-in session now reflects verified status
        return true;
      } catch (e) {
        notifications.show({ color: "red", message: authErrorMessage(e as StorefrontError) });
        return false;
      }
    },
    [refresh],
  );

  const resetPassword = useCallback(
    async (token: string, password: string): Promise<boolean> => {
      try {
        const c = await storefront.resetPassword(token, password);
        setCustomer(c); // reset auto-logs-in
        await refreshCart();
        notifications.show({ color: "teal", message: "Password updated — you're signed in." });
        return true;
      } catch (e) {
        notifications.show({ color: "red", message: authErrorMessage(e as StorefrontError) });
        return false;
      }
    },
    [refreshCart],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<boolean> => {
      try {
        await storefront.changePassword(currentPassword, newPassword);
        notifications.show({ color: "teal", message: "Password changed." });
        return true;
      } catch (e) {
        notifications.show({ color: "red", message: authErrorMessage(e as StorefrontError) });
        return false;
      }
    },
    [],
  );

  const value: CustomerValue = {
    customer,
    loading,
    register,
    login,
    logout,
    refresh,
    resendVerification,
    verifyEmail,
    resetPassword,
    changePassword,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCustomer(): CustomerValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCustomer must be used inside <CustomerProvider>");
  return v;
}
