import feedparser
import json
import urllib.parse
import datetime

# ニュースデータを格納する最終的なリスト
ALL_NEWS_DATA = []

def fetch_google_news(search_query, company_id):
    # 日本語の検索クエリをURLエンコード
    # 例: "トヨタ自動車 OR TOYOTA" -> "%E3%83%88%E3%83%A8%E3%82%BF%E8%87%AA%E5%8B%95%E8%BB%8A%20OR%20TOYOTA"
    encoded_query = urllib.parse.quote(search_query)
    # GoogleニュースRSSのURLを生成
    RSS_URL = f"https://news.google.com/rss/search?q={encoded_query}&hl=ja&gl=JP&ceid=JP:ja"
    
    print(f"  -> RSS取得中 (クエリ: {search_query})")
    
    try:
        feed = feedparser.parse(RSS_URL)
        
        for entry in feed.entries:
            # 記事タイトルとリンクが存在するか確認
            if not entry.title or not entry.link:
                continue

            # published_parsedが存在しない場合があるため、published_parsedを使用
            published_time = entry.get('published_parsed')
            if published_time:
                 # Pythonのdatetimeオブジェクトに変換
                published_iso = datetime.datetime(*published_time[:6]).isoformat() + 'Z'
            else:
                # 取得できない場合は現在時刻を仮設定 (滅多にないケース)
                published_iso = datetime.datetime.now().isoformat() + 'Z'
                
            ALL_NEWS_DATA.append({
                "company_id": company_id,
                "title": entry.title,
                "link": entry.link,
                "published": published_iso,
                "source": entry.source.get('title', 'Google News')
            })
    except Exception as e:
        # エラーが発生しても他の企業の取得は続ける
        print(f"  警告: Googleニュースの取得でエラーが発生しました: {e}")


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
    # 日付文字列でソートすれば新しい順になる
    ALL_NEWS_DATA.sort(key=lambda x: x.get('published', '1900-01-01'), reverse=True)
    
    # 4. データをJSONファイルとして保存 (news.jsonを上書き)
    with open("news.json", "w", encoding="utf-8") as f:
        json.dump(ALL_NEWS_DATA, f, indent=4, ensure_ascii=False)

    print(f"\n✅ 全企業合計で {len(ALL_NEWS_DATA)}件のニュースを news.json に保存しました。")

if __name__ == "__main__":
    main()
