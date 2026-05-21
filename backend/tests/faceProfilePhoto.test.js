import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidEnrollmentImage,
  resolveProfilePhotoUrl
} from "../src/services/faceProfileService.js";

test("accepts enrollment image payloads with image data URLs", () => {
  assert.equal(
    isValidEnrollmentImage({
      fileName: "student.jpg",
      dataUrl: "data:image/jpeg;base64,abc"
    }),
    true
  );
});

test("rejects missing file names and non-image data URLs", () => {
  assert.equal(
    isValidEnrollmentImage({
      fileName: "",
      dataUrl: "data:image/jpeg;base64,abc"
    }),
    false
  );
  assert.equal(
    isValidEnrollmentImage({
      fileName: "student.txt",
      dataUrl: "data:text/plain;base64,abc"
    }),
    false
  );
});

test("uses the first valid uploaded enrollment image as the shared profile photo", () => {
  const photoUrl = resolveProfilePhotoUrl([
    {
      fileName: "",
      dataUrl: "data:image/jpeg;base64,bad"
    },
    {
      fileName: "first-valid.jpg",
      dataUrl: "data:image/jpeg;base64,first"
    },
    {
      fileName: "second-valid.jpg",
      dataUrl: "data:image/jpeg;base64,second"
    }
  ]);

  assert.equal(photoUrl, "data:image/jpeg;base64,first");
});
