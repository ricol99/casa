import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { consoleApiClient } from "../../lib/consoleApiClient";
import { useUiSessionStore } from "../../store/uiSessionStore";
import type { ExportTreeNode, ThingDesignExternalMember, ThingDesignMember } from "../../types/consoleApi";

interface ThingTreeNode {
  uName: string;
  name: string;
  type: string;
  ignoreParent: boolean;
  ignoreChildren: boolean;
  propagateToParent: boolean;
  propagateToChildren: boolean;
  topLevelThing: boolean;
  children: ThingTreeNode[];
}

interface MemberSelection {
  kind: "property" | "event";
  uName: string;
}

function collectThingNodes(node: ExportTreeNode | null): ThingTreeNode[] {
  if (!node?.myNamedObjects) {
    return [];
  }

  const rows: ThingTreeNode[] = [];

  for (const child of Object.values(node.myNamedObjects)) {
    if (!child) {
      continue;
    }

    if (child.superType === "thing" && child.uName) {
      rows.push({
        uName: child.uName,
        name: child.name ?? child.uName,
        type: child.type ?? "thing",
        ignoreParent: !!child.ignoreParent,
        ignoreChildren: !!child.ignoreChildren,
        propagateToParent: !!child.propagateToParent,
        propagateToChildren: !!child.propagateToChildren,
        topLevelThing: !!child.topLevelThing,
        children: collectThingNodes(child)
      });
      continue;
    }

    rows.push(...collectThingNodes(child));
  }

  rows.sort((a, b) => a.uName.localeCompare(b.uName));
  return rows;
}

function findThingPath(nodes: ThingTreeNode[], targetUName: string): string[] {
  for (const node of nodes) {
    if (node.uName === targetUName) {
      return [node.uName];
    }

    const childPath = findThingPath(node.children, targetUName);
    if (childPath.length > 0) {
      return [node.uName, ...childPath];
    }
  }

  return [];
}

function subtreeContains(nodes: ThingTreeNode[], targetUName: string): boolean {
  return findThingPath(nodes, targetUName).length > 0;
}

function collectAllThingUNames(nodes: ThingTreeNode[]): string[] {
  const results: string[] = [];

  for (const node of nodes) {
    results.push(node.uName);
    results.push(...collectAllThingUNames(node.children));
  }

  return results;
}

function isSelectableMember(member: ThingDesignMember | ThingDesignExternalMember): member is ThingDesignMember {
  return "inherited" in member;
}

function FlowGlyph({
  label,
  open,
  direction
}: {
  label: string;
  open: boolean;
  direction: "up" | "down";
}) {
  return (
    <span className={open ? "flow-glyph flow-glyph-open" : "flow-glyph flow-glyph-blocked"}>
      <span className="flow-glyph-track" aria-hidden="true">
        <span className="flow-glyph-arrow">{direction === "up" ? "↑" : "↓"}</span>
        <span className="flow-glyph-line" />
        <span className="flow-glyph-gate" />
      </span>
      <span className="flow-glyph-label">{label}</span>
    </span>
  );
}

function branchLaneState({
  offered,
  blocked
}: {
  offered: boolean;
  blocked: boolean;
}): "open" | "blocked" | "offered" {
  if (!offered) {
    return "offered";
  }

  return blocked ? "blocked" : "open";
}

function BranchConnector({
  parentNode,
  childNode,
  isLastChild
}: {
  parentNode: ThingTreeNode;
  childNode: ThingTreeNode;
  isLastChild: boolean;
}) {
  const downState = branchLaneState({
    offered: parentNode.propagateToChildren,
    blocked: childNode.ignoreParent
  });
  const upState = branchLaneState({
    offered: childNode.propagateToParent,
    blocked: parentNode.ignoreChildren
  });

  const width = 76;
  const height = 54;
  const trunkX = 10;
  const rightX = 73;
  const topY = 18;
  const bottomY = 36;
  const middleY = 27;
  const openLineStart = 10;
  const openLineEnd = 70;
  const childSideStart = 32;
  const parentSideEnd = 20;
  const parentOfferedEnd = 32;
  const parentBlockX = 18;

  function laneClass(state: "open" | "blocked" | "offered") {
    return `designer-branch-svg-lane designer-branch-svg-lane-${state}`;
  }

  function ArrowHead({ direction, x, y, className }: { direction: "left" | "right"; x: number; y: number; className: string }) {
    const points =
      direction === "right"
        ? `${x},${y} ${x - 7},${y - 5} ${x - 7},${y + 5}`
        : `${x},${y} ${x + 7},${y - 5} ${x + 7},${y + 5}`;

    return <polygon points={points} className={className} />;
  }

  function BlockMark({ x, y, className }: { x: number; y: number; className: string }) {
    return (
      <g className={className}>
        <line x1={x - 4} y1={y - 4} x2={x + 4} y2={y + 4} />
        <line x1={x - 4} y1={y + 4} x2={x + 4} y2={y - 4} />
      </g>
    );
  }

  return (
    <svg
      className="designer-branch-svg"
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <line
        className="designer-branch-svg-trunk"
        x1={trunkX}
        y1={0}
        x2={trunkX}
        y2={isLastChild ? middleY : height}
      />

      <line
        className={laneClass(downState)}
        x1={trunkX}
        y1={topY}
        x2={downState === "open" || downState === "blocked" ? openLineEnd : parentOfferedEnd}
        y2={topY}
      />
      {downState === "open" ? (
        <ArrowHead direction="right" x={rightX} y={topY} className={laneClass(downState)} />
      ) : null}
      {downState === "blocked" ? (
        <BlockMark x={rightX - 2} y={topY} className={laneClass(downState)} />
      ) : null}

      <line
        className={laneClass(upState)}
        x1={upState === "open" ? openLineStart : upState === "blocked" ? parentBlockX : childSideStart}
        y1={bottomY}
        x2={rightX}
        y2={bottomY}
      />
      {upState === "open" ? (
        <ArrowHead direction="left" x={trunkX} y={bottomY} className={laneClass(upState)} />
      ) : null}
      {upState === "blocked" ? (
        <BlockMark x={parentBlockX - 6} y={bottomY} className={laneClass(upState)} />
      ) : null}
    </svg>
  );
}

function TreeFlowRow({
  node,
  depth,
  selectedThingUName,
  parentNode,
  expandedNodes,
  toggleExpanded,
  focusBranch,
  selectedPathSet,
  underSelectedBranch
}: {
  node: ThingTreeNode;
  depth: number;
  selectedThingUName: string;
  parentNode: ThingTreeNode | null;
  expandedNodes: Set<string>;
  toggleExpanded: (_uName: string) => void;
  focusBranch: boolean;
  selectedPathSet: Set<string>;
  underSelectedBranch: boolean;
}) {
  const isSelected = node.uName === selectedThingUName;
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodes.has(node.uName);
  const showAllChildren = underSelectedBranch || isSelected || !focusBranch;
  const visibleChildren = showAllChildren
    ? node.children
    : node.children.filter((childNode) => selectedPathSet.has(childNode.uName));
  return (
    <div className="designer-tree-node">
      <div
        className={parentNode ? "designer-tree-row" : "designer-tree-row designer-tree-row-root"}
        style={{ paddingLeft: "0.35rem" }}
      >
        <div className={parentNode ? "designer-tree-row-main designer-tree-row-main-child" : "designer-tree-row-main designer-tree-row-main-root"}>
          {hasChildren ? (
            <button
              type="button"
              className="designer-tree-toggle"
              onClick={() => toggleExpanded(node.uName)}
              aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            >
              {isExpanded ? "−" : "+"}
            </button>
          ) : (
            <span className="designer-tree-toggle-spacer" />
          )}
          {parentNode ? (
            <BranchConnector
              parentNode={parentNode}
              childNode={node}
              isLastChild={parentNode.children[parentNode.children.length - 1]?.uName === node.uName}
            />
          ) : (
            <span className="designer-tree-branch-spacer" />
          )}
          <Link
            to={`/designer/${encodeURIComponent(node.uName)}`}
            className={[
              "designer-tree-item",
              isSelected ? "designer-tree-item-active" : ""
            ].filter(Boolean).join(" ")}
          >
            <div className="designer-tree-main">
              <span>{node.name}</span>
              <span className="designer-tree-type">{node.type}</span>
            </div>
          </Link>
        </div>
      </div>
      {hasChildren && isExpanded && visibleChildren.length > 0 ? (
        <div className="designer-tree-children">
          {visibleChildren.map((childNode) => (
            <div key={childNode.uName} className="designer-child-branch">
              <TreeFlowRow
                node={childNode}
                depth={depth + 1}
                selectedThingUName={selectedThingUName}
                parentNode={node}
                expandedNodes={expandedNodes}
                toggleExpanded={toggleExpanded}
                focusBranch={focusBranch}
                selectedPathSet={selectedPathSet}
                underSelectedBranch={underSelectedBranch || isSelected}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MemberTable({
  title,
  members,
  selectedMemberUName,
  onSelect
}: {
  title: string;
  members: ThingDesignMember[];
  selectedMemberUName: string | null;
  onSelect: (_member: ThingDesignMember) => void;
}) {
  return (
    <article className="panel">
      <h3>{title}</h3>
      {members.length === 0 ? (
        <p className="meta">none</p>
      ) : (
        <table className="data-table compact">
          <colgroup>
            <col className="designer-member-col-name" />
            <col className="designer-member-col-type" />
            <col className="designer-member-col-inheritance" />
            <col className="designer-member-col-flow" />
            <col className="designer-member-col-listeners" />
          </colgroup>
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
              <tr
                key={member.uName}
                className={member.uName === selectedMemberUName ? "designer-selectable-row designer-selectable-row-active" : "designer-selectable-row"}
                onClick={() => onSelect(member)}
              >
                <td>{member.name}</td>
                <td>{member.type ?? "-"}</td>
                <td>
                  {member.inherited.parent ? "parent " : ""}
                  {member.inherited.child ? "child" : ""}
                  {!member.inherited.parent && !member.inherited.child ? "local" : ""}
                </td>
                <td className="designer-flow-cell">
                  <FlowGlyph
                    label="parent"
                    direction="up"
                    open={member.propagation.effective.propagateToParent && !member.propagation.effective.ignoreParent}
                  />
                  <FlowGlyph
                    label="child"
                    direction="down"
                    open={member.propagation.effective.propagateToChildren && !member.propagation.effective.ignoreChildren}
                  />
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
  empty,
  selectedMemberUName,
  onSelect
}: {
  title: string;
  members: Array<ThingDesignMember | ThingDesignExternalMember>;
  empty: string;
  selectedMemberUName?: string | null;
  onSelect?: (_member: ThingDesignMember) => void;
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
              className={
                isSelectableMember(member)
                  ? member.uName === selectedMemberUName
                    ? "designer-member-pill designer-member-pill-selectable designer-member-pill-active"
                    : "designer-member-pill designer-member-pill-selectable"
                  : "designer-member-pill"
              }
              onClick={isSelectableMember(member) && onSelect ? () => onSelect(member) : undefined}
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

  const thingNodes = useMemo(() => {
    return collectThingNodes(sourceTreesQuery.data?.activeTree ?? null);
  }, [sourceTreesQuery.data]);

  const requestedThingUName = useMemo(() => decodeURIComponent(encodedThing ?? ""), [encodedThing]);
  const selectedThingUName = requestedThingUName || thingNodes[0]?.uName || "";
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [focusBranch, setFocusBranch] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberSelection | null>(null);

  const describeQuery = useQuery({
    queryKey: ["describeThing", scopeMode, selectedCasa, selectedThingUName],
    enabled: selectedThingUName.length > 0,
    queryFn: () => consoleApiClient.describeThing(context, selectedThingUName)
  });

  const selectedPath = useMemo(() => findThingPath(thingNodes, selectedThingUName), [thingNodes, selectedThingUName]);
  const selectedPathSet = useMemo(() => new Set(selectedPath), [selectedPath]);
  const visibleRootNodes = useMemo(() => {
    if (!focusBranch) {
      return thingNodes;
    }

    return thingNodes.filter((node) => selectedPathSet.has(node.uName) || subtreeContains([node], selectedThingUName));
  }, [focusBranch, thingNodes, selectedPathSet, selectedThingUName]);
  const visibleBranchUNames = useMemo(() => collectAllThingUNames(visibleRootNodes), [visibleRootNodes]);
  const allMembers = useMemo(() => {
    if (!describeQuery.data) {
      return [];
    }

    return [
      ...describeQuery.data.properties.map((member) => ({ kind: "property" as const, member })),
      ...describeQuery.data.events.map((member) => ({ kind: "event" as const, member }))
    ];
  }, [describeQuery.data]);
  const selectedMemberDetail = useMemo(() => {
    if (!selectedMember) {
      return null;
    }

    return allMembers.find((entry) => entry.kind === selectedMember.kind && entry.member.uName === selectedMember.uName) ?? null;
  }, [allMembers, selectedMember]);

  useEffect(() => {
    if (thingNodes.length === 0) {
      return;
    }

    setExpandedNodes((previous) => {
      const next = new Set(previous);

      for (const uName of selectedPath) {
        next.add(uName);
      }

      return next;
    });
  }, [thingNodes, selectedPath]);

  useEffect(() => {
    setSelectedMember(null);
  }, [selectedThingUName]);

  function toggleExpanded(_uName: string) {
    setExpandedNodes((previous) => {
      const next = new Set(previous);

      if (next.has(_uName)) {
        next.delete(_uName);
      }
      else {
        next.add(_uName);
      }

      return next;
    });
  }

  function expandVisibleBranch() {
    setExpandedNodes((previous) => {
      const next = new Set(previous);

      for (const uName of visibleBranchUNames) {
        next.add(uName);
      }

      return next;
    });
  }

  function collapseVisibleBranch() {
    setExpandedNodes((previous) => {
      const next = new Set(previous);

      for (const uName of visibleBranchUNames) {
        next.delete(uName);
      }

      for (const uName of selectedPath.slice(0, -1)) {
        next.add(uName);
      }

      return next;
    });
  }

  function selectProperty(member: ThingDesignMember) {
    setSelectedMember({ kind: "property", uName: member.uName });
  }

  function selectEvent(member: ThingDesignMember) {
    setSelectedMember({ kind: "event", uName: member.uName });
  }

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
          {!sourceTreesQuery.isLoading && !sourceTreesQuery.isError && thingNodes.length === 0 && (
            <p className="meta">No active things found.</p>
          )}
          <div className="designer-tree-controls">
            <label className="inline-check designer-inline-check">
              <input
                type="checkbox"
                checked={focusBranch}
                onChange={(event) => setFocusBranch(event.target.checked)}
              />
              focus branch
            </label>
            <div className="designer-tree-actions">
              <button type="button" className="designer-mini-button" onClick={expandVisibleBranch}>
                expand branch
              </button>
              <button type="button" className="designer-mini-button" onClick={collapseVisibleBranch}>
                collapse branch
              </button>
            </div>
          </div>
          <div className="designer-tree-list">
            {visibleRootNodes.map((node) => (
              <TreeFlowRow
                key={node.uName}
                node={node}
                depth={0}
                selectedThingUName={selectedThingUName}
                parentNode={null}
                expandedNodes={expandedNodes}
                toggleExpanded={toggleExpanded}
                focusBranch={focusBranch}
                selectedPathSet={selectedPathSet}
                underSelectedBranch={false}
              />
            ))}
          </div>
        </section>

        <aside className="designer-inspector">
          {describeQuery.data && (
            <>
              <article className="panel">
                <div className="designer-panel-header">
                  <h3>{selectedMemberDetail ? `${selectedMemberDetail.kind}: ${selectedMemberDetail.member.name}` : "Thing"}</h3>
                  {selectedMemberDetail ? (
                    <button type="button" className="designer-mini-button" onClick={() => setSelectedMember(null)}>
                      view thing
                    </button>
                  ) : null}
                </div>
                {selectedMemberDetail ? (
                  <dl className="designer-kv">
                    <dt>uName</dt>
                    <dd>{selectedMemberDetail.member.uName}</dd>
                    <dt>type</dt>
                    <dd>{selectedMemberDetail.member.type ?? "-"}</dd>
                    <dt>value</dt>
                    <dd>{String(selectedMemberDetail.member.value ?? "-")}</dd>
                    <dt>valid</dt>
                    <dd>{selectedMemberDetail.member.valid == null ? "-" : selectedMemberDetail.member.valid ? "yes" : "no"}</dd>
                    <dt>cold</dt>
                    <dd>{selectedMemberDetail.member.cold == null ? "-" : selectedMemberDetail.member.cold ? "yes" : "no"}</dd>
                    <dt>inheritance</dt>
                    <dd>
                      {selectedMemberDetail.member.inherited.parent ? "parent " : ""}
                      {selectedMemberDetail.member.inherited.child ? "child" : ""}
                      {!selectedMemberDetail.member.inherited.parent && !selectedMemberDetail.member.inherited.child ? "local" : ""}
                    </dd>
                    <dt>local</dt>
                    <dd>{selectedMemberDetail.member.local ? "yes" : "no"}</dd>
                    <dt>listener count</dt>
                    <dd>{selectedMemberDetail.member.sourceListenerCount}</dd>
                    <dt>ignore parent</dt>
                    <dd>{selectedMemberDetail.member.propagation.effective.ignoreParent ? "yes" : "no"}</dd>
                    <dt>ignore children</dt>
                    <dd>{selectedMemberDetail.member.propagation.effective.ignoreChildren ? "yes" : "no"}</dd>
                    <dt>to parent</dt>
                    <dd>{selectedMemberDetail.member.propagation.effective.propagateToParent ? "yes" : "no"}</dd>
                    <dt>to children</dt>
                    <dd>{selectedMemberDetail.member.propagation.effective.propagateToChildren ? "yes" : "no"}</dd>
                  </dl>
                ) : (
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
                )}
              </article>

              {!selectedMemberDetail ? (
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
              ) : null}

              <MemberTable
                title="Properties"
                members={describeQuery.data.properties}
                selectedMemberUName={selectedMember?.kind === "property" ? selectedMember.uName : null}
                onSelect={selectProperty}
              />
              <MemberTable
                title="Events"
                members={describeQuery.data.events}
                selectedMemberUName={selectedMember?.kind === "event" ? selectedMember.uName : null}
                onSelect={selectEvent}
              />

              <MemberNameList
                title="Inherited properties"
                members={[
                  ...describeQuery.data.inheritance.properties.parent,
                  ...describeQuery.data.inheritance.properties.child
                ]}
                empty="No inherited properties are currently present."
                selectedMemberUName={selectedMember?.uName ?? null}
                onSelect={selectProperty}
              />

              <MemberNameList
                title="Inherited events"
                members={[
                  ...describeQuery.data.inheritance.events.parent,
                  ...describeQuery.data.inheritance.events.child
                ]}
                empty="No inherited events are currently present."
                selectedMemberUName={selectedMember?.uName ?? null}
                onSelect={selectEvent}
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
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
