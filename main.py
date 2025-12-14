import feedparser
import json
import urllib.parse
import datetime

# ニュースデータを格納する最終的なリスト
ALL_NEWS_DATA = []

# ★ 1企業あたりの最大取得件数を定義 (Google News RSSからの取得制限) ★
MAX_ARTICLES_PER_COMPANY_FETCH = 50

# ★ 1企業あたりの最大保存件数を定義 (アーカイブの上限: 100件) ★
MAX_ARTICLES_PER_COMPANY_ARCHIVE = 100 

def fetch_google_news(search_query, company_id):
    # 日本語の検索クエリをURLエンコード
    encoded_query = urllib.parse.quote(search_query)
    # GoogleニュースRSSのURLを生成
    RSS_URL = f"https://news.google.com/rss/search?q={encoded_query}&hl=ja&gl=JP&ceid=JP:ja"
    
    print(f" -> RSS取得中 (クエリ: {search_query})")
    
    try:
        feed = feedparser.parse(RSS_URL)
        
        article_count = 0 
        
        for entry in feed.entries:
            # 取得件数制限チェック
            if article_count >= MAX_ARTICLES_PER_COMPANY_FETCH:
                break

            if not entry.title or not entry.link:
                continue

            published_time = entry.get('published_parsed')
            if published_time:
                # JST時刻変換：UTC時刻をJSTに変換 (9時間加算)
                dt_utc = datetime.datetime(*published_time[:6])
                dt_jst = dt_utc + datetime.timedelta(hours=9) 
                
                published_iso = dt_jst.isoformat()
            else:
                # 取得できない場合は現在時刻を仮設定 (JST)
                # datetime.now() はローカルタイム（JST）を返すため、こちらに修正
                published_iso = datetime.datetime.now().isoformat()
                
            ALL_NEWS_DATA.append({
                "company_id": company_id,
                "title": entry.title,
                "link": entry.link,
                "published": published_iso,
                "source": entry.source.get('title', 'Google News')
                # NEW! ラベル判定は script.js 側で行うため、extracted_cycleは削除
            })
            article_count += 1
            
        print(f" -> {article_count} 件の記事を取得しました。")

    except Exception as e:
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
        
    # 2. ★ 既存のニュースデータを読み込む（重要）★
    existing_news = []
    try:
        with open("news.json", "r", encoding="utf-8") as f:
            existing_news = json.load(f)
        print(f" -> news.json から既存の {len(existing_news)} 件の記事を読み込みました。")
    except (FileNotFoundError, json.JSONDecodeError):
        # ファイルがない、または不正な場合は空リストから開始
        print(" -> 既存の news.json が見つからないか、読み込みエラーです。新規作成します。")

    print("=== ニュースデータ収集開始 ===")

    # 3. 各企業ごとにニュースを取得
    for company in COMPANIES:
        print(f"--- 企業ニュース取得開始: {company['name']} ---")
        fetch_google_news(company["search_query"], company["id"])
        
    # 4. 既存データと新規データを結合
    ALL_NEWS_DATA.extend(existing_news)

    # 5. 記事を公開日時でソート（新しい順）
    ALL_NEWS_DATA.sort(key=lambda x: x.get('published', '1900-01-01'), reverse=True)
    
    # 6. データ重複の削除 (linkをキーとして重複を排除)
    unique_links = set()
    deduplicated_news = []
    
    for item in ALL_NEWS_DATA:
        # 重複するリンクを持つ記事でなければ追加
        if item['link'] not in unique_links:
            unique_links.add(item['link'])
            deduplicated_news.append(item)
            
    print(f" -> 全体で {len(ALL_NEWS_DATA) - len(deduplicated_news)} 件の重複記事を削除しました。")
    
    # 7. ★ 企業ごとの記事数制限 (古い記事の削除) ★
    final_news_list = []
    
    # 企業IDごとに記事をグループ化
    grouped_by_company = {}
    for article in deduplicated_news:
        cid = article['company_id']
        if cid not in grouped_by_company:
            grouped_by_company[cid] = []
        # ここでは記事は既に新しい順にソートされている
        grouped_by_company[cid].append(article)
        
    # 各企業の記事数をチェックし、古い記事から削除
    for cid, articles in grouped_by_company.items():
        current_count = len(articles)
        
        if current_count > MAX_ARTICLES_PER_COMPANY_ARCHIVE:
            # リストの先頭から100件を保持する (古い記事はリストの末尾にあるため)
            articles_to_keep = articles[:MAX_ARTICLES_PER_COMPANY_ARCHIVE]
            deleted_count = current_count - MAX_ARTICLES_PER_COMPANY_ARCHIVE
            print(f" -> 企業ID {cid} (計 {current_count} 件) の記事数が上限 {MAX_ARTICLES_PER_COMPANY_ARCHIVE} を超えたため、古い {deleted_count} 件を削除しました。")
        else:
            articles_to_keep = articles
        
        final_news_list.extend(articles_to_keep)
        
    # 8. 最終リストを再度、全体の日時でソートし直す
    final_news_list.sort(key=lambda x: x.get('published', '1900-01-01'), reverse=True)


    # 9. データをJSONファイルとして保存 (news.jsonを上書き)
    with open("news.json", "w", encoding="utf-8") as f:
        json.dump(final_news_list, f, indent=4, ensure_ascii=False)

    print(f"\n✅ 最終的に {len(final_news_list)} 件のニュースを news.json に保存しました。")

if __name__ == "__main__":
    main()
