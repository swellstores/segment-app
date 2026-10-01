import { handleTrackEvent } from './lib/segment';

export const config: SwellConfig = {
  description: 'Send page events to Segment',
  model: {
    events: ['page.created', 'page.updated', 'page.deleted'],
  },
};

export default async function (req: SwellRequest) {
  await handleTrackEvent(req);
}
