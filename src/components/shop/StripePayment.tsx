import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Alert, Button, Stack, Text } from "@mantine/core";
import { AlertCircle } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Stripe payment (client half; Phase L6.2). Mounts Stripe Elements with the
// `client_secret` the API returned from `initiatePayment` and confirms the card
// in-browser. Card data NEVER touches our servers (PCI/SAQ A) — only the opaque
// client_secret does.
//
// IMPORTANT: confirming the card does NOT mark the order paid here — the order
// flips to paid off the Stripe WEBHOOK (design §11), never the browser result. On
// a successful confirm we call `onConfirmed()`; the OrderPage then POLLS the order
// until the webhook lands. `redirect: "if_required"` keeps the common card path
// in-page (only 3DS challenges redirect, then return to this same page).
// ─────────────────────────────────────────────────────────────────────────────

function PayForm({ onConfirmed }: { onConfirmed: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: window.location.href },
    });
    if (confirmError) {
      setError(confirmError.message ?? "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }
    // Confirmed on Stripe's side — the order flips off the webhook/reconcile, not here:
    //   • succeeded / processing → automatic capture (charged)
    //   • requires_capture       → MANUAL capture (authorized, captured later at dispatch)
    // All three mean "card confirmed, start polling for the server to catch up".
    if (
      paymentIntent &&
      (paymentIntent.status === "succeeded" ||
        paymentIntent.status === "processing" ||
        paymentIntent.status === "requires_capture")
    ) {
      onConfirmed();
      return;
    }
    setSubmitting(false);
  };

  return (
    <Stack gap="sm">
      <PaymentElement />
      {error && (
        <Alert color="red" icon={<AlertCircle size={16} />}>
          {error}
        </Alert>
      )}
      <Button onClick={() => void submit()} loading={submitting} disabled={!stripe || !elements}>
        Pay now
      </Button>
      <Text c="dimmed" fz="xs">
        Test mode — use card <b>4242&nbsp;4242&nbsp;4242&nbsp;4242</b>, any future expiry &amp; CVC.
      </Text>
    </Stack>
  );
}

export function StripePayment({
  publishableKey,
  clientSecret,
  onConfirmed,
}: {
  publishableKey: string;
  clientSecret: string;
  onConfirmed: () => void;
}) {
  // loadStripe is memoized so the Stripe.js singleton isn't re-created on re-render.
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
      <PayForm onConfirmed={onConfirmed} />
    </Elements>
  );
}
