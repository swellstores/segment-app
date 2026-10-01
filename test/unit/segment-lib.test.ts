import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  API_HOSTS,
  EVENT_GROUPS,
  LIBRARY_NAME,
  LIBRARY_VERSION,
  MAX_MESSAGE_BYTES,
  SegmentError,
  buildTrackPayload,
  formatEventName,
  getApiHost,
  getAuthHeader,
  getRecordData,
  getSegmentSettings,
  getSelectedEvents,
  handleTrackEvent,
  isEventSelected,
  sendTrack,
} from "../../functions/lib/segment";
import { createMockRequest } from "../helpers/mock-request";
import settingsFile from "../../settings/segment.json";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const PAYLOAD = buildTrackPayload({
  eventType: "cart.converted",
  eventId: "evt_1",
  storeId: "store_1",
  data: { id: "cart_1" },
  now: new Date("2026-01-01T00:00:00.000Z"),
});

describe("formatEventName", () => {
  it.each([
    ["cart.converted", "Cart Converted"],
    ["order.payment_failed", "Order Payment Failed"],
    ["product.review.created", "Product Review Created"],
    ["subscription.trial_will_end", "Subscription Trial Will End"],
    ["any-event.NAME", "Any Event Name"],
  ])("formats %s as %s", (type, expected) => {
    expect(formatEventName(type)).toBe(expected);
  });
});

describe("getApiHost", () => {
  it("defaults to the US endpoint", () => {
    expect(getApiHost()).toBe(API_HOSTS.us);
    expect(getApiHost("unknown")).toBe(API_HOSTS.us);
  });

  it("returns the EU endpoint", () => {
    expect(getApiHost("eu")).toBe("https://events.eu1.segmentapis.com");
  });
});

describe("getAuthHeader", () => {
  it("uses the write key as the basic auth username", () => {
    expect(getAuthHeader("wk")).toBe(`Basic ${btoa("wk:")}`);
  });
});

describe("getSelectedEvents / isEventSelected", () => {
  const settings = {
    events_cart: ["cart.converted"],
    events_order: ["order.paid", "order.created"],
    events_product: "not-an-array",
    events_unknown: ["unknown.event"],
  };

  it("flattens the per-group checkbox lists", () => {
    expect(getSelectedEvents(settings)).toEqual([
      "cart.converted",
      "order.paid",
      "order.created",
    ]);
  });

  it("ignores missing or invalid lists", () => {
    expect(getSelectedEvents({})).toEqual([]);
  });

  it("checks whether an event is selected", () => {
    expect(isEventSelected(settings, "order.paid")).toBe(true);
    expect(isEventSelected(settings, "order.updated")).toBe(false);
    expect(isEventSelected(settings, "unknown.event")).toBe(false);
  });
});

describe("getRecordData", () => {
  it("strips the $event metadata", () => {
    expect(getRecordData({ id: "1", total: 5, $event: { type: "x" } })).toEqual({
      id: "1",
      total: 5,
    });
  });

  it("handles undefined data", () => {
    expect(getRecordData(undefined)).toEqual({});
  });
});

describe("buildTrackPayload", () => {
  it("builds a Segment track message like the built-in integration", () => {
    expect(PAYLOAD).toEqual({
      userId: "store_1",
      event: "Cart Converted",
      properties: { id: "cart_1" },
      messageId: "evt_1",
      timestamp: "2026-01-01T00:00:00.000Z",
      context: { library: { name: LIBRARY_NAME, version: LIBRARY_VERSION } },
    });
  });

  it("falls back to the event id as userId", () => {
    const payload = buildTrackPayload({ eventType: "a.b", eventId: "evt_2", data: {} });
    expect(payload.userId).toBe("evt_2");
  });

  it("omits messageId without an event id", () => {
    const payload = buildTrackPayload({ eventType: "a.b", storeId: "s", data: {} });
    expect(payload).not.toHaveProperty("messageId");
  });
});

describe("getSegmentSettings", () => {
  it("returns the segment settings section", async () => {
    const swell = { settings: vi.fn().mockResolvedValue({ segment: { write_key: "wk" } }) };
    expect(await getSegmentSettings(swell as any)).toEqual({ write_key: "wk" });
  });

  it("returns an empty object when not configured", async () => {
    const swell = { settings: vi.fn().mockResolvedValue({}) };
    expect(await getSegmentSettings(swell as any)).toEqual({});
  });
});

describe("sendTrack", () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, "fetch");
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the message to the Segment tracking API", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));

    await sendTrack({ write_key: "wk" }, PAYLOAD);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.segment.io/v1/track");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa("wk:")}`);
    expect(JSON.parse(init.body as string)).toEqual(PAYLOAD);
  });

  it("uses the EU endpoint for the eu region", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await sendTrack({ write_key: "wk", region: "eu" }, PAYLOAD);
    expect(fetchMock.mock.calls[0][0]).toBe("https://events.eu1.segmentapis.com/v1/track");
  });

  it("throws a SegmentError with the response status", async () => {
    fetchMock.mockResolvedValue(new Response("bad key", { status: 401 }));

    const err = await sendTrack({ write_key: "wk" }, PAYLOAD).catch((e) => e);

    expect(err).toBeInstanceOf(SegmentError);
    expect(err.status).toBe(401);
    expect(err.detail).toBe("bad key");
    expect(err.message).toBe("Segment responded with 401: bad key");
  });

  it("throws a 503 SegmentError on network failure", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const err = await sendTrack({ write_key: "wk" }, PAYLOAD).catch((e) => e);

    expect(err).toBeInstanceOf(SegmentError);
    expect(err.status).toBe(503);
  });

  it("warns when the message is over Segment's size limit", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    const big = buildTrackPayload({
      eventType: "order.created",
      storeId: "s",
      data: { notes: "x".repeat(MAX_MESSAGE_BYTES) },
    });

    await sendTrack({ write_key: "wk" }, big);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("32 KB"));
  });
});

describe("handleTrackEvent", () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  function setup(settings: Record<string, unknown>, data: Record<string, unknown>) {
    return createMockRequest({
      data: data as any,
      store: { id: "store_1" },
      swell: { settings: vi.fn().mockResolvedValue({ segment: settings }) },
    });
  }

  const ORDER = { id: "order_1", total: 10, $event: { id: "evt_1", type: "order.paid" } };
  const SETTINGS = { write_key: "wk", events_order: ["order.paid"] };

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, "fetch");
    vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a selected event to Segment", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));

    expect(await handleTrackEvent(setup(SETTINGS, ORDER))).toBe(true);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({
      userId: "store_1",
      event: "Order Paid",
      messageId: "evt_1",
      properties: { id: "order_1", total: 10 },
    });
    expect(body.properties).not.toHaveProperty("$event");
  });

  it("skips events that are not selected", async () => {
    const req = setup({ ...SETTINGS, events_order: ["order.created"] }, ORDER);
    expect(await handleTrackEvent(req)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips when disabled", async () => {
    expect(await handleTrackEvent(setup({ ...SETTINGS, enabled: false }, ORDER))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips and warns when the write key is missing", async () => {
    expect(await handleTrackEvent(setup({ events_order: ["order.paid"] }, ORDER))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("write key is not set"));
  });

  it("skips data without an event type", async () => {
    expect(await handleTrackEvent(setup(SETTINGS, { id: "order_1" }))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs and swallows Segment 4xx errors", async () => {
    fetchMock.mockResolvedValue(new Response("invalid", { status: 400 }));

    expect(await handleTrackEvent(setup(SETTINGS, ORDER))).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("rejected"));
  });

  it("rethrows Segment 5xx errors so the platform retries", async () => {
    fetchMock.mockResolvedValue(new Response("down", { status: 502 }));

    await expect(handleTrackEvent(setup(SETTINGS, ORDER))).rejects.toMatchObject({
      name: "SegmentError",
      status: 502,
    });
  });
});

describe("settings/segment.json", () => {
  it("offers a checkbox list for every event group with matching events", () => {
    const group = settingsFile.fields.find((f: any) => f.type === "field_group") as any;
    const lists = Object.fromEntries(
      group.fields.map((f: any) => [f.id, f.options.map((o: any) => o.value)]),
    );
    const expected = Object.fromEntries(
      Object.entries(EVENT_GROUPS).map(([g, events]) => [`events_${g}`, [...events]]),
    );
    expect(lists).toEqual(expected);
  });
});
