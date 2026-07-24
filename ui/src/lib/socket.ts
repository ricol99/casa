import io from "socket.io-client";

type ExecuteRequest = {
  obj: string;
  method: string;
  arguments?: unknown[];
};

type OutputHandler = (payload: unknown) => void;

export type LiveUpdateType = "source-property-changed" | "source-event-raised" | string;

export interface LiveUpdatePayload {
  type: LiveUpdateType;
  data: {
    sourceName?: string;
    name?: string;
    value?: unknown;
    propertyOldValue?: unknown;
    transaction?: unknown;
    local?: boolean;
    fromPeer?: boolean;
    [key: string]: unknown;
  };
}

type LiveUpdateHandler = (payload: LiveUpdatePayload) => void;

const EXECUTE_TIMEOUT_MS = 60_000;
const CONSOLE_URL_STORAGE_KEY = "casa.console.url";

export function getConfiguredConsoleUrl(): string | null {
  try {
    const value = window.localStorage.getItem(CONSOLE_URL_STORAGE_KEY);
    return value && value.trim().length > 0 ? value.trim() : null;
  } catch {
    return null;
  }
}

export function setConfiguredConsoleUrl(url: string): void {
  try {
    const trimmed = url.trim();

    if (trimmed.length === 0) {
      window.localStorage.removeItem(CONSOLE_URL_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CONSOLE_URL_STORAGE_KEY, trimmed);
  } catch {
    // ignore localStorage failures
  }
}

function getQueryConsoleUrl(): string | null {
  try {
    const value = new URLSearchParams(window.location.search).get("consoleUrl");
    return value && value.trim().length > 0 ? value.trim() : null;
  } catch {
    return null;
  }
}

function createSocketUrl(): string {
  const queryUrl = getQueryConsoleUrl();

  if (queryUrl) {
    return queryUrl;
  }

  const configuredUrl = getConfiguredConsoleUrl();

  if (configuredUrl) {
    return configuredUrl;
  }

  const envUrl = import.meta.env.VITE_CONSOLE_URL as string | undefined;

  if (envUrl && envUrl.trim().length > 0) {
    return envUrl;
  }

  return window.location.origin;
}

export class ConsoleSocket {
  private socket: any | null = null;
  private connectPromise: Promise<void> | null = null;
  private outputHandlers = new Set<OutputHandler>();
  private liveUpdateHandlers = new Set<LiveUpdateHandler>();
  private liveUpdatesSubscribed = false;
  private queue: Promise<unknown> = Promise.resolve();
  private targetUrl: string | null = null;

  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const url = createSocketUrl();
      this.targetUrl = url;
      const socket = io(`${url}/consoleapi/io`, {
        transports: ["websocket"],
        reconnection: true,
        forceNew: true
      } as any);
      let socketHandlersAttached = false;

      const attachSocketHandlers = () => {
        if (socketHandlersAttached) {
          return;
        }

        socketHandlersAttached = true;
        socket.on("output", (payload: unknown) => {
          this.outputHandlers.forEach((handler) => handler(payload));
        });
        socket.on("live-update", (payload: LiveUpdatePayload) => {
          this.liveUpdateHandlers.forEach((handler) => handler(payload));
        });
        socket.on("disconnect", () => {
          this.liveUpdatesSubscribed = false;
        });
        socket.on("reconnect", () => {
          this.liveUpdatesSubscribed = false;
          this.subscribeLiveUpdates();
        });
      };

      const onConnect = () => {
        this.socket = socket;
        this.liveUpdatesSubscribed = false;
        attachSocketHandlers();
        cleanup();
        this.subscribeLiveUpdates();
        resolve();
      };

      const onConnectError = (error: unknown) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        socket.removeListener("connect", onConnect);
        socket.removeListener("connect_error", onConnectError);
        this.connectPromise = null;
      };

      socket.on("connect", onConnect);
      socket.on("connect_error", onConnectError);
    });

    return this.connectPromise;
  }

  async execute<T>(request: ExecuteRequest): Promise<T> {
    return this.enqueue<T>(() => this.executeInternal<T>(request));
  }

  onOutput(handler: OutputHandler): () => void {
    this.outputHandlers.add(handler);

    return () => {
      this.outputHandlers.delete(handler);
    };
  }

  onLiveUpdate(handler: LiveUpdateHandler): () => void {
    this.liveUpdateHandlers.add(handler);

    void this.connect()
      .then(() => this.subscribeLiveUpdates())
      .catch(() => undefined);

    return () => {
      this.liveUpdateHandlers.delete(handler);

      if (this.liveUpdateHandlers.size === 0) {
        this.unsubscribeLiveUpdates();
      }
    };
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }

  disconnect(): void {
    if (this.socket) {
      this.unsubscribeLiveUpdates();
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectPromise = null;
    this.liveUpdatesSubscribed = false;
  }

  reset(): void {
    this.disconnect();
  }

  getTargetUrl(): string {
    return this.targetUrl ?? createSocketUrl();
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }

  private subscribeLiveUpdates(): void {
    if (!this.socket || this.liveUpdatesSubscribed || this.liveUpdateHandlers.size === 0) {
      return;
    }

    this.socket.emit("subscribeLiveUpdates", {});
    this.liveUpdatesSubscribed = true;
  }

  private unsubscribeLiveUpdates(): void {
    if (!this.socket || !this.liveUpdatesSubscribed) {
      return;
    }

    this.socket.emit("unsubscribeLiveUpdates", {});
    this.liveUpdatesSubscribed = false;
  }

  private async executeInternal<T>(request: ExecuteRequest): Promise<T> {
    await this.connect();

    return new Promise<T>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("Socket is not connected"));
        return;
      }

      let completed = false;

      const cleanup = () => {
        this.socket?.removeListener("execute-output", onExecuteOutput);
        clearTimeout(timeout);
      };

      const onExecuteOutput = (payload: any) => {
        if (completed) {
          return;
        }

        completed = true;
        cleanup();
        resolve((payload ? payload.result : undefined) as T);
      };

      const timeout = setTimeout(() => {
        if (completed) {
          return;
        }

        completed = true;
        cleanup();
        reject(new Error(`Command timed out: ${request.method}`));
      }, EXECUTE_TIMEOUT_MS);

      this.socket.once("execute-output", onExecuteOutput);
      this.socket.emit("executeCommand", {
        obj: request.obj,
        method: request.method,
        arguments: request.arguments ? request.arguments : []
      });
    });
  }
}

export const consoleSocket = new ConsoleSocket();
