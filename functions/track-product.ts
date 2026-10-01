import { handleTrackEvent } from './lib/segment';

export const config: SwellConfig = {
  description: 'Send product events to Segment',
  model: {
    events: ['product.created', 'product.updated', 'product.deleted', 'product.stock_adjusted', 'product.variant.created', 'product.variant.updated', 'product.variant.deleted', 'product.review.created', 'product.review.updated', 'product.review.deleted'],
  },
};

export default async function (req: SwellRequest) {
  await handleTrackEvent(req);
}
