import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { consoleApiClient } from "../../lib/consoleApiClient";
import { useUiSessionStore } from "../../store/uiSessionStore";

type SourceRowState = "active" | "bowed";

interface SourceRow {
  sourceUName: string;
  ownerCasa: string;
  type: string;
  priority: number;
  state: SourceRowState;
  tree: "active" | "local-bowed" | "peer-bowed";
}

export function SourcesPage() {
  const scopeMode = useUiSessionStore((s) => s.scopeMode);
  const selectedCasa = useUiSessionStore((s) => s.selectedCasa);
  const sourceFilters = useUiSessionStore((s) => s.sourceFilters);
  const setSourceFilters = useUiSessionStore((s) => s.setSourceFilters);
  const setActiveSourceUName = useUiSessionStore((s) => s.setActiveSourceUName);

  const query = useQuery({
    queryKey: ["sourceTrees", scopeMode, selectedCasa],
    queryFn: () =>
      consoleApiClient.getSourceTrees({
        scopeMode,
        selectedCasa
      })
  });

  const rows = useMemo(() => {
    if (!query.data) {
      return [];
    }

    const nextRows: SourceRow[] = [
      ...Object.values(query.data.activeTree?.myNamedObjects ?? {}).flatMap((child) =>
        child && child.uName
          ? [{
              sourceUName: child.uName,
              ownerCasa: child.ownerCasa ?? query.data.casaName,
              type: child.type ?? child.superType ?? "unknown",
              priority: child.priority ?? 0,
              state: "active" as const,
              tree: "active" as const
            }]
          : []
      ),
      ...Object.values(query.data.localBowedTree?.myNamedObjects ?? {}).flatMap((child) =>
        child && child.uName
          ? [{
              sourceUName: child.uName,
              ownerCasa: child.ownerCasa ?? query.data.casaName,
              type: child.type ?? child.superType ?? "unknown",
              priority: child.priority ?? 0,
              state: "bowed" as const,
              tree: "local-bowed" as const
            }]
          : []
      ),
      ...query.data.peerTrees.flatMap((peerTree) =>
        Object.values(peerTree.tree?.myNamedObjects ?? {}).flatMap((child) =>
          child && child.uName
            ? [{
                sourceUName: child.uName,
                ownerCasa: child.ownerCasa ?? peerTree.casaName,
                type: child.type ?? child.superType ?? "unknown",
                priority: child.priority ?? 0,
                state: "bowed" as const,
                tree: "peer-bowed" as const
              }]
            : []
        )
      )
    ];

    nextRows.sort((a, b) => {
      if (a.sourceUName === b.sourceUName) {
        if (a.ownerCasa === b.ownerCasa) {
          return a.tree.localeCompare(b.tree);
        }

        return a.ownerCasa.localeCompare(b.ownerCasa);
      }

      return a.sourceUName.localeCompare(b.sourceUName);
    });

    return nextRows;
  }, [query.data]);

  const filtered = useMemo(() => {
    const prefix = sourceFilters.prefix.trim();
    const search = sourceFilters.search.trim().toLowerCase();

    return rows.filter((row) => {
      if (sourceFilters.mode === "active" && row.state !== "active") {
        return false;
      }

      if (sourceFilters.mode === "bowed" && row.state !== "bowed") {
        return false;
      }

      if (prefix && !row.sourceUName.startsWith(prefix.startsWith(":") ? prefix : `:${prefix}`)) {
        return false;
      }

      if (!search) {
        return true;
      }

      return (
        row.sourceUName.toLowerCase().includes(search) ||
        row.ownerCasa.toLowerCase().includes(search) ||
        row.type.toLowerCase().includes(search) ||
        row.tree.toLowerCase().includes(search)
      );
    });
  }, [rows, sourceFilters.mode, sourceFilters.prefix, sourceFilters.search]);

  return (
    <section className="card">
      <div className="card-header split">
        <h2>Source trees</h2>
        <div className="chip-row">
          {query.data && (
            <>
              <span className="chip">count: {filtered.length}</span>
              <span className="chip">active: {filtered.filter((row) => row.state === "active").length}</span>
              <span className="chip">bowed: {filtered.filter((row) => row.state === "bowed").length}</span>
              <span className="chip">
                peer bowed: {filtered.filter((row) => row.tree === "peer-bowed").length}
              </span>
            </>
          )}
        </div>
      </div>

      {query.data && (
        <p className="meta">
          Perspective: these trees come from the currently connected casa. `active` is the live gang tree as seen by that
          casa, `local-bowed` is that casa&apos;s bowed tree, and `peer-bowed` is what that casa keeps in each peer root.
        </p>
      )}

      <div className="toolbar">
        <label>
          mode
          <select
            value={sourceFilters.mode}
            onChange={(event) => setSourceFilters({ mode: event.target.value as "all" | "active" | "bowed" })}
          >
            <option value="all">all</option>
            <option value="active">active</option>
            <option value="bowed">bowed</option>
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
            placeholder="uName/owner/type/tree"
          />
        </label>
      </div>

      {query.isLoading && <p>Loading sources...</p>}
      {query.isError && <p className="error">Unable to load source trees.</p>}

      {query.data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>sourceUName</th>
              <th>owner</th>
              <th>type</th>
              <th>priority</th>
              <th>state</th>
              <th>tree</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={`${row.sourceUName}|${row.ownerCasa}|${row.tree}`}>
                <td>
                  <Link
                    to={`/sources/${encodeURIComponent(row.sourceUName)}`}
                    onClick={() => setActiveSourceUName(row.sourceUName)}
                  >
                    {row.sourceUName}
                  </Link>
                </td>
                <td>{row.ownerCasa}</td>
                <td>{row.type}</td>
                <td>{row.priority}</td>
                <td>{row.state}</td>
                <td>{row.tree}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
