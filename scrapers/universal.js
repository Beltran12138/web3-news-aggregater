/**
 * 通用抓取器 - 支持配置化抓取多个平台
 */

const sourcesConfig = {
  'PR Newswire': {
    url: 'https://www.prnewswire.com/apac/news-releases/consumer-technology-latest-news/cryptocurrency-list/?page=1&pagesize=25',
    selector: '.news-release-date, .news-release-date + a', // 这只是个示例，后面会优化逻辑
    color: '#3498db'
  },
  'MetaEra': {
    url: 'https://www.me.news/hk',
    color: '#f1c40f'
  },
  'Techub News': {
    url: 'https://www.techub.news/hongkong',
    color: '#e67e22'
  },
  'WuBlockchain': {
    url: 'https://www.wublock123.com/html/search/index.html?key=%u9999%u6E2F',
    color: '#e74c3c'
  },
  'TechFlow': {
    url: 'https://www.techflowpost.com/zh-CN/article',
    color: '#9b59b6'
  }
};

async function scrapeUniversal(page, sourceKey) {
  const config = sourcesConfig[sourceKey];
  if (!config) return [];

  try {
    await page.goto(config.url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 等待页面加载
    await new Promise(resolve => setTimeout(resolve, 3000));

    const news = await page.evaluate((key) => {
      const items = [];
      
      // 根据不同的平台使用不同的提取逻辑
      if (key === 'PR Newswire') {
        const dateEls = document.querySelectorAll('.news-release-date');
        dateEls.forEach(dateEl => {
          const linkEl = dateEl.nextElementSibling;
          if (linkEl && linkEl.tagName === 'A') {
            items.push({
              title: linkEl.textContent.trim(),
              link: linkEl.href,
              time: dateEl.textContent.trim(),
              source: 'PR Newswire'
            });
          }
        });
      } else if (key === 'MetaEra') {
        // MetaEra 选择器提取 (假设)
        const articles = document.querySelectorAll('article, .list-item, [class*="item"]');
        articles.forEach(el => {
          const titleEl = el.querySelector('h1, h2, h3, .title');
          const linkEl = el.querySelector('a');
          const timeEl = el.querySelector('.time, .date');
          if (titleEl && linkEl) {
            items.push({
              title: titleEl.textContent.trim(),
              link: linkEl.href,
              time: timeEl?.textContent?.trim() || '',
              source: 'MetaEra'
            });
          }
        });
      } else if (key === 'Techub News') {
        const articles = document.querySelectorAll('.news-item, [class*="news-card"]');
        articles.forEach(el => {
          const titleEl = el.querySelector('.title, h3');
          const linkEl = el.querySelector('a');
          const timeEl = el.querySelector('.time, .date');
          if (titleEl && linkEl) {
            items.push({
              title: titleEl.textContent.trim(),
              link: linkEl.href,
              time: timeEl?.textContent?.trim() || '',
              source: 'Techub News'
            });
          }
        });
      } else if (key === 'WuBlockchain') {
        const list = document.querySelectorAll('.search-list-item, .news-item');
        list.forEach(el => {
          const titleEl = el.querySelector('.title, a');
          const linkEl = el.querySelector('a');
          const timeEl = el.querySelector('.time, .date');
          if (titleEl && linkEl) {
            items.push({
              title: titleEl.textContent.trim(),
              link: linkEl.href,
              time: timeEl?.textContent?.trim() || '',
              source: 'WuBlockchain'
            });
          }
        });
      } else if (key === 'TechFlow') {
        const list = document.querySelectorAll('.article-item, [class*="article"]');
        list.forEach(el => {
          const titleEl = el.querySelector('.title, h2, h3');
          const linkEl = el.querySelector('a');
          const timeEl = el.querySelector('.time');
          if (titleEl && linkEl) {
            items.push({
              title: titleEl.textContent.trim(),
              link: linkEl.href,
              time: timeEl?.textContent?.trim() || '',
              source: 'TechFlow'
            });
          }
        });
      }

      return items;
    }, sourceKey);

    return news.map(item => ({
      ...item,
      sourceColor: config.color,
      timestamp: parseTime(item.time)
    }));
  } catch (error) {
    console.error(`${sourceKey} 抓取失败:`, error.message);
    return [];
  }
}

function parseTime(timeStr) {
  if (!timeStr) return Date.now();
  
  // 简单的时间解析逻辑
  const now = new Date();
  if (timeStr.includes('分钟前')) {
    const min = parseInt(timeStr);
    return now.getTime() - min * 60000;
  }
  if (timeStr.includes('小时前')) {
    const hour = parseInt(timeStr);
    return now.getTime() - hour * 3600000;
  }
  
  const parsed = Date.parse(timeStr);
  return isNaN(parsed) ? Date.now() : parsed;
}

module.exports = { scrapeUniversal, sourcesConfig };
