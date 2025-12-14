let allNewsData = []; // 記事データをグローバルで保持
let companyMap = {};  // 企業マップをグローバルで保持

/**
 * [追加] ISO 8601形式の文字列を、タイムゾーンを考慮せずJSTとしてパースするヘルパー関数
 * Pythonから送られてくる 'YYYY-MM-DDTHH:MM:SS' 形式を、
 * ブラウザのローカルタイムとして正確に解釈させるために使用します。
 */
function parseDateAsJST(dateString) {
    // 日付文字列から 'YYYY-MM-DDTHH:MM:SS' の各パーツを抽出
    const parts = dateString.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (parts) {
        // new Date(year, monthIndex, day, hours, minutes, seconds) はローカルタイムとして解釈される
        // monthIndexは0から始まるため、-1する
        return new Date(parts[1], parts[2] - 1, parts[3], parts[4], parts[5], parts[6]);
    }
    // パースに失敗した場合はそのまま返す
    return new Date(dateString);
}


document.addEventListener('DOMContentLoaded', () => {
    // ニュースデータと企業データを読み込む
    Promise.all([
        fetch('news.json').then(response => {
            if (!response.ok) throw new Error('news.jsonの読み込みに失敗しました。');
            return response.json();
        }),
        fetch('companies.json').then(res => res.json())
    ])
    .then(([newsData, companies]) => {
        allNewsData = newsData;
        
        // 企業リストをIDでアクセスしやすいようにマップ化
        companyMap = companies.reduce((map, company) => {
            map[company.id] = company.name;
            return map;
        }, {});
        
        renderNews(allNewsData, companies);
        setupSearch(companies); // 検索機能をセットアップ
    })
    .catch(error => {
        console.error('データの読み込みエラー:', error);
        document.getElementById('latestNewsList').innerHTML = `<div class="alert alert-danger" role="alert">ニュースの読み込み中にエラーが発生しました。時間を置いて再度お試しください。</div>`;
    });
});

/**
 * ニュースデータを処理し、新着記事一覧と企業別アーカイブをレンダリングする
 */
function renderNews(newsData, companies) {
    const newsAccordion = document.getElementById('newsAccordion');
    const latestNewsList = document.getElementById('latestNewsList');
    const now = new Date();
    const oneDayAgo = now.getTime() - (24 * 60 * 60 * 1000); // 24時間前のUNIXタイムスタンプ

    // ニュース記事を企業IDごとにグループ化
    const groupedNews = newsData.reduce((groups, item) => {
        const companyId = item.company_id;
        if (!groups[companyId]) {
            groups[companyId] = [];
        }
        groups[companyId].push(item);
        return groups;
    }, {});

    // ----------------------------------------------------------------
    // 1. 新着記事セクションの生成 (NEW!ラベルを付ける)
    // ----------------------------------------------------------------
    
    // 過去24時間以内の記事をフィルタリング
    const latestArticles = newsData.filter(article => {
        // ★修正適用: JSTとして正確にパース
        const publishedTime = parseDateAsJST(article.published).getTime();
        return publishedTime > oneDayAgo;
    });

    if (latestArticles.length === 0) {
        latestNewsList.innerHTML = `<div class="alert alert-info text-center" role="alert">過去24時間以内に新しい記事はありません。</div>`;
    } else {
        const ul = document.createElement('ul');
        ul.className = 'list-unstyled';
        ul.innerHTML = latestArticles.map(article => {
            const companyName = companyMap[article.company_id] || '不明な企業';
            const newLabel = '<span class="new-label">NEW!</span>';

            return createNewsListItem(article, companyName, true, newLabel);
        }).join('');
        latestNewsList.innerHTML = ''; // 既存の内容をクリア
        latestNewsList.appendChild(ul);
    }

    // ----------------------------------------------------------------
    // 2. 企業別アーカイブの生成 (アコーディオン。NEW!ラベルは付けない)
    // ----------------------------------------------------------------
    newsAccordion.innerHTML = ''; 

    companies.forEach((company, index) => {
        const companyId = company.id;
        const companyName = company.name;
        // 24時間以上前の記事（アーカイブ）のみを抽出
        const archiveArticles = (groupedNews[companyId] || []).filter(article => {
             // ★修正適用: JSTとして正確にパース
             const publishedTime = parseDateAsJST(article.published).getTime();
             return publishedTime <= oneDayAgo;
        });

        const accordionItem = document.createElement('div');
        accordionItem.className = 'accordion-item';
        const accordionId = `collapse-${companyId}`;
        
        accordionItem.innerHTML = `
            <h2 class="accordion-header" id="heading-${companyId}">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${accordionId}" aria-expanded="false" aria-controls="${accordionId}">
                    ${companyName}
                </button>
            </h2>
            <div id="${accordionId}" class="accordion-collapse collapse" aria-labelledby="heading-${companyId}" data-bs-parent="#newsAccordion">
                <div class="accordion-body">
                    <ul class="list-unstyled">
                        ${archiveArticles.length === 0 ? `<li class="text-muted">アーカイブ記事はありません。</li>` : archiveArticles.map(article => {
                            const newLabel = '';
                            return createNewsListItem(article, companyName, false, newLabel);
                        }).join('')}
                    </ul>
                </div>
            </div>
        `;
        newsAccordion.appendChild(accordionItem);
    });
    
    // 最終更新日時を表示
    if (newsData.length > 0) {
        // ★修正適用: JSTとして正確にパース
        const latestArticleTime = parseDateAsJST(newsData[0].published);
        document.getElementById('last-updated').textContent = latestArticleTime.toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }
}

/**
 * ニュースリストの<li>要素を生成するヘルパー関数
 */
function createNewsListItem(article, companyName, showCompanyName = false, newLabel = '') {
    // ★修正適用: JSTとして正確にパース
    const articleDate = parseDateAsJST(article.published);
    
    const formattedDate = articleDate.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    return `
        <li class="news-item">
            <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="news-title">
                ${article.title}
            </a>
            ${newLabel}
            <div class="news-meta">
                ${formattedDate} - ${companyName} - ${article.source || '外部ソース'}
            </div>
        </li>
    `;
}

/**
 * 検索機能をセットアップする
 */
function setupSearch(companies) {
    const searchInput = document.getElementById('searchKeyword');
    const searchButton = document.getElementById('searchButton');
    const searchResults = document.getElementById('searchResults');
    const clearSearch = document.getElementById('clearSearch');
    const latestNewsList = document.getElementById('latestNewsList');
    const newsAccordion = document.getElementById('newsAccordion');
    const archiveHeading = document.querySelector('h2.section-heading.mt-5'); // 企業別アーカイブ見出し

    const performSearch = () => {
        const keyword = searchInput.value.toLowerCase().trim();
        
        if (keyword.length === 0) {
            // キーワードが空の場合は検索結果を非表示にし、通常表示に戻す
            searchResults.style.display = 'none';
            latestNewsList.style.display = 'block';
            newsAccordion.style.display = 'block';
            archiveHeading.style.display = 'block';
            return;
        }

        // 検索ロジック
        const filteredArticles = allNewsData.filter(article => {
            const companyName = companyMap[article.company_id] || '';
            const title = article.title.toLowerCase();
            const source = article.source.toLowerCase();

            return title.includes(keyword) || 
                   companyName.toLowerCase().includes(keyword) || 
                   source.includes(keyword);
        });

        // 検索結果のレンダリング
        const searchList = document.getElementById('searchList');
        
        if (filteredArticles.length === 0) {
            searchList.innerHTML = `<div class="alert alert-warning text-center" role="alert">「${keyword}」に一致する記事は見つかりませんでした。</div>`;
        } else {
            const ul = document.createElement('ul');
            ul.className = 'list-unstyled';
            ul.innerHTML = filteredArticles.map(article => {
                const companyName = companyMap[article.company_id] || '不明な企業';
                return createNewsListItem(article, companyName, true, ''); // 検索結果にはNEW!ラベルはつけない
            }).join('');
            searchList.innerHTML = '';
            searchList.appendChild(ul);
        }

        // 表示の切り替え
        searchResults.style.display = 'block';
        latestNewsList.style.display = 'none';
        newsAccordion.style.display = 'none';
        archiveHeading.style.display = 'none';
    };

    // 検索ボタンとEnterキーで検索を実行
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // 検索クリア機能
    clearSearch.addEventListener('click', (e) => {
        e.preventDefault();
        searchInput.value = '';
        performSearch();
    });
}


// ----------------------------------------------------------------
// 3. アコーディオンヘッダー固定機能のイベントリスナー
// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const newsAccordion = document.getElementById('newsAccordion');
    if (newsAccordion) {
        // アコーディオンが開く直前のイベントを監視
        newsAccordion.addEventListener('show.bs.collapse', function (event) {
            const header = event.target.previousElementSibling;
            if (header && header.classList.contains('accordion-header')) {
                // ヘッダーに固定用のクラスを追加
                header.classList.add('sticky-top-header');
            }
        });

        // アコーディオンが閉じた後のイベントを監視
        newsAccordion.addEventListener('hidden.bs.collapse', function (event) {
            const header = event.target.previousElementSibling;
            if (header && header.classList.contains('accordion-header')) {
                // ヘッダーから固定用のクラスを削除
                header.classList.remove('sticky-top-header');
            }
        });
    }
});
