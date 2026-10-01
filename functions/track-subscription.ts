import { handleTrackEvent } from './lib/segment';

export const config: SwellConfig = {
  description: 'Send subscription events to Segment',
  model: {
    events: ['subscription.created', 'subscription.updated', 'subscription.deleted', 'subscription.activated', 'subscription.trial_will_end', 'subscription.trial_ended', 'subscription.invoiced', 'subscription.payment_failed', 'subscription.paid', 'subscription.canceled', 'subscription.paused', 'subscription.resumed', 'subscription.completed'],
  },
};

export default async function (req: SwellRequest) {
  await handleTrackEvent(req);
}
