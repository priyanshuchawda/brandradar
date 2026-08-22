import {
  assessListingExtract,
  defaultListingHealPrompt,
  retightenHealPrompt,
  type ExtractAssessment,
  type ListingRow,
  type RetightenReason,
} from "./extract-qa";
import { appendHealHistory } from "./heal-history";
import { geminiConfigured, proposeHealPrompt } from "./gemini";
import { healRuntimeBudget, type HealRuntimeBudget } from "./runtime-env";
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
  heal_attempts?: number;
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

type StudioHealPassResult = {
  preview: ReturnType<typeof healPreviewLooksHealthy>;
  healCliOk: boolean;
  settled: Awaited<ReturnType<typeof rerunUntilHealthy>>;
  outputSnippet: string;
};

async function runStudioHealPass(input: {
  collector_id: string;
  url: string;
  prompt: string;
  autoApprove: boolean;
  budget: HealRuntimeBudget;
  rerun: () => Promise<ListingRow[]>;
  stages: string[];
  output_snippets: string[];
  attempt: number;
}): Promise<StudioHealPassResult> {
  input.stages.push(`studio_heal_autosave:try${input.attempt}`);
  const healCli = await runStudioCli(
    "heal",
    [input.collector_id, input.url, input.prompt],
    {
      autoApprove: input.autoApprove,
      autoSave: input.autoApprove,
      timeoutMs: input.budget.healTimeoutMs,
      healCliTimeoutSec: input.budget.healCliTimeoutSec,
    },
  );
  input.output_snippets.push(healCli.output.slice(0, 700));

  const preview = healPreviewLooksHealthy(healCli.output);
  input.stages.push(
    `preview:try${input.attempt}:${preview.ok ? "ok" : "weak"}:${preview.title_count}:${preview.status ?? "?"}`,
  );

  if (!healCli.ok && !preview.ok) {
    return {
      preview,
      healCliOk: false,
      settled: {
        rows: [],
        after: assessListingExtract([], { minRows: 1 }),
        recovered: false,
        attempts: 0,
      },
      outputSnippet: healCli.output.slice(0, 200),
    };
  }

  if (!input.autoApprove || preview.status === "awaiting_approval") {
    input.stages.push(`studio_approve_autosave:try${input.attempt}`);
    const approved = await runStudioCli(
      "approve",
      [input.collector_id, input.url],
      { autoSave: true, timeoutMs: input.budget.healTimeoutMs },
    );
    input.output_snippets.push(approved.output.slice(0, 400));
  } else {
    input.stages.push(`studio_heal_done:try${input.attempt}`);
  }

  input.stages.push(`settle_verify:try${input.attempt}`);
  const settled = await rerunUntilHealthy(input.rerun, {
    attempts: input.budget.settleAttempts,
    baseDelayMs: input.budget.settleDelayMs,
  });
  input.stages.push(
    `verify:try${input.attempt}:${settled.after.status}:poll${settled.attempts}`,
  );

  return { preview, healCliOk: healCli.ok, settled, outputSnippet: "" };
}

/**
 * Strong heal loop (BD Workflow 2 + industry detect→repair→verify):
 * assess → up to N heal passes → settle re-run each pass.
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
  autoApprove?: boolean;
  settleAttempts?: number;
  maxHealAttempts?: number;
  budget?: Partial<HealRuntimeBudget>;
}): Promise<HealLoopResult> {
  const stages: string[] = [];
  const output_snippets: string[] = [];
  const mode: HealLoopMode = input.mode ?? (input.skipStudio ? "fixture" : "live");
  const collector_id = input.collectorId;
  const budget = healRuntimeBudget({
    settleAttempts: input.settleAttempts,
    ...input.budget,
  });
  const maxHealAttempts = input.maxHealAttempts ?? budget.maxHealAttempts;

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
      heal_attempts: 0,
    };
  }

  const { prompt: initialPrompt, source } = await resolveHealPrompt({
    assessment: before,
    userPrompt: input.userPrompt,
    useGemini: mode === "live" && input.useGemini === true,
  });
  stages.push(`prompt:${source}`);
  let prompt = initialPrompt;

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
      heal_attempts: 1,
    };
  }

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
  let lastPreview = { ok: false, title_count: 0, status: null as string | null };
  let lastSettled = {
    rows: [] as ListingRow[],
    after: null as ExtractAssessment | null,
    recovered: false,
    attempts: 0,
  };
  let healAttempts = 0;

  for (let attempt = 1; attempt <= maxHealAttempts; attempt++) {
    healAttempts = attempt;
    const pass = await runStudioHealPass({
      collector_id,
      url: input.url,
      prompt,
      autoApprove,
      budget,
      rerun: input.rerun,
      stages,
      output_snippets,
      attempt,
    });
    lastPreview = pass.preview;
    lastSettled = {
      rows: pass.settled.rows,
      after: pass.settled.after,
      recovered: pass.settled.recovered,
      attempts: pass.settled.attempts,
    };

    if (pass.settled.recovered) break;

    if (!pass.healCliOk && !pass.preview.ok) {
      stages.push(`heal_failed:try${attempt}`);
      if (attempt >= maxHealAttempts) break;
      prompt = retightenHealPrompt(prompt, "heal_failed");
      stages.push("retighten:heal_failed");
      continue;
    }

    if (pass.preview.ok && !pass.settled.recovered) {
      stages.push(`warn:preview_ok_run_empty:try${attempt}`);
      if (attempt >= maxHealAttempts) break;
      prompt = retightenHealPrompt(prompt, "run_empty");
      stages.push("retighten:run_empty");
      continue;
    }

    if (!pass.preview.ok) {
      if (attempt >= maxHealAttempts) break;
      prompt = retightenHealPrompt(prompt, "preview_weak");
      stages.push("retighten:preview_weak");
      continue;
    }

    break;
  }

  const recovered = lastSettled.recovered;
  await appendHealHistory({
    at: new Date().toISOString(),
    collector_id,
    url: input.url,
    surface: input.surface,
    stage: recovered ? "recovered" : "still_broken",
    before_count: before.valid_count,
    after_count: lastSettled.after?.valid_count ?? 0,
    null_rate: lastSettled.after?.null_rate,
    qa_flags: lastSettled.after?.qa_flags,
    prompt_source: source,
    note: `heal_attempts=${healAttempts} preview_titles=${lastPreview.title_count}`,
  });

  return {
    mode,
    collector_id,
    url: input.url,
    before,
    after: lastSettled.after,
    healed: recovered,
    same_id: true,
    prompt,
    prompt_source: source,
    stages,
    output_snippets,
    rows_after: lastSettled.rows,
    preview_title_count: lastPreview.title_count,
    settle_attempts: lastSettled.attempts,
    heal_attempts: healAttempts,
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
          text: "BrandRadar · QA → heal (≤2 tries) → settle verify",
        },
      },
    ],
  };
}

// Re-export for tests
export type { RetightenReason };
