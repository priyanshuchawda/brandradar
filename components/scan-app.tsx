"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { formatAvailability, formatMoney } from "@/lib/format";
import { computeKpis } from "@/lib/plays";
import type { Domain, Item, Snapshot } from "@/lib/schema";

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

const fieldClass =
  "min-h-11 w-full rounded-lg border border-line bg-[#0b0e14] px-3 py-2 text-base text-text outline-none focus-visible:border-ping/50 focus-visible:ring-2 focus-visible:ring-ping/40 md:text-sm";

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

  async function runScan(forceMock = false) {
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
          forceMock,
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

  async function scan(event: FormEvent) {
    event.preventDefault();
    await runScan(false);
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
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-5 sm:px-5 sm:py-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ping/30 bg-ping/10 font-mono text-sm text-ping">
            BR
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">BrandRadar</h1>
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
        aria-busy={loading}
      >
        <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_auto]">
          <label className="grid gap-1 text-xs text-muted">
            Brand URL
            <input
              required
              type="url"
              inputMode="url"
              autoComplete="url"
              value={brandUrl}
              onChange={(event) => setBrandUrl(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Name
            <input
              value={brandName}
              onChange={(event) => setBrandName(event.target.value)}
              placeholder="Mamaearth"
              className={fieldClass}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 w-full self-end rounded-lg bg-ping px-5 py-2.5 text-sm font-semibold text-[#062016] focus-visible:ring-2 focus-visible:ring-ping/60 disabled:opacity-50 md:w-auto"
          >
            {loading ? "Scanning…" : "Scan arena"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {domains.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={domain === entry.id}
              onClick={() => setDomain(entry.id)}
              className={`min-h-10 rounded-full border px-3 py-2 text-xs ${
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
          className={`${fieldClass} min-h-16 font-mono text-sm md:text-xs`}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">
            {status?.live[domain]
              ? "Studio collectors ready. Scan may take up to a minute."
              : "Studio ids missing for this domain — Discover + Gemini, then fixture."}
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void runScan(true)}
            className="min-h-10 rounded-lg border border-line px-3 py-2 text-xs text-muted focus-visible:ring-2 focus-visible:ring-ping/40 disabled:opacity-50"
          >
            Load demo snapshot
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-ping" role="status">
            Working — live Studio/Discover can take 30–90s. Demo snapshot is instant.
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-alert" role="alert">
            {error}
          </p>
        ) : null}
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
    <div className="flex flex-wrap gap-2 font-mono text-[11px] sm:justify-end">
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
    <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-line px-4 py-16 text-center sm:py-20">
      <div className="max-w-md">
        <p className="font-mono text-xs tracking-[0.2em] text-ping uppercase">
          Ready
        </p>
        <h2 className="mt-2 text-xl font-semibold">Scan a public brand</h2>
        <p className="mt-2 text-sm text-muted">
          Custom Scraper Studio collectors pull catalog rows. Discover finds
          rivals. Gemini Flash-Lite only rewrites play copy. Numbers stay on the
          extracted rows.
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
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{snapshot.brand.name}</h2>
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Price index" value={kpis.priceIndex ? `${kpis.priceIndex}×` : "—"} hint="brand / rival avg" />
        <Kpi label="Brand avg" value={formatMoney(kpis.brandAvgPrice, currency)} hint={`${kpis.itemCount} rows`} />
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

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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

      <Catalog items={snapshot.items} brandName={snapshot.brand.name} />

      <div className="rounded-2xl border border-line bg-panel/50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Collector health</h3>
            <p className="break-all text-xs text-muted">
              {snapshot.health.collector_ids.join(" · ")}
              {snapshot.health.last_heal ? ` · healed ${snapshot.health.last_heal}` : ""}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              disabled={loading}
              onClick={onBreak}
              className="min-h-11 rounded-lg border border-alert/30 px-3 py-2 text-xs text-alert disabled:opacity-50"
            >
              Break field
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onHeal}
              className="min-h-11 rounded-lg border border-warn/30 px-3 py-2 text-xs text-warn disabled:opacity-50"
            >
              Heal
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onApprove}
              className="min-h-11 rounded-lg border border-ping/30 px-3 py-2 text-xs text-ping disabled:opacity-50"
            >
              Approve
            </button>
          </div>
        </div>
        {snapshot.notes.length > 0 ? (
          <ul className="mt-3 grid gap-1 text-xs text-muted">
            {snapshot.notes.map((note) => (
              <li key={note} className="break-words">
                {note}
              </li>
            ))}
          </ul>
        ) : null}
        {healNote ? <p className="mt-2 font-mono text-xs break-words text-muted">{healNote}</p> : null}
        {healPreview ? (
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-[#0b0e14] p-3 font-mono text-[11px] text-muted">
            {JSON.stringify(healPreview, null, 2)}
          </pre>
        ) : null}
      </div>
    </section>
  );
}

function Catalog({ items, brandName }: { items: Item[]; brandName: string }) {
  return (
    <>
      <div className="grid gap-2 md:hidden">
        {items.map((item) => (
          <article
            key={`${item.source}-${item.url}-${item.name}`}
            className="rounded-2xl border border-line bg-panel p-3"
          >
            <p className="text-[11px] uppercase tracking-wide text-muted">
              {item.source === "brand" ? brandName : item.rival_name}
            </p>
            <h3 className="mt-1 text-sm font-medium leading-snug">{item.name}</h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div>
                <dt className="text-muted">Price</dt>
                <dd className="font-mono">{formatMoney(item.price, item.currency)}</dd>
              </div>
              <div>
                <dt className="text-muted">Rating</dt>
                <dd className="font-mono">
                  {item.rating ?? "—"}
                  {item.review_count ? ` (${item.review_count})` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Stock</dt>
                <dd>{formatAvailability(item.availability)}</dd>
              </div>
              <div>
                <dt className="text-muted">Promo</dt>
                <dd>{item.promo ? "yes" : "—"}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-line md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
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
            {items.map((item) => (
              <tr key={`${item.source}-${item.url}-${item.name}`} className="border-t border-line">
                <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted">
                  {item.source === "brand" ? brandName : item.rival_name}
                </td>
                <td className="max-w-md px-4 py-2.5">
                  <span className="line-clamp-2" title={item.name}>
                    {item.name}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono whitespace-nowrap">
                  {formatMoney(item.price, item.currency)}
                </td>
                <td className="px-4 py-2.5 font-mono whitespace-nowrap">
                  {item.rating ?? "—"}
                  {item.review_count ? (
                    <span className="text-muted"> ({item.review_count})</span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-xs">{formatAvailability(item.availability)}</td>
                <td className="px-4 py-2.5 text-xs">{item.promo ? "yes" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
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
    <div className="rounded-2xl border border-line bg-panel p-3 sm:p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight sm:text-2xl">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </div>
  );
}
