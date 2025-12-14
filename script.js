// =================================================================
// script.js 完全版 (NEW!ラベル：最新記事セクション全体に適用)
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
    let newsData = [];
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

        newsData = await newsResponse.json();
        companies = await companiesResponse.json();
    } catch (error) {
        console.error('データ取得エラー:', error);
        document.getElementById('latestNewsList').innerHTML = `<p class="text-center text-danger">ニュースデータの読み込みに失敗しました。</p>`;
        return;
    }

    // 企業IDマップの構築
    companies.forEach(company => {
        COMPANY_IDS[company.id] = company.name;
    });

    // ----------------------------------------------------------------
    // 時刻ロジックの定義
    // ----------------------------------------------------------------
    const currentTime = new Date(); 
    // 24時間前のカットオフタイムを定義 (最新記事とアーカイブの境界)
    const oneDayAgoCutoff = currentTime.getTime() - (24 * 60 * 60 * 1000); 
    
    // 最終更新日の表示
    document.getElementById('last-updated').textContent = currentTime.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });


    // ----------------------------------------------------------------
    // 1. 新着記事セクションの生成 (公開から24時間以内)
    // ----------------------------------------------------------------
    
    const latestArticles = newsData.filter(article => {
        const publishedTime = parseDateAsJST(article.published).getTime();
        // 記事公開時刻が「現在時刻から24時間前」より新しいかを判定
        return publishedTime > oneDayAgoCutoff;
    });

    const latestListContainer = document.getElementById('latestNewsList');
    latestListContainer.innerHTML = ''; 

    if (latestArticles.length > 0) {
        let latestHtml = '';
        
        latestArticles.forEach(article => {
            const companyName = COMPANY_IDS[article.company_id] || '不明';
            
            // ★ 修正点: 最新記事セクションにある記事はすべて NEW! とする ★
            const newLabel = '<span class="new-label">NEW!</span>'; 
            // 記事の published 時刻から24時間経過するまでは、NEW! ラベルを付ける
            
            latestHtml += createNewsListItem(article, companyName, newLabel);
        });
        
        latestListContainer.innerHTML = latestHtml;
    } else {
        latestListContainer.innerHTML = `<p class="text-center text-muted">過去24時間以内に公開された新しい記事はありません。</p>`;
    }


    // ----------------------------------------------------------------
    // 2. 企業別アーカイブの生成 (公開から24時間以上経過)
    // ----------------------------------------------------------------

    const groupedNews = {};
    companies.forEach(company => {
        groupedNews[company.id] = [];
    });

    newsData.forEach(article => {
        const publishedTime = parseDateAsJST(article.published).getTime();
        
        // アーカイブの記事は「公開時刻が24時間前以下」であること
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
                // アーカイブでは NEW! ラベルは不要
                newsListHtml += createNewsListItem(article, companyName);
            });
            
            // details要素 (アコーディオン) を生成
            const detailsElement = document.createElement('details');
            detailsElement.className = 'archive-item';

            detailsElement.innerHTML = `<summary class="archive-header">${companyName} (${archiveArticles.length}件)</summary><div class="archive-content">${newsListHtml}</div>`;

            archiveListContainer.appendChild(detailsElement);
        }
    });

    if (!archiveFound) {
         archiveListContainer.innerHTML = `<p class="text-center text-muted">現在、アーカイブ記事はありません。</p>`;
    }

    // ----------------------------------------------------------------
    // 3. 検索機能
    // ----------------------------------------------------------------

    document.getElementById('searchButton').onclick = searchNews;
    document.getElementById('searchKeyword').onkeydown = (e) => {
        if (e.key === 'Enter') {
            searchNews();
        }
    };
    document.getElementById('clearSearch').onclick = clearSearch;

    // ----------------------------------------------------------------
    // 4. アコーディオン開閉制御とボタン設定
    // ----------------------------------------------------------------
    document.querySelectorAll('.archive-item').forEach(details => {
        details.addEventListener('toggle', toggleCloseButton);
    });

    setupCloseButton();
}


// ----------------------------------------------------------------
// 検索ロジック (省略なし)
// ----------------------------------------------------------------

function searchNews() {
    const keyword = document.getElementById('searchKeyword').value.toLowerCase();
    const searchList = document.getElementById('searchList');
    const searchResults = document.getElementById('searchResults');
    const newsItems = document.querySelectorAll('.news-item');
    
    searchList.innerHTML = ''; 

    if (keyword.length === 0) {
        searchResults.style.display = 'none';
        document.getElementById('latestNewsList').parentElement.style.display = 'block';
        document.getElementById('archiveListContainer').parentElement.style.display = 'block';
        return;
    }

    document.getElementById('latestNewsList').parentElement.style.display = 'none';
    document.getElementById('archiveListContainer').parentElement.style.display = 'none';
    searchResults.style.display = 'block';

    let resultsHtml = '';
    let foundCount = 0;

    newsItems.forEach(item => {
        const titleLink = item.querySelector('.news-title-link');
        const meta = item.querySelector('.news-meta');
        
        if (titleLink && meta) {
            const titleText = titleLink.textContent.toLowerCase();
            const metaText = meta.textContent.toLowerCase();
            
            if (titleText.includes(keyword) || metaText.includes(keyword)) {
                resultsHtml += item.outerHTML;
                foundCount++;
            }
        }
    });

    if (foundCount > 0) {
        searchList.innerHTML = resultsHtml;
    } else {
        searchList.innerHTML = `<p class="text-center text-muted">「${keyword}」に一致する記事は見つかりませんでした。</p>`;
    }
}

function clearSearch(e) {
    if (e) e.preventDefault();
    document.getElementById('searchKeyword').value = '';
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('latestNewsList').parentElement.style.display = 'block';
    document.getElementById('archiveListContainer').parentElement.style.display = 'block';
}


// ----------------------------------------------------------------
// アコーディオン開閉ボタン制御ロジック (省略なし)
// ----------------------------------------------------------------

let scrollPositionBeforeAccordion = 0;

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
