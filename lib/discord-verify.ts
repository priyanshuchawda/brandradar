import { createPublicKey, verify } from "node:crypto";

/** Ed25519 SPKI DER prefix (OID 1.3.101.112) + 32-byte raw public key. */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/**
 * Verify a Discord Interactions request (Ed25519 over timestamp + body).
 * Uses SPKI wrapping so Node 20+/24 accept the key (raw format is rejected).
 */
export function verifyDiscordRequest(
  publicKeyHex: string,
  signature: string,
  timestamp: string,
  body: string,
): boolean {
  try {
    const raw = Buffer.from(publicKeyHex, "hex");
    if (raw.length !== 32) return false;
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
      format: "der",
      type: "spki",
    });
    return verify(
      null,
      Buffer.from(timestamp + body),
      key,
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}
