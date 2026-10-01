import { handleTrackEvent } from './lib/segment';

export const config: SwellConfig = {
  description: 'Send coupon events to Segment',
  model: {
    events: ['coupon.created', 'coupon.updated', 'coupon.deleted', 'coupon.code.created', 'coupon.code.deleted', 'coupon.generation.completed'],
  },
};

export default async function (req: SwellRequest) {
  await handleTrackEvent(req);
}
