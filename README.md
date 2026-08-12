# Citlyze MCP

Connect AI assistants to [Citlyze](https://www.citlyze.com), the AI search visibility platform. Ask questions like "how visible is my brand in AI answers this month?" or "which domains get cited for my tracked prompts?" and get answers straight from your workspace data.

The Citlyze MCP server is a hosted, read-only endpoint:

```text
https://app.citlyze.com/api/mcp
```

It speaks streamable HTTP and authenticates with a workspace API key sent as a bearer token. Create a key at [app.citlyze.com/workspace-settings](https://app.citlyze.com/workspace-settings) (requires a plan with API access).

## Tools

| Tool | What it returns |
| --- | --- |
| `get_workspace_overview` | Workspace name, target brand, active prompt/location/engine counts, competitors, latest completed measurement window |
| `list_prompts` | Tracked prompts with text, intent, tier, and active state |
| `list_measurement_windows` | Tracking snapshots, newest first |
| `get_visibility_overview` | Headline AI visibility metrics per brand and engine |
| `get_prompt_visibility` | Per-engine and per-location metrics for one prompt |
| `list_citations` | Domains cited in AI answers, with counts and sample URLs |
| `list_recommendations` | Optimization recommendations, highest priority first |
| `list_competitor_visibility` | Your brand versus tracked competitors |
| `list_crawler_events` | Daily AI crawler visits (GPTBot, ClaudeBot, PerplexityBot, and more) |

Every tool is read-only. Nothing in your workspace can be modified through MCP.

## Gemini CLI extension

This repository is a [Gemini CLI extension](https://geminicli.com/docs/extensions/). Install it with:

```bash
gemini extensions install https://github.com/citlyze/citlyze-mcp
```

Then export your API key before starting Gemini CLI:

```bash
export CITLYZE_API_KEY="aeo_live_..."
```

If your Gemini CLI version does not expand environment variables in extension headers, run `gemini extensions edit citlyze` and replace `${CITLYZE_API_KEY}` with your key.

## Other MCP clients

Setup guides for Claude Code, Claude Desktop, Cursor, Codex, Windsurf, JetBrains, and more are in the [Citlyze MCP docs](https://www.citlyze.com/docs/mcp/overview). The short version for any streamable-HTTP client:

```json
{
  "url": "https://app.citlyze.com/api/mcp",
  "headers": {
    "Authorization": "Bearer aeo_live_..."
  }
}
```

For clients that only support stdio servers, bridge with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "command": "npx",
  "args": [
    "-y",
    "mcp-remote",
    "https://app.citlyze.com/api/mcp",
    "--header",
    "Authorization: Bearer aeo_live_..."
  ]
}
```

## Agent skills

Ready-made skills that use these MCP tools (visibility reports, citation gap analysis, prompt audits, action plans) plus a standalone AEO page audit live in [Citlyze/citlyze-skills](https://github.com/citlyze/citlyze-skills). They follow the open SKILL.md standard, so they work in Claude Code, Codex, Cursor, Gemini CLI, and any compatible agent.

## Support and privacy

- Documentation: https://www.citlyze.com/docs/mcp/overview
- Troubleshooting: https://www.citlyze.com/docs/mcp/troubleshooting
- Privacy policy: https://www.citlyze.com/privacy-policy
- Terms: https://www.citlyze.com/terms-of-service

The MCP server only reads data from the workspace tied to your API key. Requests are rate limited per key.
