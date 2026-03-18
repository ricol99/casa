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

export interface RemoteTopologyTarget {
  name: string;
  host: string;
  port: number;
  messageTransportName: string;
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

export interface RemoteTopologyResult {
  count: number;
  results: RemoteTopologyEntry[];
}

export async function discoverCasas(gangName: string, timeoutMs = 1200): Promise<DiscoveryResult> {
  const response = await fetch("/api/discovery/casas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      gangName,
      timeoutMs
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload && payload.error ? payload.error : "Discovery failed");
  }

  return payload as DiscoveryResult;
}

export async function fetchRemoteTopologies(
  targets: RemoteTopologyTarget[],
  timeoutMs = 2000
): Promise<RemoteTopologyResult> {
  const response = await fetch("/api/topology/remote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      targets,
      timeoutMs
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload && payload.error ? payload.error : "Remote topology fetch failed");
  }

  return payload as RemoteTopologyResult;
}
