import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dnssd = require("dnssd");

export interface DiscoveredCasa {
  name: string;
  host: string;
  port: number;
  tier: number;
  messageTransportName: string;
  status: "up" | "down";
  previousStatus: "up" | "down";
  gang: string;
  lastSeenAt: number;
}

export interface DiscoveryResult {
  gangName: string;
  count: number;
  casas: DiscoveredCasa[];
  seenCount: number;
  errorCount: number;
  errors: string[];
}

type DiscoveryCache = {
  browser: any | null;
  started: boolean;
  timeoutMs: number;
  byName: Map<string, DiscoveredCasa>;
  errors: string[];
};

const cacheByGang = new Map<string, DiscoveryCache>();

function getOrCreateCache(gangName: string): DiscoveryCache {
  const key = gangName.trim();
  const existing = cacheByGang.get(key);

  if (existing) {
    return existing;
  }

  const created: DiscoveryCache = {
    browser: null,
    started: false,
    timeoutMs: 0,
    byName: new Map(),
    errors: []
  };
  cacheByGang.set(key, created);
  return created;
}

function normaliseHost(rawHost: string): string {
  const parts = String(rawHost || "").split(" ");
  const primary = parts.length > 1 ? `${parts[0]}.local` : parts[0];
  return primary || String(rawHost || "");
}

function readGangFromTxt(service: any): string {
  if (!service || !service.txt) {
    return "";
  }

  const rawGang = service.txt.gang;

  if (typeof rawGang === "string") {
    return rawGang.trim();
  }

  if (Buffer.isBuffer(rawGang)) {
    return rawGang.toString("utf8").trim();
  }

  return String(rawGang || "").trim();
}

function gangMatches(service: any, gangName: string): boolean {
  const discoveredGang = readGangFromTxt(service);

  if (!discoveredGang || !gangName) {
    return false;
  }

  return discoveredGang.toLowerCase() === gangName.trim().toLowerCase();
}

function ensureStarted(gangName: string, timeoutMs: number): DiscoveryCache {
  const cache = getOrCreateCache(gangName);

  if (cache.started) {
    return cache;
  }

  const browser = new dnssd.Browser(dnssd.tcp("casa"));

  browser.on("serviceUp", (service: any) => {
    if (!service || !service.txt || !service.name || !service.host || !service.port) {
      cache.errors.push(`Malformed serviceUp advert: ${JSON.stringify(service || {})}`);
      return;
    }

    if (!gangMatches(service, gangName)) {
      return;
    }

    const now = Date.now();
    const current = cache.byName.get(service.name);

    cache.byName.set(service.name, {
      name: service.name,
      host: normaliseHost(service.host),
      port: service.port,
      tier: 1,
      messageTransportName: "http",
      status: "up",
      previousStatus: current ? current.status : "down",
      gang: readGangFromTxt(service),
      lastSeenAt: now
    });
  });

  browser.on("serviceDown", (service: any) => {
    if (!service || !service.name) {
      cache.errors.push(`Malformed serviceDown advert: ${JSON.stringify(service || {})}`);
      return;
    }

    const current = cache.byName.get(service.name);

    if (!current) {
      return;
    }

    cache.byName.set(service.name, {
      ...current,
      status: "down",
      previousStatus: current.status,
      lastSeenAt: Date.now()
    });
  });

  browser.on("error", (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    cache.errors.push(`mDNS browser error: ${message}`);
  });

  cache.browser = browser;
  cache.started = true;
  cache.timeoutMs = timeoutMs;
  browser.start();
  return cache;
}

function listCasas(cache: DiscoveryCache): DiscoveredCasa[] {
  return Array.from(cache.byName.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => ({ ...item }));
}

export async function discoverCasasByGangName(gangName: string, timeoutMs = 1200): Promise<DiscoveryResult> {
  const gang = String(gangName || "").trim();

  if (!gang) {
    throw new Error("gangName is required");
  }

  const cache = ensureStarted(gang, timeoutMs);

  await new Promise((resolve) => setTimeout(resolve, Math.max(0, timeoutMs)));

  const allCasas = listCasas(cache);
  const casas = allCasas.filter((item) => item.status === "up");
  const errors = cache.errors.slice(Math.max(0, cache.errors.length - 20));

  return {
    gangName: gang,
    count: casas.length,
    casas,
    seenCount: allCasas.length,
    errorCount: errors.length,
    errors
  };
}

export function stopAllDiscovery(): void {
  cacheByGang.forEach((entry) => {
    if (entry.browser) {
      try {
        entry.browser.stop();
      } catch {
        // ignore stop errors
      }
    }
  });
  cacheByGang.clear();
}
