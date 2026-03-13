import type { Plugin } from "vite";
import { discoverCasasByGangName, stopAllDiscovery } from "./casaDiscovery";
import { fetchRemoteTopologies } from "./remoteTopology";

function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf8");
    });

    req.on("end", () => {
      if (!data || data.trim().length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function sendJson(res: any, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export function discoveryPlugin(): Plugin {
  return {
    name: "casa-discovery-plugin",
    configureServer(server) {
      server.middlewares.use("/api/discovery/casas", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        try {
          const body = await parseJsonBody(req);
          const gangName = body && typeof body.gangName === "string" ? body.gangName : "";
          const timeoutMs =
            body && typeof body.timeoutMs === "number" && Number.isFinite(body.timeoutMs)
              ? body.timeoutMs
              : 1200;

          const result = await discoverCasasByGangName(gangName, timeoutMs);
          sendJson(res, 200, result);
        } catch (error) {
          sendJson(res, 400, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      server.middlewares.use("/api/topology/remote", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        try {
          const body = await parseJsonBody(req);
          const timeoutMs =
            body && typeof body.timeoutMs === "number" && Number.isFinite(body.timeoutMs)
              ? body.timeoutMs
              : 2000;
          const targets = body && Array.isArray(body.targets) ? body.targets : [];
          const results = await fetchRemoteTopologies(targets, timeoutMs);

          sendJson(res, 200, {
            count: results.length,
            results
          });
        } catch (error) {
          sendJson(res, 400, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });
    },
    closeBundle() {
      stopAllDiscovery();
    }
  };
}
