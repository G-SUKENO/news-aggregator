// =================================================================
// script.js 完全版 (クリアロジック強化済み)
// =================================================================

const NEWS_FILE = 'news.json';
const COMPANIES_FILE = 'companies.json';
const COMPANY_IDS = {}; // 企業IDと企業名をマッピング

// ----------------------------------------------------------------
// ユーティリティ関数
// ----------------------------------------------------------------

/**
 * ISO形式の文字列をDateオブジェクトに変換する。
 * @param {string} dateString - ISO 8601形式の時刻文字列
 * @returns {Date} - Dateオブジェクト
 */
function parseDateAsJST(dateString) {
    return new Date(dateString);
}

/**
 * 記事をリストアイテムのHTMLとして生成する。
 */
function createNewsListItem(article, companyName, newLabel = '') {
    const articleDate = parseDateAsJST(article.published);
    
    const formattedDate = articleDate.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Tokyo' 
    });

    return `<div class="news-item">
            <div class="news-header">
                <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="news-title-link">
                    ${article.title}
                </a>
                ${newLabel}
            </div>
            <div class="news-meta">
                <span>${formattedDate}</span>
                <span>${companyName}</span>
                <span>${article.source || '外部ソース'}</span>
            </div>
        </div>`;
}

// ----------------------------------------------------------------
// メインレンダリング関数
// ----------------------------------------------------------------

async function renderNews() {
    let newsDataContainer = {}; 
    let companies = [];

    // データの読み込み
    try {
        const [newsResponse, companiesResponse] = await Promise.all([
            fetch(NEWS_FILE),
            fetch(COMPANIES_FILE)
        ]);

        if (!newsResponse.ok || !companiesResponse.ok) {
            throw new Error('データの読み込みに失敗しました。ファイルパスまたはサーバーを確認してください。');
        }

        newsDataContainer = await newsResponse.json();
        const newsData = newsDataContainer.articles || []; 
        companies = await companiesResponse.json();
        
        // ----------------------------------------------------------------
        // 時刻ロジックの定義と表示 (最終更新時刻)
        // ----------------------------------------------------------------
        const generatedAtString = newsDataContainer.generated_at;
        
        let displayTime;
        if (generatedAtString) {
            const generatedDate = parseDateAsJST(generatedAtString);
            
            displayTime = generatedDate.toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: 'Asia/Tokyo'
            });
        } else {
            displayTime = new Date().toLocaleString('ja-JP', {
                year: 'numeric', month: '2-digit', day: '2-digit', 
                hour: '2-digit', minute: '2-digit', hour12: false
            }) + " (時刻不明)";
        }
        
        const lastUpdatedElement = document.getElementById('last-updated');
        if (lastUpdatedElement) {
             lastUpdatedElement.textContent = displayTime;
        }


        // ----------------------------------------------------------------
        // 記事の分類・レンダリングロジック
        // ----------------------------------------------------------------
        
        companies.forEach(company => {
            COMPANY_IDS[company.id] = company.name;
        });

        const currentTime = new Date(); 
        const oneDayAgoCutoff = currentTime.getTime() - (24 * 60 * 60 * 1000); 
        
        // 1. 新着記事セクションの生成
        
        const latestArticles = newsData.filter(article => {
            const publishedTime = parseDateAsJST(article.published).getTime();
            return publishedTime > oneDayAgoCutoff;
        });

        const latestListContainer = document.getElementById('latestNewsList');
        latestListContainer.innerHTML = ''; 

        if (latestArticles.length > 0) {
            let latestHtml = '';
            const newLabelHtml = '<span class="new-label">NEW!</span>'; 
            
            latestArticles.forEach(article => {
                const companyName = COMPANY_IDS[article.company_id] || '不明';
                latestHtml += createNewsListItem(article, companyName, newLabelHtml);
            });
            
            latestListContainer.innerHTML = latestHtml;
        } else {
            latestListContainer.innerHTML = `<p class="text-center text-muted">過去24時間以内に公開された新しい記事はありません。</p>`;
        }

        // 2. 企業別アーカイブの生成
        const groupedNews = {};
        companies.forEach(company => { groupedNews[company.id] = []; });

        newsData.forEach(article => {
            const publishedTime = parseDateAsJST(article.published).getTime();
            const isArchive = publishedTime <= oneDayAgoCutoff;
            if (isArchive && groupedNews[article.company_id]) {
                groupedNews[article.company_id].push(article);
            }
        });

        const archiveListContainer = document.getElementById('archiveListContainer');
        archiveListContainer.innerHTML = ''; 
        let archiveFound = false;
        
        companies.forEach(company => {
            const companyId = company.id;
            const companyName = company.name;
            const archiveArticles = groupedNews[companyId] || [];

            if (archiveArticles.length > 0) {
                archiveFound = true;
                let newsListHtml = '';
                
                archiveArticles.forEach(article => {
                    newsListHtml += createNewsListItem(article, companyName);
                });
                
                const detailsElement = document.createElement('details');
                detailsElement.className = 'archive-item';
                detailsElement.innerHTML = `<summary class="archive-header">${companyName}</summary><div class="archive-content">${newsListHtml}</div>`;

                archiveListContainer.appendChild(detailsElement);
            }
        });

        if (!archiveFound) {
             archiveListContainer.innerHTML = `<p class="text-center text-muted">現在、アーカイブ記事はありません。</p>`;
        }

        // 3. 検索機能のイベントリスナー設定
        const searchButton = document.getElementById('searchButton');
        const searchKeyword = document.getElementById('searchKeyword');
        const clearSearchBtn = document.getElementById('clearSearch');
        
        if (searchButton) searchButton.onclick = searchNews;
        if (searchKeyword) searchKeyword.onkeydown = (e) => {
             if (e.key === 'Enter') { searchNews(); }
        };
        if (clearSearchBtn) clearSearchBtn.onclick = clearSearch;

        // 4. アコーディオン開閉制御とボタン設定
        document.querySelectorAll('.archive-item').forEach(details => {
            details.addEventListener('toggle', toggleCloseButton);
        });

        setupCloseButton();
        toggleCloseButton(); 

    } catch (error) {
        console.error('データ取得エラー:', error);
        document.getElementById('latestNewsList').innerHTML = `<p class="text-center text-danger">ニュースデータの読み込みに失敗しました。</p>`;
        const lastUpdatedElement = document.getElementById('last-updated');
        if (lastUpdatedElement) {
            lastUpdatedElement.textContent = new Date().toLocaleString() + " (エラー)";
        }
        return;
    }
}


// --- 検索ロジックおよびアコーディオン制御ロジック ---
let scrollPositionBeforeAccordion = 0;

function searchNews() {
    const keywordElement = document.getElementById('searchKeyword');
    const keyword = keywordElement ? keywordElement.value.toLowerCase() : '';

    const allNewsItems = document.querySelectorAll('.news-item');
    let foundCount = 0;
    
    // 検索前の初期化: 全記事を表示状態に戻し、全アコーディオンを一旦閉じる
    document.querySelectorAll('.archive-item').forEach(details => {
        details.open = false; 
    });

    allNewsItems.forEach(item => {
        item.style.display = 'block'; 
        item.classList.remove('hidden-by-search');
    });

    if (keyword.trim() === '') {
        document.getElementById('search-result-count').textContent = '';
        // キーワードが空の場合は、検索結果コンテナも非表示にする
        document.getElementById('searchResults').style.display = 'none'; 
        toggleCloseButton(); 
        return;
    }
    
    // 検索開始時に、検索結果コンテナを表示する
    document.getElementById('searchResults').style.display = 'block'; 

    
    // 検索実行
    allNewsItems.forEach(item => {
        const title = item.querySelector('.news-title-link')?.textContent.toLowerCase() || '';
        const meta = item.querySelector('.news-meta')?.textContent.toLowerCase() || '';
        
        if (title.includes(keyword) || meta.includes(keyword)) {
            item.style.display = 'block';
            item.classList.remove('hidden-by-search');
            foundCount++;

            const parentDetails = item.closest('.archive-item');
            if (parentDetails) {
                parentDetails.open = true; 
            }

        } else {
            item.style.display = 'none';
            item.classList.add('hidden-by-search');
        }
    });
    
    // 検索結果の表示
    document.getElementById('search-result-count').textContent = ` (${foundCount} 件)`;
    
    toggleCloseButton();
}

function clearSearch(e) {
    e.preventDefault();
    const keywordElement = document.getElementById('searchKeyword');
    if (keywordElement) {
        keywordElement.value = '';
    }
    document.getElementById('search-result-count').textContent = '';
    
    // ★ 修正ポイント: キーワードをクリアした後、searchNews関数を呼び出し、
    // キーワードが空の状態での全記事再表示ロジックを実行させる。
    searchNews(); 
}


function toggleCloseButton() {
    const openAccordions = document.querySelectorAll('.archive-item[open]').length;
    const btn = document.getElementById('close-accordion-btn');

    if (btn) {
        if (openAccordions > 0) {
            if (btn.style.display === 'none') {
                scrollPositionBeforeAccordion = window.scrollY; 
            }
            btn.style.display = 'flex'; 
        } else {
            btn.style.display = 'none';
        }
    }
}

function setupCloseButton() {
    const btn = document.getElementById('close-accordion-btn');

    if (btn) {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.archive-item[open]').forEach(details => {
                details.open = false;
            });
            
            btn.style.display = 'none'; 
            
            window.scrollTo({
                top: scrollPositionBeforeAccordion,
                behavior: 'smooth'
            });
        });
    }
}


// ----------------------------------------------------------------
// 初期化
// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', renderNews);
