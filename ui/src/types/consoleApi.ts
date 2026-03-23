export type ScopeMode = "gang" | "casa";

export type InstanceState = "active" | "bowed" | "unavailable" | "error";

export interface ExportTreeNode {
  name?: string;
  uName?: string;
  type?: string;
  superType?: string | null;
  priority?: number;
  ownerCasa?: string;
  providerType?: string;
  myNamedObjects?: Record<string, ExportTreeNode>;
}

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

export interface SourceTreesResult {
  casaName: string;
  activeTree: ExportTreeNode | null;
  localBowedTree: ExportTreeNode | null;
  peerTrees: Array<{
    casaName: string;
    connected: boolean;
    tree: ExportTreeNode | null;
  }>;
}

export interface ThingDesignMember {
  uName: string;
  name: string;
  type: string | null;
  local: boolean;
  valid: boolean | null;
  cold: boolean | null;
  value: unknown;
  inherited: {
    parent: boolean;
    child: boolean;
  };
  propagation: {
    raw: {
      ignoreParent: boolean | null;
      ignoreChildren: boolean | null;
      propagateToParent: boolean | null;
      propagateToChildren: boolean | null;
    };
    effective: {
      ignoreParent: boolean;
      ignoreChildren: boolean;
      propagateToParent: boolean;
      propagateToChildren: boolean;
    };
  };
  sourceListenerCount: number;
}

export interface ThingDesignRelation {
  object: {
    uName: string;
    name: string;
    type: string | null;
    superType: string | null;
    ownerUName: string | null;
    ownerCasa: string | null;
  };
  propagation: {
    receivesFromParent: boolean;
    sendsToParent: boolean;
  };
}

export interface ThingDesignExternalMember {
  name: string;
  type: string | null;
  uName: string | null;
  viaThingUName: string | null;
  viaThingName: string | null;
}

export interface ThingDesignResult {
  thing: {
    object: {
      uName: string;
      name: string;
      type: string | null;
      superType: string | null;
      ownerUName: string | null;
      ownerCasa: string | null;
    };
    topLevelThing: boolean;
    local: boolean;
    fromPeer: boolean;
    bowing: boolean;
    priority: number | null;
  };
  parent: ThingDesignRelation | null;
  propagation: {
    objectLevel: {
      ignoreParent: boolean;
      ignoreChildren: boolean;
      propagateToParent: boolean;
      propagateToChildren: boolean;
    };
    effective: {
      hasParentThing: boolean;
      receivesFromParent: boolean;
      sendsToParent: boolean;
      receivesFromChildren: boolean;
      sendsToChildren: boolean;
      topLevelThing: boolean;
    };
  };
  children: ThingDesignRelation[];
  properties: ThingDesignMember[];
  events: ThingDesignMember[];
  inheritance: {
    properties: {
      local: ThingDesignMember[];
      parent: ThingDesignMember[];
      child: ThingDesignMember[];
    };
    events: {
      local: ThingDesignMember[];
      parent: ThingDesignMember[];
      child: ThingDesignMember[];
    };
    blocked: {
      fromParent: {
        properties: ThingDesignExternalMember[];
        events: ThingDesignExternalMember[];
      };
      fromChildren: {
        properties: ThingDesignExternalMember[];
        events: ThingDesignExternalMember[];
      };
    };
  };
}

export interface TopologyResult {
  gangName: string;
  localCasaName: string;
  localSourceCounts: {
    total: number;
    bowed: number;
    active: number;
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
