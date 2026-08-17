import type { Domain, Item, Snapshot } from "./schema";
import { attachInsights, hostnameLabel } from "./plays";

function item(
  partial: Omit<Item, "currency" | "collector_id" | "run_id"> &
    Partial<Pick<Item, "currency" | "collector_id" | "run_id">>,
): Item {
  return {
    currency: "INR",
    collector_id: "c_mock_brandradar",
    run_id: "j_mock_preview",
    ...partial,
  };
}

const catalogs: Record<
  Domain,
  { brandItems: Omit<Item, "source" | "currency" | "collector_id" | "run_id">[]; rivals: Array<{ name: string; items: Omit<Item, "source" | "rival_name" | "currency" | "collector_id" | "run_id">[] }> }
> = {
  ecommerce: {
    brandItems: [
      {
        name: "Vitamin C Serum 30ml",
        url: "/products/vit-c-serum",
        price: 899,
        availability: "in_stock",
        rating: 4.2,
        review_count: 128,
        promo: false,
      },
      {
        name: "Niacinamide 10% 30ml",
        url: "/products/niacinamide",
        price: 649,
        availability: "in_stock",
        rating: 4.4,
        review_count: 86,
        promo: false,
      },
      {
        name: "SPF 50 Sunscreen 50g",
        url: "/products/spf-50",
        price: 499,
        availability: "in_stock",
        rating: 4.1,
        review_count: 54,
        promo: false,
      },
    ],
    rivals: [
      {
        name: "PureLeaf",
        items: [
          {
            name: "Vitamin C Serum 30ml",
            url: "/products/vit-c-serum",
            price: 749,
            availability: "in_stock",
            rating: 4.5,
            review_count: 410,
            promo: true,
          },
          {
            name: "Niacinamide 10% 30ml",
            url: "/products/niacinamide",
            price: 599,
            availability: "out_of_stock",
            rating: 4.3,
            review_count: 220,
            promo: false,
          },
          {
            name: "Retinol Night Cream 50g",
            url: "/products/retinol",
            price: 999,
            availability: "in_stock",
            rating: 4.6,
            review_count: 301,
            promo: false,
          },
        ],
      },
      {
        name: "SkinForge",
        items: [
          {
            name: "Vitamin C Serum 30ml",
            url: "/products/vit-c",
            price: 799,
            availability: "in_stock",
            rating: 4.4,
            review_count: 188,
            promo: false,
          },
          {
            name: "SPF 50 Sunscreen 50g",
            url: "/products/sunscreen",
            price: 399,
            availability: "in_stock",
            rating: 4.0,
            review_count: 97,
            promo: true,
          },
        ],
      },
    ],
  },
  edtech: {
    brandItems: [
      {
        name: "Full Stack Web Dev Bootcamp",
        url: "/courses/fullstack",
        price: 49999,
        availability: "in_stock",
        rating: 4.3,
        review_count: 920,
        promo: false,
      },
      {
        name: "Data Analytics with Python",
        url: "/courses/analytics",
        price: 24999,
        availability: "in_stock",
        rating: 4.1,
        review_count: 410,
        promo: false,
      },
    ],
    rivals: [
      {
        name: "SkillNest",
        items: [
          {
            name: "Full Stack Web Dev Bootcamp",
            url: "/courses/fullstack",
            price: 39999,
            availability: "in_stock",
            rating: 4.6,
            review_count: 2104,
            promo: true,
          },
          {
            name: "Data Analytics with Python",
            url: "/courses/python-analytics",
            price: 19999,
            availability: "in_stock",
            rating: 4.4,
            review_count: 880,
            promo: false,
          },
          {
            name: "System Design Interview Track",
            url: "/courses/system-design",
            price: 14999,
            availability: "in_stock",
            rating: 4.7,
            review_count: 640,
            promo: false,
          },
        ],
      },
      {
        name: "Pathwise",
        items: [
          {
            name: "Full Stack Web Dev Bootcamp",
            url: "/courses/web",
            price: 44999,
            availability: "in_stock",
            rating: 4.2,
            review_count: 300,
            promo: false,
          },
        ],
      },
    ],
  },
  food: {
    brandItems: [
      {
        name: "Butter Chicken Bowl",
        url: "/menu/butter-chicken",
        price: 349,
        availability: "in_stock",
        rating: 4.2,
        review_count: 640,
        promo: false,
      },
      {
        name: "Paneer Tikka Wrap",
        url: "/menu/paneer-wrap",
        price: 249,
        availability: "in_stock",
        rating: 4.0,
        review_count: 210,
        promo: false,
      },
    ],
    rivals: [
      {
        name: "Spice Route",
        items: [
          {
            name: "Butter Chicken Bowl",
            url: "/menu/butter-chicken",
            price: 299,
            availability: "in_stock",
            rating: 4.5,
            review_count: 1120,
            promo: true,
          },
          {
            name: "Chicken Biryani Box",
            url: "/menu/biryani",
            price: 279,
            availability: "in_stock",
            rating: 4.4,
            review_count: 980,
            promo: false,
          },
        ],
      },
      {
        name: "Green Thali",
        items: [
          {
            name: "Paneer Tikka Wrap",
            url: "/menu/paneer",
            price: 219,
            availability: "out_of_stock",
            rating: 4.1,
            review_count: 140,
            promo: false,
          },
          {
            name: "Butter Chicken Bowl",
            url: "/menu/bc-bowl",
            price: 329,
            availability: "in_stock",
            rating: 4.3,
            review_count: 400,
            promo: false,
          },
        ],
      },
    ],
  },
};

export function buildMockSnapshot(input: {
  brandUrl: string;
  brandName?: string;
  domain: Domain;
  rivalUrls: string[];
  notes?: string[];
}): Snapshot {
  const catalog = catalogs[input.domain];
  const brandName =
    input.brandName?.trim() || hostnameLabel(input.brandUrl, "Brand");
  const brandUrl = input.brandUrl;

  const rivals = catalog.rivals.map((rival, index) => {
    const url =
      input.rivalUrls[index] ||
      `https://${rival.name.toLowerCase().replace(/\s+/g, "")}.example`;
    return {
      name: input.rivalUrls[index]
        ? hostnameLabel(input.rivalUrls[index], rival.name)
        : rival.name,
      url,
    };
  });

  const items: Item[] = [
    ...catalog.brandItems.map((entry) =>
      item({
        ...entry,
        source: "brand",
        url: new URL(entry.url, brandUrl.endsWith("/") ? brandUrl : `${brandUrl}/`)
          .toString(),
      }),
    ),
    ...catalog.rivals.flatMap((rival, index) =>
      rival.items.map((entry) =>
        item({
          ...entry,
          source: "rival",
          rival_name: rivals[index]?.name ?? rival.name,
          url: new URL(
            entry.url,
            `${rivals[index].url.endsWith("/") ? rivals[index].url : `${rivals[index].url}/`}`,
          ).toString(),
        }),
      ),
    ),
  ];

  const snapshot: Snapshot = {
    brand: {
      name: brandName,
      domain: input.domain,
      url: brandUrl,
      snapshot_at: new Date().toISOString(),
    },
    rivals,
    items,
    signals: [],
    plays: [],
    health: {
      null_rate: 0,
      last_heal: null,
      collector_ids: ["c_mock_brandradar"],
      broken_fields: [],
    },
    mode: "mock",
    notes: input.notes ?? [
      "Mock arena — Bright Data collectors are not wired yet. Snapshot uses public-shaped demo rows stamped with your brand URL.",
    ],
  };

  return attachInsights(snapshot);
}

export function breakSnapshot(snapshot: Snapshot): Snapshot {
  const items = snapshot.items.map((entry, index) =>
    index === 0 ? { ...entry, price: null, rating: null } : entry,
  );
  return attachInsights({
    ...snapshot,
    items,
    notes: [
      ...snapshot.notes.filter((note) => !note.startsWith("Simulated")),
      "Simulated site redesign: price and rating came back null on the hero row.",
    ],
  });
}

export function healSnapshot(snapshot: Snapshot): Snapshot {
  const catalog = catalogs[snapshot.brand.domain];
  const hero = catalog.brandItems[0];
  const items = snapshot.items.map((entry, index) =>
    index === 0 && hero
      ? { ...entry, price: hero.price, rating: hero.rating }
      : entry,
  );
  return attachInsights({
    ...snapshot,
    items,
    health: {
      ...snapshot.health,
      last_heal: new Date().toISOString(),
      collector_ids: snapshot.health.collector_ids,
    },
    notes: [
      "Self-heal kept the same collector id. Price and rating recovered from the repaired extraction.",
    ],
  });
}
