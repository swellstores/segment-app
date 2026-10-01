import { handleTrackEvent } from './lib/segment';

export const config: SwellConfig = {
  description: 'Send category events to Segment',
  model: {
    events: ['category.created', 'category.updated', 'category.deleted', 'category.product.added', 'category.product.removed'],
  },
};

export default async function (req: SwellRequest) {
  await handleTrackEvent(req);
}
