var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var dnssd = require("dnssd");
var cacheByGang = new Map();
function getOrCreateCache(gangName) {
    var key = gangName.trim();
    var existing = cacheByGang.get(key);
    if (existing) {
        return existing;
    }
    var created = {
        browser: null,
        started: false,
        timeoutMs: 0,
        byName: new Map(),
        errors: []
    };
    cacheByGang.set(key, created);
    return created;
}
function normaliseHost(rawHost) {
    var parts = String(rawHost || "").split(" ");
    var primary = parts.length > 1 ? "".concat(parts[0], ".local") : parts[0];
    return primary || String(rawHost || "");
}
function readGangFromTxt(service) {
    if (!service || !service.txt) {
        return "";
    }
    var rawGang = service.txt.gang;
    if (typeof rawGang === "string") {
        return rawGang.trim();
    }
    if (Buffer.isBuffer(rawGang)) {
        return rawGang.toString("utf8").trim();
    }
    return String(rawGang || "").trim();
}
function gangMatches(service, gangName) {
    var discoveredGang = readGangFromTxt(service);
    if (!discoveredGang || !gangName) {
        return false;
    }
    return discoveredGang.toLowerCase() === gangName.trim().toLowerCase();
}
function ensureStarted(gangName, timeoutMs) {
    var cache = getOrCreateCache(gangName);
    if (cache.started) {
        return cache;
    }
    var browser = new dnssd.Browser(dnssd.tcp("casa"));
    browser.on("serviceUp", function (service) {
        if (!service || !service.txt || !service.name || !service.host || !service.port) {
            cache.errors.push("Malformed serviceUp advert: ".concat(JSON.stringify(service || {})));
            return;
        }
        if (!gangMatches(service, gangName)) {
            return;
        }
        var now = Date.now();
        var current = cache.byName.get(service.name);
        cache.byName.set(service.name, {
            name: service.name,
            host: normaliseHost(service.host),
            port: service.port,
            tier: 1,
            messageTransportName: "http",
            status: "up",
            previousStatus: current ? current.status : "down",
            gang: readGangFromTxt(service),
            lastSeenAt: now
        });
    });
    browser.on("serviceDown", function (service) {
        if (!service || !service.name) {
            cache.errors.push("Malformed serviceDown advert: ".concat(JSON.stringify(service || {})));
            return;
        }
        var current = cache.byName.get(service.name);
        if (!current) {
            return;
        }
        cache.byName.set(service.name, __assign(__assign({}, current), { status: "down", previousStatus: current.status, lastSeenAt: Date.now() }));
    });
    browser.on("error", function (error) {
        var message = error instanceof Error ? error.message : String(error);
        cache.errors.push("mDNS browser error: ".concat(message));
    });
    cache.browser = browser;
    cache.started = true;
    cache.timeoutMs = timeoutMs;
    browser.start();
    return cache;
}
function listCasas(cache) {
    return Array.from(cache.byName.values())
        .sort(function (a, b) { return a.name.localeCompare(b.name); })
        .map(function (item) { return (__assign({}, item)); });
}
export function discoverCasasByGangName(gangName_1) {
    return __awaiter(this, arguments, void 0, function (gangName, timeoutMs) {
        var gang, cache, allCasas, casas, errors;
        if (timeoutMs === void 0) { timeoutMs = 1200; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    gang = String(gangName || "").trim();
                    if (!gang) {
                        throw new Error("gangName is required");
                    }
                    cache = ensureStarted(gang, timeoutMs);
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, Math.max(0, timeoutMs)); })];
                case 1:
                    _a.sent();
                    allCasas = listCasas(cache);
                    casas = allCasas.filter(function (item) { return item.status === "up"; });
                    errors = cache.errors.slice(Math.max(0, cache.errors.length - 20));
                    return [2 /*return*/, {
                            gangName: gang,
                            count: casas.length,
                            casas: casas,
                            seenCount: allCasas.length,
                            errorCount: errors.length,
                            errors: errors
                        }];
            }
        });
    });
}
export function stopAllDiscovery() {
    cacheByGang.forEach(function (entry) {
        if (entry.browser) {
            try {
                entry.browser.stop();
            }
            catch (_a) {
                // ignore stop errors
            }
        }
    });
    cacheByGang.clear();
}
