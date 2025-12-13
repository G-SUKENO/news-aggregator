document.addEventListener('DOMContentLoaded', () => {
    const newsListElement = document.getElementById('news-list');

    fetch('news.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            newsListElement.innerHTML = ''; 

            if (data.length === 0) {
                newsListElement.innerHTML = '<p>新しいニュースはありません。</p>';
                return;
            }

            data.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('news-item');

                // リンク
                const link = document.createElement('a');
                link.href = item.link;
                link.target = '_blank'; 
                link.rel = 'noopener noreferrer';

                // タイトル
                const title = document.createElement('h3');
                title.textContent = item.title;
                link.appendChild(title);
                itemDiv.appendChild(link);

                // メタ情報
                const meta = document.createElement('p');
                meta.classList.add('meta');
                const date = new Date(item.published);
                meta.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()} - ${item.source}`;
                itemDiv.appendChild(meta);

                newsListElement.appendChild(itemDiv);
            });
        })
        .catch(error => {
            console.error('ニュースデータの読み込みエラー:', error);
            newsListElement.innerHTML = `<p>データの読み込みに失敗しました: ${error.message}</p>`;
        });
});
