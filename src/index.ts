import { Hono } from 'hono'
import { McpAgent } from 'agents/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

/** Cloudflare Workers の環境変数が無ければ空で定義 */
export interface Env {}  // ← DB 等が無い場合は空オブジェクトで十分

export class MyMCP extends McpAgent<Env> {
  /** MCP メタデータ */
  server = new McpServer({
    name: 'echo application',
    version: '0.0.1',
  })

  /** MCP ツールの登録 */
  async init() {
    this.server.tool(
      'searchTariff',
      '関税データをキーワードで検索します',
      { keyword: z.string() },               
      async ({ keyword }) => {
        try {
          const results = await this.searchTariffData(keyword)
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({
                keyword,
                found: results.length,
                results: results.slice(0, 10) // 最大10件まで返す
              }, null, 2)
            }],
          }
        } catch (error) {
          return {
            content: [{ 
              type: 'text', 
              text: `検索エラー: ${error instanceof Error ? error.message : 'Unknown error'}`
            }],
          }
        }
      },
    )
  }

  /** 関税データを検索する */
  private async searchTariffData(keyword: string) {
    const results: any[] = []
    
    // indexファイルから章リストを取得
    const indexData = await import('./tariffdata/index.json')
    
    for (const chapter of indexData.chapters) {
      try {
        // 各章のデータファイルを動的にインポート
        const chapterData = await import(`./tariffdata/j_${chapter.chapter.padStart(2, '0')}_tariff_data.json`)
        
        // 階層データを再帰的に検索
        this.searchItemsRecursively(chapterData.default || chapterData, keyword, results)
      } catch (error) {
        // ファイルが存在しない場合はスキップ
        continue
      }
    }
    
    return results
  }

  /** 階層データを再帰的に検索 */
  private searchItemsRecursively(items: any[], keyword: string, results: any[]) {
    for (const item of items) {
      // 説明文にキーワードが含まれているかチェック
      if (item.desc && item.desc.toLowerCase().includes(keyword.toLowerCase())) {
        results.push({
          stat_code: item.stat_code,
          hs_code: item.hs_code,
          desc: item.desc,
          rate: item.rate,
          level: item.level
        })
      }
      
      // 子要素がある場合は再帰的に検索
      if (item.children && item.children.length > 0) {
        this.searchItemsRecursively(item.children, keyword, results)
      }
    }
  }
}

const app = new Hono()

// /mcp エンドポイントに MCP をマウント
app.mount('/mcp', MyMCP.serve('/mcp').fetch, { replaceRequest: false })

export default app