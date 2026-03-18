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
export declare function fetchRemoteTopologies(targets: TopologyTarget[], timeoutMs: number): Promise<RemoteTopologyEntry[]>;
