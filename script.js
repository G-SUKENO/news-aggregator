// =================================================================
// script.js 完全版 (生成時刻表示適用)
// =================================================================

const NEWS_FILE = 'news.json';
const COMPANIES_FILE = 'companies.json';
const COMPANY_IDS = {}; // 企業IDと企業名をマッピング

// ----------------------------------------------------------------
// ユーティリティ関数
// ----------------------------------------------------------------

function parseDateAsJST(dateString) {
    return new Date(dateString);
}

function createNewsListItem(article, companyName, newLabel = '') {
    // ... (関数内部のロジックは変更なし)
    const articleDate = parseDateAsJST(article.published);
    
    const formattedDate = articleDate.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
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
    let newsDataContainer = {}; // news.json 全体（メタデータを含む）を格納
    let companies = [];

    // データの読み込み
    try {
        const [newsResponse, companiesResponse] = await Promise.all([
            fetch(NEWS_FILE),
            fetch(COMPANIES_FILE)
        ]);

        if (!newsResponse.ok || !companiesResponse.ok) {
            throw new Error('データの読み込みに失敗しました。');
        }

        // ★ 修正点: ニュースデータをコンテナとして読み込む ★
        newsDataContainer = await newsResponse.json();
        const newsData = newsDataContainer.articles || []; // 記事リストを取り出す
        companies = await companiesResponse.json();
        
        // ----------------------------------------------------------------
        // 時刻ロジックの定義と表示 (ここが最大の修正点)
        // ----------------------------------------------------------------
        // ★ サーバー側で記録された生成時刻を使用する ★
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
                hour12: false
            });
        } else {
            // データがない場合は、読み込み時刻を表示
            displayTime = new Date().toLocaleString('ja-JP', {
                year: 'numeric', month: '2-digit', day: '2-digit', 
                hour: '2-digit', minute: '2-digit', hour12: false
            }) + " (時刻不明)";
        }
        
        document.getElementById('last-updated').textContent = displayTime;


        // ----------------------------------------------------------------
        // 以下のロジックは前のバージョンと同じ
        // ----------------------------------------------------------------
        
        // 企業IDマップの構築
        companies.forEach(company => {
            COMPANY_IDS[company.id] = company.name;
        });

        const currentTime = new Date(); 
        const oneDayAgoCutoff = currentTime.getTime() - (24 * 60 * 60 * 1000); 
        
        // 1. 新着記事セクションの生成 (公開から24時間以内)
        
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

        // 2. 企業別アーカイブの生成 (公開から24時間以上経過)
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
                // 件数表示なし
                detailsElement.innerHTML = `<summary class="archive-header">${companyName}</summary><div class="archive-content">${newsListHtml}</div>`;

                archiveListContainer.appendChild(detailsElement);
            }
        });

        if (!archiveFound) {
             archiveListContainer.innerHTML = `<p class="text-center text-muted">現在、アーカイブ記事はありません。</p>`;
        }

        // 3. 検索機能
        document.getElementById('searchButton').onclick = searchNews;
        document.getElementById('searchKeyword').onkeydown = (e) => {
            if (e.key === 'Enter') { searchNews(); }
        };
        document.getElementById('clearSearch').onclick = clearSearch;

        // 4. アコーディオン開閉制御とボタン設定
        document.querySelectorAll('.archive-item').forEach(details => {
            details.addEventListener('toggle', toggleCloseButton);
        });

        setupCloseButton();
        toggleCloseButton(); 

    } catch (error) {
        console.error('データ取得エラー:', error);
        document.getElementById('latestNewsList').innerHTML = `<p class="text-center text-danger">ニュースデータの読み込みに失敗しました。</p>`;
        document.getElementById('last-updated').textContent = new Date().toLocaleString() + " (エラー)";
        return;
    }
}


// --- 検索ロジックおよびアコーディオン制御ロジックは前バージョンと同じため省略 ---
// ... (searchNews, clearSearch, toggleCloseButton, setupCloseButton 関数を続けてください)

let scrollPositionBeforeAccordion = 0;

function searchNews() { /* ... 省略 ... */ }
function clearSearch(e) { /* ... 省略 ... */ }

function toggleCloseButton() {
    const openAccordions = document.querySelectorAll('.archive-item[open]').length;
    const btn = document.getElementById('close-accordion-btn');

    if (openAccordions > 0) {
        if (btn.style.display === 'none') {
            scrollPositionBeforeAccordion = window.scrollY; 
        }
        btn.style.display = 'flex'; 
    } else {
        btn.style.display = 'none';
    }
}

function setupCloseButton() {
    const btn = document.getElementById('close-accordion-btn');

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


// ----------------------------------------------------------------
// 初期化
// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', renderNews);
