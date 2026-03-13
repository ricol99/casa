export type ScopeMode = "gang" | "casa";

export type InstanceState = "active" | "bowed" | "unavailable" | "error";

export interface SourceInstance {
  ownerCasa: string | null;
  providerType: string | null;
  type: string | null;
  superType: string | null;
  priority: number | null;
  state: InstanceState | string;
  inSourcesMap?: boolean;
  inBowingMap?: boolean;
  error?: string | null;
  connected: boolean;
  scope: string | null;
  consumerCount?: number;
  subscriptionCount?: number;
  consumers?: Array<{ sourceUName: string; count: number }>;
}

export interface ResolveResult {
  sourceUName: string;
  exists: boolean;
  activeOwnerCasa: string | null;
  activeProviderType: string | null;
  errors?: string[];
  instances: SourceInstance[];
}

export interface ExplainContender extends SourceInstance {
  reasons: string[];
}

export interface ExplainResult {
  sourceUName: string;
  exists: boolean;
  reason?: string;
  errors?: string[];
  activeOwnerCasa?: string | null;
  activeProviderType?: string | null;
  activePriority?: number | null;
  rule?: string;
  fallback?: {
    ownerCasa: string;
    providerType: string;
    priority: number;
    type: string;
  } | null;
  contenders?: ExplainContender[];
}

export interface UsageResult {
  sourceUName: string;
  exists: boolean;
  reason?: string;
  errors?: string[];
  activeOwnerCasa: string | null;
  activeProviderType: string | null;
  instanceCount: number;
  consumerCount: number;
  subscriptionCount: number;
  filters: {
    activeOnly: boolean;
    hasConsumers: boolean;
  };
  instances: SourceInstance[];
}

export interface SourceInventoryEntry {
  sourceUName: string;
  name: string;
  type: string;
  superType: string | null;
  priority: number;
  db: string | null;
  scope: string;
  shared: boolean;
  category: "exports" | "local";
  reason: string;
}

export interface SourceInventoryResult {
  casaName: string;
  mode: "exports" | "local" | "both";
  prefix: string | null;
  count: number;
  summary: {
    totalSources: number;
    matchedSources: number;
    matchedExports: number;
    matchedLocal: number;
  };
  sources: SourceInventoryEntry[];
}

export interface TopologyResult {
  gangName: string;
  localCasaName: string;
  localSourceCounts: {
    total: number;
    bowed: number;
    active: number;
    sourcesMapEntries: number;
    bowingMapEntries: number;
  };
  localBowed: number;
  peerBowed: number;
  totalBowed: number;
  peerCount: number;
  connectedPeerCount: number;
  peers: Array<{
    casaName: string;
    connected: boolean;
    host: string | null;
    port: number | null;
    discoveryTier: number | null;
    sourceCounts?: {
      total: number;
      bowed: number;
      active: number;
      sourcesMapEntries: number;
      bowingMapEntries: number;
    };
  }>;
}

export interface PreviewDelta {
  changed: boolean;
  activeOwnerChanged: boolean;
  beforeActiveOwnerCasa?: string | null;
  afterActiveOwnerCasa?: string | null;
  beforeActiveProviderType?: string | null;
  afterActiveProviderType?: string | null;
  instanceStateChanges: Array<{
    ownerCasa: string;
    providerType: string;
    priority: number;
    from: string;
    to: string;
  }>;
  addedInstances: SourceInstance[];
  removedInstances: SourceInstance[];
  usageChanged: boolean;
}

export interface PreviewItem {
  sourceUName: string;
  before: {
    resolve: ResolveResult;
    usage: UsageResult | null;
  };
  after: {
    resolve: ResolveResult;
    usage: UsageResult | null;
  };
  delta: PreviewDelta;
}

export interface PreviewResult {
  ok: boolean;
  scope: {
    mode: "gang" | "casa";
    targetCasa: string;
  };
  summary: {
    impactedSourceCount: number;
    changedSourceCount: number;
    changedActiveOwnerCount: number;
    changedStateCount: number;
    addedSourceCount: number;
    removedSourceCount: number;
    addedInstanceCount: number;
    removedInstanceCount: number;
    truncated: boolean;
  };
  output?: {
    mode: "full" | "summary" | "top-changed";
    impactedReturnedCount: number;
    impactedTotalCount: number;
    changedReturnedCount: number;
    changedTotalCount: number;
  };
  impactedSources: PreviewItem[];
  warnings: string[];
  errors: string[];
}

export interface PreviewConfigProgressMessage {
  type: "previewConfigProgress";
  scope: "gang" | "casa";
  targetCasa: string;
  progress: {
    event: "preview-started" | "preview-progress" | "preview-complete";
    total: number;
    processed: number;
    percent: number;
    changedSourceCount?: number;
  };
}
