"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { computeKpis } from "@/lib/plays";
import type { Domain, Snapshot } from "@/lib/schema";

type Status = {
  brightDataToken: boolean;
  discover: boolean;
  gemini: boolean;
  geminiModel?: string;
  live: Record<Domain, boolean>;
};

const domains: Array<{ id: Domain; label: string }> = [
  { id: "ecommerce", label: "Ecommerce" },
  { id: "edtech", label: "Edtech" },
  { id: "food", label: "Food" },
];

function money(amount: number | null, currency = "INR"): string {
  if (amount === null || Number.isNaN(amount)) return "—";
  if (currency === "INR") return `₹${Math.round(amount).toLocaleString("en-IN")}`;
  return `${currency} ${amount.toFixed(0)}`;
}

export function ScanApp() {
  const [status, setStatus] = useState<Status | null>(null);
  const [brandUrl, setBrandUrl] = useState("https://mamaearth.in");
  const [brandName, setBrandName] = useState("Mamaearth");
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
        `${payload.status} · ${payload.collector_id}` +
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
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-ping/30 bg-ping/10 font-mono text-sm text-ping">
            BR
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">BrandRadar</h1>
            <p className="text-sm text-muted">
              Public web data in. Three growth plays out.
            </p>
          </div>
        </div>
        <StatusStrip status={status} domain={domain} />
      </header>

      <form
        onSubmit={scan}
        className="grid gap-3 rounded-2xl border border-line bg-panel/70 p-4"
      >
        <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_auto]">
          <label className="grid gap-1 text-xs text-muted">
            Brand URL
            <input
              required
              value={brandUrl}
              onChange={(event) => setBrandUrl(event.target.value)}
              className="rounded-lg border border-line bg-[#0b0e14] px-3 py-2 text-sm text-text outline-none focus:border-ping/50"
            />
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Name
            <input
              value={brandName}
              onChange={(event) => setBrandName(event.target.value)}
              placeholder="Mamaearth"
              className="rounded-lg border border-line bg-[#0b0e14] px-3 py-2 text-sm text-text outline-none focus:border-ping/50"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="self-end rounded-lg bg-ping px-5 py-2 text-sm font-semibold text-[#062016] disabled:opacity-50"
          >
            {loading ? "Scanning…" : "Scan arena"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {domains.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setDomain(entry.id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                domain === entry.id
                  ? "border-ping bg-ping/10 text-ping"
                  : "border-line text-muted"
              }`}
            >
              {entry.label}
            </button>
          ))}
          <span className="text-xs text-muted">Public pages only.</span>
        </div>
        <textarea
          value={rivalText}
          onChange={(event) => setRivalText(event.target.value)}
          rows={2}
          placeholder="Rival URLs optional — one per line. Empty = Bright Data Discover."
          className="rounded-lg border border-line bg-[#0b0e14] px-3 py-2 font-mono text-xs text-muted outline-none focus:border-ping/50"
        />
        {error ? <p className="text-sm text-alert">{error}</p> : null}
      </form>

      {snapshot ? (
        <Dashboard
          snapshot={snapshot}
          loading={loading}
          healNote={healNote}
          healPreview={healPreview}
          onBreak={() => heal("break")}
          onHeal={() => heal("heal")}
          onApprove={() => heal("approve")}
        />
      ) : (
        <EmptyState />
      )}
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
  return (
    <div className="flex flex-wrap justify-end gap-2 font-mono text-[11px]">
      <Pill ok={status.discover} label="discover" />
      <Pill ok={status.gemini} label={status.geminiModel?.replace("gemini-", "") ?? "gemini"} />
      <Pill ok={status.live[domain]} label={status.live[domain] ? "studio" : "no studio"} />
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

function EmptyState() {
  return (
    <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-line py-20 text-center">
      <div className="max-w-md">
        <p className="font-mono text-xs tracking-[0.2em] text-ping uppercase">
          Ready
        </p>
        <h2 className="mt-2 text-xl font-semibold">Scan a public brand</h2>
        <p className="mt-2 text-sm text-muted">
          Bright Data finds rivals and listings. Gemini Flash-Lite extracts the
          catalog and writes the plays. Numbers stay grounded in the snippets.
        </p>
      </div>
    </div>
  );
}

function Dashboard({
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
  const kpis = computeKpis(snapshot);
  const currency = snapshot.items[0]?.currency ?? "INR";

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{snapshot.brand.name}</h2>
          <p className="text-sm text-muted">
            vs {snapshot.rivals.map((rival) => rival.name).join(" · ") || "no rivals yet"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 font-mono text-xs ${
            snapshot.mode === "live" ? "bg-ping/10 text-ping" : "bg-warn/10 text-warn"
          }`}
        >
          {snapshot.mode}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Price index" value={kpis.priceIndex ? `${kpis.priceIndex}×` : "—"} hint="brand / rival avg" />
        <Kpi label="Brand avg" value={money(kpis.brandAvgPrice, currency)} hint={`${kpis.itemCount} rows`} />
        <Kpi
          label="Rating"
          value={
            kpis.brandAvgRating
              ? `${kpis.brandAvgRating.toFixed(1)} vs ${kpis.rivalAvgRating?.toFixed(1) ?? "—"}`
              : "—"
          }
          hint="brand vs rival"
        />
        <Kpi
          label="Null rate"
          value={`${Math.round(snapshot.health.null_rate * 100)}%`}
          hint={snapshot.health.broken_fields.join(", ") || "fields intact"}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {snapshot.plays.map((play, index) => (
          <article
            key={`${play.title}-${index}`}
            className="rounded-2xl border border-line bg-panel p-4"
          >
            <p className="font-mono text-[11px] uppercase tracking-wider text-ping">
              Play 0{index + 1}
            </p>
            <h3 className="mt-2 text-base font-semibold leading-snug">{play.title}</h3>
            <p className="mt-2 text-sm text-muted">{play.evidence}</p>
            <p className="mt-3 text-sm">{play.action}</p>
          </article>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-panel text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2.5">Source</th>
              <th className="px-4 py-2.5">Item</th>
              <th className="px-4 py-2.5">Price</th>
              <th className="px-4 py-2.5">Rating</th>
              <th className="px-4 py-2.5">Stock</th>
              <th className="px-4 py-2.5">Promo</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.items.map((item) => (
              <tr key={`${item.source}-${item.url}-${item.name}`} className="border-t border-line">
                <td className="px-4 py-2.5 text-xs text-muted">
                  {item.source === "brand" ? snapshot.brand.name : item.rival_name}
                </td>
                <td className="px-4 py-2.5">{item.name}</td>
                <td className="px-4 py-2.5 font-mono">{money(item.price, item.currency)}</td>
                <td className="px-4 py-2.5 font-mono">
                  {item.rating ?? "—"}
                  {item.review_count ? (
                    <span className="text-muted"> ({item.review_count})</span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-xs">{item.availability.replace("_", " ")}</td>
                <td className="px-4 py-2.5 text-xs">{item.promo ? "yes" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-line bg-panel/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Collector health</h3>
            <p className="text-xs text-muted">
              {snapshot.health.collector_ids.join(" · ")}
              {snapshot.health.last_heal ? ` · healed ${snapshot.health.last_heal}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={onBreak}
              className="rounded-lg border border-alert/30 px-3 py-1.5 text-xs text-alert disabled:opacity-50"
            >
              Break field
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onHeal}
              className="rounded-lg border border-warn/30 px-3 py-1.5 text-xs text-warn disabled:opacity-50"
            >
              Heal
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onApprove}
              className="rounded-lg border border-ping/30 px-3 py-1.5 text-xs text-ping disabled:opacity-50"
            >
              Approve
            </button>
          </div>
        </div>
        {snapshot.notes.length > 0 ? (
          <ul className="mt-3 grid gap-1 text-xs text-muted">
            {snapshot.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
        {healNote ? <p className="mt-2 font-mono text-xs text-muted">{healNote}</p> : null}
        {healPreview ? (
          <pre className="mt-3 overflow-x-auto rounded-lg bg-[#0b0e14] p-3 font-mono text-[11px] text-muted">
            {JSON.stringify(healPreview, null, 2)}
          </pre>
        ) : null}
      </div>
    </section>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </div>
  );
}
