// =================================================================
// script.js 完全版 (検索機能修正済み)
// =================================================================
// ... (他の関数は省略。修正は searchNews のみ)

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

            // ★★★ 修正ポイント: アーカイブ記事の場合、親のアコーディオンを開く ★★★
            // itemから最も近い親の .archive-item 要素を探す
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
// ... (変更なし)
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
// ... (変更なし)
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
// ... (変更なし)
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
