interface TariffItem {
  level: number
  stat_code: string
  hs_code: string
  desc: string
  rate: Record<string, any>
  unit: Record<string, any>
  law: string[]
  children?: TariffItem[]
}

interface TariffSearchResult {
  stat_code: string
  hs_code: string
  desc: string
  rate: Record<string, any>
  unit: Record<string, any>
  law: string[]
  level: number
  chapter?: string
  chapter_title?: string
}

interface NoteSearchResult {
  type: 'section_note' | 'chapter_note'
  chapter: string
  content: string
}

interface LawDetailResult {
  法令コード: string
  [key: string]: any
}

export class TariffSearchService {
  /**章番号の配列を返す */
  getChapters() {
    const ret = []
    for (let i = 1; i < 98; i++) {
      // 欠番
      if (i == 77) continue
      ret.push(String(i).padStart(2, '0'))
    }
    return ret
  }
  /** 関税データを検索する */
  async searchTariffData(keywords: string) {
    const results: TariffSearchResult[] = []
    const hitCount: Record<string, number> = {}
    const keywordArray = keywords
      .split(',')
      .map((w) => w.trim().toLocaleLowerCase())
    for (const chapter of this.getChapters()) {
      try {
        // 各章のデータファイルを動的にインポート
        const chapterData = await import(
          `./tariffdata/j_${chapter}_tariff_data.json`
        )
        // 階層データを再帰的に検索
        this.searchItemsRecursively(
          chapterData,
          keywordArray,
          results,
          hitCount
        )
      } catch (error) {
        // ファイルが存在しない場合はスキップ
        continue
      }
    }
    return { results, hitCount }
  }

  /** 階層データを再帰的に検索 */
  private searchItemsRecursively(
    items: TariffItem[],
    keywordsArray: string[],
    results: TariffSearchResult[],
    hitCount: Record<string, number>
  ) {
    for (const item of items) {
      let f = false
      for (const keyword of keywordsArray) {
        if (item.desc.toLowerCase().includes(keyword)) {
          f = true
          if (!hitCount[keyword]) hitCount[keyword] = 0
          hitCount[keyword]++
        }
      }
      if (f) {
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
        this.searchItemsRecursively(
          item.children,
          keywordsArray,
          results,
          hitCount
        )
      }
    }
  }

  /** 部注・章注を検索する */
  async searchNotesData(keyword: string) {
    const results: NoteSearchResult[] = []

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
    const results: TariffSearchResult[] = []
    const hsCodesArray = hsCodes
      .split(',')
      .map((h) => h.trim().toLocaleLowerCase())
    for (const chapter of this.getChapters()) {
      try {
        // 各章のデータファイルを動的にインポート
        const chapterData = await import(
          `./tariffdata/j_${chapter}_tariff_data.json`
        )
        // HSコードで検索
        this.searchHSCodeRecursively(chapterData, hsCodesArray, results)
      } catch (error) {
        // ファイルが存在しない場合はスキップ
        continue
      }
    }
    return results
  }

  /** HSコードを再帰的に検索 */
  private searchHSCodeRecursively(
    items: TariffItem[],
    hsCodesArray: string[],
    results: TariffSearchResult[]
  ) {
    for (const item of items) {
      let f = false
      for (const hsCode of hsCodesArray) {
        // HSコードが一致するかチェック（部分一致も含む）
        const hsCodeFull = item.stat_code + '.' + item.hs_code
        if (hsCodeFull.startsWith(hsCode)) f = true
      }
      if (f) {
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
        this.searchHSCodeRecursively(item.children, hsCodesArray, results)
      }
    }
  }

  /** 法令コードから法令詳細を取得 */
  async getLawDetails(lawCodes: string) {
    try {
      // import_law_table.jsonから法令情報を取得
      const lawTable = await import('./tariffdata/import_law_table.json')
      const lawData = (lawTable.default || lawTable) as Record<string, any>
      const lawDetails: LawDetailResult[] = []

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
