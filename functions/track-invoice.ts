import { handleTrackEvent } from './lib/segment';

export const config: SwellConfig = {
  description: 'Send invoice events to Segment',
  model: {
    events: ['invoice.created', 'invoice.updated', 'invoice.deleted', 'invoice.payment_succeeded', 'invoice.payment_failed'],
  },
};

export default async function (req: SwellRequest) {
  await handleTrackEvent(req);
}
