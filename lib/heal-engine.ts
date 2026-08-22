import {
  assessListingExtract,
  defaultListingHealPrompt,
  type ExtractAssessment,
  type ListingRow,
} from "./extract-qa";
import { appendHealHistory } from "./heal-history";
import { geminiConfigured, proposeHealPrompt } from "./gemini";
import { isStudioCollectorId, runStudioCli } from "./studio";

export type HealLoopMode = "fixture" | "live";

export type HealLoopResult = {
  mode: HealLoopMode;
  collector_id: string;
  url: string;
  before: ExtractAssessment;
  after: ExtractAssessment | null;
  healed: boolean;
  same_id: true;
  prompt: string;
  prompt_source: "template" | "gemini" | "user";
  stages: string[];
  output_snippets: string[];
  rows_after: ListingRow[];
};

export async function resolveHealPrompt(input: {
  assessment: ExtractAssessment;
  userPrompt?: string;
  useGemini?: boolean;
}): Promise<{ prompt: string; source: "template" | "gemini" | "user" }> {
  if (input.userPrompt?.trim()) {
    return { prompt: input.userPrompt.trim().slice(0, 500), source: "user" };
  }
  const template = defaultListingHealPrompt(input.assessment);
  if (input.useGemini === false || !geminiConfigured()) {
    return { prompt: template, source: "template" };
  }
  try {
    const drafted = await proposeHealPrompt(
      [
        ...input.assessment.qa_flags,
        ...input.assessment.broken_fields.map((f) => `broken:${f}`),
        `null_rate=${input.assessment.null_rate}`,
        `rows=${input.assessment.row_count}`,
        "listing_only",
      ],
      template,
    );
    if (drafted && drafted.trim().length >= 40) {
      return { prompt: drafted.trim().slice(0, 500), source: "gemini" };
    }
  } catch {
    // fall through to template — never fail the heal loop on Gemini
  }
  return { prompt: template, source: "template" };
}

/**
 * Strong heal loop (cost-aware):
 * assess → one heal+approve (same c_*) → re-run verify via caller.
 * Fixture mode skips Studio/Gemini spend.
 */
export async function runHealAndVerify(input: {
  collectorId: string;
  url: string;
  surface: "heal-lab" | "intel" | "arena";
  brokenRows: ListingRow[];
  rerun: () => Promise<ListingRow[]>;
  mode?: HealLoopMode;
  userPrompt?: string;
  useGemini?: boolean;
  previousCount?: number | null;
  skipStudio?: boolean;
}): Promise<HealLoopResult> {
  const stages: string[] = [];
  const output_snippets: string[] = [];
  const mode: HealLoopMode = input.mode ?? (input.skipStudio ? "fixture" : "live");
  const collector_id = input.collectorId;

  const before = assessListingExtract(input.brokenRows, {
    previousCount: input.previousCount,
  });
  stages.push(`assess:${before.status}`);

  await appendHealHistory({
    at: new Date().toISOString(),
    collector_id,
    url: input.url,
    surface: input.surface,
    stage: "broken",
    before_count: before.valid_count,
    after_count: before.valid_count,
    null_rate: before.null_rate,
    qa_flags: before.qa_flags,
  });

  if (before.ok) {
    return {
      mode,
      collector_id,
      url: input.url,
      before,
      after: before,
      healed: false,
      same_id: true,
      prompt: "",
      prompt_source: "template",
      stages: [...stages, "skip:already_healthy"],
      output_snippets,
      rows_after: input.brokenRows,
    };
  }

  const { prompt, source } = await resolveHealPrompt({
    assessment: before,
    userPrompt: input.userPrompt,
    // Cost default: template only. Pass useGemini:true for Flash draft.
    useGemini: mode === "live" && input.useGemini === true,
  });
  stages.push(`prompt:${source}`);

  if (mode === "fixture" || input.skipStudio || !isStudioCollectorId(collector_id)) {
    stages.push("fixture_heal");
    const rows_after = await input.rerun();
    // Verify gate: rows back with title+url. Collapse vs last-good week belongs on pulls, not heal verify.
    const after = assessListingExtract(rows_after, { minRows: 1 });
    const recovered = after.valid_count >= 1 && after.status !== "empty";
    stages.push(`verify:${after.status}`);
    await appendHealHistory({
      at: new Date().toISOString(),
      collector_id,
      url: input.url,
      surface: input.surface,
      stage: recovered ? "recovered" : "still_broken",
      before_count: before.valid_count,
      after_count: after.valid_count,
      null_rate: after.null_rate,
      qa_flags: after.qa_flags,
      prompt_source: source,
      note: "fixture loop",
    });
    return {
      mode: "fixture",
      collector_id,
      url: input.url,
      before,
      after,
      healed: recovered,
      same_id: true,
      prompt,
      prompt_source: source,
      stages,
      output_snippets,
      rows_after,
    };
  }

  stages.push("studio_heal");
  await appendHealHistory({
    at: new Date().toISOString(),
    collector_id,
    url: input.url,
    surface: input.surface,
    stage: "heal_started",
    before_count: before.valid_count,
    after_count: 0,
    prompt_source: source,
  });

  const healCli = await runStudioCli("heal", [collector_id, input.url, prompt]);
  output_snippets.push(healCli.output.slice(0, 500));
  if (!healCli.ok) {
    stages.push("heal_failed");
    await appendHealHistory({
      at: new Date().toISOString(),
      collector_id,
      url: input.url,
      surface: input.surface,
      stage: "heal_failed",
      before_count: before.valid_count,
      after_count: 0,
      prompt_source: source,
      note: healCli.output.slice(0, 200),
    });
    return {
      mode,
      collector_id,
      url: input.url,
      before,
      after: null,
      healed: false,
      same_id: true,
      prompt,
      prompt_source: source,
      stages,
      output_snippets,
      rows_after: [],
    };
  }

  stages.push("studio_approve");
  const approved = await runStudioCli("approve", [collector_id, input.url]);
  output_snippets.push(approved.output.slice(0, 400));
  if (approved.ok) {
    await appendHealHistory({
      at: new Date().toISOString(),
      collector_id,
      url: input.url,
      surface: input.surface,
      stage: "approved",
      before_count: before.valid_count,
      after_count: 0,
      prompt_source: source,
    });
  }

  stages.push("rerun_verify");
  const rows_after = await input.rerun();
  const after = assessListingExtract(rows_after, { minRows: 1 });
  const recovered = after.valid_count >= 1 && after.status !== "empty";
  stages.push(`verify:${after.status}`);

  await appendHealHistory({
    at: new Date().toISOString(),
    collector_id,
    url: input.url,
    surface: input.surface,
    stage: recovered ? "recovered" : "still_broken",
    before_count: before.valid_count,
    after_count: after.valid_count,
    null_rate: after.null_rate,
    qa_flags: after.qa_flags,
    prompt_source: source,
  });

  return {
    mode,
    collector_id,
    url: input.url,
    before,
    after,
    healed: recovered,
    same_id: true,
    prompt,
    prompt_source: source,
    stages,
    output_snippets,
    rows_after,
  };
}

export function healStatusDiscordEmbed(input: {
  stage: "broken" | "recovered" | "still_broken";
  collectorId: string;
  url: string;
  beforeCount: number;
  afterCount: number;
  stages?: string[];
}): { content: string; embeds: Array<Record<string, unknown>> } {
  const color =
    input.stage === "recovered" ? 0x5cffb1 : input.stage === "broken" ? 0xff5d6a : 0xffb020;
  return {
    content: `🩹 **Collector ${input.stage}** · \`${input.collectorId}\``,
    embeds: [
      {
        title: `Self-heal · ${input.stage}`,
        description: [
          `Collector: \`${input.collectorId}\` (unchanged)`,
          `URL: ${input.url}`,
          `Rows: **${input.beforeCount}** → **${input.afterCount}**`,
          input.stages?.length ? `Stages: ${input.stages.join(" → ")}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        color,
        footer: { text: "BrandRadar · contract QA · one heal + verify" },
      },
    ],
  };
}
