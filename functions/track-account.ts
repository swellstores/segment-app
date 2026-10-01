import { handleTrackEvent } from './lib/segment';

export const config: SwellConfig = {
  description: 'Send account events to Segment',
  model: {
    events: ['account.created', 'account.updated', 'account.deleted', 'account.card.created', 'account.card.updated', 'account.card.deleted', 'account.address.created', 'account.address.updated', 'account.address.deleted', 'account.credit.created', 'account.credit.updated', 'account.credit.deleted'],
  },
};

export default async function (req: SwellRequest) {
  await handleTrackEvent(req);
}
