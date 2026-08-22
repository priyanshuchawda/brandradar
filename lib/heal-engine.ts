import {
  assessListingExtract,
  defaultListingHealPrompt,
  type ExtractAssessment,
  type ListingRow,
} from "./extract-qa";
import { appendHealHistory } from "./heal-history";
import { geminiConfigured, proposeHealPrompt } from "./gemini";
import {
  healPreviewLooksHealthy,
  isStudioCollectorId,
  runStudioCli,
} from "./studio";

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
  preview_title_count?: number;
  settle_attempts?: number;
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
        "prefer_data_attrs",
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Post-approve Collection runs often lag — BD + OSS demos settle-retry before failing.
 * Default: 4 attempts with backoff (0s, 8s, 16s, 32s).
 */
export async function rerunUntilHealthy(
  rerun: () => Promise<ListingRow[]>,
  options?: { attempts?: number; baseDelayMs?: number },
): Promise<{
  rows: ListingRow[];
  after: ExtractAssessment;
  recovered: boolean;
  attempts: number;
}> {
  const attempts = options?.attempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 8_000;
  let rows: ListingRow[] = [];
  let after = assessListingExtract([], { minRows: 1 });
  let recovered = false;

  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(baseDelayMs * i);
    rows = await rerun();
    after = assessListingExtract(rows, { minRows: 1 });
    recovered = after.valid_count >= 1 && after.status !== "empty";
    if (recovered) {
      return { rows, after, recovered, attempts: i + 1 };
    }
  }
  return { rows, after, recovered, attempts };
}

/**
 * Strong heal loop (BD Workflow 2 + industry detect→repair→verify):
 * assess → heal --auto-approve --auto-save → preview gate → settle re-run.
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
  /** Live only: pass false to stop at approval gate (manual review). Default true. */
  autoApprove?: boolean;
  settleAttempts?: number;
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
    useGemini: mode === "live" && input.useGemini === true,
  });
  stages.push(`prompt:${source}`);

  if (mode === "fixture" || input.skipStudio || !isStudioCollectorId(collector_id)) {
    stages.push("fixture_heal");
    const settled = await rerunUntilHealthy(input.rerun, {
      attempts: 1,
      baseDelayMs: 0,
    });
    stages.push(`verify:${settled.after.status}`);
    await appendHealHistory({
      at: new Date().toISOString(),
      collector_id,
      url: input.url,
      surface: input.surface,
      stage: settled.recovered ? "recovered" : "still_broken",
      before_count: before.valid_count,
      after_count: settled.after.valid_count,
      null_rate: settled.after.null_rate,
      qa_flags: settled.after.qa_flags,
      prompt_source: source,
      note: "fixture loop",
    });
    return {
      mode: "fixture",
      collector_id,
      url: input.url,
      before,
      after: settled.after,
      healed: settled.recovered,
      same_id: true,
      prompt,
      prompt_source: source,
      stages,
      output_snippets,
      rows_after: settled.rows,
      settle_attempts: settled.attempts,
    };
  }

  stages.push("studio_heal_autosave");
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

  const autoApprove = input.autoApprove !== false;
  const healCli = await runStudioCli(
    "heal",
    [collector_id, input.url, prompt],
    { autoApprove, autoSave: autoApprove },
  );
  output_snippets.push(healCli.output.slice(0, 700));

  const preview = healPreviewLooksHealthy(healCli.output);
  stages.push(
    `preview:${preview.ok ? "ok" : "weak"}:${preview.title_count}:${preview.status ?? "?"}`,
  );

  if (!healCli.ok && !preview.ok) {
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
      preview_title_count: preview.title_count,
    };
  }

  // If heal stopped at gate without auto-approve, approve+save explicitly.
  if (!autoApprove || preview.status === "awaiting_approval") {
    stages.push("studio_approve_autosave");
    const approved = await runStudioCli(
      "approve",
      [collector_id, input.url],
      { autoSave: true },
    );
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
  } else {
    stages.push("studio_heal_done");
    await appendHealHistory({
      at: new Date().toISOString(),
      collector_id,
      url: input.url,
      surface: input.surface,
      stage: "approved",
      before_count: before.valid_count,
      after_count: preview.title_count,
      prompt_source: source,
      note: "auto-approve+auto-save",
    });
  }

  // Industry rule: preview is a claim; Collection re-run is the truth.
  stages.push("settle_verify");
  const settled = await rerunUntilHealthy(input.rerun, {
    attempts: input.settleAttempts ?? 4,
    baseDelayMs: 8_000,
  });
  stages.push(`verify:${settled.after.status}:try${settled.attempts}`);

  // Never mark recovered on preview alone.
  const recovered = settled.recovered;
  if (!recovered && preview.ok) {
    stages.push("warn:preview_ok_run_empty");
  }

  await appendHealHistory({
    at: new Date().toISOString(),
    collector_id,
    url: input.url,
    surface: input.surface,
    stage: recovered ? "recovered" : "still_broken",
    before_count: before.valid_count,
    after_count: settled.after.valid_count,
    null_rate: settled.after.null_rate,
    qa_flags: settled.after.qa_flags,
    prompt_source: source,
    note: preview.ok ? `preview_titles=${preview.title_count}` : "preview_weak",
  });

  return {
    mode,
    collector_id,
    url: input.url,
    before,
    after: settled.after,
    healed: recovered,
    same_id: true,
    prompt,
    prompt_source: source,
    stages,
    output_snippets,
    rows_after: settled.rows,
    preview_title_count: preview.title_count,
    settle_attempts: settled.attempts,
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
        footer: {
          text: "BrandRadar · QA → heal --auto-approve --auto-save → settle verify",
        },
      },
    ],
  };
}
