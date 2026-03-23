import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { consoleApiClient } from "../../lib/consoleApiClient";
import { useUiSessionStore } from "../../store/uiSessionStore";
import type { ExportTreeNode, ThingDesignExternalMember, ThingDesignMember } from "../../types/consoleApi";

interface ThingTreeRow {
  uName: string;
  name: string;
  type: string;
  depth: number;
}

function collectThingRows(node: ExportTreeNode | null, depth = 0): ThingTreeRow[] {
  if (!node?.myNamedObjects) {
    return [];
  }

  const rows: ThingTreeRow[] = [];

  for (const child of Object.values(node.myNamedObjects)) {
    if (!child) {
      continue;
    }

    if (child.superType === "thing" && child.uName) {
      rows.push({
        uName: child.uName,
        name: child.name ?? child.uName,
        type: child.type ?? "thing",
        depth
      });
      rows.push(...collectThingRows(child, depth + 1));
      continue;
    }

    rows.push(...collectThingRows(child, depth));
  }

  return rows;
}

function FlowBadge({ label, open }: { label: string; open: boolean }) {
  return <span className={open ? "flow-chip flow-chip-open" : "flow-chip flow-chip-blocked"}>{label}</span>;
}

function TreeFlowRow({
  row,
  selectedThingUName,
  selectedParentUName,
  selectedChildMap,
  selectedFlow
}: {
  row: ThingTreeRow;
  selectedThingUName: string;
  selectedParentUName: string | null;
  selectedChildMap: Map<string, { receivesFromParent: boolean; sendsToParent: boolean }>;
  selectedFlow: {
    receivesFromParent: boolean;
    sendsToParent: boolean;
    receivesFromChildren: boolean;
    sendsToChildren: boolean;
  } | null;
}) {
  const isSelected = row.uName === selectedThingUName;
  const isParent = !!selectedParentUName && row.uName === selectedParentUName;
  const childFlow = selectedChildMap.get(row.uName);

  return (
    <Link
      to={`/designer/${encodeURIComponent(row.uName)}`}
      className={isSelected ? "designer-tree-item designer-tree-item-active" : "designer-tree-item"}
      style={{ paddingLeft: `${0.75 + row.depth * 0.9}rem` }}
    >
      <div className="designer-tree-main">
        <span>{row.name}</span>
        <span className="designer-tree-type">{row.type}</span>
      </div>
      <div className="designer-tree-flows">
        {isParent && childFlow === undefined && selectedFlow && (
          <>
            <FlowBadge label="↓ to thing" open={selectedFlow.receivesFromParent} />
            <FlowBadge label="↑ from thing" open={selectedFlow.sendsToParent} />
          </>
        )}
        {isSelected && selectedFlow && (
          <>
            <FlowBadge label="↑ parent" open={selectedFlow.sendsToParent} />
            <FlowBadge label="↓ parent" open={selectedFlow.receivesFromParent} />
            <FlowBadge label="↑ child" open={selectedFlow.receivesFromChildren} />
            <FlowBadge label="↓ child" open={selectedFlow.sendsToChildren} />
          </>
        )}
        {childFlow && (
          <>
            <FlowBadge label="↓ from thing" open={childFlow.receivesFromParent} />
            <FlowBadge label="↑ to thing" open={childFlow.sendsToParent} />
          </>
        )}
      </div>
    </Link>
  );
}

function MemberTable({
  title,
  members
}: {
  title: string;
  members: ThingDesignMember[];
}) {
  return (
    <article className="panel">
      <h3>{title}</h3>
      {members.length === 0 ? (
        <p className="meta">none</p>
      ) : (
        <table className="data-table compact">
          <thead>
            <tr>
              <th>name</th>
              <th>type</th>
              <th>inheritance</th>
              <th>flow</th>
              <th>listeners</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.uName}>
                <td>{member.name}</td>
                <td>{member.type ?? "-"}</td>
                <td>
                  {member.inherited.parent ? "parent " : ""}
                  {member.inherited.child ? "child" : ""}
                  {!member.inherited.parent && !member.inherited.child ? "local" : ""}
                </td>
                <td className="designer-flow-cell">
                  <FlowBadge label="up" open={member.propagation.effective.propagateToParent && !member.propagation.effective.ignoreParent} />
                  <FlowBadge label="down" open={member.propagation.effective.propagateToChildren && !member.propagation.effective.ignoreChildren} />
                </td>
                <td>{member.sourceListenerCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}

function MemberNameList({
  title,
  members,
  empty
}: {
  title: string;
  members: Array<ThingDesignMember | ThingDesignExternalMember>;
  empty: string;
}) {
  return (
    <article className="panel">
      <h3>{title}</h3>
      {members.length === 0 ? (
        <p className="meta">{empty}</p>
      ) : (
        <div className="designer-member-list">
          {members.map((member) => (
            <div
              key={("uName" in member && member.uName ? member.uName : `${member.name}-${"viaThingUName" in member ? member.viaThingUName : "local"}`)}
              className="designer-member-pill"
            >
              <strong>{member.name}</strong>
              <span>{member.type ?? "-"}</span>
              {"viaThingName" in member && member.viaThingName ? <em>via {member.viaThingName}</em> : null}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export function DesignerPage() {
  const { thingUName: encodedThing } = useParams<{ thingUName: string }>();
  const scopeMode = useUiSessionStore((s) => s.scopeMode);
  const selectedCasa = useUiSessionStore((s) => s.selectedCasa);
  const context = { scopeMode, selectedCasa } as const;

  const sourceTreesQuery = useQuery({
    queryKey: ["designer-tree", scopeMode, selectedCasa],
    queryFn: () => consoleApiClient.getSourceTrees(context)
  });

  const thingRows = useMemo(() => {
    const rows = collectThingRows(sourceTreesQuery.data?.activeTree ?? null);
    rows.sort((a, b) => a.uName.localeCompare(b.uName));
    return rows;
  }, [sourceTreesQuery.data]);

  const requestedThingUName = useMemo(() => decodeURIComponent(encodedThing ?? ""), [encodedThing]);
  const selectedThingUName = requestedThingUName || thingRows[0]?.uName || "";

  const describeQuery = useQuery({
    queryKey: ["describeThing", scopeMode, selectedCasa, selectedThingUName],
    enabled: selectedThingUName.length > 0,
    queryFn: () => consoleApiClient.describeThing(context, selectedThingUName)
  });

  const selectedParentUName = describeQuery.data?.parent?.object.uName ?? null;
  const selectedChildMap = useMemo(
    () =>
      new Map(
        (describeQuery.data?.children ?? []).map((child) => [
          child.object.uName,
          {
            receivesFromParent: child.propagation.receivesFromParent,
            sendsToParent: child.propagation.sendsToParent
          }
        ])
      ),
    [describeQuery.data]
  );
  const selectedFlow = describeQuery.data
    ? {
        receivesFromParent: describeQuery.data.propagation.effective.receivesFromParent,
        sendsToParent: describeQuery.data.propagation.effective.sendsToParent,
        receivesFromChildren: describeQuery.data.propagation.effective.receivesFromChildren,
        sendsToChildren: describeQuery.data.propagation.effective.sendsToChildren
      }
    : null;

  return (
    <section className="card">
      <div className="card-header split">
        <h2>Designer</h2>
        {describeQuery.data && (
          <div className="chip-row">
            <span className="chip">thing: {describeQuery.data.thing.object.uName}</span>
            <span className="chip">children: {describeQuery.data.children.length}</span>
            <span className="chip">properties: {describeQuery.data.properties.length}</span>
            <span className="chip">events: {describeQuery.data.events.length}</span>
          </div>
        )}
      </div>

      <p className="meta">
        Read-only composite view for the connected casa perspective. The tree panel is the main view now: it shows the active
        thing hierarchy and highlights visible parent/child flow around the currently selected node. The inspector on the right
        shows the selected thing in detail.
      </p>

      <div className="designer-layout">
        <section className="panel designer-tree-panel">
          <h3>Thing tree</h3>
          {sourceTreesQuery.isLoading && <p>Loading tree...</p>}
          {sourceTreesQuery.isError && <p className="error">Unable to load active tree.</p>}
          {!sourceTreesQuery.isLoading && !sourceTreesQuery.isError && thingRows.length === 0 && (
            <p className="meta">No active things found.</p>
          )}
          {describeQuery.data && (
            <div className="designer-tree-legend">
              <FlowBadge label="↓ from parent" open={true} />
              <FlowBadge label="↑ to parent" open={true} />
              <FlowBadge label="↓ to child" open={true} />
              <FlowBadge label="↑ from child" open={true} />
            </div>
          )}
          <div className="designer-tree-list">
            {thingRows.map((row) => (
              <TreeFlowRow
                key={row.uName}
                row={row}
                selectedThingUName={selectedThingUName}
                selectedParentUName={selectedParentUName}
                selectedChildMap={selectedChildMap}
                selectedFlow={selectedFlow}
              />
            ))}
          </div>
        </section>

        <aside className="designer-inspector">
          {describeQuery.data && (
            <>
              <article className="panel">
                <h3>Thing</h3>
                <dl className="designer-kv">
                  <dt>uName</dt>
                  <dd>{describeQuery.data.thing.object.uName}</dd>
                  <dt>type</dt>
                  <dd>{describeQuery.data.thing.object.type ?? "-"}</dd>
                  <dt>owner casa</dt>
                  <dd>{describeQuery.data.thing.object.ownerCasa ?? "-"}</dd>
                  <dt>priority</dt>
                  <dd>{describeQuery.data.thing.priority ?? "-"}</dd>
                  <dt>top level</dt>
                  <dd>{describeQuery.data.thing.topLevelThing ? "yes" : "no"}</dd>
                  <dt>bowing</dt>
                  <dd>{describeQuery.data.thing.bowing ? "yes" : "no"}</dd>
                </dl>
              </article>

              <article className="panel">
                <h3>Object propagation</h3>
                <dl className="designer-kv">
                  <dt>ignore parent</dt>
                  <dd>{describeQuery.data.propagation.objectLevel.ignoreParent ? "yes" : "no"}</dd>
                  <dt>ignore children</dt>
                  <dd>{describeQuery.data.propagation.objectLevel.ignoreChildren ? "yes" : "no"}</dd>
                  <dt>propagate to parent</dt>
                  <dd>{describeQuery.data.propagation.objectLevel.propagateToParent ? "yes" : "no"}</dd>
                  <dt>propagate to children</dt>
                  <dd>{describeQuery.data.propagation.objectLevel.propagateToChildren ? "yes" : "no"}</dd>
                </dl>
              </article>

              <MemberNameList
                title="Inherited properties"
                members={[
                  ...describeQuery.data.inheritance.properties.parent,
                  ...describeQuery.data.inheritance.properties.child
                ]}
                empty="No inherited properties are currently present."
              />

              <MemberNameList
                title="Inherited events"
                members={[
                  ...describeQuery.data.inheritance.events.parent,
                  ...describeQuery.data.inheritance.events.child
                ]}
                empty="No inherited events are currently present."
              />

              <MemberNameList
                title="Blocked from parent"
                members={[
                  ...describeQuery.data.inheritance.blocked.fromParent.properties,
                  ...describeQuery.data.inheritance.blocked.fromParent.events
                ]}
                empty="Nothing is currently blocked from the parent."
              />

              <MemberNameList
                title="Blocked from children"
                members={[
                  ...describeQuery.data.inheritance.blocked.fromChildren.properties,
                  ...describeQuery.data.inheritance.blocked.fromChildren.events
                ]}
                empty="Nothing is currently blocked from children."
              />

              <MemberTable title="Properties" members={describeQuery.data.properties} />
              <MemberTable title="Events" members={describeQuery.data.events} />
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
