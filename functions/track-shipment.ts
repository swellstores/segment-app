import { handleTrackEvent } from './lib/segment';

export const config: SwellConfig = {
  description: 'Send shipment events to Segment',
  model: {
    events: ['shipment.created', 'shipment.updated', 'shipment.deleted', 'shipment.canceled'],
  },
};

export default async function (req: SwellRequest) {
  await handleTrackEvent(req);
}
