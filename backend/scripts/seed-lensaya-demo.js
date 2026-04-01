import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/prisma.js";

dotenv.config();

const DEMO = {
  email: "demo.lensaya@example.com",
  password: "LensayaDemo123!",
  username: "lensaya",
  fullName: "Lensaya Studio Demo",
  studioName: "Lensaya",
};

const ACTIVE_SUBSCRIPTION_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE"];

const unsplash = (path) => `https://images.unsplash.com/${path}?auto=format&fit=crop&w=1800&q=80`;

const avatarImage = unsplash("photo-1542038784456-1ea8e935640e");
const bannerImage = unsplash("photo-1511285560929-80b456fea0bc");
const heroImage = unsplash("photo-1520854221256-17451cc331bf");

const teamMembers = [
  {
    name: "Aina Rahman",
    role: "Creative Director",
    image: unsplash("photo-1494790108377-be9c29b29330"),
  },
  {
    name: "Daniel Koh",
    role: "Lead Photographer",
    image: unsplash("photo-1500648767791-00dcc994a43e"),
  },
  {
    name: "Sofia Lim",
    role: "Retouch Specialist",
    image: unsplash("photo-1534528741775-53994a69daeb"),
  },
  {
    name: "Haziq Amir",
    role: "Lighting Engineer",
    image: unsplash("photo-1506794778202-cad84cf45f1d"),
  },
];

const serviceSeeds = [
  {
    key: "wedding",
    name: "Wedding Editorial Stories",
    emoji: "\u{1F48D}",
    description:
      "Luxury wedding coverage with cinematic direction, timeline planning, and signature color grading for timeless albums.",
    thumbnail: unsplash("photo-1522673607200-164d1b6ce486"),
    packages: [
      {
        name: "Signature Wedding Day",
        durationLabel: "8 hours",
        priceCents: 480000,
        isPopular: true,
        features: [
          "2-photographer storytelling team",
          "700+ hand-edited images",
          "24-hour teaser highlights",
          "Timeline and moodboard planning call",
          "Luxury online gallery with download delivery",
        ],
      },
      {
        name: "Weekend Wedding Experience",
        durationLabel: "2 days",
        priceCents: 860000,
        isPopular: false,
        features: [
          "Pre-wedding engagement session included",
          "2-day wedding event coverage",
          "1200+ hand-edited images",
          "Next-morning social media selects",
          "Premium heirloom photo book design",
        ],
      },
    ],
  },
  {
    key: "portrait",
    name: "Portraits & Personal Branding",
    emoji: "\u{1F4F8}",
    description:
      "Studio and lifestyle portraits crafted for founders, creators, and professionals who need magnetic personal branding.",
    thumbnail: unsplash("photo-1521119989659-a83eee488004"),
    packages: [
      {
        name: "Brand Authority Session",
        durationLabel: "2 hours",
        priceCents: 180000,
        isPopular: true,
        features: [
          "Creative direction and shot board",
          "2 wardrobe looks",
          "40 retouched hero images",
          "LinkedIn + website crop set",
          "Commercial usage and web licensing",
        ],
      },
      {
        name: "Executive Portrait Fast-Track",
        durationLabel: "90 minutes",
        priceCents: 120000,
        isPopular: false,
        features: [
          "Studio lighting setup",
          "25 retouched images",
          "Fast 72-hour delivery",
          "Basic makeup prep guide",
        ],
      },
    ],
  },
  {
    key: "commercial",
    name: "Commercial Campaigns",
    emoji: "\u{1F9E0}",
    description:
      "Conversion-focused visuals for ad campaigns, launch drops, and e-commerce storytelling that drives clicks and sales.",
    thumbnail: unsplash("photo-1556740749-887f6717d7e4"),
    packages: [
      {
        name: "Campaign Starter Shoot",
        durationLabel: "Half day",
        priceCents: 250000,
        isPopular: false,
        features: [
          "Art direction support on set",
          "Product and lifestyle scene setups",
          "25 final campaign assets",
          "Multi-platform ad format variants",
        ],
      },
      {
        name: "Scale Campaign Production",
        durationLabel: "Full day",
        priceCents: 420000,
        isPopular: true,
        features: [
          "Multi-scene production day",
          "60 high-converting final assets",
          "A/B concept variants for paid ads",
          "Priority 48-hour delivery",
          "Stakeholder collaboration review",
        ],
      },
    ],
  },
  {
    key: "event",
    name: "Corporate Events Coverage",
    emoji: "\u{1F3A4}",
    description:
      "Coverage designed for keynote moments, sponsor visibility, and polished event media that elevates brand perception.",
    thumbnail: unsplash("photo-1511578314322-379afb476865"),
    packages: [
      {
        name: "Conference Coverage Core",
        durationLabel: "6 hours",
        priceCents: 300000,
        isPopular: false,
        features: [
          "1 senior lead photographer",
          "On-site shot list alignment",
          "350+ edited images",
          "Same-day keynote hero highlights",
        ],
      },
      {
        name: "Summit Premium Coverage",
        durationLabel: "10 hours",
        priceCents: 520000,
        isPopular: true,
        features: [
          "Dual-photographer coverage",
          "Speaker portrait corner",
          "650+ edited images",
          "Live social content handoff",
          "Sponsor-branding priority shot list",
        ],
      },
    ],
  },
  {
    key: "engagement",
    name: "Engagement & Prewedding",
    emoji: "\u{1F49E}",
    description:
      "Romantic storytelling sessions for save-the-date, wedding websites, and cinematic prewedding narratives.",
    thumbnail: unsplash("photo-1516589091380-5d8e87df6999"),
    packages: [
      {
        name: "Golden Hour Story",
        durationLabel: "2.5 hours",
        priceCents: 210000,
        isPopular: true,
        features: [
          "Location scouting + concept board",
          "2 outfit transitions",
          "60 retouched images",
          "Vertical reels-ready edits",
          "Signature album-ready color grading",
        ],
      },
      {
        name: "Destination Love Session",
        durationLabel: "Half day",
        priceCents: 360000,
        isPopular: false,
        features: [
          "Multiple nearby locations",
          "Drone-style scenic compositions",
          "90+ retouched images",
          "Express highlight delivery in 48 hours",
        ],
      },
    ],
  },
  {
    key: "family",
    name: "Family & Maternity",
    emoji: "\u{1F46A}",
    description:
      "Warm, timeless family and maternity portraits designed for heirloom albums and milestone memories.",
    thumbnail: unsplash("photo-1511895426328-dc8714191300"),
    packages: [
      {
        name: "Milestone Moments",
        durationLabel: "90 minutes",
        priceCents: 150000,
        isPopular: true,
        features: [
          "Indoor or outdoor lifestyle setup",
          "Guided posing for families",
          "35 retouched images",
          "Print-ready delivery",
        ],
      },
      {
        name: "Maternity Legacy Session",
        durationLabel: "2 hours",
        priceCents: 220000,
        isPopular: false,
        features: [
          "Styling and mood planning",
          "Partner and sibling frames included",
          "55 retouched images",
          "Luxury black-and-white edit set",
        ],
      },
    ],
  },
];

const portfolioImages = [
  { serviceKey: "wedding", category: "Wedding", featured: true, src: unsplash("photo-1529636798458-92182e662485") },
  { serviceKey: "wedding", category: "Wedding", featured: true, src: unsplash("photo-1519741497674-611481863552") },
  { serviceKey: "wedding", category: "Wedding", featured: false, src: unsplash("photo-1522673607200-164d1b6ce486") },
  { serviceKey: "wedding", category: "Wedding", featured: false, src: unsplash("photo-1523438885200-e635ba2c371e") },
  { serviceKey: "wedding", category: "Destination", featured: false, src: unsplash("photo-1529634806980-85c3dd6d34ac") },
  { serviceKey: "wedding", category: "Ceremony", featured: false, src: unsplash("photo-1511285560929-80b456fea0bc") },

  { serviceKey: "portrait", category: "Portrait", featured: true, src: unsplash("photo-1488426862026-3ee34a7d66df") },
  { serviceKey: "portrait", category: "Portrait", featured: false, src: unsplash("photo-1492562080023-ab3db95bfbce") },
  { serviceKey: "portrait", category: "Portrait", featured: false, src: unsplash("photo-1487412720507-e7ab37603c6f") },
  { serviceKey: "portrait", category: "Portrait", featured: false, src: unsplash("photo-1519085360753-af0119f7cbe7") },
  { serviceKey: "portrait", category: "Editorial", featured: false, src: unsplash("photo-1517841905240-472988babdf9") },
  { serviceKey: "portrait", category: "Studio", featured: false, src: unsplash("photo-1521119989659-a83eee488004") },

  { serviceKey: "commercial", category: "Commercial", featured: true, src: unsplash("photo-1454165804606-c3d57bc86b40") },
  { serviceKey: "commercial", category: "Commercial", featured: false, src: unsplash("photo-1460925895917-afdab827c52f") },
  { serviceKey: "commercial", category: "Commercial", featured: false, src: unsplash("photo-1498050108023-c5249f4df085") },
  { serviceKey: "commercial", category: "Commercial", featured: false, src: unsplash("photo-1521791136064-7986c2920216") },
  { serviceKey: "commercial", category: "Brand", featured: false, src: unsplash("photo-1460925895917-afdab827c52f") },
  { serviceKey: "commercial", category: "Product", featured: false, src: unsplash("photo-1484704849700-f032a568e944") },

  { serviceKey: "event", category: "Event", featured: true, src: unsplash("photo-1505373877841-8d25f7d46678") },
  { serviceKey: "event", category: "Event", featured: false, src: unsplash("photo-1511795409834-ef04bbd61622") },
  { serviceKey: "event", category: "Event", featured: false, src: unsplash("photo-1492684223066-81342ee5ff30") },
  { serviceKey: "event", category: "Event", featured: false, src: unsplash("photo-1528605248644-14dd04022da1") },
  { serviceKey: "event", category: "Conference", featured: false, src: unsplash("photo-1515169067868-5387ec356754") },
  { serviceKey: "event", category: "Keynote", featured: false, src: unsplash("photo-1475721027785-f74eccf877e2") },

  { serviceKey: "engagement", category: "Engagement", featured: true, src: unsplash("photo-1520854221256-17451cc331bf") },
  { serviceKey: "engagement", category: "Engagement", featured: false, src: unsplash("photo-1474552226712-ac0f0961a954") },
  { serviceKey: "engagement", category: "Prewedding", featured: false, src: unsplash("photo-1516589091380-5d8e87df6999") },
  { serviceKey: "engagement", category: "Prewedding", featured: false, src: unsplash("photo-1516589178581-6cd7833ae3b2") },
  { serviceKey: "engagement", category: "Couples", featured: false, src: unsplash("photo-1487412947147-5cebf100ffc2") },
  { serviceKey: "engagement", category: "Couples", featured: false, src: unsplash("photo-1524504388940-b1c1722653e1") },

  { serviceKey: "family", category: "Family", featured: true, src: unsplash("photo-1511895426328-dc8714191300") },
  { serviceKey: "family", category: "Family", featured: false, src: unsplash("photo-1516627145497-ae6968895b74") },
  { serviceKey: "family", category: "Maternity", featured: false, src: unsplash("photo-1544005313-94ddf0286df2") },
  { serviceKey: "family", category: "Maternity", featured: false, src: unsplash("photo-1508214751196-bcfd4ca60f91") },
  { serviceKey: "family", category: "Lifestyle", featured: false, src: unsplash("photo-1519340241574-2cec6aef0c01") },
  { serviceKey: "family", category: "Lifestyle", featured: false, src: unsplash("photo-1472491235688-bdc81a63246e") },
];

const makeObjectKey = (kind, index) => `demo/lensaya/${kind}-${String(index).padStart(2, "0")}.jpg`;

const collectDemoImageUrls = () => {
  const urls = [
    avatarImage,
    bannerImage,
    heroImage,
    ...teamMembers.map((member) => member.image),
    ...serviceSeeds.map((service) => service.thumbnail),
    ...portfolioImages.map((image) => image.src),
  ].filter(Boolean);

  return [...new Set(urls)];
};

async function probeImageUrl(url) {
  const requestInit = { redirect: "follow" };

  try {
    const headResponse = await fetch(url, { ...requestInit, method: "HEAD" });
    if (headResponse.ok) {
      return { ok: true, status: headResponse.status, method: "HEAD" };
    }

    const getResponse = await fetch(url, {
      ...requestInit,
      method: "GET",
      headers: {
        Range: "bytes=0-0",
      },
    });

    if (getResponse.ok) {
      return { ok: true, status: getResponse.status, method: "GET" };
    }

    return { ok: false, status: getResponse.status, method: "GET" };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      method: "FETCH",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function validateDemoImageUrls() {
  const urls = collectDemoImageUrls();
  console.log(`[seed:lensaya] Validating ${urls.length} demo image URLs...`);

  const invalid = [];

  for (const url of urls) {
    const result = await probeImageUrl(url);
    if (!result.ok) {
      invalid.push({ url, ...result });
      continue;
    }
  }

  if (invalid.length > 0) {
    console.error(`[seed:lensaya] Found ${invalid.length} invalid/unreachable demo image URL(s):`);
    for (const entry of invalid) {
      console.error(
        `[seed:lensaya] INVALID_IMAGE_URL status=${entry.status} method=${entry.method} url=${entry.url}${entry.error ? ` error="${entry.error}"` : ""}`
      );
    }
    throw new Error(`[seed:lensaya] Aborting seed because ${invalid.length} demo image URL(s) are invalid.`);
  }

  console.log(`[seed:lensaya] All demo image URLs are reachable (${urls.length}/${urls.length}).`);
}

async function upsertAsset(tx, { photographerId, objectKey, purpose, cdnUrl, uploadedById }) {
  return tx.asset.upsert({
    where: {
      bucket_objectKey: {
        bucket: "demo-unsplash",
        objectKey,
      },
    },
    update: {
      photographerId,
      uploadedById,
      type: "IMAGE",
      purpose,
      status: "READY",
      mimeType: "image/jpeg",
      sizeBytes: 512000,
      cdnUrl,
      metadata: {
        source: "unsplash",
        demo: true,
      },
      deletedAt: null,
    },
    create: {
      photographerId,
      uploadedById,
      type: "IMAGE",
      purpose,
      status: "READY",
      bucket: "demo-unsplash",
      objectKey,
      mimeType: "image/jpeg",
      sizeBytes: 512000,
      cdnUrl,
      metadata: {
        source: "unsplash",
        demo: true,
      },
    },
  });
}

async function seed() {
  await validateDemoImageUrls();

  const existingByUsername = await prisma.photographer.findUnique({
    where: { username: DEMO.username },
    select: { id: true, userId: true },
  });

  const passwordHash = await bcrypt.hash(DEMO.password, 10);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email: DEMO.email },
      update: {
        fullName: DEMO.fullName,
        username: DEMO.username,
        passwordHash,
        role: "PHOTOGRAPHER",
        status: "ACTIVE",
      },
      create: {
        email: DEMO.email,
        fullName: DEMO.fullName,
        username: DEMO.username,
        passwordHash,
        role: "PHOTOGRAPHER",
        status: "ACTIVE",
      },
    });

    if (existingByUsername && existingByUsername.userId !== user.id) {
      throw new Error('Username "lensaya" is already used by another account.');
    }

    const avatarAsset = await upsertAsset(tx, {
      photographerId: null,
      objectKey: makeObjectKey("avatar", 1),
      purpose: "AVATAR",
      cdnUrl: avatarImage,
      uploadedById: user.id,
    });

    const bannerAsset = await upsertAsset(tx, {
      photographerId: null,
      objectKey: makeObjectKey("banner", 1),
      purpose: "BANNER",
      cdnUrl: bannerImage,
      uploadedById: user.id,
    });

    const photographer = await tx.photographer.upsert({
      where: { userId: user.id },
      update: {
        username: DEMO.username,
        studioName: DEMO.studioName,
        bio: "Award-winning wedding and brand photography studio in Kuala Lumpur. We craft cinematic visuals that feel luxury, personal, and conversion-ready.",
        status: "ACTIVE",
        websiteUrl: `https://${DEMO.username}.lensaya.com`,
        themeColor: "#06b6d4",
        phone: "+60 12-345 6789",
        whatsappNumber: "60123456789",
        instagramHandle: "lensaya.studio",
        facebookUrl: "https://facebook.com/lensaya.studio",
        tiktokHandle: "@lensaya.studio",
        timezone: "Asia/Kuala_Lumpur",
        currency: "MYR",
        avatarAssetId: avatarAsset.id,
        bannerAssetId: bannerAsset.id,
        heroTitle: "Turn Moments Into Timeless Art",
        heroSubtitle: "From wedding vows to brand launches, Lensaya delivers studio-grade visuals that make clients say yes faster.",
        heroImageUrl: heroImage,
        heroButtonText: "Check Availability",
        heroButtonLink: "#booking",
        showHero: true,
        showTeamSection: true,
        teamMembers,
        isDirectoryVisible: true,
        location: "Kuala Lumpur, Malaysia",
        city: "Kuala Lumpur",
        country: "Malaysia",
        specialty: "Wedding & Commercial",
        style: "Editorial, Cinematic, Luxury",
        hideBranding: true,
      },
      create: {
        userId: user.id,
        username: DEMO.username,
        studioName: DEMO.studioName,
        bio: "Award-winning wedding and brand photography studio in Kuala Lumpur. We craft cinematic visuals that feel luxury, personal, and conversion-ready.",
        status: "ACTIVE",
        websiteUrl: `https://${DEMO.username}.lensaya.com`,
        themeColor: "#06b6d4",
        phone: "+60 12-345 6789",
        whatsappNumber: "60123456789",
        instagramHandle: "lensaya.studio",
        facebookUrl: "https://facebook.com/lensaya.studio",
        tiktokHandle: "@lensaya.studio",
        timezone: "Asia/Kuala_Lumpur",
        currency: "MYR",
        avatarAssetId: avatarAsset.id,
        bannerAssetId: bannerAsset.id,
        heroTitle: "Turn Moments Into Timeless Art",
        heroSubtitle: "From wedding vows to brand launches, Lensaya delivers studio-grade visuals that make clients say yes faster.",
        heroImageUrl: heroImage,
        heroButtonText: "Check Availability",
        heroButtonLink: "#booking",
        showHero: true,
        showTeamSection: true,
        teamMembers,
        isDirectoryVisible: true,
        location: "Kuala Lumpur, Malaysia",
        city: "Kuala Lumpur",
        country: "Malaysia",
        specialty: "Wedding & Commercial",
        style: "Editorial, Cinematic, Luxury",
        hideBranding: true,
      },
    });

    await tx.asset.updateMany({
      where: {
        id: { in: [avatarAsset.id, bannerAsset.id] },
      },
      data: {
        photographerId: photographer.id,
      },
    });

    await tx.portfolioItem.deleteMany({ where: { photographerId: photographer.id } });
    await tx.package.deleteMany({ where: { photographerId: photographer.id } });
    await tx.service.deleteMany({ where: { photographerId: photographer.id } });
    await tx.availability.deleteMany({ where: { photographerId: photographer.id } });

    const servicesByKey = new Map();

    for (let serviceIndex = 0; serviceIndex < serviceSeeds.length; serviceIndex += 1) {
      const serviceSeed = serviceSeeds[serviceIndex];
      const thumbnailAsset = await upsertAsset(tx, {
        photographerId: photographer.id,
        objectKey: makeObjectKey(`service-${serviceSeed.key}`, serviceIndex + 1),
        purpose: "SERVICE_THUMBNAIL",
        cdnUrl: serviceSeed.thumbnail,
        uploadedById: user.id,
      });

      const service = await tx.service.create({
        data: {
          photographerId: photographer.id,
          name: serviceSeed.name,
          description: serviceSeed.description,
          emoji: serviceSeed.emoji,
          status: "ACTIVE",
          displayOrder: serviceIndex,
          thumbnailAssetId: thumbnailAsset.id,
        },
      });

      servicesByKey.set(serviceSeed.key, service);

      for (let packageIndex = 0; packageIndex < serviceSeed.packages.length; packageIndex += 1) {
        const packageSeed = serviceSeed.packages[packageIndex];
        await tx.package.create({
          data: {
            photographerId: photographer.id,
            serviceId: service.id,
            name: packageSeed.name,
            description: `${serviceSeed.name} package designed to close premium clients with clear deliverables and confident positioning.`,
            priceCents: packageSeed.priceCents,
            currency: "MYR",
            durationLabel: packageSeed.durationLabel,
            features: packageSeed.features,
            status: "ACTIVE",
            isPopular: packageSeed.isPopular,
            displayOrder: packageIndex,
          },
        });
      }
    }

    for (let index = 0; index < portfolioImages.length; index += 1) {
      const image = portfolioImages[index];
      const asset = await upsertAsset(tx, {
        photographerId: photographer.id,
        objectKey: makeObjectKey("portfolio", index + 1),
        purpose: "PORTFOLIO",
        cdnUrl: image.src,
        uploadedById: user.id,
      });

      const service = servicesByKey.get(image.serviceKey);
      if (!service) continue;

      await tx.portfolioItem.create({
        data: {
          photographerId: photographer.id,
          serviceId: service.id,
          assetId: asset.id,
          title: `${service.name} ${index + 1}`,
          description: "Studio-quality sample from the Lensaya live demo showcase.",
          category: image.category,
          isFeatured: Boolean(image.featured),
          displayOrder: index,
        },
      });
    }

    const availabilityDates = [
      { date: "2026-04-05", status: "BOOKED" },
      { date: "2026-04-08", status: "AVAILABLE" },
      { date: "2026-04-10", status: "BOOKED" },
      { date: "2026-04-12", status: "AVAILABLE" },
      { date: "2026-04-15", status: "AVAILABLE" },
      { date: "2026-04-19", status: "BOOKED" },
      { date: "2026-04-23", status: "AVAILABLE" },
      { date: "2026-04-26", status: "BOOKED" },
      { date: "2026-05-03", status: "AVAILABLE" },
      { date: "2026-05-07", status: "BOOKED" },
    ];

    await tx.availability.createMany({
      data: availabilityDates.map((item) => ({
        photographerId: photographer.id,
        date: new Date(`${item.date}T00:00:00.000Z`),
        status: item.status,
      })),
      skipDuplicates: true,
    });

    const now = new Date();
    const nextYear = new Date(now);
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    await tx.subscription.updateMany({
      where: {
        userId: user.id,
        status: { in: ACTIVE_SUBSCRIPTION_STATUSES },
      },
      data: {
        status: "CANCELED",
        canceledAt: now,
        cancelAtPeriodEnd: false,
      },
    });

    const latest = await tx.subscription.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (latest) {
      await tx.subscription.update({
        where: { id: latest.id },
        data: {
          userId: user.id,
          photographerId: photographer.id,
          plan: "STUDIO",
          status: "ACTIVE",
          provider: "MANUAL",
          billingInterval: "YEARLY",
          currentPeriodStart: now,
          currentPeriodEnd: nextYear,
          pendingPlan: null,
          pendingBillingInterval: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          trialEndsAt: null,
        },
      });
    } else {
      await tx.subscription.create({
        data: {
          userId: user.id,
          photographerId: photographer.id,
          plan: "STUDIO",
          status: "ACTIVE",
          provider: "MANUAL",
          billingInterval: "YEARLY",
          currentPeriodStart: now,
          currentPeriodEnd: nextYear,
        },
      });
    }

    return {
      user,
      photographer,
      servicesCount: serviceSeeds.length,
      portfolioCount: portfolioImages.length,
    };
  });

  console.log("Lensaya live demo seeded successfully.");
  console.log(`Public URL: /p/${result.photographer.username}`);
  console.log(`Demo login email: ${DEMO.email}`);
  console.log(`Demo login password: ${DEMO.password}`);
  console.log(`Services: ${result.servicesCount}, Portfolio items: ${result.portfolioCount}`);
}

seed()
  .catch((error) => {
    console.error("Failed to seed Lensaya live demo:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });






