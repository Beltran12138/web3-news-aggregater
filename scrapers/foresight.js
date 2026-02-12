/**
 * Foresight News 快讯抓取器
 * https://foresightnews.pro/news
 * 注意: 该网站有反爬虫混淆，需要完整执行JS
 */

async function scrapeForesight(page) {
  const url = 'https://foresightnews.pro/news';

  try {
    // 设置更真实的浏览器环境
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 45000
    });

    // 等待反爬虫脚本执行完成和页面渲染
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 等待内容加载
    await page.waitForSelector('[class*="news"], [class*="flash"], [class*="item"], article', {
      timeout: 15000
    }).catch(() => {});

    // 额外等待
    await new Promise(resolve => setTimeout(resolve, 2000));

    const news = await page.evaluate(() => {
      const items = [];

      // 尝试从全局状态中获取数据
      const globalKeys = ['__NUXT__', '__NEXT_DATA__', '__INITIAL_STATE__', 'window.__data'];
      for (const key of globalKeys) {
        try {
          const data = eval(key);
          if (data) {
            const findList = (obj, depth = 0) => {
              if (depth > 5 || !obj) return null;
              if (Array.isArray(obj) && obj.length > 3) {
                const hasNews = obj.some(item =>
                  item && typeof item === 'object' &&
                  (item.title || item.content) &&
                  (item.time || item.createTime || item.publishTime)
                );
                if (hasNews) return obj;
              }
              if (typeof obj === 'object') {
                for (const k of Object.keys(obj)) {
                  const result = findList(obj[k], depth + 1);
                  if (result) return result;
                }
              }
              return null;
            };
            const list = findList(data);
            if (list) {
              return list.slice(0, 30).map(item => ({
                title: item.title || item.content || '',
                content: item.content || item.description || item.summary || '',
                time: item.time || item.createTime || item.publishTime || item.createdAt || '',
                isImportant: item.isImportant || item.important || item.isTop || item.top || item.isHot || false,
                link: item.url || item.link || (item.id ? `https://foresightnews.pro/news/${item.id}` : ''),
                source: 'Foresight'
              }));
            }
          }
        } catch (e) {}
      }

      // 从 DOM 提取
      const selectors = [
        '[class*="news-item"]',
        '[class*="flash-item"]',
        '[class*="list-item"]',
        '[class*="article-item"]',
        '.news-card',
        'article',
        '[class*="card"]'
      ];

      let elements = [];
      for (const selector of selectors) {
        const found = document.querySelectorAll(selector);
        if (found.length > elements.length) {
          elements = found;
        }
      }

      // 如果还是没找到，尝试通用方法
      if (elements.length === 0) {
        // 寻找包含时间信息的容器
        const allDivs = document.querySelectorAll('div');
        const candidates = [];
        allDivs.forEach(div => {
          const text = div.textContent || '';
          if ((text.includes('分钟前') || text.includes('小时前') || text.includes(':')) &&
              text.length > 20 && text.length < 500) {
            candidates.push(div);
          }
        });
        elements = candidates.slice(0, 50);
      }

      elements.forEach(el => {
        // 尝试多种方式获取标题
        let title = '';
        const titleSelectors = ['h1', 'h2', 'h3', 'h4', '.title', '[class*="title"]', 'a', 'p'];
        for (const sel of titleSelectors) {
          const titleEl = el.querySelector(sel);
          if (titleEl) {
            const text = titleEl.textContent?.trim();
            if (text && text.length > 10 && text.length < 300) {
              title = text;
              break;
            }
          }
        }

        if (!title) {
          const text = el.textContent?.trim();
          if (text && text.length > 10 && text.length < 300) {
            title = text;
          }
        }

        // 获取时间
        let time = '';
        const timeEl = el.querySelector('time, .time, [class*="time"], [class*="date"], span');
        if (timeEl) {
          time = timeEl.textContent?.trim() || timeEl.getAttribute('datetime') || '';
        }

        // 检查重要性
        const isImportant = el.classList.toString().includes('important') ||
                          el.classList.toString().includes('hot') ||
                          el.classList.toString().includes('top') ||
                          el.querySelector('[class*="important"], [class*="hot"], [class*="top"]') !== null;

        if (title && title.length > 5) {
          items.push({
            title: title.substring(0, 200),
            time,
            isImportant,
            link: el.querySelector('a')?.href || '',
            source: 'Foresight'
          });
        }
      });

      // 去重
      const seen = new Set();
      return items.filter(item => {
        const key = item.title.substring(0, 50);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 30);
    });

    return news.map(item => ({
      ...item,
      source: 'Foresight',
      sourceColor: '#9C27B0',
      timestamp: parseTime(item.time)
    }));

  } catch (error) {
    console.error('Foresight News 抓取失败:', error.message);
    return [];
  }
}

function parseTime(timeStr) {
  if (!timeStr) return Date.now();

  // 处理 ISO 格式
  if (timeStr.includes('T') || timeStr.includes('-')) {
    const parsed = Date.parse(timeStr);
    if (!isNaN(parsed)) return parsed;
  }

  // 处理相对时间
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

  // 处理 HH:MM 格式 (今天的时间)
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const now = new Date();
    now.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
    return now.getTime();
  }

  return Date.now();
}

module.exports = { scrapeForesight };
