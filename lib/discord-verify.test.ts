import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyDiscordRequest } from "./discord-verify";

describe("verifyDiscordRequest", () => {
  it("accepts a valid Ed25519 Discord-style signature", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const der = publicKey.export({ type: "spki", format: "der" });
    const pubHex = Buffer.from(der.subarray(-32)).toString("hex");
    const body = JSON.stringify({ type: 1 });
    const timestamp = "1710000000";
    const signature = sign(
      null,
      Buffer.from(timestamp + body),
      privateKey,
    ).toString("hex");

    expect(verifyDiscordRequest(pubHex, signature, timestamp, body)).toBe(true);
  });

  it("rejects a bad signature", () => {
    const { publicKey } = generateKeyPairSync("ed25519");
    const der = publicKey.export({ type: "spki", format: "der" });
    const pubHex = Buffer.from(der.subarray(-32)).toString("hex");
    expect(
      verifyDiscordRequest(pubHex, "00".repeat(64), "1710000000", "{}"),
    ).toBe(false);
  });

  it("round-trips with PEM private key like the local harness", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const pubHex = Buffer.from(
      publicKey.export({ type: "spki", format: "der" }).subarray(-32),
    ).toString("hex");
    const pem = privateKey.export({ type: "pkcs8", format: "pem" });
    const key = createPrivateKey(pem);
    const body = '{"type":1}';
    const timestamp = "123";
    const signature = sign(null, Buffer.from(timestamp + body), key).toString(
      "hex",
    );
    expect(verifyDiscordRequest(pubHex, signature, timestamp, body)).toBe(true);
  });
});
