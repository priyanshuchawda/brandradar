import { NextResponse } from "next/server";
import { z } from "zod";
import { SnapshotSchema } from "@/lib/schema";
import { breakSnapshot, healSnapshot } from "@/lib/mock";

const HealRequestSchema = z.object({
  action: z.enum(["break", "heal", "approve"]),
  snapshot: SnapshotSchema,
  prompt: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = HealRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const collectorId =
    parsed.data.snapshot.health.collector_ids[0] ?? "c_mock_brandradar";

  if (parsed.data.action === "break") {
    const snapshot = breakSnapshot(parsed.data.snapshot);
    return NextResponse.json({
      status: "broken",
      collector_id: collectorId,
      snapshot,
      next_step: "heal",
    });
  }

  if (parsed.data.action === "heal") {
    const preview = healSnapshot(parsed.data.snapshot);
    return NextResponse.json({
      status: "awaiting_approval",
      collector_id: collectorId,
      prompt:
        parsed.data.prompt ||
        "The price and rating fields return null since the site redesign. Re-capture them.",
      preview_result: preview.items[0],
      snapshot: parsed.data.snapshot,
      next_step: "approve",
    });
  }

  const snapshot = healSnapshot(parsed.data.snapshot);
  return NextResponse.json({
    status: "done",
    collector_id: collectorId,
    snapshot,
    note: "Collector ID unchanged. Downstream BrandRadar still points at the same c_*.",
  });
}
