/**
 * 交易所公告抓取器
 */

const exchangeSources = {
  'Binance': {
    url: 'https://www.binance.com/zh-CN/support/announcement/c-48?navId=48',
    color: '#F3BA2F'
  },
  'OKX': {
    url: 'https://www.okx.com/zh-hans/help/section/announcements-latest-announcements',
    color: '#000000'
  },
  'Bybit': {
    url: 'https://announcements.bybit.com/zh-MY/',
    color: '#f7a600'
  },
  'Bitget': {
    url: 'https://www.bitget.com/zh-CN/support/announcements',
    color: '#00F0FF'
  },
  'Gate.io': {
    url: 'https://www.gate.com/zh/announcements/lastest',
    color: '#e91e63'
  },
  'Kucoin': {
    url: 'https://www.kucoin.com/zh-hant/announcement/latest-announcements',
    color: '#24ae8f'
  },
  'MEXC': {
    url: 'https://www.mexc.com/zh-MY/support/announcements',
    color: '#00d285'
  },
  'HTX': {
    url: 'https://www.htx.com/zh-cn/support/list/announcements',
    color: '#0052ff'
  },
  'HashKey Exchange': {
    url: 'https://support.hashkey.com/hc/en-gb/categories/900001209743-Announcement',
    color: '#121212'
  },
  'HashKey Group': {
    url: 'https://group.hashkey.com/en/news/categories/announcement-1',
    color: '#121212'
  },
  'OSL': {
    url: 'https://www.osl.com/zh-Hans/announcement',
    color: '#000000'
  },
  'Matrixport': {
    url: 'https://helpcenter.matrixport.com/zh-CN/collections/10411294-%E5%AE%98%E6%96%B9%E5%85%AC%E5%91%8A',
    color: '#1e3d59'
  },
  'Ex.io': {
    url: 'https://www.ex.io/zh/support/announcements',
    color: '#0052ff'
  }
};

async function scrapeExchange(page, exchangeKey) {
  const config = exchangeSources[exchangeKey];
  if (!config) return [];

  try {
    await page.goto(config.url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 等待加载
    await new Promise(resolve => setTimeout(resolve, 3000));

    const announcements = await page.evaluate((key) => {
      const items = [];
      
      // 这里的选择器是通用的尝试
      const selectors = [
        'a.announcement-item',
        '.article-list-item a',
        '.announcement-list a',
        '.news-list-item a',
        'a[href*="announcement"]',
        'a[href*="article"]',
        '.list-item a',
        '.help-center-article a'
      ];

      let elements = [];
      for (const selector of selectors) {
        const found = document.querySelectorAll(selector);
        if (found.length > 5) {
          elements = Array.from(found);
          break;
        }
      }

      if (elements.length === 0) {
        // 如果没找到，尝试所有链接
        elements = Array.from(document.querySelectorAll('a')).filter(a => 
          a.textContent.length > 10 && (a.href.includes('announcement') || a.href.includes('article'))
        );
      }

      elements.forEach(el => {
        const title = el.textContent.trim();
        const link = el.href;
        
        // 尝试寻找日期
        let time = '';
        const parent = el.parentElement;
        const timeEl = parent.querySelector('.time, .date, span[class*="date"], span[class*="time"]');
        if (timeEl) time = timeEl.textContent.trim();

        if (title && title.length > 5 && !items.some(i => i.title === title)) {
          items.push({
            title,
            link,
            time,
            source: key
          });
        }
      });

      return items.slice(0, 15);
    }, exchangeKey);

    return announcements.map(item => ({
      ...item,
      sourceColor: config.color,
      timestamp: Date.now() // 交易所公告通常很难直接在列表页抓到精确时间，默认用当前抓取时间
    }));

  } catch (error) {
    console.error(`${exchangeKey} 公告抓取失败:`, error.message);
    return [];
  }
}

module.exports = { scrapeExchange, exchangeSources };
