import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import Fastify from "fastify";

import { analyticsEventSchema } from "@bubble-kingdom/analytics";
import { defaultRemoteConfig } from "@bubble-kingdom/config";
import { contentVersion, liveContent, shopCatalog } from "@bubble-kingdom/game-data";
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
  const overrides = await prisma.remoteConfigOverride.findMany().catch(() => []);
  const patch = Object.fromEntries(
    overrides.map((item) => [item.key, JSON.parse(item.valueJson)]),
  );
  return {
    ...defaultRemoteConfig,
    ...patch,
  };
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
