"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Domain, Snapshot } from "@/lib/schema";

type Status = {
  mockForced: boolean;
  brightDataToken: boolean;
  gemini: boolean;
  live: Record<Domain, boolean>;
};

const domains: Array<{ id: Domain; label: string; hint: string }> = [
  { id: "ecommerce", label: "Ecommerce", hint: "PDP price, stock, rating" },
  { id: "edtech", label: "Edtech", hint: "Course fee, hours, proof" },
  { id: "food", label: "Food", hint: "Menu price, rating, stock" },
];

function money(amount: number | null, currency: string): string {
  if (amount === null) return "—";
  if (currency === "INR") return `₹${Math.round(amount).toLocaleString("en-IN")}`;
  return `${currency} ${amount}`;
}

export function ScanApp() {
  const [status, setStatus] = useState<Status | null>(null);
  const [brandUrl, setBrandUrl] = useState("https://lumina.example");
  const [brandName, setBrandName] = useState("");
  const [domain, setDomain] = useState<Domain>("ecommerce");
  const [rivalText, setRivalText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [healNote, setHealNote] = useState<string | null>(null);
  const [healPreview, setHealPreview] = useState<unknown>(null);

  useEffect(() => {
    fetch("/api/scan")
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const rivalUrls = useMemo(
    () =>
      rivalText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    [rivalText],
  );

  async function scan(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setHealNote(null);
    setHealPreview(null);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandUrl,
          brandName: brandName || undefined,
          domain,
          rivalUrls,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ? JSON.stringify(payload.error) : "Scan failed");
      }
      setSnapshot(payload as Snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  async function heal(action: "break" | "heal" | "approve") {
    if (!snapshot) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/heal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, snapshot }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error("Heal failed");
      if (payload.snapshot) setSnapshot(payload.snapshot as Snapshot);
      setHealNote(
        `${payload.status} · collector ${payload.collector_id}` +
          (payload.note ? ` · ${payload.note}` : ""),
      );
      setHealPreview(payload.preview_result ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Heal failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-5 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.22em] text-ping uppercase">
            Into the Scrape-Verse
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            BrandRadar
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Drop in a public brand URL. See rivals. Get three growth plays. When
            a layout breaks, the collector heals in place.
          </p>
        </div>
        <StatusStrip status={status} domain={domain} />
      </header>

      <form
        onSubmit={scan}
        className="grid gap-4 rounded-2xl border border-line bg-panel/80 p-5 shadow-[0_0_0_1px_#ffffff08]"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted">Brand URL</span>
            <input
              required
              value={brandUrl}
              onChange={(event) => setBrandUrl(event.target.value)}
              placeholder="https://yourbrand.com"
              className="rounded-lg border border-line bg-[#0b0e14] px-3 py-2 outline-none ring-ping/40 focus:ring-2"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted">Brand name (optional)</span>
            <input
              value={brandName}
              onChange={(event) => setBrandName(event.target.value)}
              placeholder="Lumina"
              className="rounded-lg border border-line bg-[#0b0e14] px-3 py-2 outline-none ring-ping/40 focus:ring-2"
            />
          </label>
        </div>

        <div className="grid gap-2">
          <span className="text-sm text-muted">Domain</span>
          <div className="flex flex-wrap gap-2">
            {domains.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setDomain(entry.id)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  domain === entry.id
                    ? "border-ping bg-ping/10 text-ping"
                    : "border-line text-muted hover:text-text"
                }`}
              >
                {entry.label}
                <span className="ml-2 text-xs opacity-70">{entry.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="grid gap-1.5 text-sm">
          <span className="text-muted">
            Rival URLs (optional, one per line). Empty = demo rivals.
          </span>
          <textarea
            value={rivalText}
            onChange={(event) => setRivalText(event.target.value)}
            rows={3}
            placeholder="https://rival-a.com&#10;https://rival-b.com"
            className="rounded-lg border border-line bg-[#0b0e14] px-3 py-2 font-mono text-xs outline-none ring-ping/40 focus:ring-2"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-ping px-4 py-2 text-sm font-semibold text-[#062016] disabled:opacity-50"
          >
            {loading ? "Scanning…" : "Scan the arena"}
          </button>
          <p className="text-xs text-muted">
            Public pages only. No login, paywall, or personal data.
          </p>
        </div>
        {error ? <p className="text-sm text-alert">{error}</p> : null}
      </form>

      {snapshot ? (
        <Arena
          snapshot={snapshot}
          loading={loading}
          healNote={healNote}
          healPreview={healPreview}
          onBreak={() => heal("break")}
          onHeal={() => heal("heal")}
          onApprove={() => heal("approve")}
        />
      ) : null}
    </div>
  );
}

function StatusStrip({
  status,
  domain,
}: {
  status: Status | null;
  domain: Domain;
}) {
  if (!status) return null;
  const live = status.live[domain];
  return (
    <div className="flex flex-wrap gap-2 font-mono text-[11px]">
      <Pill ok={!status.mockForced && live} label={live ? "live collectors" : "mock arena"} />
      <Pill ok={status.brightDataToken} label="bright data token" />
      <Pill ok={status.gemini} label="gemini" />
    </div>
  );
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 ${
        ok ? "border-ping/40 text-ping" : "border-line text-muted"
      }`}
    >
      {ok ? "●" : "○"} {label}
    </span>
  );
}

function Arena({
  snapshot,
  loading,
  healNote,
  healPreview,
  onBreak,
  onHeal,
  onApprove,
}: {
  snapshot: Snapshot;
  loading: boolean;
  healNote: string | null;
  healPreview: unknown;
  onBreak: () => void;
  onHeal: () => void;
  onApprove: () => void;
}) {
  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {snapshot.brand.name}{" "}
            <span className="text-muted">vs {snapshot.rivals.map((r) => r.name).join(", ")}</span>
          </h2>
          <p className="text-xs text-muted">
            {snapshot.mode} · {snapshot.brand.domain} · {snapshot.brand.snapshot_at}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs ${
            snapshot.health.null_rate > 0
              ? "bg-alert/15 text-alert"
              : "bg-ping/10 text-ping"
          }`}
        >
          null-rate {(snapshot.health.null_rate * 100).toFixed(0)}%
        </span>
      </div>

      {snapshot.notes.length > 0 ? (
        <ul className="grid gap-1 rounded-xl border border-line bg-panel px-4 py-3 text-xs text-muted">
          {snapshot.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {snapshot.plays.map((play, index) => (
          <article
            key={`${play.title}-${index}`}
            className="rounded-2xl border border-line bg-panel p-4"
          >
            <p className="font-mono text-[11px] uppercase tracking-wider text-ping">
              Play 0{index + 1} · {play.signal_type.replace("_", " ")}
            </p>
            <h3 className="mt-2 text-base font-semibold">{play.title}</h3>
            <p className="mt-2 text-sm text-muted">{play.evidence}</p>
            <p className="mt-3 text-sm">{play.action}</p>
          </article>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-panel text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Rating</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Promo</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.items.map((item) => (
              <tr key={`${item.source}-${item.url}`} className="border-t border-line">
                <td className="px-3 py-2 text-xs text-muted">
                  {item.source === "brand" ? snapshot.brand.name : item.rival_name}
                </td>
                <td className="px-3 py-2">{item.name}</td>
                <td className="px-3 py-2 font-mono">
                  {money(item.price, item.currency)}
                </td>
                <td className="px-3 py-2 font-mono">
                  {item.rating ?? "—"}
                  {item.review_count ? (
                    <span className="text-muted"> ({item.review_count})</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs">{item.availability}</td>
                <td className="px-3 py-2 text-xs">{item.promo ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-dashed border-line bg-panel/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Scraper health</h3>
            <p className="text-xs text-muted">
              Collectors: {snapshot.health.collector_ids.join(", ") || "none"}
              {snapshot.health.last_heal
                ? ` · last heal ${snapshot.health.last_heal}`
                : ""}
              {snapshot.health.broken_fields.length
                ? ` · broken: ${snapshot.health.broken_fields.join(", ")}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={onBreak}
              className="rounded-lg border border-alert/40 px-3 py-1.5 text-xs text-alert disabled:opacity-50"
            >
              Simulate redesign
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onHeal}
              className="rounded-lg border border-warn/40 px-3 py-1.5 text-xs text-warn disabled:opacity-50"
            >
              Heal in place
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onApprove}
              className="rounded-lg border border-ping/40 px-3 py-1.5 text-xs text-ping disabled:opacity-50"
            >
              Approve heal
            </button>
          </div>
        </div>
        {healNote ? <p className="mt-3 font-mono text-xs text-muted">{healNote}</p> : null}
        {healPreview ? (
          <pre className="mt-3 overflow-x-auto rounded-lg bg-[#0b0e14] p-3 font-mono text-[11px] text-muted">
            {JSON.stringify(healPreview, null, 2)}
          </pre>
        ) : null}
      </div>
    </section>
  );
}
