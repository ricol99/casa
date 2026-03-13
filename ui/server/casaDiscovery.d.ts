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
export declare function discoverCasasByGangName(gangName: string, timeoutMs?: number): Promise<DiscoveryResult>;
export declare function stopAllDiscovery(): void;
