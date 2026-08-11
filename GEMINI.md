# Citlyze

Citlyze tracks how brands show up in AI search: ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews, and more. This extension connects Gemini CLI to the workspace behind the API key in `CITLYZE_API_KEY`.

All tools are read-only. Typical flow:

1. `get_workspace_overview` to learn the workspace, target brand, and latest completed measurement window.
2. Drill in with `get_visibility_overview`, `get_prompt_visibility`, `list_citations`, or `list_competitor_visibility`. When a tool takes `measurement_window_id` and none is given, it defaults to the latest completed window.
3. `list_recommendations` returns optimization actions ranked by priority. `list_crawler_events` shows daily AI crawler visits (GPTBot, ClaudeBot, PerplexityBot, and others) to the workspace's tracked sites.

Notes:

- Results are capped at 100 rows per call; use filters (`status`, `active`, `domain`, `crawler_id`) rather than paging.
- Visibility scores, mention rates, and citation rates are percentages computed per measurement window; compare across windows to describe trends.
- If a call fails with an authentication error, ask the user to check `CITLYZE_API_KEY`. Keys are created at https://app.citlyze.com/workspace-settings and require a plan with API access.
