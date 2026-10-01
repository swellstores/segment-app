import { handleTrackEvent } from './lib/segment';

export const config: SwellConfig = {
  description: 'Send cart events to Segment',
  model: {
    events: ['cart.created', 'cart.deleted', 'cart.converted', 'cart.abandoned'],
  },
};

export default async function (req: SwellRequest) {
  await handleTrackEvent(req);
}
