import { pendingReview } from "@/pipeline/review";

import { ReviewDeck } from "./ReviewDeck";

export const dynamic = "force-dynamic";

/**
 * The review queue. Nothing reaches outreach without passing through here, so
 * this page is the one place a human decides a real business's site is right.
 */
export default async function ReviewPage() {
  const cards = await pendingReview();
  return <ReviewDeck cards={cards} />;
}
