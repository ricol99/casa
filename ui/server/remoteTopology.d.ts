export interface TopologyTarget {
    name: string;
    host: string;
    port: number;
    messageTransportName?: string;
}
export interface RemoteTopologyEntry {
    casaName: string;
    ok: boolean;
    localBowed: number;
    peerBowed: number;
    totalBowed: number;
    error?: string;
}
export declare function fetchRemoteTopologies(targets: TopologyTarget[], timeoutMs: number): Promise<RemoteTopologyEntry[]>;
