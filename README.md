# Japan Tariff MCP

日本の関税率をキーワードから検索できるMCP (Model Context Protocol) サーバーです。

## 概要

このプロジェクトは、日本の関税データを検索する機能を提供するCloudflare Workersアプリケーションです。MCPプロトコルを使用して、AI エージェントが関税情報にアクセスできるようになります。

## 関税タリフとは？

関税タリフ（Tariff）は、各国が輸入品に課税する際の税率表です。日本の関税タリフには以下の特徴があります：

### 主要な構成要素

- **HSコード（Harmonized System Code）**: 世界共通の商品分類コード（6桁）
- **統計品目コード**: 日本独自の詳細分類（9桁）
- **基本税率**: WTO協定税率とも呼ばれる標準税率
- **暫定税率**: 期間限定で適用される優遇税率
- **EPA税率**: 経済連携協定による優遇税率

### 税率の種類

1. **基本税率・暫定税率**
   - 最恵国待遇の原則に基づく標準的な税率
   - 暫定税率が設定されている場合は、より低い税率が適用

2. **EPA税率**
   - CPTPP（環太平洋パートナーシップ協定）
   - RCEP（地域的な包括的経済連携）
   - 二国間EPA（欧州連合、英国、韓国など）

3. **特恵税率**
   - 発展途上国向けの一般特恵関税制度（GSP）
   - 後発開発途上国向けの特別特恵関税制度

### 章構成

関税タリフは96章で構成され、商品の性質や用途により分類されています：

- 第01-05章: 動物・動物性生産品
- 第06-14章: 植物性生産品
- 第15章: 動植物性油脂
- 第16-24章: 食料品・飲料・タバコ
- 第25-27章: 鉱物性生産品
- 第28-38章: 化学工業生産品
- 第39-40章: プラスチック・ゴム
- 第41-43章: 革・毛皮
- 第44-49章: 木材・紙製品
- 第50-63章: 繊維製品
- 第64-67章: 履物・帽子
- 第68-71章: 石・貴金属
- 第72-83章: 金属
- 第84-85章: 機械・電子機器
- 第86-89章: 輸送機器
- 第90-97章: 精密機器・美術品等

## 機能

- **関税データ検索**: キーワードで関税データを検索
- **部注・章注検索**: 部注・章注をキーワードで検索  
- **HSコード検索**: HSコードから関税データを検索
- **税率比較**: 商品名から各協定の税率を比較
- **法令詳細取得**: 法令コードから他法令の詳細情報を取得

## 技術スタック

- **フレームワーク**: Hono.js
- **ランタイム**: Cloudflare Workers
- **MCP統合**: `@modelcontextprotocol/sdk` と `@hono/mcp`
- **型安全性**: TypeScript
- **コードフォーマット**: Prettier

## データ構造

関税データは96章、15,450件以上のアイテムで構成されています：

- 章のメタデータとタイトル
- HSコードを含むカテゴリ情報
- アイテム数と説明
- 各種協定税率（EPA、RCEP、WTO等）

## 開発

### 前提条件

- Node.js
- npm または yarn
- Cloudflareアカウント

### セットアップ

1. **プロジェクトのクローン**

```bash
git clone https://github.com/qlitre/japan-tariff-mcp
cd japan-tariff-mcp
```

2. **依存関係のインストール**

```bash
npm install
```

3. **Wrangler設定ファイルの作成**

```bash
# テンプレートファイルをコピー
cp wrangler.jsonc.template wrangler.jsonc

# 必要に応じてwrangler.jsoncの設定を編集
# - プロジェクト名
# - アカウントID
# - その他の設定
```

4. **開発サーバーの起動**

```bash
npm run dev
```

5. **コードフォーマット**

```bash
# フォーマット実行
npm run format

# フォーマットチェック
npm run format:check
```


## MCP エンドポイント

アプリケーションは `/mcp` エンドポイントでMCPツールを公開します。

### 利用可能なツール

1. **searchTariff** - 関税データをキーワードで検索
2. **searchNotes** - 部注・章注をキーワードで検索
3. **searchByHSCode** - HSコードから関税データを検索
4. **compareTaxRates** - 商品名から各協定の税率を比較
5. **getLawDetail** - 法令コードから他法令の詳細情報を取得

## デプロイ

Cloudflare Workersにデプロイするには：

```bash
npm run deploy
```

## Claude Desktop での使用方法

このMCPサーバーをClaude Desktopで使用するには、以下の手順で設定してください。

### 1. サーバーのデプロイ

まず、Cloudflare Workersにサーバーをデプロイします：

```bash
npm run deploy
```

### 2. Claude Desktop設定ファイルの編集

Claude Desktopの設定ファイル `claude_desktop_config.json` を編集します：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tariff-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "https://{your-app-name}.{your-account-name}.workers.dev/mcp"
      ],
      "env": {}
    }
  }
}
```

または、ローカル開発時は：

```json
{
  "mcpServers": {
    "tariff-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "http://localhost:8787/mcp"
      ],
      "env": {}
    }
  }
}
```

### 3. Claude Desktopの再起動

設定ファイルを保存後、Claude Desktopを再起動してください。

### 4. 使用例

Claude Desktopで以下のように質問できます：

- 「コーヒーの関税率を教えて」
- 「HSコード0901の詳細を調べて」

## 設定ファイル

### wrangler.jsonc

プロジェクトには `wrangler.jsonc.template` が含まれています。初回セットアップ時に：

```bash
cp wrangler.jsonc.template wrangler.jsonc
```

を実行してテンプレートから設定ファイルを作成してください。必要に応じて以下の項目を編集：

- `name`: アプリケーション名（Claude Desktop設定で使用するURL）
- アカウント関連の設定
- その他のCloudflare Workers固有の設定

## ライセンス

このプロジェクトは[MITライセンス](LICENSE)の下で公開されています。

## 貢献

プロジェクトへの貢献を歓迎します。プルリクエストやイシューの報告をお気軽にどうぞ。