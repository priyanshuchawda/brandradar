import { afterEach, describe, expect, it } from "vitest";
import { geminiFlashModel, geminiLiteModel } from "./gemini";

const originalLite = process.env.GEMINI_MODEL;
const originalFlash = process.env.GEMINI_MODEL_FLASH;

afterEach(() => {
  if (originalLite === undefined) delete process.env.GEMINI_MODEL;
  else process.env.GEMINI_MODEL = originalLite;
  if (originalFlash === undefined) delete process.env.GEMINI_MODEL_FLASH;
  else process.env.GEMINI_MODEL_FLASH = originalFlash;
});

describe("gemini model routing", () => {
  it("keeps the lite slot on flash-lite even if GEMINI_MODEL is full flash", () => {
    process.env.GEMINI_MODEL = "gemini-3.6-flash";
    expect(geminiLiteModel()).toBe("gemini-3.1-flash-lite");
  });

  it("uses GEMINI_MODEL when it is a flash-lite id", () => {
    process.env.GEMINI_MODEL = "gemini-3.1-flash-lite";
    expect(geminiLiteModel()).toBe("gemini-3.1-flash-lite");
  });

  it("defaults the flash slot to gemini-3.6-flash", () => {
    delete process.env.GEMINI_MODEL_FLASH;
    expect(geminiFlashModel()).toBe("gemini-3.6-flash");
  });

  it("refuses flash-lite in the flash slot", () => {
    process.env.GEMINI_MODEL_FLASH = "gemini-3.1-flash-lite";
    expect(geminiFlashModel()).toBe("gemini-3.6-flash");
  });
});
