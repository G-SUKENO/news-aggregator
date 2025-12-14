import feedparser
import json
import urllib.parse
import datetime
import time # 現在時刻取得に使用

# ニュースデータを格納する最終的なリスト
ALL_NEWS_DATA = []

# 1企業あたりの最大取得件数を定義 (Google News RSSから一度に取得する上限)
MAX_ARTICLES_PER_COMPANY_FETCH = 50

# 1企業あたりの最大保存件数を定義 (news.jsonにアーカイブする記事の上限)
MAX_ARTICLES_PER_COMPANY_ARCHIVE = 100 

def fetch_google_news(search_query, company_id):
    """
    Google News RSSフィードから記事を取得し、ALL_NEWS_DATAリストに追加する。
    """
    # 日本語の検索クエリをURLエンコード
    encoded_query = urllib.parse.quote(search_query)
    RSS_URL = f"https://news.google.com/rss/search?q={encoded_query}&hl=ja&gl=JP&ceid=JP:ja"
    
    print(f" -> RSS取得中 (クエリ: {search_query})")
    
    try:
        # RSSフィードの解析
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
                # published_parsed は UTC の struct_time
                dt_utc = datetime.datetime(*published_time[:6], tzinfo=datetime.timezone.utc)
                dt_jst = dt_utc.astimezone(datetime.timezone(datetime.timedelta(hours=9)))
                published_iso = dt_jst.isoformat()
            else:
                # 取得できなかった場合は現在時刻をJSTとして記録
                published_iso = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).isoformat()
                
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
        print(f" 警告: Googleニュースの取得でエラーが発生しました (クエリ: {search_query}): {e}")


def main():
    """
    メイン処理：企業リスト読み込み、ニュース取得、データ処理、JSON保存を行う。
    """
    # 0. ★ データ生成時刻を記録 (JST) ★
    # タイムゾーン付きのJST現在時刻を取得
    JST = datetime.timezone(datetime.timedelta(hours=9))
    generated_time_jst = datetime.datetime.now(JST).isoformat()

    # 1. 企業リストの読み込み (companies.json)
    try:
        with open("companies.json", "r", encoding="utf-8") as f:
            COMPANIES = json.load(f)
    except FileNotFoundError:
        print("致命的エラー: companies.json が見つかりません。")
        return
    except json.JSONDecodeError:
        print("致命的エラー: companies.json の形式が不正です。")
        return

    if not COMPANIES:
        print("エラー: companies.json に企業データがありません。処理をスキップします。")
        return
        
    # 2. 既存のニュースデータを読み込む (news.json)
    existing_news = []
    try:
        with open("news.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            
            # データの形式をチェックして記事リストを取り出す (配列形式/オブジェクト形式の両対応)
            if isinstance(data, list):
                # 古い配列形式の場合
                existing_news = data
                print(" -> news.json が古い配列形式で読み込まれました。")
            elif isinstance(data, dict) and 'articles' in data:
                # 新しいオブジェクト形式の場合
                existing_news = data['articles']
                print(" -> news.json が新しいオブジェクト形式で読み込まれました。")
            else:
                print(" -> news.json の形式が不正です。既存データは破棄されます。")
                
            print(f" -> news.json から既存の {len(existing_news)} 件の記事を読み込みました。")
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f" -> 既存の news.json が見つからないか、読み込みエラーです。新規作成します。エラー: {e}")
        existing_news = [] # 新規作成の場合は空リスト

    print("\n=== ニュースデータ収集開始 ===")

    # 3. 各企業ごとにニュースを取得
    for company in COMPANIES:
        print(f"--- 企業ニュース取得開始: {company['name']} ---")
        # グローバルリスト ALL_NEWS_DATA に新規記事を追加
        fetch_google_news(company["search_query"], company["id"])
        
    # 4. 既存データと新規データを結合
    ALL_NEWS_DATA.extend(existing_news)

    # 5. 記事を公開日時でソート（新しい順）
    # 'published'キーがない場合は古い日時 '1900-01-01' を代替値として使用
    ALL_NEWS_DATA.sort(key=lambda x: x.get('published', '1900-01-01'), reverse=True)
    
    # 6. データ重複の削除 (Linkが重複する記事を削除)
    unique_links = set()
    deduplicated_news = []
    
    for item in ALL_NEWS_DATA:
        if item.get('link') and item['link'] not in unique_links:
            unique_links.add(item['link'])
            deduplicated_news.append(item)
            
    print(f"\n -> 重複排除前: {len(ALL_NEWS_DATA)} 件")
    print(f" -> 全体で {len(ALL_NEWS_DATA) - len(deduplicated_news)} 件の重複記事を削除しました。")
    
    # 7. 企業ごとの記事数制限 (アーカイブ上限 MAX_ARTICLES_PER_COMPANY_ARCHIVE に基づき古い記事を削除)
    final_news_list = []
    grouped_by_company = {}
    
    # company_idごとに記事をグループ化 (この時、既に全体で日時ソートされているため、リスト内の順番は新しい順)
    for article in deduplicated_news:
        cid = article['company_id']
        if cid not in grouped_by_company:
            grouped_by_company[cid] = []
        grouped_by_company[cid].append(article)
        
    # 各企業の上限を超えた記事を削除
    for cid, articles in grouped_by_company.items():
        current_count = len(articles)
        
        if current_count > MAX_ARTICLES_PER_COMPANY_ARCHIVE:
            articles_to_keep = articles[:MAX_ARTICLES_PER_COMPANY_ARCHIVE]
            deleted_count = current_count - MAX_ARTICLES_PER_COMPANY_ARCHIVE
            print(f" -> 企業ID {cid} (計 {current_count} 件) の記事数が上限 {MAX_ARTICLES_PER_COMPANY_ARCHIVE} を超えたため、古い {deleted_count} 件を削除しました。")
        else:
            articles_to_keep = articles
        
        final_news_list.extend(articles_to_keep)
        
    # 8. 最終リストを再度、全体の日時でソートし直す (企業ごとの削除で順序が崩れている可能性があるため)
    final_news_list.sort(key=lambda x: x.get('published', '1900-01-01'), reverse=True)

    # 9. ★ 最終データをメタデータ付きの JSON 形式で保存 ★
    final_data_structure = {
        "generated_at": generated_time_jst,
        "articles": final_news_list
    }

    with open("news.json", "w", encoding="utf-8") as f:
        # JSONを読みやすくインデントして保存
        json.dump(final_data_structure, f, indent=4, ensure_ascii=False)

    print(f"\n✅ 最終的に {len(final_news_list)} 件のニュースを news.json に保存しました。")
    print(f"✅ 生成時刻: {generated_time_jst}")

if __name__ == "__main__":
    main()
