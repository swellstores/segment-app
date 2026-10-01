// Segment integration logic:
// - Only events selected by the merchant are sent.
// - Event name is the Swell event type split on `.`, `-`, `_` and capitalized,
//   e.g. `cart.converted` -> `Cart Converted`, `order.payment_failed` -> `Order Payment Failed`.
// - userId is the store id, falling back to the event id.
// - properties are the event record data.
// - Missing write key is logged, not thrown. Segment 4xx errors are logged and
//   swallowed; 5xx/network errors propagate so the platform can retry.

export const LIBRARY_NAME = 'swell-app-segment';
export const LIBRARY_VERSION = '1.0.0';

// Segment rejects single messages larger than 32 KB
export const MAX_MESSAGE_BYTES = 32 * 1024;

export const API_HOSTS: Record<string, string> = {
  us: 'https://api.segment.io',
  eu: 'https://events.eu1.segmentapis.com',
};

// Events offered to the merchant, grouped by model. Mirrors the built-in
// integration's event picker, adjusted to event types the platform accepts.
export const EVENT_GROUPS = {
  account: [
    'account.created',
    'account.updated',
    'account.deleted',
    'account.card.created',
    'account.card.updated',
    'account.card.deleted',
    'account.address.created',
    'account.address.updated',
    'account.address.deleted',
    'account.credit.created',
    'account.credit.updated',
    'account.credit.deleted',
  ],
  cart: ['cart.created', 'cart.deleted', 'cart.converted', 'cart.abandoned'],
  category: [
    'category.created',
    'category.updated',
    'category.deleted',
    'category.product.added',
    'category.product.removed',
  ],
  coupon: [
    'coupon.created',
    'coupon.updated',
    'coupon.deleted',
    'coupon.code.created',
    'coupon.code.deleted',
    'coupon.generation.completed',
  ],
  invoice: [
    'invoice.created',
    'invoice.updated',
    'invoice.deleted',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
  ],
  order: [
    'order.created',
    'order.updated',
    'order.deleted',
    'order.submitted',
    'order.canceled',
    'order.paid',
    'order.payment_failed',
    'order.refunded',
    'order.delivered',
    'order.trial_started',
    'order.trial_will_end',
    'order.trial_ended',
  ],
  page: [
    'page.created',
    'page.updated',
    'page.deleted',
  ],
  payment: [
    'payment.succeeded',
    'payment.failed',
    'payment.voided',
    'payment.refund.succeeded',
    'payment.refund.failed',
    'payment.refund.voided',
  ],
  product: [
    'product.created',
    'product.updated',
    'product.deleted',
    'product.stock_adjusted',
    'product.variant.created',
    'product.variant.updated',
    'product.variant.deleted',
    'product.review.created',
    'product.review.updated',
    'product.review.deleted',
  ],
  promotion: ['promotion.created', 'promotion.updated', 'promotion.deleted'],
  shipment: [
    'shipment.created',
    'shipment.updated',
    'shipment.deleted',
    'shipment.canceled',
  ],
  subscription: [
    'subscription.created',
    'subscription.updated',
    'subscription.deleted',
    'subscription.activated',
    'subscription.trial_will_end',
    'subscription.trial_ended',
    'subscription.invoiced',
    'subscription.payment_failed',
    'subscription.paid',
    'subscription.canceled',
    'subscription.paused',
    'subscription.resumed',
    'subscription.completed',
  ],
} as const;

export type EventGroup = keyof typeof EVENT_GROUPS;

export interface SegmentSettings {
  write_key?: string;
  enabled?: boolean;
  region?: string;
  [key: string]: unknown;
}

export interface TrackPayload {
  userId: string;
  event: string;
  properties: Record<string, unknown>;
  messageId?: string;
  timestamp: string;
  context: { library: { name: string; version: string } };
}

export class SegmentError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'SegmentError';
    this.status = status;
    this.detail = detail;
  }
}

export async function getSegmentSettings(swell: SwellAPI): Promise<SegmentSettings> {
  const settings = await swell.settings();
  return (settings?.segment as SegmentSettings) || {};
}

// Settings store one checkbox list per model group: `events_<group>`
export function getSelectedEvents(settings: SegmentSettings): string[] {
  const selected: string[] = [];
  for (const group of Object.keys(EVENT_GROUPS)) {
    const value = settings[`events_${group}`];
    if (Array.isArray(value)) {
      selected.push(...value.filter((v): v is string => typeof v === 'string'));
    }
  }
  return selected;
}

export function isEventSelected(settings: SegmentSettings, eventType: string): boolean {
  return getSelectedEvents(settings).includes(eventType);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

// 'cart.converted' -> 'Cart Converted'
export function formatEventName(type: string): string {
  return type
    .split(/[.\-_]/)
    .map((word) => capitalize(word))
    .join(' ');
}

export function getApiHost(region?: string): string {
  return API_HOSTS[region || 'us'] || API_HOSTS.us;
}

// Record fields without the `$event` metadata the platform adds
export function getRecordData(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const { $event, ...record } = data || {};
  return record;
}

export function buildTrackPayload({
  eventType,
  eventId,
  storeId,
  data,
  now = new Date(),
}: {
  eventType: string;
  eventId?: string;
  storeId?: string | null;
  data: Record<string, unknown>;
  now?: Date;
}): TrackPayload {
  const payload: TrackPayload = {
    userId: String(storeId || eventId || ''),
    event: formatEventName(eventType),
    properties: { ...data },
    timestamp: now.toISOString(),
    context: { library: { name: LIBRARY_NAME, version: LIBRARY_VERSION } },
  };
  // Segment deduplicates on messageId, so platform retries are not double counted
  if (eventId) {
    payload.messageId = eventId;
  }
  return payload;
}

export function getAuthHeader(writeKey: string): string {
  return `Basic ${btoa(`${writeKey}:`)}`;
}

export async function sendTrack(
  settings: SegmentSettings,
  payload: TrackPayload,
): Promise<Response> {
  const body = JSON.stringify(payload);

  if (body.length > MAX_MESSAGE_BYTES) {
    console.warn(
      `Segment: '${payload.event}' message is ${body.length} bytes, over Segment's 32 KB limit`,
    );
  }

  let response: Response;
  try {
    response = await fetch(`${getApiHost(settings.region)}/v1/track`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(String(settings.write_key)),
        'Content-Type': 'application/json',
      },
      body,
    });
  } catch (err) {
    throw new SegmentError(`Segment request failed: ${(err as Error).message}`, 503);
  }

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.text();
    } catch {
      detail = undefined;
    }
    throw new SegmentError(
      `Segment responded with ${response.status}${detail ? `: ${detail}` : ''}`,
      response.status,
      detail,
    );
  }

  return response;
}

// Shared handler for all track-<model> functions
export async function handleTrackEvent(req: SwellRequest): Promise<boolean> {
  const { swell, data } = req;
  const eventType: string | undefined = data?.$event?.type;
  const eventId: string | undefined = data?.$event?.id;

  if (!eventType) {
    return false;
  }

  const settings = await getSegmentSettings(swell);

  if (settings.enabled === false) {
    return false;
  }

  if (!isEventSelected(settings, eventType)) {
    return false;
  }

  if (!settings.write_key) {
    console.warn(`Segment: write key is not set, skipped '${eventType}'`);
    return false;
  }

  const payload = buildTrackPayload({
    eventType,
    eventId,
    storeId: req.store?.id || req.storeId,
    data: getRecordData(data),
  });

  try {
    await sendTrack(settings, payload);
    console.log(`Segment: tracked '${payload.event}' (${eventType})`);
    return true;
  } catch (err) {
    // Client errors are not retried
    if (err instanceof SegmentError && err.status < 500) {
      console.error(`Segment: '${eventType}' rejected - ${err.message}`);
      return false;
    }
    throw err;
  }
}
