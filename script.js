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
                    // companies.jsonが読めなくても、最小限の表示は試みる
                    renderNews(newsData, []);
                });
        })
        .catch(error => {
            console.error('ニュースデータの読み込みエラー:', error);
            document.getElementById('newsAccordion').innerHTML = `<div class="alert alert-danger" role="alert">ニュースの読み込み中にエラーが発生しました。時間を置いて再度お試しください。</div>`;
        });
});

/**
 * ニュースデータを企業ごとにグループ化し、アコーディオンとして表示する
 * @param {Array} newsData - news.json から読み込んだニュース記事の配列
 * @param {Array} companies - companies.json から読み込んだ企業リストの配列
 */
function renderNews(newsData, companies) {
    const newsAccordion = document.getElementById('newsAccordion');
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

    // 企業リストの順番でアコーディオンを生成
    companies.forEach((company, index) => {
        const companyId = company.id;
        const companyName = company.name;
        const articles = groupedNews[companyId] || [];

        // アコーディオン要素の生成
        const accordionItem = document.createElement('div');
        accordionItem.className = 'accordion-item';

        const accordionId = `collapse-${companyId}`;
        const isFirst = index === 0; // 最初の企業はデフォルトで開いておく

        accordionItem.innerHTML = `
            <h2 class="accordion-header" id="heading-${companyId}">
                <button class="accordion-button ${isFirst ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#${accordionId}" aria-expanded="${isFirst ? 'true' : 'false'}" aria-controls="${accordionId}">
                    ${companyName} (${articles.length}件)
                </button>
            </h2>
            <div id="${accordionId}" class="accordion-collapse collapse ${isFirst ? 'show' : ''}" aria-labelledby="heading-${companyId}" data-bs-parent="#newsAccordion">
                <div class="accordion-body">
                    <ul class="list-unstyled">
                        ${articles.map(article => {
                            const publishedTime = new Date(article.published).getTime();
                            const isNew = publishedTime > oneDayAgo;
                            const newLabel = isNew ? '<span class="new-label">NEW!</span>' : '';
                            
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
                                        ${formattedDate} - ${article.source || companyName}
                                    </div>
                                </li>
                            `;
                        }).join('')}
                    </ul>
                </div>
            </div>
        `;
        newsAccordion.appendChild(accordionItem);
    });

    // 最終更新日時を表示
    if (newsData.length > 0) {
        // news.jsonファイル自体のタイムスタンプではなく、最も新しい記事の日付を表示することが多いが、今回は簡略化しnews.jsonの更新時刻を代替する
        const latestArticleTime = new Date(newsData[0].published); // news.jsonは既に新しい順にソートされているため
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
