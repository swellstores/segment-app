import { handleTrackEvent } from './lib/segment';

export const config: SwellConfig = {
  description: 'Send promotion events to Segment',
  model: {
    events: ['promotion.created', 'promotion.updated', 'promotion.deleted'],
  },
};

export default async function (req: SwellRequest) {
  await handleTrackEvent(req);
}
