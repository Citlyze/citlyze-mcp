# Runs the stdio bridge to the hosted Citlyze MCP server.
# Without CITLYZE_API_KEY the bridge serves discovery (initialize, tools/list)
# from a static catalog; tool calls require a workspace API key from
# https://app.citlyze.com/workspace-settings
FROM node:22-alpine
WORKDIR /app
COPY mcpb/server ./server
CMD ["node", "server/index.js"]
