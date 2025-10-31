import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Skald } from '@skald-labs/skald-node';
import minimist from 'minimist';
import { z } from 'zod';

// Parse command line arguments
const args = minimist(process.argv.slice(2));
const apiKey = args.key || process.env.SKALD_API_KEY;

if (!apiKey) {
  console.error(
    'Error: SKALD_API_KEY environment variable or --key argument is required',
  );
  process.exit(1);
}

// Initialize Skald client
const skald = new Skald(apiKey);

// Create server instance
const server = new McpServer({
  name: 'skald-mcp',
  version: '0.1.0',
});

// Reusable filter schema for tools that support filtering
const filterSchema = z
  .array(
    z.object({
      field: z.string().describe('The field to filter on'),
      operator: z
        .enum([
          'eq',
          'neq',
          'contains',
          'startswith',
          'endswith',
          'in',
          'not_in',
        ])
        .describe('The filter operator'),
      value: z
        .union([z.string(), z.array(z.string())])
        .describe('The value to filter by'),
      filter_type: z
        .enum(['native_field', 'custom_metadata'])
        .describe(
          'Filter type: native_field (e.g., source, tags) or custom_metadata',
        ),
    }),
  )
  .optional();

// Tool 1: Chat - Ask questions to your knowledge base
server.tool(
  'skald-chat',
  'Ask a question to your Skald knowledge base and get an AI-generated response with inline citations. Supports optional filters to narrow search context',
  {
    query: z.string().describe('The question to ask your knowledge base'),
    project_id: z
      .string()
      .optional()
      .describe('Project UUID (required when using Token Authentication)'),
    filters: filterSchema.describe(
      'Optional filters to narrow the search context',
    ),
  },
  async (args) => {
    console.error('Debug - Asking Skald chat:', args.query);

    try {
      const chatParams: any = { query: args.query };
      if (args.project_id) {
        chatParams.project_id = args.project_id;
      }
      if (args.filters) {
        chatParams.filters = args.filters;
      }

      const response = await skald.chat(chatParams);

      return {
        content: [
          {
            type: 'text',
            text: response || 'No response received',
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to get response from Skald chat: ${errorMessage}`,
      );
    }
  },
);

// Tool 2: Search - Search through memos
server.tool(
  'skald-search',
  'Search through your Skald memos using semantic search on memo chunks with optional filters',
  {
    query: z.string().describe('The search query'),
    search_method: z
      .enum(['chunk_semantic_search'])
      .describe(
        'Search method: chunk_semantic_search (semantic search on memo chunks)',
      ),
    limit: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe('Maximum number of results to return (1-50, default 10)'),
    filters: filterSchema.describe('Optional filters to narrow results'),
  },
  async (args) => {
    console.error('Debug - Searching Skald memos:', args.query);

    try {
      const searchParams: any = {
        query: args.query,
        search_method: args.search_method as 'chunk_semantic_search',
        limit: args.limit,
      };
      if (args.filters) {
        searchParams.filters = args.filters;
      }

      const response = await skald.search(searchParams);

      // Format results for display
      const resultText =
        response.results.length > 0
          ? response.results
              .map((result: any, idx: number) => {
                const parts = [
                  `${idx + 1}. ${result.title}`,
                  `   UUID: ${result.uuid}`,
                  `   Summary: ${result.summary}`,
                  `   Snippet: ${result.content_snippet}`,
                ];

                if (result.distance !== null) {
                  parts.push(
                    `   Distance: ${result.distance.toFixed(4)} (lower is more relevant)`,
                  );
                }

                return parts.join('\n');
              })
              .join('\n\n')
          : 'No results found';

      return {
        content: [
          {
            type: 'text',
            text: `Found ${response.results.length} result(s):\n\n${resultText}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to search Skald memos: ${errorMessage}`);
    }
  },
);

// Tool 3: Create Memo - Create a new memo
server.tool(
  'skald-create-memo',
  'Create a new memo in Skald that will be automatically processed (summarized, tagged, chunked, and indexed for search)',
  {
    title: z
      .string()
      .max(255)
      .describe('The title of the memo (max 255 characters)'),
    content: z.string().describe('The full content of the memo'),
    project_id: z
      .string()
      .optional()
      .describe('Project UUID (required when using Token Authentication)'),
    metadata: z.record(z.any()).optional().describe('Custom JSON metadata'),
    reference_id: z
      .string()
      .max(255)
      .optional()
      .describe(
        'External reference ID to match Skald memo UUIDs with your documents',
      ),
    tags: z.array(z.string()).optional().describe('Tags for categorization'),
    source: z
      .string()
      .max(255)
      .optional()
      .describe('Source of the content (useful for integrations)'),
  },
  async (args) => {
    console.error('Debug - Creating Skald memo:', args.title);

    try {
      const memoData: any = {
        title: args.title,
        content: args.content,
      };

      // Add optional fields if provided
      if (args.project_id) memoData.project_id = args.project_id;
      if (args.metadata) memoData.metadata = args.metadata;
      if (args.reference_id) memoData.reference_id = args.reference_id;
      if (args.tags) memoData.tags = args.tags;
      if (args.source) memoData.source = args.source;

      const response = await skald.createMemo(memoData);

      return {
        content: [
          {
            type: 'text',
            text: response.ok
              ? `✓ Memo "${args.title}" created successfully!`
              : 'Failed to create memo',
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create Skald memo: ${errorMessage}`);
    }
  },
);

// Tool 4: Get Memo - Retrieve a memo by UUID or reference ID
server.tool(
  'skald-get-memo',
  'Retrieve a memo by UUID or client reference ID with full content, summary, tags, and chunks',
  {
    memo_id: z.string().describe('The memo UUID or client reference ID'),
    id_type: z
      .enum(['memo_uuid', 'reference_id'])
      .optional()
      .default('memo_uuid')
      .describe(
        'Type of identifier: memo_uuid (default) or reference_id',
      ),
  },
  async (args) => {
    console.error('Debug - Getting Skald memo:', args.memo_id);

    try {
      const memo = await skald.getMemo(args.memo_id, args.id_type);

      const tagsText = memo.tags.map((t) => t.tag).join(', ');
      const chunksText = memo.chunks
        .map((c) => `Chunk ${c.chunk_index}: ${c.chunk_content.substring(0, 100)}...`)
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: [
              `Memo: ${memo.title}`,
              `UUID: ${memo.uuid}`,
              `Created: ${memo.created_at}`,
              `Updated: ${memo.updated_at}`,
              `Summary: ${memo.summary}`,
              `Content: ${memo.content}`,
              `Tags: ${tagsText || 'None'}`,
              `Client Reference ID: ${memo.client_reference_id || 'None'}`,
              `Source: ${memo.source || 'None'}`,
              `Type: ${memo.type}`,
              `Chunks: ${memo.chunks.length}`,
              chunksText ? `\n${chunksText}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get Skald memo: ${errorMessage}`);
    }
  },
);

// Tool 5: Update Memo - Update an existing memo
server.tool(
  'skald-update-memo',
  'Update an existing memo by UUID or client reference ID. If content is updated, the memo will be reprocessed',
  {
    memo_id: z.string().describe('The memo UUID or client reference ID'),
    id_type: z
      .enum(['memo_uuid', 'reference_id'])
      .optional()
      .default('memo_uuid')
      .describe(
        'Type of identifier: memo_uuid (default) or reference_id',
      ),
    title: z
      .string()
      .max(255)
      .optional()
      .describe('New title for the memo'),
    content: z.string().optional().describe('New content for the memo'),
    metadata: z.record(z.any()).optional().describe('New metadata'),
    client_reference_id: z
      .string()
      .max(255)
      .optional()
      .describe('New client reference ID'),
    source: z.string().max(255).optional().describe('New source'),
    expiration_date: z.string().optional().describe('New expiration date'),
  },
  async (args) => {
    console.error('Debug - Updating Skald memo:', args.memo_id);

    try {
      const updateData: any = {};

      // Only add fields that were provided
      if (args.title !== undefined) updateData.title = args.title;
      if (args.content !== undefined) updateData.content = args.content;
      if (args.metadata !== undefined) updateData.metadata = args.metadata;
      if (args.client_reference_id !== undefined)
        updateData.client_reference_id = args.client_reference_id;
      if (args.source !== undefined) updateData.source = args.source;
      if (args.expiration_date !== undefined)
        updateData.expiration_date = args.expiration_date;

      const response = await skald.updateMemo(
        args.memo_id,
        updateData,
        args.id_type,
      );

      return {
        content: [
          {
            type: 'text',
            text: response.ok
              ? `✓ Memo "${args.memo_id}" updated successfully!`
              : 'Failed to update memo',
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to update Skald memo: ${errorMessage}`);
    }
  },
);

// Tool 6: Delete Memo - Delete a memo
server.tool(
  'skald-delete-memo',
  'Permanently delete a memo by UUID or client reference ID. This deletes the memo and all associated data (content, summary, tags, chunks)',
  {
    memo_id: z.string().describe('The memo UUID or client reference ID'),
    id_type: z
      .enum(['memo_uuid', 'reference_id'])
      .optional()
      .default('memo_uuid')
      .describe(
        'Type of identifier: memo_uuid (default) or reference_id',
      ),
  },
  async (args) => {
    console.error('Debug - Deleting Skald memo:', args.memo_id);

    try {
      await skald.deleteMemo(args.memo_id, args.id_type);

      return {
        content: [
          {
            type: 'text',
            text: `✓ Memo "${args.memo_id}" deleted successfully!`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to delete Skald memo: ${errorMessage}`);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Skald MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
