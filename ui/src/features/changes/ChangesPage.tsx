import { FormEvent, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { consoleApiClient } from "../../lib/consoleApiClient";
import { useUiSessionStore } from "../../store/uiSessionStore";
import type { PreviewConfigProgressMessage, PreviewResult } from "../../types/consoleApi";

const EXAMPLE_PATCH = JSON.stringify(
  {
    changes: [
      {
        action: "upsert",
        sourceUName: ":test-1-bedroom",
        scope: "casa",
        patch: {
          priority: 10,
          type: "bedroom"
        }
      }
    ]
  },
  null,
  2
);

export function ChangesPage() {
  const scopeMode = useUiSessionStore((s) => s.scopeMode);
  const selectedCasa = useUiSessionStore((s) => s.selectedCasa);
  const previewOptions = useUiSessionStore((s) => s.previewOptions);
  const setPreviewOptions = useUiSessionStore((s) => s.setPreviewOptions);

  const [patchText, setPatchText] = useState(EXAMPLE_PATCH);
  const [parseError, setParseError] = useState<string | null>(null);
  const [latestProgress, setLatestProgress] = useState<PreviewConfigProgressMessage | null>(null);

  useEffect(() => {
    return consoleApiClient.onOutput((payload) => {
      const output = payload as { result?: PreviewConfigProgressMessage };

      if (output?.result?.type === "previewConfigProgress") {
        setLatestProgress(output.result);
      }
    });
  }, []);

  const previewMutation = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      setLatestProgress(null);

      return consoleApiClient.previewConfig(
        {
          scopeMode,
          selectedCasa
        },
        {
          patch,
          includeUsage: previewOptions.includeUsage,
          progress: previewOptions.progress,
          summaryOnly: previewOptions.summaryOnly,
          topChanged: previewOptions.topChanged,
          limit: previewOptions.limit
        }
      );
    }
  });

  const result = previewMutation.data as PreviewResult | undefined;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setParseError(null);

    try {
      const patch = JSON.parse(patchText) as Record<string, unknown>;
      previewMutation.mutate(patch);
    } catch (error) {
      setParseError((error as Error).message);
    }
  };

  return (
    <section className="card">
      <div className="card-header split">
        <h2>Config preview</h2>
        <div className="chip-row">
          <span className="chip">scope: {scopeMode}</span>
          <span className="chip">target casa: {selectedCasa}</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="changes-grid">
        <div className="panel">
          <h3>Patch JSON</h3>
          <textarea
            value={patchText}
            onChange={(event) => setPatchText(event.target.value)}
            className="patch-textarea"
            spellCheck={false}
          />
          {parseError && <p className="error">Parse error: {parseError}</p>}
          <button type="submit" disabled={previewMutation.isPending}>
            {previewMutation.isPending ? "Previewing..." : "Run preview"}
          </button>
        </div>

        <div className="panel">
          <h3>Options</h3>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={previewOptions.includeUsage}
              onChange={(event) => setPreviewOptions({ includeUsage: event.target.checked })}
            />
            include usage
          </label>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={previewOptions.progress}
              onChange={(event) => setPreviewOptions({ progress: event.target.checked })}
            />
            stream progress
          </label>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={previewOptions.summaryOnly}
              onChange={(event) => setPreviewOptions({ summaryOnly: event.target.checked })}
            />
            summary only
          </label>
          <label>
            top changed
            <input
              type="number"
              min={0}
              value={previewOptions.topChanged}
              onChange={(event) => setPreviewOptions({ topChanged: Number(event.target.value) })}
            />
          </label>
          <label>
            limit
            <input
              type="number"
              min={0}
              value={previewOptions.limit}
              onChange={(event) => setPreviewOptions({ limit: Number(event.target.value) })}
            />
          </label>
        </div>
      </form>

      <div className="panel">
        <h3>Progress</h3>
        {latestProgress ? (
          <>
            <p className="meta">
              {latestProgress.progress.event} {latestProgress.progress.processed}/{latestProgress.progress.total} ({latestProgress.progress.percent}%)
            </p>
            <div className="progress-track">
              <div
                className="progress-bar"
                style={{ width: `${Math.max(0, Math.min(100, latestProgress.progress.percent))}%` }}
              />
            </div>
          </>
        ) : (
          <p className="meta">No active progress events.</p>
        )}
      </div>

      {previewMutation.isError && <p className="error">{(previewMutation.error as Error).message}</p>}

      {result && (
        <div className="panel">
          <h3>Preview summary</h3>
          <div className="chip-row">
            <span className="chip">impacted: {result.summary.impactedSourceCount}</span>
            <span className="chip">changed: {result.summary.changedSourceCount}</span>
            <span className="chip">owner changes: {result.summary.changedActiveOwnerCount}</span>
            <span className="chip">added: {result.summary.addedSourceCount}</span>
            <span className="chip">removed: {result.summary.removedSourceCount}</span>
          </div>

          {result.output && (
            <p className="meta">
              output mode: {result.output.mode}, returned {result.output.impactedReturnedCount}/{result.output.impactedTotalCount}
            </p>
          )}

          {result.warnings.length > 0 && (
            <div className="warning-box">
              {result.warnings.map((warning, index) => (
                <p key={`${warning}-${index}`}>{warning}</p>
              ))}
            </div>
          )}

          {result.impactedSources.length > 0 && (
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>source</th>
                  <th>changed</th>
                  <th>before owner</th>
                  <th>after owner</th>
                  <th>added instances</th>
                  <th>removed instances</th>
                </tr>
              </thead>
              <tbody>
                {result.impactedSources.map((item) => (
                  <tr key={item.sourceUName}>
                    <td>{item.sourceUName}</td>
                    <td>{item.delta.changed ? "yes" : "no"}</td>
                    <td>{item.before.resolve.activeOwnerCasa ?? "-"}</td>
                    <td>{item.after.resolve.activeOwnerCasa ?? "-"}</td>
                    <td>{item.delta.addedInstances.length}</td>
                    <td>{item.delta.removedInstances.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
