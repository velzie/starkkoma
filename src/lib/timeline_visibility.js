const timelineVisibleUnauthenticated = (state, timeline) => (
  state.instance.publicTimelineVisibility[timeline] ?? false
);

const currentUser = (state) => state.users.currentUser;

const currentUserOrTimelineVisibleUnauthenticated = (state, timeline) => (
  currentUser(state) || timelineVisibleUnauthenticated(state, timeline)
);

const federatedTimelineAvailable = (state) => state.instance.federatedTimelineAvailable;

export const federatedTimelineVisible = (state) => (
  federatedTimelineAvailable(state) && currentUserOrTimelineVisibleUnauthenticated(state, 'federated')
);

export const publicTimelineVisible = (state) => (
  currentUserOrTimelineVisibleUnauthenticated(state, 'local')
);

export const bubbleTimelineVisible = (state) => (
  //state.instance.localBubbleInstances.length > 0 &&
  // TODO does sharkey have a way to see this?
  currentUserOrTimelineVisibleUnauthenticated(state, 'bubble')
);
