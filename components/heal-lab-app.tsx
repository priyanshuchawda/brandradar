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
};

type Row = {
  title: string;
  url: string;
  published_at: string | null;
  summary: string | null;
};

export function HealLabApp() {
  const [status, setStatus] = useState<Status | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [stage, setStage] = useState<string>("idle");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [beforeCount, setBeforeCount] = useState(0);
  /** Default true = zero Studio spend for local testing. */
  const [liveStudio, setLiveStudio] = useState(false);
  const [useGemini, setUseGemini] = useState(false);
  const [qaLine, setQaLine] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/heal-lab")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

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
          <code className="text-ping">bdata scraper heal</code> — Collector ID unchanged, Discord
          still works. Combined with Monday Diff for idea 07.
        </p>
      </header>

      <div className="flex flex-wrap gap-4 text-sm text-muted">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={liveStudio}
            onChange={(e) => setLiveStudio(e.target.checked)}
            className="size-4"
          />
          Live Studio (spends credits)
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
          onClick={() => call({ action: "heal" })}
          className="min-h-11 rounded-lg border border-ping/40 px-4 text-sm text-ping disabled:opacity-50"
        >
          3 · Heal same id
        </button>
        <button
          type="button"
          disabled={loading || !liveStudio}
          onClick={() => call({ action: "approve" })}
          className="min-h-11 rounded-lg border border-line px-4 text-sm text-muted disabled:opacity-40"
        >
          4 · Approve
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            if (!liveStudio) {
              const healed = await call({ action: "heal" });
              if (healed?.rows) setRows(healed.rows);
              return;
            }
            await call({ action: "run", layout: "after" });
          }}
          className="min-h-11 rounded-lg border border-blue/40 px-4 text-sm text-blue disabled:opacity-50"
        >
          5 · Re-run after (recovered)
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() =>
            call({
              action: "auto_loop",
              useGemini,
              notifyDiscord: Boolean(status?.discord),
            })
          }
          className="min-h-11 rounded-lg bg-ping/90 px-4 text-sm font-medium text-[#04140c] disabled:opacity-50"
        >
          Strong heal loop (assess → heal → verify)
        </button>
        <button
          type="button"
          disabled={loading || !status?.discord}
          onClick={() =>
            call({
              action: "discord",
              rowCountBefore: beforeCount,
              rowCountAfter: rows.length || 5,
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
