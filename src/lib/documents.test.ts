import { describe, it, expect } from "vitest";
import {
  validateUpload,
  isAllowedMimeType,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
} from "./documents";

describe("isAllowedMimeType", () => {
  it("accepts each allowed type", () => {
    for (const type of ALLOWED_MIME_TYPES) {
      expect(isAllowedMimeType(type)).toBe(true);
    }
  });

  it("rejects disallowed types", () => {
    expect(isAllowedMimeType("application/zip")).toBe(false);
    expect(isAllowedMimeType("image/gif")).toBe(false);
    expect(isAllowedMimeType("")).toBe(false);
  });
});

describe("validateUpload", () => {
  it("accepts a valid PDF under the size limit", () => {
    expect(validateUpload({ mimeType: "application/pdf", fileSize: 1024 })).toEqual({
      ok: true,
    });
  });

  it("rejects an unsupported mime type with INVALID_TYPE", () => {
    const result = validateUpload({ mimeType: "image/gif", fileSize: 1024 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_TYPE");
  });

  it("rejects an empty file with INVALID_SIZE", () => {
    const result = validateUpload({ mimeType: "image/png", fileSize: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_SIZE");
  });

  it("rejects a non-finite file size with INVALID_SIZE", () => {
    const result = validateUpload({ mimeType: "image/png", fileSize: NaN });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_SIZE");
  });

  it("accepts a file exactly at the size limit", () => {
    expect(
      validateUpload({ mimeType: "image/jpeg", fileSize: MAX_FILE_SIZE })
    ).toEqual({ ok: true });
  });

  it("rejects a file one byte over the limit with FILE_TOO_LARGE", () => {
    const result = validateUpload({
      mimeType: "image/jpeg",
      fileSize: MAX_FILE_SIZE + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FILE_TOO_LARGE");
  });
});
