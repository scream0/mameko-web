import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOrderReviewState,
  normalizeProductReview,
  extractHelpfulVoteResponse,
} from "./reviewSync.ts";

test("normalizeOrderReviewState reads backend snake_case fields matching Android OrderDto", () => {
  const state = normalizeOrderReviewState({
    id: "ord-1",
    is_reviewed: true,
    review_edit_count: 0,
    review_rating: 5,
    review_comment: "Wangi tahan lama",
  });

  assert.equal(state.isReviewed, true);
  assert.equal(state.reviewEditCount, 0);
  assert.equal(state.reviewRating, 5);
  assert.equal(state.reviewComment, "Wangi tahan lama");
  assert.equal(state.canCreateReview, false);
  assert.equal(state.canEditReview, true);
  assert.equal(state.isReviewQuotaExhausted, false);
});

test("normalizeOrderReviewState detects exhausted 1x edit quota", () => {
  const state = normalizeOrderReviewState({
    is_reviewed: true,
    review_edit_count: 1,
    review_rating: 4,
    review_comment: "Updated review",
  });

  assert.equal(state.canCreateReview, false);
  assert.equal(state.canEditReview, false);
  assert.equal(state.isReviewQuotaExhausted, true);
});

test("normalizeProductReview prioritizes camelCase fields from Go models.Review", () => {
  const review = normalizeProductReview({
    id: "rev-1",
    productId: "prod-1",
    userName: "Budi Santoso",
    rating: 5,
    comment: "Mantap",
    reviewPhoto: "https://res.cloudinary.com/demo/image/upload/rev.webp",
    helpfulCount: 3,
    isHelpful: true,
    createdAt: "2026-11-10T10:00:00Z",
  });

  assert.equal(review.userName, "Budi Santoso");
  assert.equal(review.reviewPhoto, "https://res.cloudinary.com/demo/image/upload/rev.webp");
  assert.equal(review.helpfulCount, 3);
  assert.equal(review.isHelpful, true);
  assert.equal(review.createdAt, "2026-11-10T10:00:00Z");
});

test("extractHelpfulVoteResponse reads camelCase helpful toggle response", () => {
  const parsed = extractHelpfulVoteResponse({
    success: true,
    isHelpful: true,
    helpfulCount: 7,
  });

  assert.equal(parsed.isHelpful, true);
  assert.equal(parsed.helpfulCount, 7);
});

