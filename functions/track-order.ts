import { handleTrackEvent } from './lib/segment';

export const config: SwellConfig = {
  description: 'Send order events to Segment',
  model: {
    events: ['order.created', 'order.updated', 'order.deleted', 'order.submitted', 'order.canceled', 'order.paid', 'order.payment_failed', 'order.refunded', 'order.delivered', 'order.trial_started', 'order.trial_will_end', 'order.trial_ended'],
  },
};

export default async function (req: SwellRequest) {
  await handleTrackEvent(req);
}
