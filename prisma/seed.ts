/**
 * Prisma seed script
 *
 * Populates the database with realistic example data for all four launch
 * communities. Run with `npm run db:seed` (wraps `tsx prisma/seed.ts`).
 *
 * Idempotent: uses `upsert` keyed on unique fields (slug/email) so the script
 * can be re-run safely against a dev database without creating duplicates.
 */

import { PrismaClient, UserRole, ContentStatus, EventType, BlogCategory } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Communities ──────────────────────────────────────────────────────────────

const communities = [
  {
    name: "Zcash Nigeria",
    slug: "zcash-nigeria",
    description:
      "The Nigerian chapter of the Zcash ambassador program, driving privacy-first financial education across Lagos, Abuja, and beyond.",
    region: "West Africa",
    website: "https://zcashnigeria.org",
    telegram: "https://t.me/zcashnigeria",
    xAccount: "@ZcashNigeria",
    logo: "https://res.cloudinary.com/zcash-africa/image/upload/v1/zcash-africa/nigeria/logo.png",
    banner: "https://res.cloudinary.com/zcash-africa/image/upload/v1/zcash-africa/nigeria/banner.jpg",
  },
  {
    name: "Zcash Ghana",
    slug: "zcash-ghana",
    description:
      "Building privacy-tech literacy in Ghana through campus meetups, workshops, and developer onboarding programs.",
    region: "West Africa",
    website: "https://zcashghana.org",
    telegram: "https://t.me/zcashghana",
    xAccount: "@ZcashGhana",
    logo: "https://res.cloudinary.com/zcash-africa/image/upload/v1/zcash-africa/ghana/logo.png",
    banner: "https://res.cloudinary.com/zcash-africa/image/upload/v1/zcash-africa/ghana/banner.jpg",
  },
  {
    name: "Zcash South Africa",
    slug: "zcash-south-africa",
    description:
      "Connecting South Africa's fintech and crypto communities with the Zcash ecosystem through education and grassroots advocacy.",
    region: "Southern Africa",
    website: "https://zcashsouthafrica.org",
    telegram: "https://t.me/zcashsouthafrica",
    xAccount: "@ZcashSouthAfrica",
    logo: "https://res.cloudinary.com/zcash-africa/image/upload/v1/zcash-africa/south-africa/logo.png",
    banner: "https://res.cloudinary.com/zcash-africa/image/upload/v1/zcash-africa/south-africa/banner.jpg",
  },
  {
    name: "Zcash East Africa",
    slug: "zcash-east-africa",
    description:
      "A regional hub spanning Kenya, Tanzania, and Uganda, focused on remittances, financial privacy, and Swahili-language education.",
    region: "East Africa",
    website: "https://zcasteastafrica.org",
    telegram: "https://t.me/zcasteastafrica",
    xAccount: "@ZcashEastAfrica",
    logo: "https://res.cloudinary.com/zcash-africa/image/upload/v1/zcash-africa/east-africa/logo.png",
    banner: "https://res.cloudinary.com/zcash-africa/image/upload/v1/zcash-africa/east-africa/banner.jpg",
  },
] as const;

// ─── Per-community supplementary data ─────────────────────────────────────────
// Keyed by slug so we can wire up relations after the community is created.

type SeedExtras = {
  ambassadors: Array<{
    name: string;
    role: string;
    bio: string;
    country: string;
    xAccount?: string;
    telegram?: string;
  }>;
  adminEmail: string;
  adminName: string;
  contributorEmail: string;
  contributorName: string;
  event: {
    title: string;
    description: string;
    location: string;
    eventType: EventType;
    daysFromNow: number; // negative = past (so we get a mix of upcoming/recent)
    attendance: number;
  };
  post: {
    title: string;
    excerpt: string;
    category: BlogCategory;
    tags: string[];
  };
};

const extras: Record<string, SeedExtras> = {
  "zcash-nigeria": {
    ambassadors: [
      {
        name: "Adaeze Okafor",
        role: "Lead Ambassador",
        bio: "Privacy advocate and fintech educator based in Lagos, organizing monthly Zcash meetups since 2023.",
        country: "Nigeria",
        xAccount: "@adaeze_zec",
        telegram: "@adaezeokafor",
      },
      {
        name: "Tunde Bakare",
        role: "Developer Relations",
        bio: "Backend engineer onboarding Nigerian developers to shielded-transaction tooling and the Zcash SDK.",
        country: "Nigeria",
        xAccount: "@tunde_codes",
      },
    ],
    adminEmail: "admin@zcashnigeria.org",
    adminName: "Adaeze Okafor",
    contributorEmail: "writer@zcashnigeria.org",
    contributorName: "Ifeoma Chukwu",
    event: {
      title: "Lagos Privacy & Payments Meetup",
      description:
        "A hands-on session covering shielded transactions, wallet setup, and how financial privacy protects everyday users in Nigeria's cash-based economy.",
      location: "Civic Hub, Yaba, Lagos",
      eventType: EventType.MEETUP,
      daysFromNow: 21,
      attendance: 0,
    },
    post: {
      title: "Why Financial Privacy Matters for Nigerian Freelancers",
      excerpt:
        "Cross-border freelancers face unique exposure risks when payment histories are public. Here's how shielded transactions change the calculus.",
      category: BlogCategory.EDUCATION,
      tags: ["privacy", "freelancing", "remittances"],
    },
  },
  "zcash-ghana": {
    ambassadors: [
      {
        name: "Kwame Mensah",
        role: "Lead Ambassador",
        bio: "Community organizer connecting University of Ghana computer science students with the Zcash developer ecosystem.",
        country: "Ghana",
        xAccount: "@kwame_zec",
        telegram: "@kwamemensah",
      },
      {
        name: "Abena Owusu",
        role: "Community Manager",
        bio: "Runs Accra's quarterly 'Privacy 101' workshop series for small-business owners and market traders.",
        country: "Ghana",
        telegram: "@abenaowusu",
      },
    ],
    adminEmail: "admin@zcashghana.org",
    adminName: "Kwame Mensah",
    contributorEmail: "writer@zcashghana.org",
    contributorName: "Yaw Boateng",
    event: {
      title: "Accra Campus Workshop: Intro to Zcash",
      description:
        "An introductory workshop for university students covering blockchain fundamentals, the case for privacy-preserving payments, and live wallet demos.",
      location: "University of Ghana, Legon Campus",
      eventType: EventType.WORKSHOP,
      daysFromNow: 14,
      attendance: 0,
    },
    post: {
      title: "Recap: Accra's First Zcash Developer Hackathon",
      excerpt:
        "Forty developers, eighteen hours, and six shipped prototypes — a look back at how Ghana's first Zcash hackathon came together.",
      category: BlogCategory.EVENT_REPORTS,
      tags: ["hackathon", "developers", "accra"],
    },
  },
  "zcash-south-africa": {
    ambassadors: [
      {
        name: "Lerato Dlamini",
        role: "Lead Ambassador",
        bio: "Fintech consultant bridging South Africa's established crypto-trading scene with privacy-tech education.",
        country: "South Africa",
        xAccount: "@lerato_zec",
        telegram: "@leratodlamini",
      },
      {
        name: "Sipho Nkosi",
        role: "Developer Relations",
        bio: "Maintains community translation glossaries and supports local meetup infrastructure across Johannesburg and Cape Town.",
        country: "South Africa",
        xAccount: "@sipho_builds",
      },
    ],
    adminEmail: "admin@zcashsouthafrica.org",
    adminName: "Lerato Dlamini",
    contributorEmail: "writer@zcashsouthafrica.org",
    contributorName: "Naledi Khumalo",
    event: {
      title: "Cape Town Fintech & Privacy Roundtable",
      description:
        "A panel discussion with local fintech founders on regulatory trends, consumer data protection, and the role of privacy coins in emerging markets.",
      location: "The Bandwidth Barn, Cape Town",
      eventType: EventType.CONFERENCE,
      daysFromNow: -10,
      attendance: 86,
    },
    post: {
      title: "How POPIA Compliance Connects to Crypto Privacy",
      excerpt:
        "South Africa's data protection law and privacy-preserving blockchain design share more common ground than you'd expect.",
      category: BlogCategory.ECOSYSTEM,
      tags: ["regulation", "popia", "compliance"],
    },
  },
  "zcash-east-africa": {
    ambassadors: [
      {
        name: "Amani Mwangi",
        role: "Lead Ambassador",
        bio: "Coordinates a three-country ambassador network spanning Kenya, Tanzania, and Uganda, with a focus on remittance use cases.",
        country: "Kenya",
        xAccount: "@amani_zec",
        telegram: "@amanimwangi",
      },
      {
        name: "Furaha Joseph",
        role: "Education Lead",
        bio: "Builds Swahili-language learning materials and runs 'Faragha na Fedha' (Privacy and Money) community sessions in Dar es Salaam.",
        country: "Tanzania",
        telegram: "@furahajoseph",
      },
    ],
    adminEmail: "admin@zcasteastafrica.org",
    adminName: "Amani Mwangi",
    contributorEmail: "writer@zcasteastafrica.org",
    contributorName: "Grace Achieng",
    event: {
      title: "Nairobi Remittance & Privacy Forum",
      description:
        "Exploring how shielded transactions can lower costs and improve safety for cross-border remittances within the East African Community.",
      location: "iHub, Nairobi",
      eventType: EventType.ONLINE,
      daysFromNow: 35,
      attendance: 0,
    },
    post: {
      title: "Faragha na Fedha: Teaching Privacy in Swahili",
      excerpt:
        "Why localized, language-first education is the key to privacy-tech adoption across East Africa — and what we've learned running it.",
      category: BlogCategory.COMMUNITY_UPDATES,
      tags: ["education", "swahili", "localization"],
    },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding Zcash Africa database...\n");

  // 1. Super Admin (platform-wide, no community)
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@zcashafrica.org" },
    update: {},
    create: {
      name: "Zcash Africa Platform Team",
      email: "superadmin@zcashafrica.org",
      role: UserRole.SUPER_ADMIN,
    },
  });
  console.log(`✓ Super admin ready: ${superAdmin.email}`);

  for (const communityData of communities) {
    const extra = extras[communityData.slug];
    if (!extra) continue;

    // 2. Community
    const community = await prisma.community.upsert({
      where: { slug: communityData.slug },
      update: communityData,
      create: communityData,
    });
    console.log(`\n✓ Community: ${community.name} (${community.slug})`);

    // 3. Community Admin
    const admin = await prisma.user.upsert({
      where: { email: extra.adminEmail },
      update: { communityId: community.id, role: UserRole.COMMUNITY_ADMIN },
      create: {
        name: extra.adminName,
        email: extra.adminEmail,
        role: UserRole.COMMUNITY_ADMIN,
        communityId: community.id,
      },
    });
    console.log(`  ✓ Community admin: ${admin.email}`);

    // 4. Contributor
    const contributor = await prisma.user.upsert({
      where: { email: extra.contributorEmail },
      update: { communityId: community.id, role: UserRole.CONTRIBUTOR },
      create: {
        name: extra.contributorName,
        email: extra.contributorEmail,
        role: UserRole.CONTRIBUTOR,
        communityId: community.id,
      },
    });
    console.log(`  ✓ Contributor: ${contributor.email}`);

    // 5. Ambassadors
    // Ambassador has no natural unique key, so we look up by (name, communityId)
    // and create-or-update explicitly to keep the script idempotent.
    for (const amb of extra.ambassadors) {
      const existing = await prisma.ambassador.findFirst({
        where: { name: amb.name, communityId: community.id },
        select: { id: true },
      });

      if (existing) {
        await prisma.ambassador.update({
          where: { id: existing.id },
          data: { ...amb, communityId: community.id },
        });
      } else {
        await prisma.ambassador.create({
          data: { ...amb, communityId: community.id },
        });
      }
    }
    console.log(`  ✓ Ambassadors: ${extra.ambassadors.length} seeded`);

    // 6. Event
    const eventSlug = `${slugify(extra.event.title)}-${communityData.slug.replace("zcash-", "")}`;
    const eventDate = daysFromNow(extra.event.daysFromNow);
    await prisma.event.upsert({
      where: { slug: eventSlug },
      update: {},
      create: {
        title: extra.event.title,
        slug: eventSlug,
        description: extra.event.description,
        eventDate,
        location: extra.event.location,
        eventType: extra.event.eventType,
        attendance: extra.event.attendance,
        status: ContentStatus.PUBLISHED,
        communityId: community.id,
        authorId: admin.id,
        gallery: [],
      },
    });
    console.log(`  ✓ Event: ${extra.event.title}`);

    // 7. Blog post
    const postSlug = `${slugify(extra.post.title)}-${communityData.slug.replace("zcash-", "")}`;
    await prisma.blogPost.upsert({
      where: { slug: postSlug },
      update: {},
      create: {
        title: extra.post.title,
        slug: postSlug,
        excerpt: extra.post.excerpt,
        content: [
          {
            _type: "block",
            style: "normal",
            children: [{ _type: "span", text: extra.post.excerpt }],
          },
        ],
        category: extra.post.category,
        tags: extra.post.tags,
        status: ContentStatus.PUBLISHED,
        publishedAt: daysFromNow(-Math.abs(extra.event.daysFromNow) - 2),
        authorId: contributor.id,
        communityId: community.id,
      },
    });
    console.log(`  ✓ Blog post: ${extra.post.title}`);
  }

  // 8. A pending submission queued for Super Admin review (cross-community example)
  const nigeria = await prisma.community.findUnique({ where: { slug: "zcash-nigeria" } });
  const nigeriaContributor = await prisma.user.findUnique({
    where: { email: extras["zcash-nigeria"]!.contributorEmail },
  });
  if (nigeria && nigeriaContributor) {
    await prisma.blogPost.upsert({
      where: { slug: "draft-zk-snarks-explained-nigeria" },
      update: {},
      create: {
        title: "zk-SNARKs Explained for Newcomers",
        slug: "draft-zk-snarks-explained-nigeria",
        excerpt: "A plain-language walkthrough of the cryptography that makes shielded transactions possible.",
        content: [{ _type: "block", style: "normal", children: [{ _type: "span", text: "Draft in progress…" }] }],
        category: BlogCategory.DEVELOPER,
        tags: ["zk-snarks", "cryptography", "beginners"],
        status: ContentStatus.PENDING,
        authorId: nigeriaContributor.id,
        communityId: nigeria.id,
      },
    });
    console.log(`\n✓ Pending submission queued for review: "zk-SNARKs Explained for Newcomers"`);
  }

  console.log("\n🌱 Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
