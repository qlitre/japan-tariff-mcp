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
  })

  const searchService = new TariffSearchService()

  server.tool(
    'searchTariff',
    '関税データをキーワード(カンマ区切り可)で検索します',
    { keywords: z.string().min(1) },
    async ({ keywords }) => {
      try {
        const { results, hitCount } =
          await searchService.searchTariffData(keywords)
        let msg = ''
        if (results.length > 30) {
          msg =
            '最大件数の30より多くの情報がヒットしました。hitCountを参考にして必要に応じて再検索を実行してください。'
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
                  results: results.slice(0, 30),
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
    '部注・章注をキーワードで検索します',
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
    'HSコード(カンマ区切り可)から関税データを検索します',
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
    '法令コードから他法令の詳細情報を取得します',
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
