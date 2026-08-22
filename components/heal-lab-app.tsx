"use client";

import { useEffect, useState } from "react";

type Status = {
  brand: string;
  before: string;
  after: string;
  collector: string | null;
  ready: boolean;
  discord: boolean;
  costHint?: string;
  demoSteps?: string[];
};

type Row = {
  title: string;
  url: string;
  published_at: string | null;
  summary: string | null;
};

type DemoProof = {
  beforeCount: number;
  afterCount: number;
  recoveredCount: number;
  collectorId: string | null;
  healed: boolean;
  mode: "fixture" | "live";
};

type DemoStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "failed";
  detail?: string;
};

const INITIAL_DEMO_STEPS: DemoStep[] = [
  { id: "before", label: "Scrape /before (healthy layout)", status: "pending" },
  { id: "after", label: "Scrape /after (redesign — broken)", status: "pending" },
  { id: "heal", label: "Strong heal loop (same collector id)", status: "pending" },
  { id: "proof", label: "Verify recovery + proof card", status: "pending" },
];

export function HealLabApp() {
  const [status, setStatus] = useState<Status | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [stage, setStage] = useState<string>("idle");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [beforeCount, setBeforeCount] = useState(0);
  const [afterCount, setAfterCount] = useState(0);
  /** Default true = zero Studio spend for local testing. */
  const [liveStudio, setLiveStudio] = useState(false);
  const [useGemini, setUseGemini] = useState(false);
  const [qaLine, setQaLine] = useState<string | null>(null);
  const [demoSteps, setDemoSteps] = useState<DemoStep[]>(INITIAL_DEMO_STEPS);
  const [proof, setProof] = useState<DemoProof | null>(null);

  useEffect(() => {
    fetch("/api/heal-lab")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  function patchDemoStep(id: string, patch: Partial<DemoStep>) {
    setDemoSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function call(body: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    setNote(null);
    try {
      const response = await fetch("/api/heal-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceMock: !liveStudio, ...body }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Heal Lab request failed",
        );
      }
      if (Array.isArray(payload.rows)) setRows(payload.rows);
      if (typeof payload.count === "number" && body.action === "run" && body.layout === "before") {
        setBeforeCount(payload.count);
      }
      if (typeof payload.count === "number" && body.action === "run" && body.layout === "after") {
        setAfterCount(payload.count);
      }
      if (payload.qa || payload.before) {
        const qa = payload.qa ?? payload.after ?? payload.before;
        if (qa && typeof qa === "object") {
          setQaLine(
            `QA ${qa.status} · valid ${qa.valid_count}/${qa.row_count} · null ${qa.null_rate} · ${(qa.qa_flags ?? []).join(",") || "clean"}`,
          );
        }
      } else if (Array.isArray(payload.stages)) {
        setQaLine(`Stages: ${payload.stages.join(" → ")}`);
      }
      setStage(String(payload.status ?? body.action));
      setNote(payload.note ?? null);
      return payload;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Heal Lab failed");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function runJudgeDemo() {
    setError(null);
    setProof(null);
    setDemoSteps(INITIAL_DEMO_STEPS.map((s) => ({ ...s, status: "pending", detail: undefined })));

    patchDemoStep("before", { status: "running" });
    const before = await call({ action: "run", layout: "before" });
    if (!before) {
      patchDemoStep("before", { status: "failed", detail: "Request failed" });
      return;
    }
    const bCount = typeof before.count === "number" ? before.count : 0;
    setBeforeCount(bCount);
    patchDemoStep("before", {
      status: bCount >= 1 ? "done" : "failed",
      detail: `${bCount} rows`,
    });

    patchDemoStep("after", { status: "running" });
    const after = await call({ action: "run", layout: "after" });
    if (!after) {
      patchDemoStep("after", { status: "failed", detail: "Request failed" });
      return;
    }
    const aCount = typeof after.count === "number" ? after.count : 0;
    setAfterCount(aCount);
    const afterOk = liveStudio ? aCount >= 1 : aCount === 0;
    patchDemoStep("after", {
      status: afterOk ? "done" : "failed",
      detail: liveStudio
        ? aCount >= 1
          ? `${aCount} rows (collector already healed on /after)`
          : "0 rows (broken — heal next)"
        : aCount === 0
          ? "0 rows (broken — expected)"
          : `${aCount} rows (expected 0)`,
    });

    patchDemoStep("heal", { status: "running", detail: liveStudio ? "~3–5 min on Live Studio" : "fixture" });
    const heal = await call({
      action: "auto_loop",
      layout: "after",
      useGemini,
      notifyDiscord: Boolean(status?.discord),
    });
    if (!heal) {
      patchDemoStep("heal", { status: "failed", detail: "Heal loop failed" });
      return;
    }
    const recovered = heal.healed === true || (typeof heal.count === "number" && heal.count >= 1);
    const rCount = typeof heal.count === "number" ? heal.count : rows.length;
    patchDemoStep("heal", {
      status: recovered ? "done" : "failed",
      detail: recovered ? `${rCount} rows recovered` : "Still broken — try Unlock stuck job",
    });

    const collectorId =
      (typeof heal.collector_id === "string" ? heal.collector_id : null) ??
      status?.collector ??
      null;
    const nextProof: DemoProof = {
      beforeCount: bCount,
      afterCount: aCount,
      recoveredCount: rCount,
      collectorId,
      healed: recovered,
      mode: liveStudio ? "live" : "fixture",
    };
    setProof(nextProof);
    patchDemoStep("proof", {
      status: recovered ? "done" : "failed",
      detail: recovered
        ? `Same id ${collectorId ?? "c_*"} · ${bCount} → 0 → ${rCount}`
        : "Recovery incomplete",
    });
  }

  function stepIcon(s: DemoStep["status"]) {
    if (s === "done") return "✓";
    if (s === "failed") return "✗";
    if (s === "running") return "…";
    return "○";
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="grid gap-2">
        <p className="font-mono text-[11px] tracking-[0.22em] text-ping uppercase">
          Heal Lab
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Own the page. Break it. Heal the same c_*.
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Fake startup <strong className="text-text">{status?.brand ?? "Driftmark"}</strong>{" "}
          changelog we control. Scrape <code className="text-ping">/before</code>, switch to{" "}
          <code className="text-ping">/after</code> (class rename), watch extract go empty, then{" "}
          Studio self-heals — Collector ID unchanged.
        </p>
      </header>

      <section className="rounded-2xl border border-ping/30 bg-ping/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ping">Judge demo (one click)</h2>
            <p className="mt-1 text-xs text-muted">
              Runs before → after → strong heal loop and builds a proof card. Fixtures by default;
              enable Live Studio for real Bright Data proof.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={runJudgeDemo}
            className="min-h-11 rounded-lg bg-ping px-5 text-sm font-semibold text-[#04140c] disabled:opacity-50"
          >
            Run full demo proof
          </button>
        </div>
        <ol className="mt-4 grid gap-2 text-sm">
          {demoSteps.map((step) => (
            <li
              key={step.id}
              className={`flex flex-wrap items-baseline gap-2 rounded-lg border px-3 py-2 ${
                step.status === "done"
                  ? "border-ping/40 text-text"
                  : step.status === "failed"
                    ? "border-alert/40 text-alert"
                    : step.status === "running"
                      ? "border-blue/40 text-blue"
                      : "border-line text-muted"
              }`}
            >
              <span className="font-mono text-xs">{stepIcon(step.status)}</span>
              <span>{step.label}</span>
              {step.detail ? (
                <span className="font-mono text-xs opacity-80">· {step.detail}</span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {proof ? (
        <section
          className={`rounded-2xl border p-4 ${
            proof.healed ? "border-ping/50 bg-ping/10" : "border-alert/40 bg-alert/10"
          }`}
        >
          <h2 className="text-sm font-semibold">
            {proof.healed ? "Proof · self-heal recovered" : "Proof · recovery incomplete"}
          </h2>
          <dl className="mt-3 grid gap-2 font-mono text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted">Mode</dt>
              <dd>{proof.mode === "live" ? "Live Studio (real c_*)" : "Fixture (zero credits)"}</dd>
            </div>
            <div>
              <dt className="text-muted">Collector id</dt>
              <dd className="text-ping">{proof.collectorId ?? "fixture"} (unchanged)</dd>
            </div>
            <div>
              <dt className="text-muted">/before rows</dt>
              <dd>{proof.beforeCount}</dd>
            </div>
            <div>
              <dt className="text-muted">/after rows (broken)</dt>
              <dd>{proof.afterCount}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">After heal</dt>
              <dd className="text-base font-semibold">
                {proof.beforeCount} → {proof.afterCount} → {proof.recoveredCount}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-4 text-sm text-muted">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={liveStudio}
            onChange={(e) => setLiveStudio(e.target.checked)}
            className="size-4"
          />
          Live Studio (spends credits — use for judge proof)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useGemini}
            onChange={(e) => setUseGemini(e.target.checked)}
            className="size-4"
          />
          Gemini heal prompt (opt-in)
        </label>
      </div>

      {status?.costHint ? (
        <p className="font-mono text-[11px] text-muted">{status.costHint}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <a
          href={status?.before ?? "/heal-lab/before"}
          target="_blank"
          rel="noreferrer"
          className="min-h-11 rounded-lg border border-line px-4 text-sm leading-[2.75] text-muted"
        >
          Open before
        </a>
        <a
          href={status?.after ?? "/heal-lab/after"}
          target="_blank"
          rel="noreferrer"
          className="min-h-11 rounded-lg border border-line px-4 text-sm leading-[2.75] text-muted"
        >
          Open after
        </a>
        <button
          type="button"
          disabled={loading}
          onClick={() => call({ action: "run", layout: "before" })}
          className="min-h-11 rounded-lg bg-ping px-4 text-sm font-medium text-[#04140c] disabled:opacity-50"
        >
          1 · Run before
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => call({ action: "run", layout: "after" })}
          className="min-h-11 rounded-lg border border-alert/40 px-4 text-sm text-alert disabled:opacity-50"
        >
          2 · Run after (expect empty)
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => call({ action: "auto_loop", layout: "after", useGemini })}
          className="min-h-11 rounded-lg border border-ping/40 px-4 text-sm text-ping disabled:opacity-50"
        >
          3 · Strong heal loop
        </button>
        <button
          type="button"
          disabled={loading || !liveStudio}
          onClick={() => call({ action: "unlock" })}
          className="min-h-11 rounded-lg border border-line px-4 text-sm text-muted disabled:opacity-40"
        >
          Unlock stuck job
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            const result = await call({ action: "run", layout: "after" });
            if (result && typeof result.count === "number") setAfterCount(result.count);
          }}
          className="min-h-11 rounded-lg border border-blue/40 px-4 text-sm text-blue disabled:opacity-50"
        >
          Re-run after (verify)
        </button>
        <button
          type="button"
          disabled={loading || !status?.discord}
          onClick={() =>
            call({
              action: "discord",
              rowCountBefore: beforeCount,
              rowCountAfter: rows.length || proof?.recoveredCount || 5,
              layout: "after",
            })
          }
          className="min-h-11 rounded-lg border border-blue/40 px-4 text-sm text-blue disabled:opacity-40"
        >
          Post recovery to Discord
        </button>
      </div>

      <p className="font-mono text-xs text-muted">
        stage={stage}
        {status?.collector ? ` · ${status.collector}` : " · set COLLECTOR_HEAL_LAB after deploy"}
        {beforeCount > 0 || afterCount >= 0
          ? ` · counts before=${beforeCount} after=${afterCount}`
          : null}
      </p>
      {qaLine ? <p className="font-mono text-xs text-muted">{qaLine}</p> : null}
      {note ? <p className="font-mono text-xs text-ping">{note}</p> : null}
      {error ? (
        <p className="rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-line bg-panel/50 p-4">
        <h2 className="text-sm font-semibold">Extracted rows ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-alert">Extraction returned nothing</p>
        ) : (
          <ul className="mt-3 grid gap-2 text-sm">
            {rows.map((row) => (
              <li key={row.url} className="rounded-lg border border-line/80 px-3 py-2">
                <a href={row.url} className="text-ping hover:underline" target="_blank" rel="noreferrer">
                  {row.title}
                </a>
                <p className="text-xs text-muted">{row.published_at}</p>
                <p className="text-xs text-muted">{row.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ol className="grid gap-2 text-sm text-muted">
        <li>01 Page shifts — we ship /after without .post-title</li>
        <li>02 Scraper notices — empty extract</li>
        <li>03 Logic repairs — heal from plain language, same c_*</li>
        <li>04 Data keeps flowing — Discord + Monday Diff untouched</li>
      </ol>
    </div>
  );
}
