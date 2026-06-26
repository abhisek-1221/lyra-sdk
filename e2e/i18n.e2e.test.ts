// ---------------------------------------------------------------------------
// lyra-sdk — I18n module end-to-end tests
// ---------------------------------------------------------------------------
//
// Exercises `YTClient.regions` and `YTClient.languages` against the real
// YouTube Data API. Both endpoints are cheap (1 quota unit each) and stable
// — they return the same set of supported regions/languages every time.
// ---------------------------------------------------------------------------

import { expect } from "vitest";
import { describeE2E, getClient, itE2E } from "./_setup.js";

describeE2E("YTClient.regions (e2e)", () => {
  itE2E("returns a non-empty list including the United States", async () => {
    const client = getClient();
    const regions = await client.regions();

    expect(regions.length).toBeGreaterThan(10);
    const us = regions.find((r) => r.id === "US");
    expect(us).toBeDefined();
    expect(us?.gl).toBe("US");
    expect(us?.name.length).toBeGreaterThan(0);
  });
});

describeE2E("YTClient.languages (e2e)", () => {
  itE2E("returns a non-empty list including English", async () => {
    const client = getClient();
    const langs = await client.languages();

    expect(langs.length).toBeGreaterThan(5);
    const en = langs.find((l) => l.id === "en");
    expect(en).toBeDefined();
    expect(en?.hl).toBe("en");
    expect(en?.name.toLowerCase()).toContain("english");
  });
});
