import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import Fastify from "fastify";

import { analyticsEventSchema } from "@bubble-kingdom/analytics";
import { defaultRemoteConfig, mergeRemoteConfig } from "@bubble-kingdom/config";
import {
  buildCommerceBindings,
  contentVersion,
  getShopOfferById,
  liveContent,
  resolvePlatformProductId,
  shopCatalog,
} from "@bubble-kingdom/game-data";
import { createLogger, safeJsonParse } from "@bubble-kingdom/shared";

const prisma = new PrismaClient();
const logger = createLogger({
  sessionId: "backend",
  anonymousId: "backend",
  appVersion: "0.1.0-alpha",
  buildTarget: "local",
  platformTarget: "web-mock",
});

const server = Fastify({
  logger: false,
});

await server.register(cors, {
  origin: true,
});

server.get("/health", async () => ({
  ok: true,
  service: "bubble-kingdom-backend",
  version: "0.1.0-alpha",
}));

server.get("/ready", async () => {
  const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  return {
    ok: dbOk,
    database: dbOk ? "ready" : "degraded",
  };
});

server.get("/config", async () => {
  return loadRuntimeConfig();
});

server.post("/experiments/assign", async (request) => {
  const body = request.body as {
    anonymousId: string;
    assignments: Record<string, string>;
  };

  await Promise.all(
    Object.entries(body.assignments).map(([experiment, variant]) =>
      prisma.experimentAssignment.upsert({
        where: {
          anonymousId_experiment: {
            anonymousId: body.anonymousId,
            experiment,
          },
        },
        create: {
          anonymousId: body.anonymousId,
          experiment,
          variant,
        },
        update: {
          variant,
        },
      }),
    ),
  ).catch((error) => {
    logger.warn("NETWORK", "Experiment assignment write failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return {
    ok: true,
  };
});

server.post("/events", async (request) => {
  const event = analyticsEventSchema.parse(request.body);

  await prisma.analyticsEventLog
    .create({
      data: {
        name: event.name,
        payloadJson: JSON.stringify(event.payload),
        sessionId: event.session.sessionId,
        anonymousId: event.session.anonymousId,
        userId: event.session.userId ?? null,
      },
    })
    .catch((error) => {
      logger.warn("NETWORK", "Analytics event write failed", {
        error: error instanceof Error ? error.message : String(error),
        name: event.name,
      });
    });

  return {
    ok: true,
  };
});

server.get("/liveops", async () => {
  const schedules = await prisma.liveopsSchedule.findMany().catch(() => []);
  return {
    eventId: defaultRemoteConfig.liveops.currentEventId,
    schedules: schedules.map((item) => ({
      eventId: item.eventId,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      payload: safeJsonParse<unknown>(item.payloadJson),
    })),
  };
});

server.get("/shop", async () => {
  const overrides = await prisma.shopOfferOverride.findMany().catch(() => []);
  const overrideMap = new Map(
    overrides.map((item) => [
      item.offerId,
      safeJsonParse<Record<string, unknown>>(item.valueJson) ?? {},
    ]),
  );

  return shopCatalog.map((offer) => ({
    ...offer,
    ...(overrideMap.get(offer.id) ?? {}),
  }));
});

server.get("/commerce", async () => {
  const config = await loadRuntimeConfig();

  return {
    leaderboards: config.leaderboards,
    receiptValidationMode: config.commerce.receiptValidationMode,
    offers: buildCommerceBindings(config),
  };
});

server.post("/receipts/validate", async (request) => {
  const body = request.body as {
    offerId: string;
    productId: string;
    purchaseToken?: string;
    signature?: string;
    developerPayload?: string;
    anonymousId: string;
    userId?: string;
    platformTarget: "web-mock" | "yandex" | "vk";
  };
  const config = await loadRuntimeConfig();
  const offer = getShopOfferById(body.offerId);

  if (!offer) {
    return {
      ok: false,
      status: "rejected",
      shouldGrant: false,
      consumePurchase: false,
      source: "backend",
      reason: "unknown_offer",
    };
  }

  if (config.commerce.receiptValidationMode === "platform_only") {
    return {
      ok: true,
      status: "skipped",
      shouldGrant: true,
      consumePurchase: true,
      source: "platform",
    };
  }

  const expectedProductId = resolvePlatformProductId(offer, body.platformTarget, config);
  if (body.productId !== expectedProductId) {
    logger.warn("IAP", "Receipt validation rejected", {
      offerId: body.offerId,
      productId: body.productId,
      expectedProductId,
      platformTarget: body.platformTarget,
    });

    return {
      ok: false,
      status: "rejected",
      shouldGrant: false,
      consumePurchase: false,
      source: "backend",
      reason: "product_id_mismatch",
    };
  }

  if (config.commerce.receiptValidationMode === "server" && body.platformTarget === "yandex") {
    if (!body.purchaseToken || !body.signature) {
      logger.warn("IAP", "Signed Yandex receipt rejected", {
        offerId: body.offerId,
        productId: body.productId,
        hasPurchaseToken: Boolean(body.purchaseToken),
        hasSignature: Boolean(body.signature),
      });

      return {
        ok: false,
        status: "rejected",
        shouldGrant: false,
        consumePurchase: false,
        source: "backend",
        reason: "missing_signed_receipt",
      };
    }
  }

  return {
    ok: true,
    status:
      config.commerce.receiptValidationMode === "server" ? "validated" : "accepted_stub",
    shouldGrant: true,
    consumePurchase: true,
    source: config.commerce.receiptValidationMode === "server" ? "backend" : "stub",
  };
});

server.get("/content", async () => ({
  version: contentVersion,
  counts: {
    levels: liveContent.levels.length,
    chapters: liveContent.chapters.length,
    quests: liveContent.quests.length,
    shopOffers: liveContent.shopCatalog.length,
  },
}));

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

async function loadRuntimeConfig() {
  const overrides = await prisma.remoteConfigOverride.findMany().catch(() => []);
  const patch: Record<string, unknown> = {};
  for (const item of overrides) {
    setNestedValue(patch, item.key, JSON.parse(item.valueJson));
  }
  return mergeRemoteConfig(
    defaultRemoteConfig,
    patch as Partial<typeof defaultRemoteConfig>,
  );
}

function setNestedValue(target: Record<string, unknown>, dottedKey: string, value: unknown) {
  const segments = dottedKey.split(".").filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  let cursor: Record<string, unknown> = target;
  for (const segment of segments.slice(0, -1)) {
    const next = cursor[segment];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }

  cursor[segments.at(-1)!] = value;
}

async function start() {
  try {
    await prisma.$connect();
  } catch (error) {
    logger.warn("NETWORK", "Database connection failed, backend will run in degraded mode", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await server.listen({ port, host });
  logger.info("BOOT", "Backend started", { port, host });
}

start().catch((error) => {
  logger.fatal("ERROR", "Backend startup failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
