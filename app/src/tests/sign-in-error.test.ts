import assert from "node:assert/strict";
import test from "node:test";

import { getSignInErrorMessage } from "@/lib/auth/sign-in-error";

test("sign-in errors explain the failure without mislabeling every link expired", () => {
  assert.match(getSignInErrorMessage("expired") ?? "", /expired.*already used/i);

  const originMessage = getSignInErrorMessage("invalid-origin") ?? "";
  assert.match(originMessage, /confirm this sign-in request.*reopen the link/i);
  assert.doesNotMatch(originMessage, /expired/i);

  const verificationMessage = getSignInErrorMessage("verification") ?? "";
  assert.match(verificationMessage, /did not pass verification.*request a new link/i);
  assert.doesNotMatch(verificationMessage, /expired/i);

  const missingMessage = getSignInErrorMessage("missing-token") ?? "";
  assert.match(missingMessage, /incomplete.*full link/i);
  assert.doesNotMatch(missingMessage, /expired/i);
});

test("unknown sign-in errors use safe fixed copy and absent errors show no message", () => {
  assert.equal(getSignInErrorMessage(), null);
  assert.equal(getSignInErrorMessage(""), null);

  const fallback = getSignInErrorMessage("unexpected-error") ?? "";
  assert.match(fallback, /request a new link/i);
  assert.doesNotMatch(fallback, /expired|unexpected-error/i);
  assert.equal(getSignInErrorMessage('<script>alert("untrusted")</script>'), fallback);
});
