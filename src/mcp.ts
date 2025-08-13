import { StreamableHTTPTransport } from '@hono/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { Hono } from 'hono'
import type { Env } from 'hono'
import { TariffSearchService } from './tariff-service.js'

export const getMcpServer = async (c: Context<Env>) => {
  const server = new McpServer({
    name: 'japan-tariff-mcp',
    version: '0.0.1',
    details: '',
  })

  const searchService = new TariffSearchService()

  server.tool(
    'searchTariffByKeywords',
    'Search tariff data by Japanese keywords (comma-separated, use Japanese keywords for best results)',
    { keywords: z.string().min(1) },
    async ({ keywords }) => {
      try {
        const { results, hitCount } =
          await searchService.searchTariffData(keywords)
        const limit = 30
        let msg = ''
        if (results.length > limit) {
          msg = `More than the maximum limit of ${limit} items were found. Please refer to hitCount and re-search if necessary.`
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  keywords,
                  found: results.length,
                  message: msg,
                  hitCount: hitCount,
                  results: results.slice(0, limit),
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `検索エラー: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            },
          ],
        }
      }
    }
  )

  server.tool(
    'searchNotes',
    'Search section and chapter notes by Japanese keyword (use Japanese keyword for best results)',
    { keyword: z.string().min(1) },
    async ({ keyword }) => {
      try {
        const results = await searchService.searchNotesData(keyword)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  keyword,
                  found: results.length,
                  results: results.slice(0, 10), // 最大10件まで返す
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `検索エラー: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            },
          ],
        }
      }
    }
  )

  server.tool(
    'searchByHSCode',
    'Search tariff data by HS codes (comma-separated)',
    { hs_codes: z.string().min(1) },
    async ({ hs_codes }) => {
      try {
        const results = await searchService.searchByHSCode(hs_codes)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  hs_codes,
                  found: results.length,
                  results,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `HSコード検索エラー: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            },
          ],
        }
      }
    }
  )

  server.tool(
    'getLawDetail',
    'Get detailed information of other laws by law code',
    { law_code: z.string().length(2) },
    async ({ law_code }) => {
      try {
        const lawDetails = await searchService.getLawDetails(law_code)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  law_code,
                  details: lawDetails,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `法令詳細取得エラー: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            },
          ],
        }
      }
    }
  )
  return server
}

const app = new Hono()

app.all('/', async (c) => {
  const mcpServer = await getMcpServer(c)
  const transport = new StreamableHTTPTransport()
  await mcpServer.connect(transport)
  return transport.handleRequest(c)
})

app.onError((err, c) => {
  console.log(err.message)

  if (err instanceof HTTPException && err.res) {
    return err.res
  }

  return c.json(
    {
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error',
      },
      id: null,
    },
    500
  )
})

export default app
