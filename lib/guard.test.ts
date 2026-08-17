import { describe, expect, it } from "vitest";
import { demoFixtureAllowed } from "./guard";

describe("demoFixtureAllowed", () => {
  it("is enabled outside production by default", () => {
    expect(demoFixtureAllowed()).toBe(true);
  });
});
