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

// Tool 1: Chat - Ask questions to your knowledge base
server.tool(
  'skald-chat',
  'Ask a question to your Skald knowledge base and get an AI-generated response with inline citations',
  {
    query: z.string().describe('The question to ask your knowledge base'),
    project_id: z
      .string()
      .optional()
      .describe('Project UUID (required when using Token Authentication)'),
  },
  async (args) => {
    console.error('Debug - Asking Skald chat:', args.query);

    try {
      const chatParams: any = { query: args.query };
      if (args.project_id) {
        chatParams.project_id = args.project_id;
      }

      const response = await skald.chat(chatParams);

      return {
        content: [
          {
            type: 'text',
            text: response.response || 'No response received',
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
  'Search through your Skald memos using various search methods (semantic search, title contains, title starts with)',
  {
    query: z.string().describe('The search query'),
    search_method: z
      .enum(['chunk_vector_search', 'title_contains', 'title_startswith'])
      .describe(
        'Search method: chunk_vector_search (semantic search), title_contains (substring match), or title_startswith (prefix match)',
      ),
    limit: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe('Maximum number of results to return (1-50, default 10)'),
    tags: z.array(z.string()).optional().describe('Filter results by tags'),
  },
  async (args) => {
    console.error('Debug - Searching Skald memos:', args.query);

    try {
      const searchParams: any = {
        query: args.query,
        search_method: args.search_method as
          | 'chunk_vector_search'
          | 'title_contains'
          | 'title_startswith',
        limit: args.limit,
      };
      if (args.tags) {
        searchParams.tags = args.tags;
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Skald MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
