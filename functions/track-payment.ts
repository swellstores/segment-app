import { handleTrackEvent } from './lib/segment';

export const config: SwellConfig = {
  description: 'Send payment events to Segment',
  model: {
    events: ['payment.succeeded', 'payment.failed', 'payment.voided', 'payment.refund.succeeded', 'payment.refund.failed', 'payment.refund.voided'],
  },
};

export default async function (req: SwellRequest) {
  await handleTrackEvent(req);
}
