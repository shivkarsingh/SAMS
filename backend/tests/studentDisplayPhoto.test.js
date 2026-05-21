import assert from "node:assert/strict";
import test from "node:test";
import { resolveStudentDisplayPhotoUrl } from "../src/utils/studentDisplayPhoto.js";

test("uses the uploaded student avatar before the face enrollment photo", () => {
  assert.equal(
    resolveStudentDisplayPhotoUrl(
      { avatarDataUrl: "data:image/jpeg;base64,avatar" },
      { profilePhotoUrl: "data:image/jpeg;base64,enrollment" }
    ),
    "data:image/jpeg;base64,avatar"
  );
});

test("falls back to the face enrollment photo when the avatar is empty", () => {
  assert.equal(
    resolveStudentDisplayPhotoUrl(
      { avatarDataUrl: "" },
      { profilePhotoUrl: "data:image/jpeg;base64,enrollment" }
    ),
    "data:image/jpeg;base64,enrollment"
  );
});

test("returns an empty string when no display photo is available", () => {
  assert.equal(resolveStudentDisplayPhotoUrl({}, {}), "");
});
