import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter, Route, Routes } from "react-router";
import axe from "axe-core";
import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Automated a11y scan (Phase L9.6): axe-core over the cart + checkout pages and
// the cookie banner, rendered with a mocked storefront client (a payable
// one-line cart). Color-contrast is skipped — jsdom does no real layout/paint,
// so axe can't compute it reliably; everything else must come back clean.
// ─────────────────────────────────────────────────────────────────────────────

const CART = {
  id: "cart-1",
  itemCount: 2,
  vatRegistered: true,
  b2b: null,
  warnings: [],
  coupons: [],
  items: [
    {
      variantId: "var-1",
      productId: "prod-1",
      sku: "SKU-1",
      name: "Test Widget",
      slug: "test-widget",
      image: null,
      taxClass: "standard",
      purchasable: true,
      quantity: 2,
      unitPrice: 1999,
      regularPrice: 1999,
      salePrice: null,
      onSale: false,
      lineTotal: 3998,
      inventoryTracked: true,
      backorder: false,
      onHand: 10,
      weightGrams: 500,
      available: 10,
    },
  ],
  shipping: {
    country: "HR",
    method: { id: "ship-1", code: "courier", name: "Courier", kind: "courier", codAllowed: true },
    pickupPoint: null,
    codSelected: false,
    free: false,
    freeByCoupon: false,
  },
  totals: {
    itemsSubtotal: 3998,
    discountTotal: 0,
    shipping: { net: 400, vat: 100, gross: 500, rateBps: 2500 },
    surcharge: null,
    netTotal: 3598,
    taxTotal: 900,
    grossTotal: 4498,
    taxSummary: [{ rateBps: 2500, net: 3598, vat: 900 }],
    lines: [
      { id: "var-1", quantity: 2, unitPrice: 1999, discount: 0, net: 3198, vat: 800, gross: 3998, rateBps: 2500, taxClass: "standard" },
    ],
  },
};

const SHIPPING_OPTIONS = {
  country: "HR",
  methods: [
    { methodId: "ship-1", code: "courier", name: "Courier", kind: "courier", requiresPickupPoint: false, codAllowed: true, rate: { gross: 500 }, free: false, pickupPoints: [] },
  ],
};

vi.mock("@/lib/storefront", () => ({
  storefront: {
    getCart: async () => CART,
    getShippingMethods: async () => SHIPPING_OPTIONS,
    setShipping: async () => CART,
    previewCheckout: async () => ({
      isQuote: false,
      cart: CART,
      paymentMethods: ["pay_now", "bank_transfer", "cod"],
      defaultPaymentMethod: "pay_now",
    }),
    getCustomer: async () => null,
    getCsrfToken: async () => "",
    listOAuthProviders: async () => [],
    listAddresses: async () => [],
    getAnalyticsConfig: async () => ({ ga4MeasurementId: null }),
    recordConsent: async () => ({ ok: true }),
  },
}));

vi.mock("@/lib/api", () => ({
  getSiteSettings: async () => ({
    siteTitle: "Test Shop",
    defaultLocale: "en",
    availableLocales: ["en"],
    faviconUrl: null,
  }),
  getStrings: async () => ({}),
  getMenu: async () => [],
}));

import { LocaleConfigProvider, StringsProvider } from "@/lib/locale";
import { CartProvider } from "@/lib/cart";
import { CustomerProvider } from "@/lib/customer";
import { ConsentProvider } from "@/lib/consent";
import { CartPage } from "@/routes/CartPage";
import { CheckoutPage } from "@/routes/CheckoutPage";
import { CookieBanner } from "@/components/CookieBanner";

function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>
      <LocaleConfigProvider>
        <MemoryRouter initialEntries={["/en/checkout"]}>
          <Routes>
            <Route
              path="/:locale/*"
              element={
                <CartProvider>
                  <CustomerProvider>
                    <ConsentProvider>
                      {/* Landmark wrapper — pages normally render inside RootLayout's <main>. */}
                      <StringsProvider locale="en"><main>{children}</main></StringsProvider>
                    </ConsentProvider>
                  </CustomerProvider>
                </CartProvider>
              }
            />
          </Routes>
        </MemoryRouter>
      </LocaleConfigProvider>
    </MantineProvider>
  );
}

async function expectNoViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      // jsdom does no layout/paint — axe can't compute contrast there.
      "color-contrast": { enabled: false },
    },
  });
  const failures = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target.join(" ")),
  }));
  expect(failures).toEqual([]);
}

describe("a11y (axe) on the shop's money pages", () => {
  // RTL auto-cleanup needs vitest globals; we run without them — clean explicitly
  // so a previous test's <main> doesn't duplicate landmarks in the next scan.
  afterEach(cleanup);

  test("cart page has no axe violations", async () => {
    const { container, findByText } = render(
      <Providers>
        <CartPage />
      </Providers>,
    );
    await findByText("Test Widget"); // cart fixture rendered
    await expectNoViolations(container);
  });

  test("checkout page has no axe violations", async () => {
    const { container, findByLabelText } = render(
      <Providers>
        <CheckoutPage />
      </Providers>,
    );
    await findByLabelText(/^Email \*?$/); // form rendered from the preview
    await expectNoViolations(container);
  });

  test("cookie banner is a labelled region with real buttons", async () => {
    const { container, findByRole } = render(
      <Providers>
        <CookieBanner />
      </Providers>,
    );
    const region = await findByRole("region", { name: /cookie consent/i });
    expect(region).toBeTruthy();
    const accept = await findByRole("button", { name: /accept analytics/i });
    const decline = await findByRole("button", { name: /decline/i });
    expect(accept).toBeTruthy();
    expect(decline).toBeTruthy();
    await expectNoViolations(container);
  });

  test("checkout surfaces field errors accessibly on a failed submit (aria-invalid)", async () => {
    const { findByRole, findByLabelText } = render(
      <Providers>
        <CheckoutPage />
      </Providers>,
    );
    const place = await findByRole("button", { name: /place order/i });
    await waitFor(() => expect(place.hasAttribute("disabled")).toBe(false));
    place.click();
    const email = await findByLabelText(/^Email \*?$/);
    await waitFor(() => expect(email.getAttribute("aria-invalid")).toBe("true"));
  });
});
