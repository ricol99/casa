import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { consoleApiClient } from "../../lib/consoleApiClient";
import { useUiSessionStore } from "../../store/uiSessionStore";

export function SourcesPage() {
  const scopeMode = useUiSessionStore((s) => s.scopeMode);
  const selectedCasa = useUiSessionStore((s) => s.selectedCasa);
  const sourceFilters = useUiSessionStore((s) => s.sourceFilters);
  const setSourceFilters = useUiSessionStore((s) => s.setSourceFilters);
  const setActiveSourceUName = useUiSessionStore((s) => s.setActiveSourceUName);

  const query = useQuery({
    queryKey: ["sourceInventory", scopeMode, selectedCasa, sourceFilters],
    queryFn: () =>
      consoleApiClient.getSourceInventory(
        {
          scopeMode,
          selectedCasa
        },
        {
          mode: sourceFilters.mode,
          prefix: sourceFilters.prefix.trim() ? sourceFilters.prefix : undefined
        }
      )
  });

  const filtered = useMemo(() => {
    if (!query.data) {
      return [];
    }

    const search = sourceFilters.search.trim().toLowerCase();

    if (!search) {
      return query.data.sources;
    }

    return query.data.sources.filter((row) => {
      return (
        row.sourceUName.toLowerCase().includes(search) ||
        row.name.toLowerCase().includes(search) ||
        row.type.toLowerCase().includes(search)
      );
    });
  }, [query.data, sourceFilters.search]);

  return (
    <section className="card">
      <div className="card-header split">
        <h2>Source inventory</h2>
        <div className="chip-row">
          {query.data && (
            <>
              <span className="chip">count: {filtered.length}</span>
              <span className="chip">exports: {query.data.summary.matchedExports}</span>
              <span className="chip">local: {query.data.summary.matchedLocal}</span>
            </>
          )}
        </div>
      </div>

      <div className="toolbar">
        <label>
          mode
          <select
            value={sourceFilters.mode}
            onChange={(event) => setSourceFilters({ mode: event.target.value as "exports" | "local" | "both" })}
          >
            <option value="both">both</option>
            <option value="exports">exports</option>
            <option value="local">local</option>
          </select>
        </label>
        <label>
          prefix
          <input
            value={sourceFilters.prefix}
            onChange={(event) => setSourceFilters({ prefix: event.target.value })}
            placeholder=":test"
          />
        </label>
        <label>
          search
          <input
            value={sourceFilters.search}
            onChange={(event) => setSourceFilters({ search: event.target.value })}
            placeholder="source/type/name"
          />
        </label>
      </div>

      {query.isLoading && <p>Loading sources...</p>}
      {query.isError && <p className="error">Unable to load source inventory.</p>}

      {query.data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>sourceUName</th>
              <th>type</th>
              <th>priority</th>
              <th>scope</th>
              <th>category</th>
              <th>reason</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.sourceUName}>
                <td>
                  <Link
                    to={`/sources/${encodeURIComponent(row.sourceUName)}`}
                    onClick={() => setActiveSourceUName(row.sourceUName)}
                  >
                    {row.sourceUName}
                  </Link>
                </td>
                <td>{row.type}</td>
                <td>{row.priority}</td>
                <td>{row.scope}</td>
                <td>{row.category}</td>
                <td>{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
