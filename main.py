import feedparser
import json
import urllib.parse
import datetime
import time # 現在時刻取得に使用

# ニュースデータを格納する最終的なリスト
ALL_NEWS_DATA = []

# 1企業あたりの最大取得件数を定義
MAX_ARTICLES_PER_COMPANY_FETCH = 50

# 1企業あたりの最大保存件数を定義 (アーカイブの上限: 100件)
MAX_ARTICLES_PER_COMPANY_ARCHIVE = 100 

def fetch_google_news(search_query, company_id):
    # 日本語の検索クエリをURLエンコード
    encoded_query = urllib.parse.quote(search_query)
    RSS_URL = f"https://news.google.com/rss/search?q={encoded_query}&hl=ja&gl=JP&ceid=JP:ja"
    
    print(f" -> RSS取得中 (クエリ: {search_query})")
    
    try:
        feed = feedparser.parse(RSS_URL)
        article_count = 0 
        
        for entry in feed.entries:
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
                published_iso = datetime.datetime.now().isoformat()
                
            ALL_NEWS_DATA.append({
                "company_id": company_id,
                "title": entry.title,
                "link": entry.link,
                "published": published_iso,
                "source": entry.source.get('title', 'Google News')
            })
            article_count += 1
            
        print(f" -> {article_count} 件の記事を取得しました。")

    except Exception as e:
        print(f" 警告: Googleニュースの取得でエラーが発生しました: {e}")


def main():
    # 0. ★ データ生成時刻を記録 (JST) ★
    generated_time_jst = datetime.datetime.now().isoformat()

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
        
    # 2. 既存のニュースデータを読み込む
    existing_news_container = {}
    try:
        with open("news.json", "r", encoding="utf-8") as f:
            # news.json の構造が変更になるため、ここでは一旦 dict で読み込む
            data = json.load(f)
            # 記事リスト部分を取り出す (メタデータが先頭に追加されるため)
            existing_news = data.get('articles', [])
            existing_news_container['articles'] = existing_news
            print(f" -> news.json から既存の {len(existing_news)} 件の記事を読み込みました。")
    except (FileNotFoundError, json.JSONDecodeError):
        print(" -> 既存の news.json が見つからないか、読み込みエラーです。新規作成します。")
        existing_news = [] # 新規作成の場合は空リスト

    print("=== ニュースデータ収集開始 ===")

    # 3. 各企業ごとにニュースを取得
    for company in COMPANIES:
        print(f"--- 企業ニュース取得開始: {company['name']} ---")
        fetch_google_news(company["search_query"], company["id"])
        
    # 4. 既存データと新規データを結合
    ALL_NEWS_DATA.extend(existing_news)

    # 5. 記事を公開日時でソート（新しい順）
    ALL_NEWS_DATA.sort(key=lambda x: x.get('published', '1900-01-01'), reverse=True)
    
    # 6. データ重複の削除
    unique_links = set()
    deduplicated_news = []
    
    for item in ALL_NEWS_DATA:
        if item['link'] not in unique_links:
            unique_links.add(item['link'])
            deduplicated_news.append(item)
            
    print(f" -> 全体で {len(ALL_NEWS_DATA) - len(deduplicated_news)} 件の重複記事を削除しました。")
    
    # 7. 企業ごとの記事数制限 (古い記事の削除)
    final_news_list = []
    grouped_by_company = {}
    for article in deduplicated_news:
        cid = article['company_id']
        if cid not in grouped_by_company:
            grouped_by_company[cid] = []
        grouped_by_company[cid].append(article)
        
    for cid, articles in grouped_by_company.items():
        current_count = len(articles)
        
        if current_count > MAX_ARTICLES_PER_COMPANY_ARCHIVE:
            articles_to_keep = articles[:MAX_ARTICLES_PER_COMPANY_ARCHIVE]
            deleted_count = current_count - MAX_ARTICLES_PER_COMPANY_ARCHIVE
            print(f" -> 企業ID {cid} (計 {current_count} 件) の記事数が上限 {MAX_ARTICLES_PER_COMPANY_ARCHIVE} を超えたため、古い {deleted_count} 件を削除しました。")
        else:
            articles_to_keep = articles
        
        final_news_list.extend(articles_to_keep)
        
    # 8. 最終リストを再度、全体の日時でソートし直す
    final_news_list.sort(key=lambda x: x.get('published', '1900-01-01'), reverse=True)


    # 9. ★ 最終データをメタデータ付きの JSON 形式で保存 ★
    final_data_structure = {
        "generated_at": generated_time_jst,
        "articles": final_news_list
    }

    with open("news.json", "w", encoding="utf-8") as f:
        json.dump(final_data_structure, f, indent=4, ensure_ascii=False)

    print(f"\n✅ 最終的に {len(final_news_list)} 件のニュースを news.json に保存しました。")
    print(f"✅ 生成時刻: {generated_time_jst}")

if __name__ == "__main__":
    main()
