// =================================================================
// 修正完全版 script.js: 閉じるボタン機能、details要素対応
// =================================================================

let allNewsData = []; // 記事データをグローバルで保持
let companyMap = {};  // 企業マップをグローバルで保持
let scrollPositionBeforeAccordion = 0; // ★★★ 新規追加: アコーディオンを開く前のスクロール位置を保持

// UI要素の取得（HTMLに #close-accordion-btn がある前提）
const closeBtn = document.getElementById('close-accordion-btn');

/**
 * ISO 8601形式の文字列を、JSTとしてパースするヘルパー関数
 */
function parseDateAsJST(dateString) {
    const parts = dateString.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (parts) {
        // new Date(year, monthIndex, day, hours, minutes, seconds) はローカルタイムとして解釈される
        return new Date(parts[1], parts[2] - 1, parts[3], parts[4], parts[5], parts[6]);
    }
    return new Date(dateString);
}


document.addEventListener('DOMContentLoaded', () => {
    Promise.all([
        fetch('news.json').then(response => {
            if (!response.ok) throw new Error('news.jsonの読み込みに失敗しました。');
            return response.json();
        }),
        fetch('companies.json').then(res => res.json())
    ])
    .then(([newsData, companies]) => {
        allNewsData = newsData;
        
        companyMap = companies.reduce((map, company) => {
            map[company.id] = company.name;
            return map;
            }, {});
        
        renderNews(allNewsData, companies);
        setupSearch(); 
        // ★★★ 追加: 閉じるボタンのセットアップを呼び出し ★★★
        setupCloseButton(); 
    })
    .catch(error => {
        console.error('データの読み込みエラー:', error);
        document.getElementById('latestNewsList').innerHTML = `<div class="alert alert-danger text-center" role="alert">ニュースの読み込み中にエラーが発生しました。</div>`;
    });
});

/**
 * ニュースリストのアイテム要素を生成するヘルパー関数
 */
function createNewsListItem(article, companyName, newLabel = '') {
    const articleDate = parseDateAsJST(article.published);
    
    // 日付フォーマットの調整 (秒を削除し、よりコンパクトに)
    const formattedDate = articleDate.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    return `
        <div class="news-item">
            <div class="news-header">
                <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="news-title-link">
                    ${article.title}
                </a>
                ${newLabel}
            </div>
            <div class="news-meta text-muted"> 
                <span>${formattedDate}</span>
                <span>${companyName}</span>
                <span>${article.source || '外部ソース'}</span>
            </div>
        </div>
    `;
}

/**
 * ニュースデータを処理し、新着記事一覧と企業別アーカイブをレンダリングする
 */
function renderNews(newsData, companies) {
    const archiveListContainer = document.getElementById('archiveListContainer');
    const latestNewsList = document.getElementById('latestNewsList');
    
    // ----------------------------------------------------------------
    // 時刻ロジック (変更なし)
    // ----------------------------------------------------------------
    const latestArticleDate = newsData.length > 0 ? parseDateAsJST(newsData[0].published) : new Date();
    
    const lastUpdateTime = new Date(
        latestArticleDate.getFullYear(), 
        latestArticleDate.getMonth(), 
        latestArticleDate.getDate(), 
        8, 0, 0
    );

    const oneDayAgoCutoff = lastUpdateTime.getTime() - (24 * 60 * 60 * 1000);
    
    const groupedNews = newsData.reduce((groups, item) => {
        const companyId = item.company_id;
        if (!groups[companyId]) {
            groups[companyId] = [];
        }
        groups[companyId].push(item);
        return groups;
    }, {});

    // 1.1 最終更新日時を表示 (変更なし)
    if (newsData.length > 0) {
        document.getElementById('last-updated').textContent = lastUpdateTime.toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }) + ' (システム更新)';
    }

    // 2. 新着記事セクションの生成 (変更なし)
    const latestArticles = newsData.filter(article => {
        const publishedTime = parseDateAsJST(article.published).getTime();
        return publishedTime > oneDayAgoCutoff;
    });

    if (latestArticles.length === 0) {
        latestNewsList.innerHTML = `<div class="alert alert-info text-center" role="alert">直近のシステム更新（${lastUpdateTime.toLocaleString('ja-JP', {hour: '2-digit', minute: '2-digit', hour12: false})}）以降、新しい記事はありません。</div>`;
    } else {
        const newsContainer = document.createElement('div');
        newsContainer.className = 'news-list-container';
        newsContainer.innerHTML = latestArticles.map(article => {
            const companyName = companyMap[article.company_id] || '不明な企業';
            const newLabel = '<span class="new-label">NEW!</span>';

            return createNewsListItem(article, companyName, newLabel);
        }).join('');
        latestNewsList.innerHTML = ''; 
        latestNewsList.appendChild(newsContainer);
    }

    // ----------------------------------------------------------------
    // 3. 企業別アーカイブの生成 (details/summaryに修正とリスナー追加)
    // ----------------------------------------------------------------
    archiveListContainer.innerHTML = ''; 

    companies.forEach((company) => {
        const companyId = company.id;
        const companyName = company.name;
        
        const archiveArticles = (groupedNews[companyId] || []).filter(article => {
             const publishedTime = parseDateAsJST(article.published).getTime();
             return publishedTime <= oneDayAgoCutoff;
        });

        // details要素を生成 (アコーディオンのitemに相当)
        const detailsElement = document.createElement('details');
        detailsElement.className = 'archive-item';
        
        // ★★★ 修正: details要素にクリックリスナーを追加し、開く前のスクロール位置を記録 ★★★
        detailsElement.addEventListener('click', (e) => {
            // クリックされた時点で、detailsが閉じている場合 (これから開く場合)
            if (!detailsElement.open) {
                // 開く前のスクロール位置を記録
                scrollPositionBeforeAccordion = window.scrollY || document.documentElement.scrollTop;
            }
        });
        
        // アーカイブ記事のHTMLを生成
        const newsListHtml = archiveArticles.length === 0 ? 
            `<div class="text-muted text-center py-3">アーカイブ記事はありません。</div>` : 
            archiveArticles.map(article => {
                return createNewsListItem(article, companyName, '');
            }).join('');

        detailsElement.innerHTML = `
            <summary class="archive-header">${companyName}</summary>
            <div class="archive-content">
                ${newsListHtml}
            </div>
        `;
        archiveListContainer.appendChild(detailsElement);
    });
}

/**
 * 検索機能をセットアップする (変更なし)
 */
function setupSearch() {
    const searchInput = document.getElementById('searchKeyword');
    const searchButton = document.getElementById('searchButton');
    const searchResults = document.getElementById('searchResults');
    const clearSearch = document.getElementById('clearSearch');
    const latestNewsList = document.getElementById('latestNewsList');
    const archiveListContainer = document.getElementById('archiveListContainer');
    const archiveHeading = document.querySelector('h2.section-heading.mt-5');

    const performSearch = () => {
        const keyword = searchInput.value.toLowerCase().trim();
        
        if (keyword.length === 0) {
            searchResults.style.display = 'none';
            latestNewsList.style.display = 'block';
            archiveListContainer.style.display = 'block';
            archiveHeading.style.display = 'block';
            return;
        }

        const filteredArticles = allNewsData.filter(article => {
            const companyName = companyMap[article.company_id] || '';
            const title = article.title.toLowerCase();
            const source = article.source.toLowerCase();

            return title.includes(keyword) || 
                   companyName.toLowerCase().includes(keyword) || 
                   source.includes(keyword);
        });

        const searchList = document.getElementById('searchList');
        
        if (filteredArticles.length === 0) {
            searchList.innerHTML = `<div class="alert alert-warning text-center" role="alert">「${keyword}」に一致する記事は見つかりませんでした。</div>`;
        } else {
            const newsContainer = document.createElement('div');
            newsContainer.className = 'news-list-container';
            newsContainer.innerHTML = filteredArticles.map(article => {
                const companyName = companyMap[article.company_id] || '不明な企業';
                return createNewsListItem(article, companyName, '');
            }).join('');
            searchList.innerHTML = '';
            searchList.appendChild(newsContainer);
        }

        searchResults.style.display = 'block';
        latestNewsList.style.display = 'none';
        archiveListContainer.style.display = 'none';
        archiveHeading.style.display = 'none';
    };

    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    clearSearch.addEventListener('click', (e) => {
        e.preventDefault();
        searchInput.value = '';
        performSearch();
    });
}

// =================================================================
// ★★★ 新規機能: 画面右下の閉じるボタンのロジック ★★★
// =================================================================

/**
 * 画面右下の閉じるボタンの表示/非表示を制御する
 */
function toggleCloseButton() {
    if (!closeBtn) return;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    
    // 現在開いている details 要素があるかチェック
    // details[open] は開いている details 要素を指す
    const activeDetails = document.querySelector('details[open]');
    
    // スクロール量が 150px より大きい AND detailsが開いている場合 のみ表示
    if (scrollY > 150 && activeDetails) {
        closeBtn.style.display = "block";
    } else {
        closeBtn.style.display = "none";
    }
}

/**
 * 画面右下の閉じるボタンのイベントを設定する
 */
function setupCloseButton() {
    if (!closeBtn) return; // ボタン要素が存在しない場合は何もしない

    // スクロール監視の登録
    window.addEventListener('scroll', toggleCloseButton);

    // ボタンクリック時の処理
    closeBtn.onclick = function() {
        
        // 1. 開いている details 要素をすべて閉じる
        document.querySelectorAll('details[open]').forEach(details => {
            details.open = false; 
        });

        // 2. 記録した位置に戻る（スムーズスクロール）
        const targetScroll = scrollPositionBeforeAccordion || 0; 
        
        window.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        });

        // 3. 記録位置をリセット
        scrollPositionBeforeAccordion = 0;

        // 4. ボタンを非表示にする (スムーズスクロール完了後に消えるが、即座に消す)
        closeBtn.style.display = "none";
        // スムーズスクロールが完了した後、最終的に非表示になるように (保険)
        setTimeout(toggleCloseButton, 500); 
    };
}
