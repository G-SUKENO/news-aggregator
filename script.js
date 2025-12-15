// =================================================================
// script.js 完全版 (検索機能、JST強制表示、新JSON形式対応)
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
    // タイムゾーン情報（+09:00）を含むため、Dateオブジェクトは正しいUTC時刻を内部保持する
    return new Date(dateString);
}

/**
 * 記事をリストアイテムのHTMLとして生成する。
 */
function createNewsListItem(article, companyName, newLabel = '') {
    const articleDate = parseDateAsJST(article.published);
    
    // タイムゾーンを明示的に 'Asia/Tokyo' に指定し、JSTで表示する
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

// ★★★ この定義は、他の関数の内部ではなく、グローバルに配置されます ★★★
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

        // ニュースデータと企業リストの読み込み
        newsDataContainer = await newsResponse.json();
        const newsData = newsDataContainer.articles || []; // 新JSON形式: 'articles'リストを取り出す
        companies = await companiesResponse.json();
        
        // ----------------------------------------------------------------
        // 時刻ロジックの定義と表示 (最終更新時刻)
        // ----------------------------------------------------------------
        const generatedAtString = newsDataContainer.generated_at;
        
        let displayTime;
        if (generatedAtString) {
            const generatedDate = parseDateAsJST(generatedAtString);
            
            // タイムゾーンを明示的に 'Asia/Tokyo' に指定し、JSTで表示する
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
            // データがない場合は、読み込み時刻をローカルタイムで表示
            displayTime = new Date().toLocaleString('ja-JP', {
                year: 'numeric', month: '2-digit', day: '2-digit', 
                hour: '2-digit', minute: '2-digit', hour12: false
            }) + " (時刻不明)";
        }
        
        // 'last-updated' エレメントに表示
        const lastUpdatedElement = document.getElementById('last-updated');
        if (lastUpdatedElement) {
             lastUpdatedElement.textContent = `最終更新: ${displayTime}`;
        }


        // ----------------------------------------------------------------
        // 記事の分類・レンダリングロジック
        // ----------------------------------------------------------------
        
        // 企業IDマップの構築
        companies.forEach(company => {
            COMPANY_IDS[company.id] = company.name;
        });

        const currentTime = new Date(); 
        const oneDayAgoCutoff = currentTime.getTime() - (24 * 60 * 60 * 1000); 
        
        // 1. 新着記事セクションの生成 (公開から24時間以内)
        
        const latestArticles = newsData.filter(article => {
            // 時刻比較にはgetTime()を使う
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
        details.open = false; // 検索前に全アコーディオンを閉じる
    });

    allNewsItems.forEach(item => {
        item.style.display = 'block'; // 初期化
        item.classList.remove('hidden-by-search');
    });

    if (keyword.trim() === '') {
        // キーワードが空の場合は全て表示
        document.getElementById('search-result-count').textContent = '';
        toggleCloseButton(); // ボタンの状態を更新
        return;
    }
    
    // 検索実行
    allNewsItems.forEach(item => {
        const title = item.querySelector('.news-title-link')?.textContent.toLowerCase() || '';
        const meta = item.querySelector('.news-meta')?.textContent.toLowerCase() || '';
        
        if (title.includes(keyword) || meta.includes(keyword)) {
            // キーワードが見つかった場合
            item.style.display = 'block';
            item.classList.remove('hidden-by-search');
            foundCount++;

            // ★ 検索機能修正ポイント: アーカイブ記事の場合、親のアコーディオンを開く ★
            const parentDetails = item.closest('.archive-item');
            if (parentDetails) {
                parentDetails.open = true; // 該当記事を含むアコーディオンを開く
            }

        } else {
            // キーワードが見つからなかった場合
            item.style.display = 'none';
            item.classList.add('hidden-by-search');
        }
    });
    
    // 検索結果の表示
    document.getElementById('search-result-count').textContent = ` (${foundCount} 件)`;
    
    // 検索後のアコーディオン開閉ボタンの状態更新
    toggleCloseButton();
}

function clearSearch(e) {
    e.preventDefault();
    const keywordElement = document.getElementById('searchKeyword');
    if (keywordElement) {
        keywordElement.value = '';
    }
    document.getElementById('search-result-count').textContent = '';
    
    // 全て表示に戻す
    document.querySelectorAll('.news-item').forEach(item => {
        item.style.display = 'block';
        item.classList.remove('hidden-by-search');
    });
    
    // アコーディオンを閉じる
    document.querySelectorAll('.archive-item').forEach(details => {
        details.open = false;
    });

    // アコーディオン開閉ボタンの状態更新
    toggleCloseButton();
}


function toggleCloseButton() {
    const openAccordions = document.querySelectorAll('.archive-item[open]').length;
    const btn = document.getElementById('close-accordion-btn');

    if (btn) {
        if (openAccordions > 0) {
            if (btn.style.display === 'none') {
                // 開き始めた瞬間のスクロール位置を記録
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
            
            // アコーディオンを開く前の位置に戻る
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
