"use client";

import { useEffect, useState } from "react";
import type { IntelSnapshot } from "@/lib/intel-schema";
import { formatIntelDiscordMessage } from "@/lib/intel-plays";

type IntelStatus = {
  cohort: string;
  label: string;
  rivals: Array<{ id: string; name: string; update_url: string; surface: string }>;
  intelCollector: string | null;
  intelReady: boolean;
  week?: string;
  weekCached?: boolean;
  storageBackend?: string;
  storageWarning?: string | null;
  costHint?: string;
};

function apiError(payload: unknown, fallback: string, status: number): Error {
  if (status === 429) {
    return new Error(
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : "Rate limit reached.",
    );
  }
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error: unknown }).error;
    if (typeof value === "string") return new Error(value);
  }
  return new Error(fallback);
}

export function MondayDiffApp() {
  const [status, setStatus] = useState<IntelStatus | null>(null);
  const [snapshot, setSnapshot] = useState<IntelSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discordNote, setDiscordNote] = useState<string | null>(null);
  const [discordReady, setDiscordReady] = useState(false);

  useEffect(() => {
    fetch("/api/intel")
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setStatus(null));
    fetch("/api/discord")
      .then((res) => res.json())
      .then((payload) => setDiscordReady(Boolean(payload?.configured)))
      .catch(() => setDiscordReady(false));
  }, []);

  async function pull(opts: { forceMock: boolean; refresh?: boolean }) {
    setLoading(true);
    setError(null);
    setDiscordNote(null);
    try {
      const response = await fetch("/api/intel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forceMock: opts.forceMock,
          persist: !opts.forceMock,
          refresh: opts.refresh === true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw apiError(payload, "Intel pull failed", response.status);
      setSnapshot(payload as IntelSnapshot);
      // refresh status cache badge
      fetch("/api/intel")
        .then((res) => res.json())
        .then(setStatus)
        .catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Intel pull failed");
    } finally {
      setLoading(false);
    }
  }

  async function postDiscord(opts: { forceMock: boolean; refresh?: boolean }) {
    setLoading(true);
    setError(null);
    setDiscordNote(null);
    try {
      const response = await fetch("/api/discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forceMock: opts.forceMock,
          persist: false,
          refresh: opts.refresh === true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw apiError(payload, "Discord post failed", response.status);
      setDiscordNote(
        `Posted (${payload.mode}) · week ${payload.week} · ${payload.cached ? "cached" : payload.intel_mode} · ${payload.plays} plays`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discord post failed");
    } finally {
      setLoading(false);
    }
  }

  async function healIntel() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/intel/heal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "auto_loop",
          snapshot: snapshot ?? undefined,
          notifyDiscord: discordReady,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw apiError(payload, "Heal failed", response.status);
      setDiscordNote(
        payload.healed
          ? `Recovered · ${payload.after?.valid_count ?? payload.count ?? "?"} rows · same ${payload.collector_id}`
          : payload.note ?? `Heal finished on ${payload.collector_id}`,
      );
      if (payload.healed) {
        await pull({ forceMock: false, refresh: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Heal failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="font-mono text-[11px] tracking-[0.22em] text-ping uppercase">
            Monday Diff
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {status?.label ?? "Cohort competitive intel"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Scrape each rival’s own guides or blog, diff against last week, and
            get three plays. Post rich embeds to Discord{" "}
            <code className="text-ping">#monday-diff</code> when a bot is
            configured — or use slash <code className="text-ping">/intel</code>.
          </p>
        </div>
        <div className="font-mono text-[11px] text-muted">
          {status?.intelReady ? (
            <span className="text-ping">
              ● studio ready
              {status.weekCached ? " · week cached" : ""}
            </span>
          ) : (
            <span>○ fixture / set COLLECTOR_INTEL_UPDATES</span>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => pull({ forceMock: false })}
          className="min-h-11 rounded-lg bg-ping px-4 text-sm font-medium text-[#04140c] disabled:opacity-50"
          title="Uses this week's snapshot when available (no Studio spend)"
        >
          {loading ? "Pulling…" : "Pull cohort"}
        </button>
        <button
          type="button"
          disabled={loading || !status?.intelReady}
          onClick={() => pull({ forceMock: false, refresh: true })}
          className="min-h-11 rounded-lg border border-ping/40 px-4 text-sm text-ping disabled:opacity-40"
          title="Re-trigger Studio — spends Bright Data credits"
        >
          Refresh Studio
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => pull({ forceMock: true })}
          className="min-h-11 rounded-lg border border-line px-4 text-sm text-muted disabled:opacity-50"
        >
          Load example week
        </button>
        <button
          type="button"
          disabled={loading || !discordReady}
          onClick={() => postDiscord({ forceMock: false })}
          className="min-h-11 rounded-lg border border-blue/40 px-4 text-sm text-blue disabled:opacity-40"
          title="Post from week cache / last pull — does not re-scrape by default"
        >
          Post to Discord
        </button>
        <button
          type="button"
          disabled={loading || !discordReady}
          onClick={() => postDiscord({ forceMock: true })}
          className="min-h-11 rounded-lg border border-line px-4 text-sm text-muted disabled:opacity-40"
        >
          Post example
        </button>
        <button
          type="button"
          disabled={loading || !status?.intelReady}
          onClick={() => healIntel()}
          className="min-h-11 rounded-lg border border-alert/40 px-4 text-sm text-alert disabled:opacity-40"
          title="bdata scraper heal on the same COLLECTOR_INTEL_UPDATES id"
        >
          Heal collector (auto_loop)
        </button>
      </div>
      {status?.storageWarning ? (
        <p className="rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-xs text-alert">
          {status.storageWarning}
        </p>
      ) : null}
      {status?.costHint ? (
        <p className="font-mono text-[11px] text-muted">{status.costHint}</p>
      ) : null}
      {discordNote ? (
        <p className="font-mono text-xs text-ping">{discordNote}</p>
      ) : null}

      {status ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {status.rivals.map((rival) => (
            <li
              key={rival.id}
              className="rounded-xl border border-line bg-panel/40 px-3 py-2 text-sm"
            >
              <p className="font-medium">{rival.name}</p>
              <a
                href={rival.update_url}
                className="break-all text-xs text-blue hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {rival.update_url}
              </a>
              <p className="mt-1 font-mono text-[10px] text-muted uppercase">
                {rival.surface}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-alert">
          {error}
        </p>
      ) : null}

      {snapshot ? <Brief snapshot={snapshot} /> : null}
    </div>
  );
}

function Brief({ snapshot }: { snapshot: IntelSnapshot }) {
  const discord = formatIntelDiscordMessage(snapshot);
  const vis = snapshot.visibility;
  return (
    <section className="grid gap-5">
      {vis ? (
        <div
          className={`rounded-2xl border p-4 ${
            vis.status === "healthy"
              ? "border-ping/40 bg-ping/5"
              : vis.status === "critical"
                ? "border-alert/40 bg-alert/10"
                : "border-blue/40 bg-blue/5"
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Competitive visibility</h2>
            <p className="font-mono text-lg font-semibold text-ping">{vis.score}/100</p>
          </div>
          <p className="mt-1 text-sm text-muted">{vis.summary}</p>
          <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
            {vis.per_rival.map((r) => (
              <li key={r.rival_id} className="rounded-lg border border-line/60 px-2 py-1">
                <span className="font-medium">{r.rival_name}</span> · {r.entry_count} rows
                {r.new_this_week > 0 ? ` · +${r.new_this_week} new` : ""}
                {r.modified_this_week > 0 ? ` · ~${r.modified_this_week} updated` : ""}
                {r.status === "empty" ? (
                  <span className="text-alert"> · empty</span>
                ) : null}
              </li>
            ))}
          </ul>
          {vis.heal_recommended ? (
            <p className="mt-2 text-xs text-alert">
              Heal recommended — QA flags or empty rivals detected.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="rounded-2xl border border-line bg-panel/50 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Week {snapshot.week}</h2>
          <p className="font-mono text-[11px] text-muted">
            {snapshot.mode} · {snapshot.pulled_at.slice(0, 19)}Z
          </p>
        </div>
        <div className="mt-4 grid gap-3">
          {snapshot.plays.map((play) => (
            <article
              key={play.title}
              className="rounded-xl border border-line/80 bg-[#0b0e14] p-3"
            >
              <p className="font-mono text-[10px] tracking-wider text-ping uppercase">
                {play.kind}
              </p>
              <h3 className="mt-1 text-sm font-semibold">{play.title}</h3>
              <p className="mt-1 text-xs text-muted">{play.evidence}</p>
              <p className="mt-2 text-sm">{play.action}</p>
              <p className="mt-1 text-xs text-muted">{play.why_it_grows}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-panel/50 p-4">
        <h2 className="text-sm font-semibold">Diff by rival</h2>
        <div className="mt-3 grid gap-3">
          {snapshot.diff.map((change) => (
            <div key={change.rival_id} className="text-sm">
              <p className="font-medium">{change.rival_name}</p>
              {change.added.length === 0 &&
              change.removed.length === 0 &&
              change.modified.length === 0 ? (
                <p className="text-xs text-muted">No public updates this week</p>
              ) : null}
              <ul className="mt-1 grid gap-1 text-xs">
                {change.added.map((entry) => (
                  <li key={entry.url} className="text-ping">
                    NEW ·{" "}
                    <a href={entry.url} className="hover:underline" target="_blank" rel="noreferrer">
                      {entry.title}
                    </a>
                  </li>
                ))}
                {change.modified.map((mod) => (
                  <li key={`${mod.after.url}-mod`} className="text-blue">
                    UPD · {mod.fields.join(", ")} ·{" "}
                    <a
                      href={mod.after.url}
                      className="hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {mod.after.title}
                    </a>
                  </li>
                ))}
                {change.removed.map((entry) => (
                  <li key={entry.url} className="text-alert">
                    gone · {entry.title}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-panel/50 p-4">
        <h2 className="text-sm font-semibold">Discord preview</h2>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-[#0b0e14] p-3 font-mono text-[11px] text-muted">
          {discord}
        </pre>
      </div>

      {snapshot.notes.length > 0 ? (
        <ul className="grid gap-1 text-xs text-muted">
          {snapshot.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
