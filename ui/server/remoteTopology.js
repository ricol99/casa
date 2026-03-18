var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { createRequire } from "node:module";
var require = createRequire(import.meta.url);
var io = require("socket.io-client");
function asNumber(value, fallback) {
    if (fallback === void 0) { fallback = 0; }
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function normaliseTransport(target) {
    return target.messageTransportName === "https" ? "https" : "http";
}
function queryCasaTopology(target, timeoutMs) {
    return new Promise(function (resolve) {
        var transport = normaliseTransport(target);
        var url = "".concat(transport, "://").concat(target.host, ":").concat(target.port);
        var socket = io("".concat(url, "/consoleapi/io"), {
            transports: ["websocket"],
            reconnection: false,
            forceNew: true
        });
        var done = false;
        var finish = function (result) {
            if (done) {
                return;
            }
            done = true;
            try {
                socket.disconnect();
            }
            catch (_a) {
                // ignore disconnect errors
            }
            clearTimeout(timer);
            resolve(result);
        };
        var timer = setTimeout(function () {
            finish({
                casaName: target.name,
                ok: false,
                sourceTotal: 0,
                sourceActive: 0,
                localBowed: 0,
                peerBowed: 0,
                totalBowed: 0,
                connectedPeerCount: 0,
                peerCount: 0,
                error: "Topology request timed out"
            });
        }, Math.max(500, timeoutMs));
        socket.on("connect_error", function (error) {
            var message = error instanceof Error ? error.message : String(error);
            finish({
                casaName: target.name,
                ok: false,
                sourceTotal: 0,
                sourceActive: 0,
                localBowed: 0,
                peerBowed: 0,
                totalBowed: 0,
                connectedPeerCount: 0,
                peerCount: 0,
                error: "connect_error: ".concat(message)
            });
        });
        socket.on("error", function (error) {
            var message = error instanceof Error ? error.message : String(error);
            finish({
                casaName: target.name,
                ok: false,
                sourceTotal: 0,
                sourceActive: 0,
                localBowed: 0,
                peerBowed: 0,
                totalBowed: 0,
                connectedPeerCount: 0,
                peerCount: 0,
                error: "socket_error: ".concat(message)
            });
        });
        socket.on("connect", function () {
            socket.once("execute-output", function (payload) {
                var _a, _b, _c;
                var result = payload ? payload.result : null;
                if (!result || typeof result === "string") {
                    finish({
                        casaName: target.name,
                        ok: false,
                        sourceTotal: 0,
                        sourceActive: 0,
                        localBowed: 0,
                        peerBowed: 0,
                        totalBowed: 0,
                        connectedPeerCount: 0,
                        peerCount: 0,
                        error: typeof result === "string" ? result : "Malformed topology result"
                    });
                    return;
                }
                var sourceTotal = asNumber((_a = result === null || result === void 0 ? void 0 : result.localSourceCounts) === null || _a === void 0 ? void 0 : _a.total, 0);
                var sourceActive = asNumber((_b = result === null || result === void 0 ? void 0 : result.localSourceCounts) === null || _b === void 0 ? void 0 : _b.active, 0);
                var localBowed = asNumber(result.localBowed, asNumber((_c = result === null || result === void 0 ? void 0 : result.localSourceCounts) === null || _c === void 0 ? void 0 : _c.bowed, 0));
                var peerBowed = asNumber(result.peerBowed, 0);
                var totalBowed = asNumber(result.totalBowed, localBowed + peerBowed);
                var connectedPeerCount = asNumber(result.connectedPeerCount, 0);
                var peerCount = asNumber(result.peerCount, 0);
                finish({
                    casaName: target.name,
                    ok: true,
                    sourceTotal: sourceTotal,
                    sourceActive: sourceActive,
                    localBowed: localBowed,
                    peerBowed: peerBowed,
                    totalBowed: totalBowed,
                    connectedPeerCount: connectedPeerCount,
                    peerCount: peerCount
                });
            });
            socket.emit("executeCommand", {
                obj: ":",
                method: "topology",
                arguments: []
            });
        });
    });
}
export function fetchRemoteTopologies(targets, timeoutMs) {
    return __awaiter(this, void 0, void 0, function () {
        var safeTargets, results;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    safeTargets = (targets || []).filter(function (target) {
                        return !!(target && target.name && target.host && Number.isFinite(target.port));
                    });
                    return [4 /*yield*/, Promise.all(safeTargets.map(function (target) { return queryCasaTopology(target, timeoutMs); }))];
                case 1:
                    results = _a.sent();
                    results.sort(function (a, b) { return a.casaName.localeCompare(b.casaName); });
                    return [2 /*return*/, results];
            }
        });
    });
}
