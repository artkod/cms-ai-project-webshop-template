import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Anchor,
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Rating,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { MessageSquare } from "lucide-react";
import type { ProductReviewsResponse } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useCustomer } from "@/lib/customer";

// Product reviews block (L9.1): approved reviews + aggregate, and — for a
// verified customer without a prior review — a submit form. New reviews start
// `pending` (moderation), so after submitting the shopper sees an "awaiting
// approval" note instead of their review in the public list.
export function ReviewsSection({ productId, locale }: { productId: string; locale: string }) {
  const { customer } = useCustomer();
  const [data, setData] = useState<ProductReviewsResponse | null>(null);

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    let alive = true;
    storefront
      .listProductReviews(productId)
      .then((r) => alive && setData(r))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [productId]);

  // Refetch on product change AND on login/logout — `mine`/`canReview` are session-dependent.
  useEffect(() => reload(), [reload, customer?.id]);

  if (!data) return null;

  const submit = async () => {
    if (rating < 1) {
      notifications.show({ color: "red", message: "Pick a star rating first." });
      return;
    }
    setBusy(true);
    try {
      await storefront.submitReview(productId, {
        rating,
        title: title.trim() || null,
        body: body.trim() || null,
      });
      setRating(0);
      setTitle("");
      setBody("");
      notifications.show({ color: "teal", message: "Thanks! Your review is awaiting approval." });
      reload();
    } catch (err) {
      const code = (err as { code?: string }).code;
      notifications.show({
        color: "red",
        message:
          code === "review_exists"
            ? "You already reviewed this product."
            : code === "email_not_verified"
              ? "Verify your email to write a review."
              : code === "not_a_buyer"
                ? "Only customers who bought this product can review it."
                : "Could not submit the review. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Group gap="xs">
          <MessageSquare size={18} />
          <Title order={3}>Reviews</Title>
          {data.summary.count > 0 && data.summary.average != null && (
            <Group gap={6}>
              <Rating value={data.summary.average} fractions={10} readOnly size="sm" />
              <Text fz="sm" c="dimmed">
                {data.summary.average} / 5 ({data.summary.count})
              </Text>
            </Group>
          )}
        </Group>

        {data.data.length === 0 && (
          <Text c="dimmed" fz="sm">
            No reviews yet.
          </Text>
        )}

        {data.data.map((r) => (
          <Stack key={r.id} gap={4}>
            <Group gap="xs">
              <Rating value={r.rating} readOnly size="xs" />
              <Text fw={600} fz="sm">
                {r.authorName ?? "Anonymous"}
              </Text>
              {r.verifiedPurchase && (
                <Badge color="teal" variant="light" size="xs">
                  Verified purchase
                </Badge>
              )}
              <Text fz="xs" c="dimmed">
                {new Date(r.createdAt).toLocaleDateString()}
              </Text>
            </Group>
            {r.title && (
              <Text fw={600} fz="sm">
                {r.title}
              </Text>
            )}
            {r.body && <Text fz="sm">{r.body}</Text>}
          </Stack>
        ))}

        {data.mine && data.mine.status === "pending" && (
          <Text fz="sm" c="dimmed">
            Your review is awaiting approval.
          </Text>
        )}

        {data.canReview && (
          <>
            <Divider />
            <Stack gap="xs">
              <Text fw={600} fz="sm">
                Write a review
              </Text>
              <Rating value={rating} onChange={setRating} />
              <TextInput placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.currentTarget.value)} maxLength={200} />
              <Textarea
                placeholder="Share your experience (optional)"
                value={body}
                onChange={(e) => setBody(e.currentTarget.value)}
                minRows={3}
                maxLength={5000}
              />
              <Group>
                <Button onClick={submit} loading={busy} disabled={rating < 1}>
                  Submit review
                </Button>
              </Group>
            </Stack>
          </>
        )}

        {!customer && (
          <Text fz="sm" c="dimmed">
            <Anchor component={Link} to={`/${locale}/account`}>
              Sign in
            </Anchor>{" "}
            to write a review.
          </Text>
        )}
        {customer && !customer.emailVerified && !data.mine && (
          <Text fz="sm" c="dimmed">
            Verify your email to write a review.
          </Text>
        )}
        {customer && customer.emailVerified && !data.mine && !data.canReview && data.buyersOnly && (
          <Text fz="sm" c="dimmed">
            Only customers who bought this product can write a review.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
