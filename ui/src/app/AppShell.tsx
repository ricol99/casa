import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { consoleApiClient } from "../lib/consoleApiClient";
import { useUiSessionStore } from "../store/uiSessionStore";
import { discoverCasas, type DiscoveredCasa } from "../lib/discoveryClient";
import { setConfiguredConsoleUrl } from "../lib/socket";

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        isActive ? "tab-link tab-link-active" : "tab-link"
      }
    >
      {label}
    </NavLink>
  );
}

export function AppShell() {
  const scopeMode = useUiSessionStore((s) => s.scopeMode);
  const selectedCasa = useUiSessionStore((s) => s.selectedCasa);
  const setScopeMode = useUiSessionStore((s) => s.setScopeMode);
  const setSelectedCasa = useUiSessionStore((s) => s.setSelectedCasa);
  const setDiscoverySnapshot = useUiSessionStore((s) => s.setDiscoverySnapshot);

  const [connected, setConnected] = useState(consoleApiClient.isConnected());
  const [gangNameInput, setGangNameInput] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discoveredCasas, setDiscoveredCasas] = useState<DiscoveredCasa[]>([]);
  const [discoveryMeta, setDiscoveryMeta] = useState<{
    gangName: string;
    seenCount: number;
    errorCount: number;
    errors: string[];
  } | null>(null);

  const topologyQuery = useQuery({
    queryKey: ["topology", scopeMode, selectedCasa],
    queryFn: () =>
      consoleApiClient.getTopology({
        scopeMode,
        selectedCasa
      })
  });


  useEffect(() => {
    const timer = window.setInterval(() => {
      setConnected(consoleApiClient.isConnected());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedCasa !== "all") {
      return;
    }

    const localCasaName = typeof (topologyQuery.data as any)?.localCasaName === "string"
      ? (topologyQuery.data as any).localCasaName
      : null;

    if (localCasaName) {
      setSelectedCasa(localCasaName);
    }
  }, [topologyQuery.data, selectedCasa, setSelectedCasa]);

  const targetUrl = consoleApiClient.getTargetUrl();
  const connectedCasaLabel = useMemo(() => {
    const normalisedTarget = targetUrl.replace(/\/+$/, "");
    const match = discoveredCasas.find((casa) => {
      const transport = casa.messageTransportName === "https" ? "https" : "http";
      return `${transport}://${casa.host}:${casa.port}` === normalisedTarget;
    });

    return match ? match.name : null;
  }, [discoveredCasas, targetUrl]);

  const onDiscoverCasas = async () => {
    setDiscoverError(null);

    if (!gangNameInput.trim()) {
      setDiscoverError("Enter a gang name");
      return;
    }

    try {
      setDiscovering(true);
      const result = await discoverCasas(gangNameInput.trim(), 3000);
      setDiscoveredCasas(result.casas);
      setDiscoverySnapshot(
        result.gangName,
        result.casas.map((casa) => ({
          name: casa.name,
          host: casa.host,
          port: casa.port,
          messageTransportName: casa.messageTransportName
        }))
      );
      setDiscoveryMeta({
        gangName: result.gangName,
        seenCount: result.seenCount,
        errorCount: result.errorCount,
        errors: result.errors
      });
    } catch (error) {
      setDiscoverError((error as Error).message);
    } finally {
      setDiscovering(false);
    }
  };

  const connectToDiscoveredCasa = async (casa: DiscoveredCasa) => {
    const transport = casa.messageTransportName === "https" ? "https" : "http";
    const url = `${transport}://${casa.host}:${casa.port}`;
    setConfiguredConsoleUrl(url);
    consoleApiClient.resetConnection();
    setSelectedCasa(casa.name);
    setScopeMode("gang");

    try {
      await consoleApiClient.connect();
      setConnected(consoleApiClient.isConnected());
    } catch (error) {
      setDiscoverError(`Connection failed: ${(error as Error).message}`);
    }
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <div>
          <h1 className="app-title">Casa Config Console</h1>
          <p className="app-subtitle">Gang/casa source model and preview-first change workflow</p>
        </div>
        <div className="header-controls">
          <label className="control">
            <span>Gang discovery</span>
            <div className="discover-row">
              <input
                value={gangNameInput}
                onChange={(event) => setGangNameInput(event.target.value)}
                placeholder="gang name"
              />
              <button type="button" onClick={onDiscoverCasas} disabled={discovering}>
                {discovering ? "..." : "discover"}
              </button>
            </div>
          </label>
          <label className="control">
            <span>View scope</span>
            <select
              value={scopeMode}
              onChange={(event) => setScopeMode(event.target.value as "gang" | "casa")}
            >
              <option value="gang">gang</option>
              <option value="casa">casa</option>
            </select>
          </label>
          <span className={connected ? "status connected" : "status disconnected"}>
            {connected ? "socket connected" : "socket disconnected"}
          </span>
        </div>
      </header>

      <section className="card compact-card">
        <div className="card-header split">
          <h2 className="h3ish">Connection</h2>
          <span className="chip">socket target: {targetUrl}</span>
        </div>
        {discoverError && <p className="error">{discoverError}</p>}
        <p className="meta">
          The buttons below choose which casa the browser connects to and set the current casa context. The header scope
          selector changes whether commands run at gang level or casa level.
        </p>
        <p className="meta">
          connected casa: {connectedCasaLabel ?? "unknown"} / command scope: {scopeMode} / current casa: {selectedCasa}
        </p>
        {discoveryMeta && (
          <p className="meta">
            gang: {discoveryMeta.gangName}, seen: {discoveryMeta.seenCount}, matched-up: {discoveredCasas.length}, errors: {discoveryMeta.errorCount}
          </p>
        )}
        {discoveryMeta && discoveryMeta.errors.length > 0 && (
          <div className="warning-box">
            {discoveryMeta.errors.map((item, index) => (
              <p key={`${item}-${index}`}>{item}</p>
            ))}
          </div>
        )}
        {discoveredCasas.length > 0 ? (
          <>
            <p className="meta">Connect browser socket to:</p>
            <div className="discover-results">
            {discoveredCasas.map((casa) => (
              <button
                key={`${casa.name}-${casa.host}-${casa.port}`}
                type="button"
                className={connectedCasaLabel === casa.name ? "discover-item discover-item-active" : "discover-item"}
                onClick={() => {
                  void connectToDiscoveredCasa(casa);
                }}
              >
                {casa.name} ({casa.host}:{casa.port})
              </button>
            ))}
            </div>
          </>
        ) : (
          <p className="meta">Enter gang name and click discover to list available casas.</p>
        )}
      </section>

      <nav className="tab-nav">
        <TabLink to="/topology" label="Topology" />
        <TabLink to="/sources" label="Sources" />
        <TabLink to="/designer" label="Designer" />
        <TabLink to="/changes" label="Changes" />
        <TabLink to="/jobs" label="Jobs" />
      </nav>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
