export interface NormalizedOrderReviewState {
  isReviewed: boolean;
  reviewEditCount: number;
  reviewRating: number | null;
  reviewComment: string | null;
  canCreateReview: boolean;
  canEditReview: boolean;
  isReviewQuotaExhausted: boolean;
}

export interface NormalizedProductReview {
  id: string;
  userId: string | null;
  orderId: string | null;
  productId: string;
  userName: string;
  productName: string | null;
  rating: number;
  comment: string;
  reviewPhoto: string | null;
  approved: boolean;
  editCount: number;
  helpfulCount: number;
  isHelpful: boolean;
  createdAt: string;
}

/**
 * Normalizes order-level review fields from Go Backend (`is_reviewed`, `review_edit_count`,
 * `review_rating`, `review_comment`) with backward-compatible camelCase/legacy fallbacks.
 */
export function normalizeOrderReviewState(order: any): NormalizedOrderReviewState {
  const isReviewed = Boolean(
    order?.is_reviewed ?? order?.isReviewed ?? order?.hasBeenReviewed ?? false
  );

  const rawEditCount =
    order?.review_edit_count ?? order?.reviewEditCount ?? order?.edit_count ?? 0;
  const reviewEditCount = Number.isFinite(Number(rawEditCount))
    ? Math.max(0, Number(rawEditCount))
    : 0;

  const rawRating = order?.review_rating ?? order?.reviewRating ?? null;
  const reviewRating =
    rawRating !== null && rawRating !== undefined && Number.isFinite(Number(rawRating))
      ? Number(rawRating)
      : null;

  const rawComment = order?.review_comment ?? order?.reviewComment ?? null;
  const reviewComment =
    typeof rawComment === "string" && rawComment.trim() !== "" ? rawComment : null;

  return {
    isReviewed,
    reviewEditCount,
    reviewRating,
    reviewComment,
    canCreateReview: !isReviewed,
    canEditReview: isReviewed && reviewEditCount === 0,
    isReviewQuotaExhausted: isReviewed && reviewEditCount >= 1,
  };
}

/**
 * Normalizes product review items returned by `GET /api/reviews` (`models.Review` camelCase)
 * and helpful vote payloads from `POST /api/reviews/:id/helpful`.
 */
export function normalizeProductReview(raw: any): NormalizedProductReview {
  const userNameRaw = raw?.userName ?? raw?.user_name;
  const userName =
    typeof userNameRaw === "string" && userNameRaw.trim() !== ""
      ? userNameRaw.trim()
      : "Pelanggan Mameko";

  const ratingNum = Number(raw?.rating);
  const rating = Number.isFinite(ratingNum) && ratingNum >= 1 ? Math.min(5, Math.round(ratingNum)) : 5;

  const helpfulNum = Number(raw?.helpfulCount ?? raw?.helpful_count ?? 0);

  return {
    id: String(raw?.id ?? ""),
    userId: raw?.userId ?? raw?.user_id ?? null,
    orderId: raw?.orderId ?? raw?.order_id ?? null,
    productId: String(raw?.productId ?? raw?.product_id ?? ""),
    userName,
    productName: raw?.productName ?? raw?.product_name ?? null,
    rating,
    comment: typeof raw?.comment === "string" ? raw.comment : "",
    reviewPhoto: raw?.reviewPhoto ?? raw?.review_photo ?? null,
    approved: raw?.approved === undefined || raw?.approved === null ? true : Boolean(raw.approved),
    editCount: Number(raw?.editCount ?? raw?.edit_count ?? 0) || 0,
    helpfulCount: Number.isFinite(helpfulNum) ? Math.max(0, helpfulNum) : 0,
    isHelpful: Boolean(raw?.isHelpful ?? raw?.is_helpful ?? false),
    createdAt: String(raw?.createdAt ?? raw?.created_at ?? ""),
  };
}

export function extractHelpfulVoteResponse(data: any): {
  isHelpful: boolean;
  helpfulCount: number | null;
} {
  const isHelpful = Boolean(data?.isHelpful ?? data?.is_helpful ?? false);
  const rawCount = data?.helpfulCount ?? data?.helpful_count;
  const helpfulCount =
    rawCount !== undefined && rawCount !== null && Number.isFinite(Number(rawCount))
      ? Math.max(0, Number(rawCount))
      : null;

  return { isHelpful, helpfulCount };
}

