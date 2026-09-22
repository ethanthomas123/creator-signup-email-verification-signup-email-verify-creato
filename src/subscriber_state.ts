export type SubscriberState = {
  email: string;
  creatorId: string;
  assetSlug: string;
  updateTopics: string[];
  emailVerified: boolean;
  assetDelivery: "locked" | "ready";
  contentProcessing: "queued" | "eligible";
  subscriberUpdates: "paused" | "subscribed";
};

export function pendingSubscriber(input: {
  email: string;
  creatorId: string;
  assetSlug: string;
  updateTopics: string[];
}): SubscriberState {
  return {
    email: input.email,
    creatorId: input.creatorId,
    assetSlug: input.assetSlug,
    updateTopics: input.updateTopics,
    emailVerified: false,
    assetDelivery: "locked",
    contentProcessing: "queued",
    subscriberUpdates: "paused",
  };
}

export function verifySubscriber(state: SubscriberState): SubscriberState {
  return {
    email: state.email,
    creatorId: state.creatorId,
    assetSlug: state.assetSlug,
    updateTopics: state.updateTopics,
    emailVerified: true,
    assetDelivery: "ready",
    contentProcessing: "eligible",
    subscriberUpdates: state.updateTopics.length > 0 ? "subscribed" : "paused",
  };
}
