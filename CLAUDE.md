# CLAUDE.md
日本語で返してください。
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
日本の関税率をキーワードから返すプロジェクトです。
This is a Cloudflare Workers application that implements an MCP (Model Context Protocol) server using Hono framework. The application provides tariff data search functionality through MCP tools.

### Architecture

- **Framework**: Hono.js for HTTP routing
- **Runtime**: Cloudflare Workers with Durable Objects
- **MCP Integration**: Uses `@modelcontextprotocol/sdk` and `agents/mcp` for MCP server functionality
- **Data**: Tariff data stored as JSON files in `src/tariffdata/` (96 chapters, 15,450+ items)
- **Type Safety**: TypeScript with strict configuration

### Key Components

- `src/index.ts`: Main application entry point with MyMCP class extending McpAgent
- `src/tariffdata/`: Contains tariff data JSON files (j_01 through j_97)
- `wrangler.jsonc`: Cloudflare Workers configuration with Durable Objects setup

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Deploy to Cloudflare Workers
npm run deploy

# Generate Cloudflare types
npm run cf-typegen
```

## MCP Implementation Details

The application exposes MCP tools at the `/mcp` endpoint. The `MyMCP` class:
- Extends `McpAgent<Env>` 
- Registers tools in the `init()` method
- Currently implements `searchTariff` tool with keyword parameter
- Uses Zod for parameter validation

## Cloudflare Workers Configuration

- Uses Durable Objects with `MyMCP` class
- SQLite classes migration configured for free tier
- Node.js compatibility enabled
- Observability enabled

## Data Structure

Tariff data is organized in chapters (01-97) with structured JSON containing:
- Chapter metadata and titles
- Category information with HS codes
- Item counts and descriptions
- Total of 15,450+ tariff items across 96 chapters