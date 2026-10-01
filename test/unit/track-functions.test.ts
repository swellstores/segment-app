import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EVENT_GROUPS, type EventGroup } from "../../functions/lib/segment";
import { createMockRequest } from "../helpers/mock-request";

import * as trackAccount from "../../functions/track-account";
import * as trackCart from "../../functions/track-cart";
import * as trackCategory from "../../functions/track-category";
import * as trackCoupon from "../../functions/track-coupon";
import * as trackInvoice from "../../functions/track-invoice";
import * as trackOrder from "../../functions/track-order";
import * as trackPage from "../../functions/track-page";
import * as trackPayment from "../../functions/track-payment";
import * as trackProduct from "../../functions/track-product";
import * as trackPromotion from "../../functions/track-promotion";
import * as trackShipment from "../../functions/track-shipment";
import * as trackSubscription from "../../functions/track-subscription";

const FUNCTIONS: Record<EventGroup, { config: SwellConfig; default: (req: SwellRequest) => Promise<void> }> = {
  account: trackAccount,
  cart: trackCart,
  category: trackCategory,
  coupon: trackCoupon,
  invoice: trackInvoice,
  order: trackOrder,
  page: trackPage,
  payment: trackPayment,
  product: trackProduct,
  promotion: trackPromotion,
  shipment: trackShipment,
  subscription: trackSubscription,
};

describe("track-* functions", () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, "fetch");
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("has one function per event group", () => {
    expect(Object.keys(FUNCTIONS).sort()).toEqual(Object.keys(EVENT_GROUPS).sort());
  });

  describe.each(Object.entries(FUNCTIONS) as [EventGroup, (typeof FUNCTIONS)[EventGroup]][])(
    "track-%s",
    (group, fn) => {
      const events = EVENT_GROUPS[group];

      it("subscribes to exactly the group's events", () => {
        expect((fn.config as any).model.events).toEqual([...events]);
      });

      it("sends each subscribed event when selected", async () => {
        for (const eventType of events) {
          fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
          const req = createMockRequest({
            data: { id: "rec_1", $event: { id: `evt_${eventType}`, type: eventType } } as any,
            store: { id: "store_1" },
            swell: {
              settings: vi.fn().mockResolvedValue({
                segment: { write_key: "wk", [`events_${group}`]: [eventType] },
              }),
            },
          });

          await fn.default(req);

          const body = JSON.parse((fetchMock.mock.lastCall![1] as RequestInit).body as string);
          expect(body.messageId).toBe(`evt_${eventType}`);
          expect(body.properties).toEqual({ id: "rec_1" });
        }
        expect(fetchMock).toHaveBeenCalledTimes(events.length);
      });

      it("does nothing when no events are selected", async () => {
        const req = createMockRequest({
          data: { id: "rec_1", $event: { id: "evt", type: events[0] } } as any,
          swell: { settings: vi.fn().mockResolvedValue({ segment: { write_key: "wk" } }) },
        });

        await fn.default(req);

        expect(fetchMock).not.toHaveBeenCalled();
      });
    },
  );
});
