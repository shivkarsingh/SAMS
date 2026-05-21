import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAvatarDataUrl } from "../src/services/userProfileService.js";

test("accepts image data URLs for saved profile photos", () => {
  assert.equal(
    normalizeAvatarDataUrl("data:image/jpeg;base64,abc"),
    "data:image/jpeg;base64,abc"
  );
});

test("allows clearing a saved profile photo", () => {
  assert.equal(normalizeAvatarDataUrl(""), "");
  assert.equal(normalizeAvatarDataUrl(null), "");
});

test("rejects non-image profile photos", () => {
  assert.throws(
    () => normalizeAvatarDataUrl("data:text/plain;base64,abc"),
    /must be an image/
  );
});
