import re
from pathlib import Path
from collections import deque
import requests
from bs4 import BeautifulSoup, UnicodeDammit
import json
import time

BASE_DIR = Path(__file__).resolve().parent.parent


def extract_level(td) -> int:
    """style="padding-left:…em" から階層レベルを整数で返す"""
    m = re.search(r"padding-left\s*:\s*([\d.]+)\s*em", td.get("style", ""))

    ret = int(float(m.group(1))) if m else 0
    cnt = 0
    for c in td.text.strip():
        if c == "−":
            cnt += 1
        else:
            break

    return ret + cnt


def fetch_html(url: str) -> str:
    """文字化けしないように、複数候補で自動判定して UTF-8 文字列で返す"""
    r = requests.get(url, timeout=10)
    r.raise_for_status()

    # ❶ requests が推測した encoding を信用せず、自前で再判定
    #    （meta 要素や BOM も考慮してくれる）
    dammit = UnicodeDammit(
        r.content,
        ["utf-8", "shift_jisx0213", "shift_jis", "euc-jp", "iso2022_jp"],
        smart_quotes_to="html",
    )
    return dammit.unicode_markup


def row_to_node(row):
    # テーブルヘッド構造に基づく関税率のキー定義
    rate_keys = [
        "基本", "暫定", "WTO協定", "特恵", "特別特恵",  # 基本関税率（5つ）
        "EPA_シンガポール", "EPA_メキシコ", "EPA_マレーシア", "EPA_チリ", "EPA_タイ",
        "EPA_インドネシア", "EPA_ブルネイ", "EPA_アセアン", "EPA_フィリピン", "EPA_スイス",
        "EPA_ベトナム", "EPA_インド", "EPA_ペルー", "EPA_豪州", "EPA_モンゴル",
        "EPA_CPTPP", "EPA_欧州連合", "EPA_英国", "EPA_RCEP_アセアン豪州NZ", "EPA_RCEP_中国",
        "EPA_RCEP_韓国", "EPA_日米貿易協定"  # EPA関税率（22つ）
    ]

    # 関税率部分を辞書として構築（row[4]から始まり、単位とその他法令の手前まで）
    # テーブル構造：level, stat_code, hs_code, desc, 関税率27個, 単位I, 単位II, law
    rates = {}
    unit = {}
    rate_start_idx = 4
    f = False
    for i in range(rate_start_idx, len(row)):
        if row[i]:
            f = True
            break
    if f:
        for i, key in enumerate(rate_keys):
            if rate_start_idx + i < len(row) - 3:  # 単位I、単位II、lawを除く
                rates[key] = row[rate_start_idx + i].strip() if row[rate_start_idx + i] else ""

        # 単位情報（関税率の後、law の前の2つ）
        unit_i = row[-3] if len(row) >= 3 else ""
        unit_ii = row[-2] if len(row) >= 2 else ""
        unit = {"I": unit_i.strip() if unit_i else "",
                "II": unit_ii.strip() if unit_ii else ""}
    # 他法令の処理
    laws = []
    if row[-1]:
        tmp = ''
        for i, c in enumerate(row[-1]):
            tmp += c
            if i % 2 == 1:
                laws.append(tmp)
                tmp = ''

    return {
        "level": row[0],
        "stat_code": row[1],
        "hs_code": row[2],
        "desc": row[3],
        "rate": rates,
        "unit": unit,
        "law": laws,
        "children": []
    }


def build_forest(que):
    """森を構成する"""
    ret = deque()
    nodes = deque()
    for row in que:
        nodes.append(row_to_node(row))
    while nodes:
        # 後ろからとっていく
        node = nodes.pop()
        lvl = node["level"]
        # 親nodeにたどり着いたら結果に加える
        if lvl == 0:
            ret.appendleft(node)
            continue
        # 逆順に見ていき、自分のlevelより小さいのが親
        for j in reversed(range(len(nodes))):
            parent_level = nodes[j]["level"]
            if parent_level < lvl:
                # insertする
                nodes[j]["children"].insert(0, node)
                break

    return ret


def inherit_stat_codes(forest):
    """親のstat_codeを子ノードに引き継ぐ"""
    def propagate_stat_code(node, parent_stat_code=None):
        # 現在のノードのstat_codeが空で、親のstat_codeがある場合は引き継ぐ
        if not node["stat_code"] and parent_stat_code:
            node["stat_code"] = parent_stat_code
        
        # 子ノードに対して再帰的に処理
        current_stat_code = node["stat_code"] if node["stat_code"] else parent_stat_code
        for child in node.get("children", []):
            propagate_stat_code(child, current_stat_code)
    
    # 森の各ルートノードから開始
    for root in forest:
        propagate_stat_code(root)
    
    return forest


def create_index_entry(forest, chapter_num):
    """各類のインデックス情報を生成"""

    def count_items(nodes):
        count = 0
        for node in nodes:
            count += 1
            count += count_items(node.get("children", []))
        return count

    
    total_items = count_items(forest)

    return {
        "chapter": f"{chapter_num:02d}",
        "total_items": total_items,
        "file_name": f"j_{chapter_num:02d}_tariff_data.json"
    }


def create_master_index(all_indices):
    """全体のマスターインデックスを作成"""
    return {
        "created_at": "2025-06-17",
        "total_chapters": len(all_indices),
        "total_items": sum(idx["total_items"] for idx in all_indices),
        "chapters": all_indices
    }


def fetch_section_note(section_num):
    """部注を取得"""
    url = f"https://www.kanzei.or.jp/statistical/popcontent/note/tariff/hs1dig/j/{section_num:02d}"
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        soup = BeautifulSoup(r.content, "html.parser")
        return soup.text.strip()
    except:
        return ""


def fetch_chapter_note(chapter_num):
    """類注を取得"""
    url = f"https://www.kanzei.or.jp/statistical/popcontent/note/tariff/hs2dig/j/{chapter_num:02d}"
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        soup = BeautifulSoup(r.content, "html.parser")
        return soup.text.strip()
    except:
        return ""


def get_section_from_chapter(chapter_num):
    """類番号から部番号を取得"""
    section_mapping = {
        (1, 5): 1,   # 第1部: 動物及び動物性生産品
        (6, 14): 2,  # 第2部: 植物性生産品
        (15, 15): 3, # 第3部: 動物性、植物性又は微生物性の油脂等
        (16, 24): 4, # 第4部: 調製食料品、飲料、たばこ等
        (25, 27): 5, # 第5部: 鉱物性生産品
        (28, 38): 6, # 第6部: 化学工業の生産品
        (39, 40): 7, # 第7部: プラスチック及びゴム等
        (41, 43): 8, # 第8部: 皮革・毛皮・容器等
        (44, 46): 9, # 第9部: 木材・コルク・わら製品等
        (47, 49): 10, # 第10部: パルプ・紙・印刷物
        (50, 63): 11, # 第11部: 紡織用繊維及びその製品
        (64, 67): 12, # 第12部: 履物、帽子、傘、羽毛等
        (68, 70): 13, # 第13部: 石、陶磁、ガラス製品等
        (71, 71): 14, # 第14部: 真珠、貴石、貨幣等
        (72, 83): 15, # 第15部: 卑金属及びその製品
        (84, 85): 16, # 第16部: 機械・電気機器・映像音声機器等
        (86, 89): 17, # 第17部: 車両、航空機、船舶等
        (90, 92): 18, # 第18部: 精密機器、医療機器、楽器等
        (93, 93): 19, # 第19部: 武器等
        (94, 96): 20, # 第20部: 雑品
        (97, 97): 21, # 第21部: 美術品等
    }
    
    for (start, end), section in section_mapping.items():
        if start <= chapter_num <= end:
            return section
    return None


def job():
    base_url = "https://www.customs.go.jp/tariff/2025_04_01/data/"
    all_indices = []
    
    # データ保存用ディレクトリの作成
    data_dir = Path(BASE_DIR ,"src","tariffdata")
    data_dir.mkdir(exist_ok=True)
    
    for i in range(1, 98):
        if i == 77:
            # 欠番
            continue
        num = str(i).zfill(2)
        url = f"{base_url}j_{num}.htm"
        html = fetch_html(url)
        soup = BeautifulSoup(html, "html.parser")
        table = soup.find("table", id="datatable")
        que = deque()
        for tr in table.find_all("tr")[2:]:
            tds = tr.find_all("td")
            level = extract_level(tds[2])
            tmp = [level]
            for td in tds:
                tmp.append(td.text.strip())
            que.append(tmp)

        forest = build_forest(que)
        
        # stat_codeを親から子に引き継ぐ
        forest = inherit_stat_codes(forest)

        # JSONファイルに書き出し
        output_file = data_dir / f"j_{num}_tariff_data.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(list(forest), f, ensure_ascii=False, indent=2)

        # 部注・類注を取得
        section_num = get_section_from_chapter(i)
        section_note = fetch_section_note(section_num) if section_num else ""
        chapter_note = fetch_chapter_note(i)
        
        # インデックス情報を生成
        index_entry = create_index_entry(forest, i)
        index_entry["section_note"] = section_note
        index_entry["chapter_note"] = chapter_note
        all_indices.append(index_entry)

        print(f"データを {output_file} に保存しました")
        print(f"処理したアイテム数: {len(forest)}")
        time.sleep(0.5)
    # マスターインデックスを作成
    master_index = create_master_index(all_indices)
    index_file = data_dir / "index.json"
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(master_index, f, ensure_ascii=False, indent=2)

    print(f"\nインデックスファイルを {index_file} に保存しました")
    print(f"総計: {master_index['total_chapters']}類, {master_index['total_items']}アイテム")

if __name__ == "__main__":
    job()
