#!/usr/bin/env node
// Stdio-to-HTTP bridge for the hosted Citlyze MCP server.
//
// Claude Desktop launches this as a local stdio MCP server; every JSON-RPC
// message is forwarded to the remote streamable-HTTP endpoint with the
// workspace API key, and the JSON response is written back to stdout.
// No dependencies: Node's built-in fetch only.

const ENDPOINT = process.env.CITLYZE_MCP_URL || "https://app.citlyze.com/api/mcp";
const API_KEY = process.env.CITLYZE_API_KEY;

// Without an API key the bridge still starts and serves discovery
// (initialize, tools/list) from the static catalog below, so clients can
// browse the tool set before configuring a key. Tool calls need the key.
const SERVER_INFO = { name: "citlyze", version: "1.0.0" };
const FALLBACK_PROTOCOL_VERSION = "2025-06-18";
const TOOL_CATALOG = [
  { name: "get_workspace_overview", description: "Workspace name, target brand, active prompt/location/engine counts, competitors, and the latest completed measurement window.", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "list_prompts", description: "List tracked prompts with text, intent, tier, and active state.", inputSchema: { type: "object", properties: { active: { type: "boolean" }, search: { type: "string" }, limit: { type: "number" } } }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "list_measurement_windows", description: "List measurement windows (tracking snapshots), newest first.", inputSchema: { type: "object", properties: { status: { type: "string" }, limit: { type: "number" } } }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "get_visibility_overview", description: "Headline AI visibility metrics per brand and engine for a measurement window.", inputSchema: { type: "object", properties: { measurement_window_id: { type: "string" }, brand_id: { type: "string" } } }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "get_prompt_visibility", description: "Per-engine and per-location visibility metrics for a single tracked prompt.", inputSchema: { type: "object", properties: { query_id: { type: "string" }, measurement_window_id: { type: "string" } }, required: ["query_id"] }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "list_citations", description: "Domains cited in AI answers, grouped with citation counts and sample URLs.", inputSchema: { type: "object", properties: { measurement_window_id: { type: "string" }, domain: { type: "string" }, limit: { type: "number" } } }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "list_recommendations", description: "AI visibility optimization recommendations, highest priority first.", inputSchema: { type: "object", properties: { status: { type: "string" }, category: { type: "string" }, limit: { type: "number" } } }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "list_competitor_visibility", description: "Compare AI visibility across the target brand and tracked competitors.", inputSchema: { type: "object", properties: { measurement_window_id: { type: "string" } } }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "list_crawler_events", description: "Daily AI crawler visits (GPTBot, ClaudeBot, PerplexityBot, Bingbot, and more) on tracked sites.", inputSchema: { type: "object", properties: { crawler_id: { type: "string" }, site_key_id: { type: "string" }, limit: { type: "number" } } }, annotations: { readOnlyHint: true, openWorldHint: false } },
];

let protocolVersion = null;

function localAnswer(message) {
  const { id, method } = message;
  if (method === "initialize") {
    protocolVersion = message.params?.protocolVersion || FALLBACK_PROTOCOL_VERSION;
    return { jsonrpc: "2.0", id, result: { protocolVersion, capabilities: { tools: {} }, serverInfo: SERVER_INFO } };
  }
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOL_CATALOG } };
  }
  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }
  if (id === undefined || id === null) return null; // notifications need no reply
  return errorResponse(id, -32000, "CITLYZE_API_KEY is not configured. Create a workspace API key at https://app.citlyze.com/workspace-settings and set it to use this tool.");
}

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
  if (!API_KEY) {
    const response = localAnswer(message);
    if (response) write(response);
    return;
  }
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
