document.addEventListener('DOMContentLoaded', () => {
    fetch('news.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('news.jsonの読み込みに失敗しました。');
            }
            return response.json();
        })
        .then(newsData => {
            fetch('companies.json')
                .then(res => res.json())
                .then(companies => {
                    renderNews(newsData, companies);
                })
                .catch(error => {
                    console.error('companies.jsonの読み込みエラー:', error);
                    renderNews(newsData, []);
                });
        })
        .catch(error => {
            console.error('ニュースデータの読み込みエラー:', error);
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

    // 企業リストをIDでアクセスしやすいようにマップ化
    const companyMap = companies.reduce((map, company) => {
        map[company.id] = company.name;
        return map;
    }, {});

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
    // 1. 新着記事セクションの生成
    // ----------------------------------------------------------------
    
    // 過去24時間以内の記事をフィルタリング
    const latestArticles = newsData.filter(article => {
        const publishedTime = new Date(article.published).getTime();
        return publishedTime > oneDayAgo;
    });

    if (latestArticles.length === 0) {
        latestNewsList.innerHTML = `<div class="alert alert-info text-center" role="alert">過去24時間以内に新しい記事はありません。</div>`;
    } else {
        const ul = document.createElement('ul');
        ul.className = 'list-unstyled';
        ul.innerHTML = latestArticles.map(article => {
            const companyName = companyMap[article.company_id] || '不明な企業';

            return createNewsListItem(article, companyName, true);
        }).join('');
        latestNewsList.appendChild(ul);
    }

    // ----------------------------------------------------------------
    // 2. 企業別アーカイブの生成 (アコーディオン)
    // ----------------------------------------------------------------
    // 以前のコンテンツをクリア
    newsAccordion.innerHTML = ''; 

    companies.forEach((company, index) => {
        const companyId = company.id;
        const companyName = company.name;
        const articles = groupedNews[companyId] || [];

        // アコーディオン要素の生成
        const accordionItem = document.createElement('div');
        accordionItem.className = 'accordion-item';

        const accordionId = `collapse-${companyId}`;
        
        // 修正ポイント: isFirstを使わず、デフォルトで閉じた状態にする
        accordionItem.innerHTML = `
            <h2 class="accordion-header" id="heading-${companyId}">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${accordionId}" aria-expanded="false" aria-controls="${accordionId}">
                    ${companyName}
                </button>
            </h2>
            <div id="${accordionId}" class="accordion-collapse collapse" aria-labelledby="heading-${companyId}" data-bs-parent="#newsAccordion">
                <div class="accordion-body">
                    <ul class="list-unstyled">
                        ${articles.length === 0 ? `<li class="text-muted">記事が見つかりませんでした。</li>` : articles.map(article => {
                            // アーカイブセクションでは、記事の横にNEW!ラベルを付ける
                            const publishedTime = new Date(article.published).getTime();
                            const oneDayAgo = now.getTime() - (24 * 60 * 60 * 1000);
                            const isNew = publishedTime > oneDayAgo;
                            const newLabel = isNew ? '<span class="new-label">NEW!</span>' : '';
                            
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
        const latestArticleTime = new Date(newsData[0].published);
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
    // 日付を「YYYY/MM/DD hh:mm」形式にフォーマット
    const formattedDate = new Date(article.published).toLocaleString('ja-JP', {
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
