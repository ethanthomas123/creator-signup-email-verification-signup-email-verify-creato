import assert from "node:assert/strict";
import test from "node:test";
import { pendingSubscriber, verifySubscriber } from "../src/subscriber_state.ts";

test("verification unlocks delivery, processing, and requested updates", () => {
  const pending = pendingSubscriber({
    email: "reader@example.com",
    creatorId: "studio-notes",
    assetSlug: "lighting-presets",
    updateTopics: ["new-releases"],
  });

  assert.deepEqual(
    {
      assetDelivery: pending.assetDelivery,
      contentProcessing: pending.contentProcessing,
      subscriberUpdates: pending.subscriberUpdates,
    },
    { assetDelivery: "locked", contentProcessing: "queued", subscriberUpdates: "paused" },
  );

  const verified = verifySubscriber(pending);
  assert.deepEqual(
    {
      emailVerified: verified.emailVerified,
      assetDelivery: verified.assetDelivery,
      contentProcessing: verified.contentProcessing,
      subscriberUpdates: verified.subscriberUpdates,
    },
    {
      emailVerified: true,
      assetDelivery: "ready",
      contentProcessing: "eligible",
      subscriberUpdates: "subscribed",
    },
  );
});

test("verification keeps updates paused when no topics were requested", () => {
  const verified = verifySubscriber(pendingSubscriber({
    email: "quiet@example.com",
    creatorId: "studio-notes",
    assetSlug: "lighting-presets",
    updateTopics: [],
  }));
  assert.equal(verified.assetDelivery, "ready");
  assert.equal(verified.subscriberUpdates, "paused");
});
