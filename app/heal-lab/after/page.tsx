import {
  HEAL_LAB_BRAND,
  HEAL_LAB_POSTS,
  healLabPostUrl,
} from "@/lib/heal-lab-data";

/** AFTER redesign — .post-title gone; [data-test="post-title"] instead. */
export default function HealLabAfterPage() {
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://brandradar-beta.vercel.app";

  return (
    <div data-heal-lab="after">
      <style>{`
        .hl-after { font-family: "Segoe UI", system-ui, sans-serif; margin: 0; background: #0b1220; color: #e8eefc; min-height: 100vh; }
        .hl-after .top { padding: 1.5rem; background: linear-gradient(120deg, #12203a, #0b1220); }
        .hl-after .top h1 { margin: 0; font-size: 1.75rem; letter-spacing: -0.02em; }
        .hl-after .top p { margin: 0.4rem 0 0; color: #9db0d0; }
        .hl-after .feed { max-width: 760px; margin: 0 auto; padding: 1.5rem; display: grid; gap: 1rem; }
        .hl-after .item, .hl-after [data-test="post-card"] { background: #141e33; border: 1px solid #243356; border-radius: 12px; padding: 1rem 1.1rem; }
        .hl-after [data-test="post-title"] { margin: 0; font-size: 1.1rem; }
        .hl-after [data-test="post-title"] a { color: #7dffc0; text-decoration: none; }
        .hl-after [data-test="post-date"] { margin: 0.35rem 0 0; font-size: 0.8rem; color: #8ea0c0; font-family: ui-monospace, monospace; }
        .hl-after [data-test="post-summary"] { margin: 0.55rem 0 0; color: #c9d4ea; line-height: 1.45; }
        .hl-after .demo-banner { background: #7dffc0; color: #04140c; font: 12px/1.4 monospace; padding: 0.5rem 1.5rem; }
      `}</style>
      <div className="hl-after">
        <div className="demo-banner">
          BrandRadar Heal Lab · layout=after · [data-test=&quot;post-title&quot;] (old .post-title removed)
        </div>
        <header className="top">
          <h1>{HEAL_LAB_BRAND.name}</h1>
          <p>{HEAL_LAB_BRAND.tagline} · redesigned updates feed</p>
        </header>
        <main className="feed" data-test="updates-feed">
          {HEAL_LAB_POSTS.map((post) => (
            <article key={post.slug} data-test="post-card" className="item">
              <h2 data-test="post-title">
                <a href={healLabPostUrl(origin, post.slug)}>{post.title}</a>
              </h2>
              <p data-test="post-date">{post.published_at}</p>
              <p data-test="post-summary">{post.summary}</p>
            </article>
          ))}
        </main>
      </div>
    </div>
  );
}
