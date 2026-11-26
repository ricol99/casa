# Cloudflare Tunnel service

`cloudflaretunnelservice` manages an existing Cloudflare Tunnel connector on the
Casa Pi. It starts on cold/hot start, retries an exited connector after a delay,
and stops it during Casa shutdown. All service methods and event callbacks are
prototype methods. No changes to the MCP service or hardware control are needed.

The optional npm dependency is pinned to `cloudflared` 0.7.3. Its published
CommonJS wrapper was tested on Node 16.9.0 using a local test connector, including
actual child-process startup, connection events, graceful shutdown and spawn
failure. This is not a live Cloudflare or Raspberry Pi integration test. The
wrapper installer supports Linux `arm` and `arm64`; the configured executable
must already work on the target Pi.

## Installation and configuration

Use the existing executable via an explicit `binaryPath`. The service does not
download or update it. Standard npm installation of the wrapper runs its own
binary download script, even though this service uses the configured executable.
On a Pi whose Casa dependencies are already installed, the wrapper can be
installed without that script using:

```sh
npm install --ignore-scripts --no-save cloudflared@0.7.3
```

Run this from Casa's `src` directory. Do not use `--ignore-scripts` as a general
replacement for a fresh Casa installation: other dependencies need build scripts.

Add a service entry using the normal Casa service configuration mechanism. For a
remotely managed tunnel, a minimal illustrative entry is:

```json
{
   "type": "cloudflaretunnelservice",
   "name": "cloudflaretunnelservice-public",
   "binaryPath": "/usr/local/bin/cloudflared",
   "token": "YOUR_TUNNEL_TOKEN"
}
```

`token` is the token for an existing remotely managed tunnel. Supply it directly
in the Casa service configuration; no token file, credential JSON or cloudflared
YAML file is required. The hostname and origin routing remain configured on that
Cloudflare tunnel (for example, the Pi's local MCP HTTP address).

`binaryPath` locates your existing executable; it is not a configuration file.
No user-managed configuration or credential file paths are accepted.
The service passes the token as a separate `--token` argument, without a shell.
Treat the Casa configuration as sensitive: the token is stored there and can also
be visible to local users who can inspect process arguments. Status and service
logs omit it; the service does not redact general configuration-file exports.

For an existing **locally managed** tunnel, omit `token` and provide
`credentials` and `ingress` directly instead:

```json
{
   "name": "cloudflare",
   "type": "cloudflaretunnelservice",
   "enabled": false,
   "binaryPath": "/usr/bin/cloudflared",
   "credentials": {
      "AccountTag": "YOUR_ACCOUNT_TAG",
      "TunnelID": "12345678-1234-4123-8123-123456789abc",
      "TunnelSecret": "YOUR_EXISTING_TUNNEL_SECRET"
   },
   "ingress": [
      {
         "hostname": "casa.example.com",
         "service": "http://localhost:8047"
      },
      { "service": "http_status:404" }
   ]
}
```

Preserve the original credential object and ordered ingress rules, including any
`originRequest` settings. The final ingress rule must be a catch-all. Local
credentials and remote tokens are mutually exclusive. The example is disabled
until ownership is handed over from the existing connector.

Cloudflared requires a file to read multiple ingress rules. Casa generates its
own temporary JSON/YAML configuration from these parameters, in a private 0700
directory with a 0600 file. It embeds `credentials-contents` there, keeping the
local secret out of command-line arguments. The file is removed after process
closure, startup failure or normal Casa process exit. SIGKILL or power loss can
leave a private temporary file behind. No separate file is maintained by the
operator. Casa's source configuration still contains the secret, so general
configuration exports and backups must be treated as sensitive.

Optional settings:

| Setting | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Start the connector with Casa |
| `restartDelay` | `10000` | Milliseconds before retrying; minimum 1000 |
| `stopTimeout` | `5000` | Milliseconds before force-killing a connector that does not stop |

Stop/disable the independently managed connector when handing ownership to Casa;
this service does not adopt or stop an existing external process. Keep the
existing public hostname, ingress routes and MCP authentication. The tunnel does
not configure access policies or provide MCP authorization. Local controls
continue when the connector cannot start or loses connectivity.

## Lifecycle and status

`start()`, `stop()` and `getStatus()` are service methods. No additional console
commands or MCP tools are introduced in this change. Status includes `enabled`,
`status`, `connections` and a sanitized `lastError`; credential contents and raw
connector output are not included. `connected` reflects connector events parsed
by the npm wrapper, not an end-to-end authenticated MCP health check. The wrapper
parses human-readable logs, so connection reporting should be checked against the
actual connector version during deployment.

The connector handles network reconnection itself. Casa restarts it after process
closure and cancels pending retries during shutdown. Casa's immediate process-exit
paths force-kill any remaining managed child; normal shutdown first requests a
graceful stop. Forced termination of Casa with SIGKILL cannot run cleanup hooks.

## Verification

With the optional npm dependency installed:

```sh
npm run test:cloudflare-tunnel
```

The tests never start a real tunnel or access hardware. Before replacing the
existing Pi service, verify its executable path and token or local credentials, then check
authenticated public MCP access, reconnect after a network interruption, and
Casa restart/shutdown on that Pi.
