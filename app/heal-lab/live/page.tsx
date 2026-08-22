import {
  HEAL_LAB_BRAND,
  HEAL_LAB_POSTS,
  healLabPostUrl,
} from "@/lib/heal-lab-data";
import { HEAL_LAB_LIVE_VARIANT } from "@/lib/heal-lab-live";

/**
 * Same-URL Heal Lab stress page.
 * Flip HEAL_LAB_LIVE_VARIANT in lib/heal-lab-live.ts → redeploy → scrape again.
 */
export default function HealLabLivePage() {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://brandradar-beta.vercel.app";

  if (HEAL_LAB_LIVE_VARIANT === "redesign-v2") {
    return <RedesignV2 origin={origin} />;
  }
  return <Classic origin={origin} />;
}

function Classic({ origin }: { origin: string }) {
  return (
    <div data-heal-lab="live" data-variant="classic">
      <style>{`
        .hl-live { font-family: Georgia, serif; margin: 0; background: #f6f3ee; color: #1a1a1a; min-height: 100vh; }
        .hl-live .site-header { padding: 2rem 1.5rem; border-bottom: 2px solid #1a1a1a; display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; justify-content: space-between; }
        .hl-live .site-header h1 { margin: 0; font-size: 2rem; }
        .hl-live .site-header p { margin: 0.5rem 0 0; color: #555; }
        .hl-live .header-actions { display: flex; gap: 0.5rem; }
        .hl-live .btn-primary { background: #0b3d2e; color: #f6f3ee; border: 0; padding: 0.55rem 0.9rem; font: 13px/1 Georgia, serif; cursor: pointer; }
        .hl-live .btn-ghost { background: transparent; color: #0b3d2e; border: 1px solid #0b3d2e; padding: 0.55rem 0.9rem; font: 13px/1 Georgia, serif; cursor: pointer; }
        .hl-live .changelog-list { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; }
        .hl-live .post-card { padding: 1.25rem 0; border-bottom: 1px solid #d9d2c5; }
        .hl-live .post-title { margin: 0; font-size: 1.25rem; }
        .hl-live .post-title a { color: #0b3d2e; text-decoration: none; }
        .hl-live .post-date { font-size: 0.85rem; color: #666; margin-top: 0.35rem; }
        .hl-live .post-summary { margin: 0.5rem 0 0; line-height: 1.45; }
        .hl-live .demo-banner { background: #1a1a1a; color: #f6f3ee; font: 12px/1.4 monospace; padding: 0.5rem 1.5rem; }
      `}</style>
      <div className="hl-live">
        <div className="demo-banner">
          Heal Lab LIVE · variant=classic · same URL forever · .post-title
        </div>
        <header className="site-header">
          <div>
            <h1>{HEAL_LAB_BRAND.name}</h1>
            <p>{HEAL_LAB_BRAND.tagline}</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-ghost">
              Subscribe
            </button>
            <button type="button" className="btn-primary">
              Open app
            </button>
          </div>
        </header>
        <main className="changelog-list">
          <h2>Changelog</h2>
          {HEAL_LAB_POSTS.map((post) => (
            <article key={post.slug} className="post-card">
              <h3 className="post-title">
                <a href={healLabPostUrl(origin, post.slug)}>{post.title}</a>
              </h3>
              <p className="post-date">{post.published_at}</p>
              <p className="post-summary">{post.summary}</p>
            </article>
          ))}
        </main>
      </div>
    </div>
  );
}

/** Multi-break redesign: classes renamed, CTAs moved into cards, titles nested in buttons. */
function RedesignV2({ origin }: { origin: string }) {
  return (
    <div data-heal-lab="live" data-variant="redesign-v2">
      <style>{`
        .dm-shell { font-family: "IBM Plex Sans", system-ui, sans-serif; margin: 0; background: #071018; color: #e7f3ff; min-height: 100vh; }
        .dm-shell .dm-banner { background: #2ee6a6; color: #04140c; font: 12px/1.4 ui-monospace, monospace; padding: 0.55rem 1.25rem; }
        .dm-shell .dm-hero { padding: 1.75rem 1.25rem 1rem; border-bottom: 1px solid #1d3348; }
        .dm-shell .dm-hero h1 { margin: 0; font-size: 1.65rem; letter-spacing: -0.03em; }
        .dm-shell .dm-hero p { margin: 0.4rem 0 0; color: #8fb0c9; }
        .dm-shell .dm-rail { max-width: 780px; margin: 0 auto; padding: 1.25rem; display: grid; gap: 0.85rem; }
        .dm-shell .dm-card { display: grid; grid-template-columns: 1fr auto; gap: 0.75rem 1rem; align-items: start; background: #0d1a24; border: 1px solid #234057; border-radius: 14px; padding: 1rem 1.05rem; }
        .dm-shell .dm-meta { display: flex; flex-direction: column; gap: 0.35rem; }
        .dm-shell .dm-kicker { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: #6f93ad; }
        .dm-shell .dm-body { color: #c5d9e8; line-height: 1.45; margin: 0; font-size: 0.95rem; }
        .dm-shell .dm-actions { display: flex; flex-direction: column; gap: 0.4rem; min-width: 7.5rem; }
        .dm-shell .dm-cta { appearance: none; border: 0; border-radius: 999px; padding: 0.55rem 0.85rem; font: 600 12px/1.2 inherit; cursor: pointer; text-align: center; text-decoration: none; }
        .dm-shell .dm-cta-primary { background: #2ee6a6; color: #04140c; }
        .dm-shell .dm-cta-secondary { background: transparent; color: #9fd0ea; border: 1px solid #355872; }
        .dm-shell .dm-footer-cta { margin: 1.5rem auto 2rem; max-width: 780px; padding: 0 1.25rem; display: flex; gap: 0.6rem; justify-content: flex-end; }
      `}</style>
      <div className="dm-shell">
        <div className="dm-banner">
          Heal Lab LIVE · variant=redesign-v2 · SAME URL · no .post-title · titles inside buttons · CTAs reordered
        </div>
        <header className="dm-hero">
          <h1>{HEAL_LAB_BRAND.name}</h1>
          <p>{HEAL_LAB_BRAND.tagline} · shipping feed redesign</p>
        </header>
        <div className="dm-footer-cta">
          <a className="dm-cta dm-cta-secondary" href="#updates">
            Jump to updates
          </a>
          <button type="button" className="dm-cta dm-cta-primary">
            Start free
          </button>
        </div>
        <main className="dm-rail" id="updates" data-dm="feed">
          {HEAL_LAB_POSTS.map((post) => (
            <section key={post.slug} className="dm-card" data-dm="entry">
              <div className="dm-meta">
                <span className="dm-kicker" data-dm="when">
                  {post.published_at}
                </span>
                <p className="dm-body" data-dm="blurb">
                  {post.summary}
                </p>
              </div>
              <div className="dm-actions">
                {/* Title is no longer an h3.post-title — nested in a CTA button/link */}
                <a
                  className="dm-cta dm-cta-primary"
                  data-dm="open"
                  href={healLabPostUrl(origin, post.slug)}
                >
                  <span data-dm="headline">{post.title}</span>
                </a>
                <button type="button" className="dm-cta dm-cta-secondary">
                  Share
                </button>
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
