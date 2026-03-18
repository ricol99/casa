import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const io = require("socket.io-client");

export interface TopologyTarget {
  name: string;
  host: string;
  port: number;
  messageTransportName?: string;
}

export interface RemoteTopologyEntry {
  casaName: string;
  ok: boolean;
  sourceTotal: number;
  sourceActive: number;
  localBowed: number;
  peerBowed: number;
  totalBowed: number;
  connectedPeerCount: number;
  peerCount: number;
  error?: string;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normaliseTransport(target: TopologyTarget): "http" | "https" {
  return target.messageTransportName === "https" ? "https" : "http";
}

function queryCasaTopology(target: TopologyTarget, timeoutMs: number): Promise<RemoteTopologyEntry> {
  return new Promise((resolve) => {
    const transport = normaliseTransport(target);
    const url = `${transport}://${target.host}:${target.port}`;
    const socket = io(`${url}/consoleapi/io`, {
      transports: ["websocket"],
      reconnection: false,
      forceNew: true
    });

    let done = false;

    const finish = (result: RemoteTopologyEntry) => {
      if (done) {
        return;
      }

      done = true;

      try {
        socket.disconnect();
      } catch {
        // ignore disconnect errors
      }

      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        casaName: target.name,
        ok: false,
        sourceTotal: 0,
        sourceActive: 0,
        localBowed: 0,
        peerBowed: 0,
        totalBowed: 0,
        connectedPeerCount: 0,
        peerCount: 0,
        error: "Topology request timed out"
      });
    }, Math.max(500, timeoutMs));

    socket.on("connect_error", (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      finish({
        casaName: target.name,
        ok: false,
        sourceTotal: 0,
        sourceActive: 0,
        localBowed: 0,
        peerBowed: 0,
        totalBowed: 0,
        connectedPeerCount: 0,
        peerCount: 0,
        error: `connect_error: ${message}`
      });
    });

    socket.on("error", (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      finish({
        casaName: target.name,
        ok: false,
        sourceTotal: 0,
        sourceActive: 0,
        localBowed: 0,
        peerBowed: 0,
        totalBowed: 0,
        connectedPeerCount: 0,
        peerCount: 0,
        error: `socket_error: ${message}`
      });
    });

    socket.on("connect", () => {
      socket.once("execute-output", (payload: any) => {
        const result = payload ? payload.result : null;

        if (!result || typeof result === "string") {
          finish({
            casaName: target.name,
            ok: false,
            sourceTotal: 0,
            sourceActive: 0,
            localBowed: 0,
            peerBowed: 0,
            totalBowed: 0,
            connectedPeerCount: 0,
            peerCount: 0,
            error: typeof result === "string" ? result : "Malformed topology result"
          });
          return;
        }

        const sourceTotal = asNumber(result?.localSourceCounts?.total, 0);
        const sourceActive = asNumber(result?.localSourceCounts?.active, 0);
        const localBowed = asNumber(result.localBowed, asNumber(result?.localSourceCounts?.bowed, 0));
        const peerBowed = asNumber(result.peerBowed, 0);
        const totalBowed = asNumber(result.totalBowed, localBowed + peerBowed);
        const connectedPeerCount = asNumber(result.connectedPeerCount, 0);
        const peerCount = asNumber(result.peerCount, 0);

        finish({
          casaName: target.name,
          ok: true,
          sourceTotal,
          sourceActive,
          localBowed,
          peerBowed,
          totalBowed,
          connectedPeerCount,
          peerCount
        });
      });

      socket.emit("executeCommand", {
        obj: ":",
        method: "topology",
        arguments: []
      });
    });
  });
}

export async function fetchRemoteTopologies(targets: TopologyTarget[], timeoutMs: number): Promise<RemoteTopologyEntry[]> {
  const safeTargets = (targets || []).filter((target) => {
    return !!(target && target.name && target.host && Number.isFinite(target.port));
  });

  const results = await Promise.all(
    safeTargets.map((target) => queryCasaTopology(target, timeoutMs))
  );

  results.sort((a, b) => a.casaName.localeCompare(b.casaName));
  return results;
}
