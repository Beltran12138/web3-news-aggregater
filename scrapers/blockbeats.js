/**
 * BlockBeats 律动快讯抓取器
 * https://www.theblockbeats.info/newsflash
 */

async function scrapeBlockBeats(page) {
  const url = 'https://www.theblockbeats.info/newsflash';

  try {
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 等待快讯列表加载
    await page.waitForSelector('.news-flash-item, .newsflash-item, [class*="flash"], [class*="news-item"]', {
      timeout: 10000
    }).catch(() => {});

    // 额外等待确保内容加载
    await new Promise(resolve => setTimeout(resolve, 2000));

    const news = await page.evaluate(() => {
      const items = [];

      // 尝试多种可能的选择器
      const selectors = [
        '.news-flash-item',
        '.newsflash-item',
        '[class*="flash-item"]',
        '[class*="news-card"]',
        '.flash-list-item',
        'article',
        '.news-item'
      ];

      let elements = [];
      for (const selector of selectors) {
        elements = document.querySelectorAll(selector);
        if (elements.length > 0) break;
      }

      // 如果还是没找到，尝试从页面数据中提取
      if (elements.length === 0) {
        // 尝试从 __NEXT_DATA__ 或其他嵌入数据中获取
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          const text = script.textContent || '';
          if (text.includes('newsflash') || text.includes('flash')) {
            try {
              // 尝试解析 JSON 数据
              const match = text.match(/\{.*"list":\s*\[.*\].*\}/s);
              if (match) {
                const data = JSON.parse(match[0]);
                if (data.list && Array.isArray(data.list)) {
                  return data.list.slice(0, 30).map(item => ({
                    title: item.title || item.content || '',
                    time: item.add_time || item.created_at || item.time || '',
                    isImportant: item.is_important || item.importance > 0 || false,
                    link: item.url || item.link || '',
                    source: 'BlockBeats'
                  }));
                }
              }
            } catch (e) {}
          }
        }
      }

      elements.forEach(el => {
        const titleEl = el.querySelector('h3, h4, .title, [class*="title"], .content, p');
        const timeEl = el.querySelector('time, .time, [class*="time"], .date, span[class*="date"]');
        const isImportant = el.classList.contains('important') ||
                           el.querySelector('.important, .hot, [class*="important"], [class*="hot"]') !== null ||
                           el.getAttribute('data-important') === 'true';

        const title = titleEl?.textContent?.trim();
        const time = timeEl?.textContent?.trim() || timeEl?.getAttribute('datetime') || '';

        if (title && title.length > 5) {
          items.push({
            title,
            time,
            isImportant,
            link: el.querySelector('a')?.href || '',
            source: 'BlockBeats'
          });
        }
      });

      return items.slice(0, 30);
    });

    return news.map(item => ({
      ...item,
      source: 'BlockBeats',
      sourceColor: '#1E88E5',
      timestamp: parseTime(item.time)
    }));

  } catch (error) {
    console.error('BlockBeats 抓取失败:', error.message);
    return [];
  }
}

function parseTime(timeStr) {
  if (!timeStr) return Date.now();

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

  // 尝试直接解析日期
  const parsed = Date.parse(timeStr);
  if (!isNaN(parsed)) return parsed;

  return Date.now();
}

module.exports = { scrapeBlockBeats };
