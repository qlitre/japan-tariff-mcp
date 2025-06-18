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

    this.server.tool(
      'searchNotes',
      '部注・章注をキーワードで検索します',
      { keyword: z.string() },
      async ({ keyword }) => {
        try {
          const results = await this.searchNotesData(keyword)
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

    this.server.tool(
      'searchByHSCode',
      'HSコードから関税データを検索します',
      { hs_code: z.string() },
      async ({ hs_code }) => {
        try {
          const results = await this.searchByHSCode(hs_code)
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({
                hs_code,
                found: results.length,
                results
              }, null, 2)
            }],
          }
        } catch (error) {
          return {
            content: [{ 
              type: 'text', 
              text: `HSコード検索エラー: ${error instanceof Error ? error.message : 'Unknown error'}`
            }],
          }
        }
      },
    )

    this.server.tool(
      'compareTaxRates',
      '商品名から各協定の税率を比較します',
      { keyword: z.string() },
      async ({ keyword }) => {
        try {
          const results = await this.compareTaxRates(keyword)
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({
                keyword,
                found: results.length,
                results: results.slice(0, 5) // 最大5件まで返す
              }, null, 2)
            }],
          }
        } catch (error) {
          return {
            content: [{ 
              type: 'text', 
              text: `税率比較エラー: ${error instanceof Error ? error.message : 'Unknown error'}`
            }],
          }
        }
      },
    )

    this.server.tool(
      'getLawDetail',
      '法令コードから他法令の詳細情報を取得します',
      { law_code: z.string() },
      async ({ law_code }) => {
        try {
          const lawDetails = await this.getLawDetails(law_code)
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({
                law_code,
                details: lawDetails
              }, null, 2)
            }],
          }
        } catch (error) {
          return {
            content: [{ 
              type: 'text', 
              text: `法令詳細取得エラー: ${error instanceof Error ? error.message : 'Unknown error'}`
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

  /** 部注・章注を検索する */
  private async searchNotesData(keyword: string) {
    const results: any[] = []
    
    try {
      // indexファイルから部注・章注データを取得
      const indexData = await import('./tariffdata/index.json')
      
      for (const chapter of indexData.chapters) {
        // 部注を検索
        if (chapter.section_note && chapter.section_note.toLowerCase().includes(keyword.toLowerCase())) {
          results.push({
            type: 'section_note',
            chapter: chapter.chapter,
            chapter_title: chapter.title,
            content: chapter.section_note
          })
        }
        
        // 章注を検索
        if (chapter.chapter_note && chapter.chapter_note.toLowerCase().includes(keyword.toLowerCase())) {
          results.push({
            type: 'chapter_note',
            chapter: chapter.chapter,
            chapter_title: chapter.title,
            content: chapter.chapter_note
          })
        }
      }
    } catch (error) {
      throw new Error(`部注・章注の検索中にエラーが発生しました: ${error}`)
    }
    
    return results
  }

  /** HSコードから関税データを検索する */
  private async searchByHSCode(hsCode: string) {
    const results: any[] = []
    
    // indexファイルから章リストを取得
    const indexData = await import('./tariffdata/index.json')
    
    for (const chapter of indexData.chapters) {
      try {
        // 各章のデータファイルを動的にインポート
        const chapterData = await import(`./tariffdata/j_${chapter.chapter.padStart(2, '0')}_tariff_data.json`)
        
        // HSコードで検索
        this.searchHSCodeRecursively(chapterData.default || chapterData, hsCode, results, chapter)
      } catch (error) {
        // ファイルが存在しない場合はスキップ
        continue
      }
    }
    
    return results
  }

  /** 税率を比較する */
  private async compareTaxRates(keyword: string) {
    const results: any[] = []
    
    // indexファイルから章リストを取得
    const indexData = await import('./tariffdata/index.json')
    
    for (const chapter of indexData.chapters) {
      try {
        // 各章のデータファイルを動的にインポート
        const chapterData = await import(`./tariffdata/j_${chapter.chapter.padStart(2, '0')}_tariff_data.json`)
        
        // キーワードで検索し、税率情報を比較用に整理
        this.searchForTaxComparison(chapterData.default || chapterData, keyword, results)
      } catch (error) {
        // ファイルが存在しない場合はスキップ
        continue
      }
    }
    
    return results
  }

  /** HSコードを再帰的に検索 */
  private searchHSCodeRecursively(items: any[], hsCode: string, results: any[], chapterInfo: any) {
    for (const item of items) {
      // HSコードが一致するかチェック（部分一致も含む）
      if (item.hs_code && item.hs_code.includes(hsCode)) {
        results.push({
          chapter: chapterInfo.chapter,
          chapter_title: chapterInfo.title,
          stat_code: item.stat_code,
          hs_code: item.hs_code,
          desc: item.desc,
          rate: item.rate,
          unit: item.unit,
          law: item.law,
          level: item.level
        })
      }
      
      // 子要素がある場合は再帰的に検索
      if (item.children && item.children.length > 0) {
        this.searchHSCodeRecursively(item.children, hsCode, results, chapterInfo)
      }
    }
  }

  /** 税率比較用の検索 */
  private searchForTaxComparison(items: any[], keyword: string, results: any[]) {
    for (const item of items) {
      // 説明文にキーワードが含まれ、かつ税率データがある場合
      if (item.desc && item.desc.toLowerCase().includes(keyword.toLowerCase()) && 
          item.rate && Object.keys(item.rate).length > 0) {
        
        // 主要な税率を抽出して比較しやすい形に整理
        const taxRates: any = {}
        
        // 基本税率
        if (item.rate['基本']) taxRates['基本'] = item.rate['基本']
        if (item.rate['暫定']) taxRates['暫定'] = item.rate['暫定']
        if (item.rate['WTO協定']) taxRates['WTO協定'] = item.rate['WTO協定']
        
        // EPA税率（主要なもの）
        const majorEPAs = ['EPA_CPTPP', 'EPA_RCEP_アセアン豪州NZ', 'EPA_RCEP_中国', 'EPA_RCEP_韓国', 'EPA_欧州連合', 'EPA_英国']
        majorEPAs.forEach(epa => {
          if (item.rate[epa]) taxRates[epa] = item.rate[epa]
        })
        
        // 特恵税率
        if (item.rate['特恵']) taxRates['特恵'] = item.rate['特恵']
        if (item.rate['特別特恵']) taxRates['特別特恵'] = item.rate['特別特恵']
        
        results.push({
          stat_code: item.stat_code,
          hs_code: item.hs_code,
          desc: item.desc,
          tax_rates: taxRates,
          unit: item.unit,
          level: item.level
        })
      }
      
      // 子要素がある場合は再帰的に検索
      if (item.children && item.children.length > 0) {
        this.searchForTaxComparison(item.children, keyword, results)
      }
    }
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
          unit: item.unit,
          law: item.law,
          level: item.level
        })
      }
      
      // 子要素がある場合は再帰的に検索
      if (item.children && item.children.length > 0) {
        this.searchItemsRecursively(item.children, keyword, results)
      }
    }
  }

  /** 法令コードから法令詳細を取得 */
  private async getLawDetails(lawCodes: string) {
    try {
      // import_law_table.jsonから法令情報を取得
      const lawTable = await import('./tariffdata/import_law_table.json')
      const lawData = (lawTable.default || lawTable) as Record<string, any>
      const lawDetails: any[] = []
      
      // 複数の法令コードがカンマ区切りで入っている場合を想定
      const codes = lawCodes.split(',').map(code => code.trim())
      
      for (const code of codes) {
        if (lawData[code]) {
          lawDetails.push({
            法令コード: code,
            ...lawData[code]
          })
        }
      }
      
      return lawDetails.length > 0 ? lawDetails : null
    } catch (error) {
      // エラーが発生した場合はnullを返す
      return null
    }
  }
}

const app = new Hono()

// /mcp エンドポイントに MCP をマウント
app.mount('/mcp', MyMCP.serve('/mcp').fetch, { replaceRequest: false })

export default app