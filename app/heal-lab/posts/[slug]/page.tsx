import { HEAL_LAB_BRAND, HEAL_LAB_POSTS } from "@/lib/heal-lab-data";

export default async function HealLabPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = HEAL_LAB_POSTS.find((p) => p.slug === slug);
  if (!post) {
    return <p style={{ padding: "2rem" }}>Post not found.</p>;
  }
  return (
    <article style={{ fontFamily: "Georgia, serif", maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
      <p>
        <a href="/heal-lab/before">← Changelog</a>
      </p>
      <h1>{post.title}</h1>
      <p>{post.published_at}</p>
      <p>{post.summary}</p>
      <p style={{ color: "#666", fontSize: 14 }}>{HEAL_LAB_BRAND.description}</p>
    </article>
  );
}
