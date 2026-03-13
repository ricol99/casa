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
  const remoteByCasa = new Map<string, { localBowed: number; peerBowed: number; totalBowed: number }>();

  if (remoteTopologyQuery.data?.results) {
    remoteTopologyQuery.data.results.forEach((entry) => {
      if (entry && entry.ok) {
        remoteByCasa.set(entry.casaName, {
          localBowed: entry.localBowed,
          peerBowed: entry.peerBowed,
          totalBowed: entry.totalBowed
        });
      }
    });
  }

  const localSnapshot = remoteByCasa.get(localCasaName);
  const localRowLocalBowed = localSnapshot ? localSnapshot.localBowed : localBowed;
  const localRowRemoteBowed = localSnapshot ? localSnapshot.peerBowed : peerBowed;
  const localRowTotalBowed = localSnapshot ? localSnapshot.totalBowed : totalBowed;

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
          <tr>
            <td>{localCasaName}</td>
            <td>yes</td>
            <td>{localSourceCounts.total ?? 0}</td>
            <td>{localSourceCounts.active ?? 0}</td>
            <td>{localRowLocalBowed}</td>
            <td>{localRowRemoteBowed}</td>
            <td>{localRowTotalBowed}</td>
            <td>{Math.max(0, (localSourceCounts.total ?? 0) - (localSourceCounts.active ?? 0) - (localSourceCounts.bowed ?? 0))}</td>
          </tr>
          {peers.map((peer: any) => (
            <tr key={peer.casaName}>
              <td>{peer.casaName}</td>
              <td>{peer.connected ? "yes" : "no"}</td>
              <td>{peer.sourceCounts?.total ?? "-"}</td>
              <td>{peer.sourceCounts?.active ?? "-"}</td>
              <td>{remoteByCasa.get(peer.casaName)?.localBowed ?? (peer.sourceCounts?.bowed ?? 0)}</td>
              <td>{remoteByCasa.get(peer.casaName)?.peerBowed ?? 0}</td>
              <td>{remoteByCasa.get(peer.casaName)?.totalBowed ?? (peer.sourceCounts?.bowed ?? "-")}</td>
              <td>
                {peer.sourceCounts
                  ? Math.max(0, peer.sourceCounts.total - peer.sourceCounts.active - peer.sourceCounts.bowed)
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
