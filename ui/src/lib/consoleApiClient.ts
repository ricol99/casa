import { consoleSocket } from "./socket";
import type {
  ExplainResult,
  PreviewResult,
  ResolveResult,
  ScopeMode,
  SourceInventoryResult,
  TopologyResult,
  UsageResult
} from "../types/consoleApi";

export interface ScopeSelection {
  scopeMode: ScopeMode;
  selectedCasa: string;
}

export interface SourceUsageOptions {
  activeOnly?: boolean;
  hasConsumers?: boolean;
}

export interface SourceInventoryOptions {
  mode?: "exports" | "local" | "both";
  prefix?: string;
}

export interface PreviewConfigOptions {
  patch: Record<string, unknown>;
  includeUsage?: boolean;
  limit?: number;
  progress?: boolean;
  summaryOnly?: boolean;
  topChanged?: number;
  targetCasaName?: string;
}

function normaliseSourceUName(sourceUName: string): string {
  const trimmed = sourceUName.trim();

  if (!trimmed.startsWith(":")) {
    return `:${trimmed}`;
  }

  return trimmed;
}

function contextObject(context: ScopeSelection): string {
  if (context.scopeMode === "casa" && context.selectedCasa && context.selectedCasa !== "all") {
    return `:${context.selectedCasa}`;
  }

  if (context.scopeMode === "gang" && context.selectedCasa && context.selectedCasa !== "all") {
    return `:${context.selectedCasa}`;
  }

  return ":";
}

async function executeAtObject<T>(obj: string, method: string, args: unknown[] = []): Promise<T> {
  const result = await consoleSocket.execute<T | string>({
    obj,
    method,
    arguments: args
  });

  if (typeof result === "string") {
    throw new Error(result);
  }

  return result as T;
}

export class ConsoleApiClient {
  connect(): Promise<void> {
    return consoleSocket.connect();
  }

  onOutput(handler: (payload: unknown) => void): () => void {
    return consoleSocket.onOutput(handler);
  }

  isConnected(): boolean {
    return consoleSocket.isConnected();
  }

  getTargetUrl(): string {
    return consoleSocket.getTargetUrl();
  }

  resetConnection(): void {
    consoleSocket.reset();
  }

  async getTopology(context: ScopeSelection): Promise<TopologyResult> {
    const obj = context.scopeMode === "casa" && context.selectedCasa !== "all" ? `:${context.selectedCasa}` : ":";
    return executeAtObject<TopologyResult>(obj, "topology", []);
  }

  async getSourceInventory(context: ScopeSelection, options: SourceInventoryOptions): Promise<SourceInventoryResult> {
    const obj = contextObject(context);
    return executeAtObject<SourceInventoryResult>(obj, "sourceInventory", [options]);
  }

  async resolveSource(context: ScopeSelection, sourceUName: string): Promise<ResolveResult> {
    const obj = contextObject(context);
    return executeAtObject<ResolveResult>(obj, "resolveSource", [normaliseSourceUName(sourceUName)]);
  }

  async explainSource(context: ScopeSelection, sourceUName: string): Promise<ExplainResult> {
    const obj = contextObject(context);
    return executeAtObject<ExplainResult>(obj, "explainSource", [normaliseSourceUName(sourceUName)]);
  }

  async sourceUsage(context: ScopeSelection, sourceUName: string, options: SourceUsageOptions): Promise<UsageResult> {
    const obj = contextObject(context);
    return executeAtObject<UsageResult>(obj, "sourceUsage", [normaliseSourceUName(sourceUName), options]);
  }

  async previewConfig(context: ScopeSelection, options: PreviewConfigOptions): Promise<PreviewResult> {
    const obj = contextObject(context);
    const payload: PreviewConfigOptions = {
      ...options
    };

    if (!payload.targetCasaName && context.selectedCasa !== "all") {
      payload.targetCasaName = context.selectedCasa;
    }

    return executeAtObject<PreviewResult>(obj, "previewConfig", [payload]);
  }
}

export const consoleApiClient = new ConsoleApiClient();
