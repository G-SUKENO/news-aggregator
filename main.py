import feedparser
import json
import urllib.parse
import datetime

# ニュースデータを格納する最終的なリスト
ALL_NEWS_DATA = []

def fetch_google_news(search_query, company_id):
    # 日本語の検索クエリをURLエンコード
    encoded_query = urllib.parse.quote(search_query)
    # GoogleニュースRSSのURLを生成
    RSS_URL = f"https://news.google.com/rss/search?q={encoded_query}&hl=ja&gl=JP&ceid=JP:ja"
    
    print(f" -> RSS取得中 (クエリ: {search_query})")
    
    try:
        feed = feedparser.parse(RSS_URL)
        
        for entry in feed.entries:
            # 記事タイトルとリンクが存在するか確認
            if not entry.title or not entry.link:
                continue

            # published_parsed を使用して日時を取得
            published_time = entry.get('published_parsed')
            if published_time:
                # ----------------------------------------------------
                # ★ JST時刻変換：UTC時刻をJSTに変換 (9時間加算) ★
                # ----------------------------------------------------
                # feedparserは時刻をタプル形式で返し、これはUTCと見なされる
                dt_utc = datetime.datetime(*published_time[:6])
                # JST = UTC + 9時間
                dt_jst = dt_utc + datetime.timedelta(hours=9) 
                
                # タイムゾーン情報を含めないISOフォーマットで保存
                published_iso = dt_jst.isoformat()
            else:
                # 取得できない場合は現在時刻を仮設定
                published_iso = datetime.datetime.now().isoformat()
                
            ALL_NEWS_DATA.append({
                "company_id": company_id,
                "title": entry.title,
                "link": entry.link,
                "published": published_iso,
                "source": entry.source.get('title', 'Google News')
            })
    except Exception as e:
        # エラーが発生しても他の企業の取得は続ける
        print(f" 警告: Googleニュースの取得でエラーが発生しました: {e}")


def main():
    # 1. 企業リストの読み込み
    try:
        with open("companies.json", "r", encoding="utf-8") as f:
            COMPANIES = json.load(f)
    except FileNotFoundError:
        print("致命的エラー: companies.json が見つかりません。")
        return

    if not COMPANIES:
        print("エラー: companies.json に企業データがありません。処理をスキップします。")
        return

    # 2. 各企業ごとにニュースを取得
    for company in COMPANIES:
        print(f"--- 企業ニュース取得開始: {company['name']} ---")
        fetch_google_news(company["search_query"], company["id"])

    # 3. 記事を公開日時でソート（新しい順）
    ALL_NEWS_DATA.sort(key=lambda x: x.get('published', '1900-01-01'), reverse=True)
    
    # 4. データ重複の削除 (linkをキーとして重複を排除)
    unique_links = set()
    deduplicated_news = []
    
    for item in ALL_NEWS_DATA:
        # 重複するリンクを持つ記事でなければ追加
        if item['link'] not in unique_links:
            unique_links.add(item['link'])
            deduplicated_news.append(item)
            
    print(f" -> 全体で {len(ALL_NEWS_DATA) - len(deduplicated_news)} 件の重複記事を削除しました。")
    
    # 5. データをJSONファイルとして保存 (news.jsonを上書き)
    with open("news.json", "w", encoding="utf-8") as f:
        # 重複削除後のリストを保存
        json.dump(deduplicated_news, f, indent=4, ensure_ascii=False)

    print(f"\n✅ 最終的に {len(deduplicated_news)} 件のニュースを news.json に保存しました。")

if __name__ == "__main__":
    main()
