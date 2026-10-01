import { describe, it, expect } from "vitest";
import { createSwellClient } from "../helpers/swell-client";
import { EVENT_GROUPS, getSegmentSettings, getSelectedEvents } from "../../functions/lib/segment";

// Read-only checks against the logged-in test store (uses swell-cli auth).
// Requires the app to be pushed first: `swell app push`.
describe("deployed app settings", () => {
  const swell = createSwellClient();

  it("reads the Segment settings section with defaults", async () => {
    const settings = await getSegmentSettings(swell as any);

    expect(settings).toBeTypeOf("object");
    expect(["us", "eu"]).toContain(settings.region);
    for (const group of Object.keys(EVENT_GROUPS)) {
      expect(Array.isArray(settings[`events_${group}`])).toBe(true);
    }
  });

  it("only contains selectable events", async () => {
    const settings = await getSegmentSettings(swell as any);
    const allowed = Object.values(EVENT_GROUPS).flat() as string[];

    for (const event of getSelectedEvents(settings)) {
      expect(allowed).toContain(event);
    }
  });
});
