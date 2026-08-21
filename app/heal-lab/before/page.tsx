import {
  HEAL_LAB_BRAND,
  HEAL_LAB_POSTS,
  healLabPostUrl,
} from "@/lib/heal-lab-data";

/** BEFORE redesign — classic class names (.post-title). */
export default function HealLabBeforePage() {
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://brandradar-beta.vercel.app";

  return (
    <div data-heal-lab="before">
      <style>{`
        .hl-before { font-family: Georgia, serif; margin: 0; background: #f6f3ee; color: #1a1a1a; min-height: 100vh; }
        .hl-before .site-header { padding: 2rem 1.5rem; border-bottom: 2px solid #1a1a1a; }
        .hl-before .site-header h1 { margin: 0; font-size: 2rem; }
        .hl-before .site-header p { margin: 0.5rem 0 0; color: #555; }
        .hl-before .changelog-list { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; }
        .hl-before .post-card { padding: 1.25rem 0; border-bottom: 1px solid #d9d2c5; }
        .hl-before .post-title { margin: 0; font-size: 1.25rem; }
        .hl-before .post-title a { color: #0b3d2e; text-decoration: none; }
        .hl-before .post-date { font-size: 0.85rem; color: #666; margin-top: 0.35rem; }
        .hl-before .post-summary { margin: 0.5rem 0 0; line-height: 1.45; }
        .hl-before .demo-banner { background: #1a1a1a; color: #f6f3ee; font: 12px/1.4 monospace; padding: 0.5rem 1.5rem; }
      `}</style>
      <div className="hl-before">
        <div className="demo-banner">
          BrandRadar Heal Lab · layout=before · .changelog-list .post-card .post-title
        </div>
        <header className="site-header">
          <h1>{HEAL_LAB_BRAND.name}</h1>
          <p>{HEAL_LAB_BRAND.tagline}</p>
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
