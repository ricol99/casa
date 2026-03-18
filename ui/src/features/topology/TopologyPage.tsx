import { useQuery } from "@tanstack/react-query";
import { consoleApiClient } from "../../lib/consoleApiClient";
import { useUiSessionStore } from "../../store/uiSessionStore";
import { fetchRemoteTopologies } from "../../lib/discoveryClient";

export function TopologyPage() {
  const scopeMode = useUiSessionStore((s) => s.scopeMode);
  const selectedCasa = useUiSessionStore((s) => s.selectedCasa);
  const discoveredCasas = useUiSessionStore((s) => s.discoveredCasas);

  const query = useQuery({
    queryKey: ["topology", scopeMode, selectedCasa],
    queryFn: () =>
      consoleApiClient.getTopology({
        scopeMode,
        selectedCasa
      })
  });

  const remoteTopologyQuery = useQuery({
    queryKey: ["remote-topologies", discoveredCasas],
    enabled: discoveredCasas.length > 0,
    queryFn: () => fetchRemoteTopologies(discoveredCasas, 2500),
    refetchInterval: 5000
  });

  if (query.isLoading) {
    return <section className="card">Loading topology...</section>;
  }

  if (query.isError || !query.data) {
    return (
      <section className="card">
        <p className="error">Unable to load topology.</p>
        <p className="meta">{query.error instanceof Error ? query.error.message : "Unknown error"}</p>
      </section>
    );
  }

  const data = query.data as any;
  const localCasaName = typeof data?.localCasaName === "string" ? data.localCasaName : "-";
  const gangName = typeof data?.gangName === "string" ? data.gangName : "-";
  const peerCount = typeof data?.peerCount === "number" ? data.peerCount : 0;
  const connectedPeerCount = typeof data?.connectedPeerCount === "number" ? data.connectedPeerCount : 0;
  const localSourceCounts = data?.localSourceCounts ?? { total: 0, active: 0, bowed: 0 };
  const peers = Array.isArray(data?.peers) ? data.peers : [];
  const localBowed = typeof data?.localBowed === "number" ? data.localBowed : (localSourceCounts.bowed ?? 0);
  const peerBowed = typeof data?.peerBowed === "number"
    ? data.peerBowed
    : peers.reduce((count: number, peer: any) => count + (peer?.sourceCounts?.bowed ?? 0), 0);
  const totalBowed = typeof data?.totalBowed === "number" ? data.totalBowed : (localBowed + peerBowed);
  const remoteByCasa = new Map<string, {
    sourceTotal: number;
    sourceActive: number;
    localBowed: number;
    peerBowed: number;
    totalBowed: number;
    connectedPeerCount: number;
    peerCount: number;
  }>();

  if (remoteTopologyQuery.data?.results) {
    remoteTopologyQuery.data.results.forEach((entry) => {
      if (entry && entry.ok) {
        remoteByCasa.set(entry.casaName, {
          sourceTotal: entry.sourceTotal,
          sourceActive: entry.sourceActive,
          localBowed: entry.localBowed,
          peerBowed: entry.peerBowed,
          totalBowed: entry.totalBowed,
          connectedPeerCount: entry.connectedPeerCount,
          peerCount: entry.peerCount
        });
      }
    });
  }

  const localSnapshot = remoteByCasa.get(localCasaName);
  const localRowLocalBowed = localSnapshot ? localSnapshot.localBowed : localBowed;
  const localRowRemoteBowed = localSnapshot ? localSnapshot.peerBowed : peerBowed;
  const localRowTotalBowed = localSnapshot ? localSnapshot.totalBowed : totalBowed;
  const rowNames = Array.from(
    new Set<string>([
      localCasaName,
      ...discoveredCasas.map((c) => c.name),
      ...Array.from(remoteByCasa.keys()),
      ...peers.map((peer: any) => peer.casaName)
    ].filter((name) => typeof name === "string" && name.length > 0))
  ).sort((a, b) => a.localeCompare(b));

  return (
    <section className="card">
      <div className="card-header">
        <h2>Gang topology</h2>
        <div className="chip-row">
          <span className="chip">gang: {gangName}</span>
          <span className="chip">local: {localCasaName}</span>
          <span className="chip">connected peers: {connectedPeerCount}/{peerCount}</span>
          <span className="chip">local bowed: {localBowed}</span>
          <span className="chip">peer bowed: {peerBowed}</span>
          <span className="chip">total bowed: {totalBowed}</span>
          {remoteTopologyQuery.isSuccess && <span className="chip">remote snapshots: {remoteTopologyQuery.data.count}</span>}
          {remoteTopologyQuery.isError && <span className="chip">remote snapshots unavailable</span>}
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>casa</th>
            <th>connected</th>
            <th>sources</th>
            <th>active</th>
            <th>local bowed</th>
            <th>remote bowed</th>
            <th>bowed</th>
            <th>disconnected</th>
          </tr>
        </thead>
        <tbody>
          {rowNames.map((rowCasaName) => {
            const snapshot = remoteByCasa.get(rowCasaName);
            const peer = peers.find((entry: any) => entry.casaName === rowCasaName);
            const isLocalRow = rowCasaName === localCasaName;
            const sourceTotal = isLocalRow
              ? (snapshot?.sourceTotal ?? localSourceCounts.total ?? 0)
              : (snapshot?.sourceTotal ?? peer?.sourceCounts?.total ?? "-");
            const sourceActive = isLocalRow
              ? (snapshot?.sourceActive ?? localSourceCounts.active ?? 0)
              : (snapshot?.sourceActive ?? peer?.sourceCounts?.active ?? "-");
            const localRowBowed = isLocalRow
              ? localRowLocalBowed
              : (snapshot?.localBowed ?? peer?.sourceCounts?.bowed ?? 0);
            const remoteRowBowed = isLocalRow
              ? localRowRemoteBowed
              : (snapshot?.peerBowed ?? 0);
            const totalRowBowed = isLocalRow
              ? localRowTotalBowed
              : (snapshot?.totalBowed ?? peer?.sourceCounts?.bowed ?? "-");
            const disconnected = (typeof sourceTotal === "number") && (typeof sourceActive === "number") && (typeof totalRowBowed === "number")
              ? Math.max(0, sourceTotal - sourceActive - totalRowBowed)
              : "-";
            const connected = isLocalRow
              ? "yes"
              : (snapshot
                  ? (snapshot.connectedPeerCount > 0 ? "yes" : "no")
                  : (peer?.connected ? "yes" : "no"));

            return (
              <tr key={rowCasaName}>
                <td>{rowCasaName}</td>
                <td>{connected}</td>
                <td>{sourceTotal}</td>
                <td>{sourceActive}</td>
                <td>{localRowBowed}</td>
                <td>{remoteRowBowed}</td>
                <td>{totalRowBowed}</td>
                <td>{disconnected}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
