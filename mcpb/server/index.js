#!/usr/bin/env node
// Stdio-to-HTTP bridge for the hosted Citlyze MCP server.
//
// Claude Desktop launches this as a local stdio MCP server; every JSON-RPC
// message is forwarded to the remote streamable-HTTP endpoint with the
// workspace API key, and the JSON response is written back to stdout.
// No dependencies: Node's built-in fetch only.

const ENDPOINT = process.env.CITLYZE_MCP_URL || "https://app.citlyze.com/api/mcp";
const API_KEY = process.env.CITLYZE_API_KEY;

if (!API_KEY) {
  process.stderr.write("CITLYZE_API_KEY is not set. Configure your Citlyze API key in the extension settings.\n");
  process.exit(1);
}

let protocolVersion = null;

function write(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function errorResponse(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function forward(message) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json",
    authorization: `Bearer ${API_KEY}`,
  };
  if (protocolVersion) headers["mcp-protocol-version"] = protocolVersion;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
  });

  // Notifications are accepted with an empty body; nothing to relay.
  if (res.status === 202 || res.status === 204) return null;

  const text = await res.text();
  if (!text) return null;
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Unexpected response from Citlyze (HTTP ${res.status}).`);
  }
  // Auth/plan errors come back as plain JSON, not JSON-RPC.
  if (!res.ok && payload && payload.jsonrpc === undefined) {
    throw new Error(payload.error || `Citlyze request failed (HTTP ${res.status}).`);
  }
  return payload;
}

async function handle(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  const id = message.id;
  try {
    const response = await forward(message);
    if (response == null) return;
    if (message.method === "initialize" && response.result?.protocolVersion) {
      protocolVersion = response.result.protocolVersion;
    }
    write(response);
  } catch (error) {
    if (id !== undefined && id !== null) {
      write(errorResponse(id, -32000, error instanceof Error ? error.message : "Request failed."));
    } else {
      process.stderr.write(`citlyze-mcp: ${error instanceof Error ? error.message : error}\n`);
    }
  }
}

let buffer = "";
let pending = 0;
let stdinClosed = false;

function maybeExit() {
  if (stdinClosed && pending === 0) process.exit(0);
}

function track(promise) {
  pending += 1;
  void promise.finally(() => {
    pending -= 1;
    maybeExit();
  });
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (line) track(handle(line));
  }
});
process.stdin.on("end", () => {
  stdinClosed = true;
  maybeExit();
});
