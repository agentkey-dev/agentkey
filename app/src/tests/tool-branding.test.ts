import assert from "node:assert/strict";
import test from "node:test";

import {
  getBrandfetchLogoUrl,
  getToolDomain,
  normalizeToolUrl,
} from "@/lib/tool-branding";

test("tool URLs are normalized for bare domains", () => {
  assert.equal(normalizeToolUrl("linear.app"), "https://linear.app/");
  assert.equal(normalizeToolUrl(" https://linear.app/docs "), "https://linear.app/docs");
});

test("tool domains are extracted without www prefix", () => {
  assert.equal(getToolDomain("https://www.linear.app/docs"), "linear.app");
  assert.equal(getToolDomain("not a url"), null);
});

test("brandfetch logo URLs require both a valid domain and client id", () => {
  assert.equal(
    getBrandfetchLogoUrl("https://linear.app", "bf_client_123"),
    "https://cdn.brandfetch.io/linear.app?c=bf_client_123",
  );
  assert.equal(getBrandfetchLogoUrl("https://linear.app", undefined), null);
  assert.equal(getBrandfetchLogoUrl("", "bf_client_123"), null);
});
