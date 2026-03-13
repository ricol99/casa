import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { consoleApiClient } from "../../lib/consoleApiClient";
import { useUiSessionStore } from "../../store/uiSessionStore";

export function SourceDetailPage() {
  const { sourceUName: encodedSource } = useParams<{ sourceUName: string }>();
  const sourceUName = useMemo(() => decodeURIComponent(encodedSource ?? ""), [encodedSource]);

  const scopeMode = useUiSessionStore((s) => s.scopeMode);
  const selectedCasa = useUiSessionStore((s) => s.selectedCasa);
  const usageFilters = useUiSessionStore((s) => s.usageFilters);
  const setUsageFilters = useUiSessionStore((s) => s.setUsageFilters);

  const context = { scopeMode, selectedCasa } as const;

  const resolveQuery = useQuery({
    queryKey: ["resolveSource", scopeMode, selectedCasa, sourceUName],
    enabled: sourceUName.length > 0,
    queryFn: () => consoleApiClient.resolveSource(context, sourceUName)
  });

  const explainQuery = useQuery({
    queryKey: ["explainSource", scopeMode, selectedCasa, sourceUName],
    enabled: sourceUName.length > 0,
    queryFn: () => consoleApiClient.explainSource(context, sourceUName)
  });

  const usageQuery = useQuery({
    queryKey: ["sourceUsage", scopeMode, selectedCasa, sourceUName, usageFilters],
    enabled: sourceUName.length > 0,
    queryFn: () =>
      consoleApiClient.sourceUsage(context, sourceUName, {
        activeOnly: usageFilters.activeOnly,
        hasConsumers: usageFilters.hasConsumers
      })
  });

  if (!sourceUName) {
    return <section className="card error">Missing source uName.</section>;
  }

  return (
    <section className="card">
      <div className="card-header split">
        <h2>Source detail: {sourceUName}</h2>
        <label>
          usage filters
          <span className="inline-check">
            <input
              type="checkbox"
              checked={usageFilters.activeOnly}
              onChange={(event) => setUsageFilters({ activeOnly: event.target.checked })}
            />
            active only
          </span>
          <span className="inline-check">
            <input
              type="checkbox"
              checked={usageFilters.hasConsumers}
              onChange={(event) => setUsageFilters({ hasConsumers: event.target.checked })}
            />
            has consumers
          </span>
        </label>
      </div>

      <div className="detail-grid">
        <article className="panel">
          <h3>Resolve</h3>
          {resolveQuery.isLoading && <p>Loading resolve...</p>}
          {resolveQuery.isError && <p className="error">Unable to resolve source.</p>}
          {resolveQuery.data && (
            <>
              <p className="meta">active owner: {resolveQuery.data.activeOwnerCasa ?? "-"}</p>
              <p className="meta">active provider: {resolveQuery.data.activeProviderType ?? "-"}</p>
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>owner</th>
                    <th>provider</th>
                    <th>prio</th>
                    <th>state</th>
                    <th>scope</th>
                  </tr>
                </thead>
                <tbody>
                  {resolveQuery.data.instances.map((instance, index) => (
                    <tr key={`${instance.ownerCasa}-${instance.providerType}-${index}`}>
                      <td>{instance.ownerCasa}</td>
                      <td>{instance.providerType}</td>
                      <td>{instance.priority}</td>
                      <td>{instance.state}</td>
                      <td>{instance.scope}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </article>

        <article className="panel">
          <h3>Explain</h3>
          {explainQuery.isLoading && <p>Loading explain...</p>}
          {explainQuery.isError && <p className="error">Unable to explain source state.</p>}
          {explainQuery.data && (
            <>
              <p className="meta">rule: {explainQuery.data.rule ?? explainQuery.data.reason ?? "-"}</p>
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>owner</th>
                    <th>state</th>
                    <th>priority</th>
                    <th>reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {(explainQuery.data.contenders ?? []).map((row, index) => (
                    <tr key={`${row.ownerCasa}-${index}`}>
                      <td>{row.ownerCasa}</td>
                      <td>{row.state}</td>
                      <td>{row.priority}</td>
                      <td>{(row.reasons ?? []).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </article>

        <article className="panel">
          <h3>Usage</h3>
          {usageQuery.isLoading && <p>Loading usage...</p>}
          {usageQuery.isError && <p className="error">Unable to load usage.</p>}
          {usageQuery.data && (
            <>
              <p className="meta">
                consumers: {usageQuery.data.consumerCount} / subscriptions: {usageQuery.data.subscriptionCount}
              </p>
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>owner</th>
                    <th>state</th>
                    <th>consumers</th>
                    <th>subscriptions</th>
                  </tr>
                </thead>
                <tbody>
                  {usageQuery.data.instances.map((instance, index) => (
                    <tr key={`${instance.ownerCasa}-${index}`}>
                      <td>{instance.ownerCasa}</td>
                      <td>{instance.state}</td>
                      <td>{instance.consumerCount ?? 0}</td>
                      <td>{instance.subscriptionCount ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
