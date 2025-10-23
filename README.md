# Skald MCP Server 🧠

Chat with your Skald knowledge base, add and update new knowledge, and search through memos.

## Features

The Skald MCP server provides seven powerful tools:

### 1. **skald-chat**
Ask Skald questions about your knowledge base in natural language with optional filters to narrow search context.

### 2. **skald-search**
Search through your memos using multiple methods with optional filters:
- **Semantic search** (`chunk_vector_search`) - Find relevant content by meaning
- **Title contains** (`title_contains`) - Case-insensitive substring matching
- **Title starts with** (`title_startswith`) - Case-insensitive prefix matching

### 3. **skald-create-memo**
Create new memos that are automatically processed, summarized, tagged, chunked, and indexed for search.

### 4. **skald-get-memo**
Retrieve a memo by UUID or client reference ID with full content, summary, tags, and chunks.

### 5. **skald-update-memo**
Update an existing memo by UUID or client reference ID. If content is updated, the memo will be reprocessed.

### 6. **skald-delete-memo**
Permanently delete a memo by UUID or client reference ID along with all associated data.

### 7. **skald-generate**
Generate documents based on prompts and retrieved context from the knowledge base with optional style/format rules and filters.

## Setup

### Prerequisites

1. A Skald account with an API key. Get yours at [platform.useskald.com](https://platform.useskald.com/)
2. Node.js 18.0.0 or higher

### Installation

1. Clone this repository:

```bash
git clone https://github.com/skaldlabs/skald-mcp
cd skald-mcp
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

## Configuration

### Cursor

1. Open Cursor Settings (`cmd`+`shift`+`p` on macOS or `ctrl`+`shift`+`p` on Windows → "Cursor Settings")

2. Select "MCP" from the left sidebar and click "Add new global MCP server"

3. Add the following configuration:

```json
{
  "mcpServers": {
    "skald": {
      "type": "command",
      "command": "node ABSOLUTE_PATH_TO_PROJECT/build/index.js --key=YOUR_SKALD_API_KEY"
    }
  }
}
```

Replace:
- `ABSOLUTE_PATH_TO_PROJECT` with the full path to your `skald-mcp` directory
- `YOUR_SKALD_API_KEY` with your Skald API key

**Tip:** Right-click on `/build/index.js` in Cursor and select "Copy Path" to get the absolute path.

**Command-line arguments:**
- `--key`: Your Skald API key (required if not using environment variable)

### Claude Desktop

1. Open Claude Desktop settings and navigate to the "Developer" tab

2. Click "Edit Config"

3. Add the following configuration:

```json
{
  "mcpServers": {
    "skald": {
      "command": "node",
      "args": [
        "ABSOLUTE_PATH_TO_PROJECT/build/index.js"
      ],
      "env": {
        "SKALD_API_KEY": "YOUR_SKALD_API_KEY"
      }
    }
  }
}
```

Replace:
- `ABSOLUTE_PATH_TO_PROJECT` with the full path to your `skald-mcp` directory
- `YOUR_SKALD_API_KEY` with your Skald API key

**Environment variables:**
- `SKALD_API_KEY`: Your Skald API key (required)

4. Restart Claude Desktop

## Usage Examples

### Chat with your knowledge base

```
Ask Cursor/Claude: "Check Skald for what are the instructions for running our Django server locally."
```

The assistant will query your Skald knowledge base and return an answer.

### Search for memos


```
Ask Cursor/Claude: "Search Skald for the docs about our product vision"
```

The assistant will use the `skald-search` tool with semantic search to find relevant memos and display:
- Title
- UUID
- Summary
- Content snippet
- Relevance score (for semantic search)

If you had asked for "memos with Product Vision in the title", the agent would pick another search method such as `title_contains`.


### Create a new memo

```
Ask Cursor/Claude: "Generate an API reference for my endpoints and upload it to Skald"
```

The assistant will create a new memo in your Skald knowledge base, which will be automatically processed and made searchable.

## Tool Parameters

### skald-chat

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The question to ask your knowledge base |
| `project_id` | string | No | Project UUID (required when using Token Authentication) |
| `filters` | Filter[] | No | Optional filters to narrow the search context |

### skald-search

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The search query |
| `search_method` | enum | Yes | One of: `chunk_vector_search`, `title_contains`, `title_startswith` |
| `limit` | number | No | Maximum results to return (1-50, default 10) |
| `filters` | Filter[] | No | Optional filters to narrow results |

### skald-create-memo

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | The title of the memo (max 255 characters) |
| `content` | string | Yes | The full content of the memo |
| `project_id` | string | No | Project UUID (required when using Token Authentication) |
| `metadata` | object | No | Custom JSON metadata |
| `reference_id` | string | No | External reference ID to match with your documents |
| `tags` | string[] | No | Tags for categorization |
| `source` | string | No | Source of the content (useful for integrations) |

### skald-get-memo

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `memo_id` | string | Yes | The memo UUID or client reference ID |
| `id_type` | enum | No | Type of identifier: `memo_uuid` (default) or `reference_id` |

### skald-update-memo

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `memo_id` | string | Yes | The memo UUID or client reference ID |
| `id_type` | enum | No | Type of identifier: `memo_uuid` (default) or `reference_id` |
| `title` | string | No | New title for the memo |
| `content` | string | No | New content for the memo |
| `metadata` | object | No | New metadata |
| `client_reference_id` | string | No | New client reference ID |
| `source` | string | No | New source |
| `expiration_date` | string | No | New expiration date |

### skald-delete-memo

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `memo_id` | string | Yes | The memo UUID or client reference ID |
| `id_type` | enum | No | Type of identifier: `memo_uuid` (default) or `reference_id` |

### skald-generate

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | The prompt for document generation |
| `rules` | string | No | Optional style/format rules |
| `filters` | Filter[] | No | Optional filters to control which memos are used as context |

### Filter Object

Filters are used in `skald-chat`, `skald-search`, and `skald-generate` to narrow results:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `field` | string | Yes | The field to filter on |
| `operator` | enum | Yes | One of: `eq`, `neq`, `contains`, `startswith`, `endswith`, `in`, `not_in` |
| `value` | string or string[] | Yes | The value to filter by |
| `filter_type` | enum | Yes | `native_field` (e.g., source, tags) or `custom_metadata` |

**Example filter:**
```json
{
  "field": "source",
  "operator": "eq",
  "value": "notion",
  "filter_type": "native_field"
}
```

## Development

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Fix linting issues

```bash
npm run lint:fix
```

## Troubleshooting

### API Key Issues

If you get an error about a missing API key:
- For Cursor: Ensure the `--key` argument is set in your config
- For Claude Desktop: Ensure `SKALD_API_KEY` is set in the env section

### Module Not Found

If you see "Cannot find module '@skald-labs/skald-node'":
```bash
npm install
npm run build
```

### Connection Issues

Check the debug logs:
- Cursor: Check the MCP server logs in Cursor settings
- Claude Desktop: Check the logs in Claude Desktop developer settings


