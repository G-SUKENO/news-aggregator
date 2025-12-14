# =================================================================
# main.py 修正版 (既存データ読み込みの安定化)
# =================================================================
import feedparser
import json
import urllib.parse
import datetime
import time 
# ... (他の import はそのまま)

# ... (fetch_google_news 関数はそのまま)

def main():
    # 0. ★ データ生成時刻を記録 (JST) ★
    generated_time_jst = datetime.datetime.now().isoformat()

    # 1. 企業リストの読み込み (省略)
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
    existing_news = []
    try:
        with open("news.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            
            # ★★★ 修正点: データの形式をチェックして記事リストを取り出す ★★★
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

    print("=== ニュースデータ収集開始 ===")
    
    # ... (ステップ 3～9 は、ご提示いただいたコードと同じで問題ありません) ...

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
