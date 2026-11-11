import { describe, it, expect, vi, afterEach } from "vitest";
import { createMockRequest } from "../helpers/mock-request";
import testConnection, { config } from "../../functions/test-connection";

afterEach(() => {
  vi.restoreAllMocks();
});

function run(segment: object) {
  return testConnection(createMockRequest({ swell: { settings: vi.fn().mockResolvedValue({ segment }) } }));
}

const sourceSettings = (apiHost: string) => Response.json({ integrations: { "Segment.io": { apiHost } } });

describe("test-connection", () => {
  it("is an action", () => {
    expect(config.action).toBe(true);
  });

  it("asks for the write key without calling Segment", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(run({})).rejects.toMatchObject({
      status: 400,
      message: "Add the Segment write key and save the settings first.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the source settings for the write key", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(sourceSettings("api.segment.io/v1"));
    await expect(run({ write_key: "wk" })).resolves.toEqual({
      message: expect.stringMatching(/^Connected to Segment, US workspace: it recognizes the write key\./),
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://cdn.segment.com/v1/projects/wk/settings");
  });

  it("flags a region that doesn't match the workspace", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(sourceSettings("events.eu1.segmentapis.com/v1"));
    await expect(run({ write_key: "wk", region: "us" })).rejects.toThrow(/workspace is in the EU region/);
  });

  it("doesn't guess the region when the source settings don't name it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));
    await expect(run({ write_key: "wk", region: "eu" })).resolves.toEqual({
      message: expect.stringMatching(/^Connected to Segment: it recognizes the write key\./),
    });
  });

  it("rejects a write key Segment doesn't know", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Cannot GET - Invalid path or write key provided.", { status: 404 }));
    await expect(run({ write_key: "bad" })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/doesn't recognize this write key/) });
  });

  it("says when Segment can't be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    await expect(run({ write_key: "wk" })).rejects.toThrow(/couldn't be reached/);
  });
});
