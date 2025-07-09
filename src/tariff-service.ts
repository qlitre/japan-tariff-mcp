import { hrtime } from 'process'

export class TariffSearchService {
  /**章番号の配列を返す */
  getChapters() {
    const ret = []
    for (let i = 1; i < 98; i++) {
      if (i == 77) continue
      ret.push(String(i).padStart(2, '0'))
    }
    return ret
  }
  /** 関税データを検索する */
  async searchTariffData(keywords: string) {
    const results: any[] = []
    const hitCount: Record<string, number> = {}
    const keywordArray = keywords.split(',')
    for (const chapter of this.getChapters()) {
      try {
        // 各章のデータファイルを動的にインポート
        const chapterData = await import(
          `./tariffdata/j_${chapter}_tariff_data.json`
        )
        for (const keyword of keywordArray) {
          // 階層データを再帰的に検索
          this.searchItemsRecursively(
            chapterData.default || chapterData,
            keyword,
            results,
            hitCount
          )
        }
      } catch (error) {
        // ファイルが存在しない場合はスキップ
        continue
      }
    }
    return { results, hitCount }
  }

  /** 部注・章注を検索する */
  async searchNotesData(keyword: string) {
    const results: any[] = []

    try {
      // indexファイルから部注・章注データを取得
      const indexData = await import('./tariffdata/index.json')

      for (const chapter of indexData.chapters) {
        // 部注を検索
        if (
          chapter.section_note &&
          chapter.section_note.toLowerCase().includes(keyword.toLowerCase())
        ) {
          results.push({
            type: 'section_note',
            chapter: chapter.chapter,
            chapter_title: chapter.title,
            content: chapter.section_note,
          })
        }

        // 章注を検索
        if (
          chapter.chapter_note &&
          chapter.chapter_note.toLowerCase().includes(keyword.toLowerCase())
        ) {
          results.push({
            type: 'chapter_note',
            chapter: chapter.chapter,
            chapter_title: chapter.title,
            content: chapter.chapter_note,
          })
        }
      }
    } catch (error) {
      throw new Error(`部注・章注の検索中にエラーが発生しました: ${error}`)
    }
    return results
  }

  /** HSコードから関税データを検索する */
  async searchByHSCode(hsCodes: string) {
    const results: any[] = []
    const hsCodesArray = hsCodes.split(',')
    for (const chapter of this.getChapters()) {
      try {
        // 各章のデータファイルを動的にインポート
        const chapterData = await import(
          `./tariffdata/j_${chapter}_tariff_data.json`
        )
        for (const hsCode of hsCodesArray) {
          // HSコードで検索
          this.searchHSCodeRecursively(
            chapterData.default || chapterData,
            hsCode,
            results,
            chapter
          )
        }
      } catch (error) {
        // ファイルが存在しない場合はスキップ
        continue
      }
    }
    return results
  }

  /** HSコードを再帰的に検索 */
  private searchHSCodeRecursively(
    items: any[],
    hsCode: string,
    results: any[],
    chapterInfo: any
  ) {
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
          level: item.level,
        })
      }

      // 子要素がある場合は再帰的に検索
      if (item.children && item.children.length > 0) {
        this.searchHSCodeRecursively(
          item.children,
          hsCode,
          results,
          chapterInfo
        )
      }
    }
  }

  /** 階層データを再帰的に検索 */
  private searchItemsRecursively(
    items: any[],
    keyword: string,
    results: any[],
    hitCount: Record<string, number>
  ) {
    for (const item of items) {
      // 説明文にキーワードが含まれているかチェック
      if (
        item.desc &&
        item.desc.toLowerCase().includes(keyword.toLowerCase())
      ) {
        if (!hitCount[keyword]) hitCount[keyword] = 0
        hitCount[keyword]++
        results.push({
          stat_code: item.stat_code,
          hs_code: item.hs_code,
          desc: item.desc,
          rate: item.rate,
          unit: item.unit,
          law: item.law,
          level: item.level,
        })
      }

      // 子要素がある場合は再帰的に検索
      if (item.children && item.children.length > 0) {
        this.searchItemsRecursively(item.children, keyword, results, hitCount)
      }
    }
  }

  /** 法令コードから法令詳細を取得 */
  async getLawDetails(lawCodes: string) {
    try {
      // import_law_table.jsonから法令情報を取得
      const lawTable = await import('./tariffdata/import_law_table.json')
      const lawData = (lawTable.default || lawTable) as Record<string, any>
      const lawDetails: any[] = []

      // 複数の法令コードがカンマ区切りで入っている場合を想定
      const codes = lawCodes.split(',').map((code) => code.trim())

      for (const code of codes) {
        if (lawData[code]) {
          lawDetails.push({
            法令コード: code,
            ...lawData[code],
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
