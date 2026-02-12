/**
 * ChainCatcher 链捕手快讯抓取器
 * https://www.chaincatcher.com/news
 */

async function scrapeChainCatcher(page) {
  const url = 'https://www.chaincatcher.com/news';

  try {
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 等待页面加载
    await new Promise(resolve => setTimeout(resolve, 2000));

    const news = await page.evaluate(() => {
      const items = [];

      // ChainCatcher 使用 Nuxt.js，数据在 window.__NUXT__ 中
      if (window.__NUXT__ && window.__NUXT__.data) {
        // 遍历 data 对象寻找快讯列表
        const findNewsList = (obj) => {
          if (!obj || typeof obj !== 'object') return null;

          // 检查是否是快讯数组
          if (Array.isArray(obj)) {
            const hasNews = obj.some(item =>
              item && (item.title || item.description) && (item.createTime || item.releaseTime)
            );
            if (hasNews && obj.length > 5) return obj;
          }

          // 递归搜索
          for (const key of Object.keys(obj)) {
            if (key === 'newsFlashList' || key === 'list' || key === 'newsList') {
              if (Array.isArray(obj[key])) return obj[key];
            }
            const result = findNewsList(obj[key]);
            if (result) return result;
          }
          return null;
        };

        const newsList = findNewsList(window.__NUXT__.data);

        if (newsList) {
          return newsList.slice(0, 30).map(item => ({
            title: item.title || item.description || '',
            content: item.description || item.content || '',
            time: item.createTime || item.releaseTime || item.time || '',
            isImportant: item.isHot || item.topping || item.isTop || false,
            isHot: item.isHot || false,
            isTop: item.topping || item.isTop || false,
            link: item.id ? `https://www.chaincatcher.com/article/${item.id}` : '',
            tags: item.tagNames || [],
            source: 'ChainCatcher'
          }));
        }
      }

      // 备用: 从 DOM 中提取
      const elements = document.querySelectorAll('[class*="news-item"], [class*="flash-item"], article, .news-card');

      elements.forEach(el => {
        const titleEl = el.querySelector('h3, h4, .title, [class*="title"]');
        const timeEl = el.querySelector('time, .time, [class*="time"]');
        const isHot = el.querySelector('.hot, [class*="hot"]') !== null;
        const isTop = el.querySelector('.top, [class*="top"], .topping') !== null;

        const title = titleEl?.textContent?.trim();
        if (title) {
          items.push({
            title,
            time: timeEl?.textContent?.trim() || '',
            isImportant: isHot || isTop,
            isHot,
            isTop,
            link: el.querySelector('a')?.href || '',
            source: 'ChainCatcher'
          });
        }
      });

      return items.slice(0, 30);
    });

    return news.map(item => ({
      ...item,
      source: 'ChainCatcher',
      sourceColor: '#FF6B35',
      timestamp: parseTime(item.time)
    }));

  } catch (error) {
    console.error('ChainCatcher 抓取失败:', error.message);
    return [];
  }
}

function parseTime(timeStr) {
  if (!timeStr) return Date.now();

  // 处理 ISO 格式时间
  if (timeStr.includes('T')) {
    const parsed = Date.parse(timeStr);
    if (!isNaN(parsed)) return parsed;
  }

  // 处理 "5分钟前", "1小时前" 等格式
  const minuteMatch = timeStr.match(/(\d+)\s*分钟前/);
  if (minuteMatch) {
    return Date.now() - parseInt(minuteMatch[1]) * 60 * 1000;
  }

  const hourMatch = timeStr.match(/(\d+)\s*小时前/);
  if (hourMatch) {
    return Date.now() - parseInt(hourMatch[1]) * 60 * 60 * 1000;
  }

  const dayMatch = timeStr.match(/(\d+)\s*天前/);
  if (dayMatch) {
    return Date.now() - parseInt(dayMatch[1]) * 24 * 60 * 60 * 1000;
  }

  // 尝试直接解析
  const parsed = Date.parse(timeStr);
  if (!isNaN(parsed)) return parsed;

  return Date.now();
}

module.exports = { scrapeChainCatcher };
