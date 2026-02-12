/**
 * Twitter (X) 抓取器
 */

async function scrapeTwitter(page, username) {
  const url = `https://x.com/${username}`;

  try {
    // 设置一些请求头伪装成真实用户
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Twitter 经常会弹出登录框或者需要时间加载
    await new Promise(resolve => setTimeout(resolve, 5000));

    const tweets = await page.evaluate((user) => {
      const items = [];
      const tweetEls = document.querySelectorAll('article[data-testid="tweet"]');
      
      tweetEls.forEach(el => {
        const textEl = el.querySelector('div[data-testid="tweetText"]');
        const timeEl = el.querySelector('time');
        const linkEl = timeEl?.closest('a');

        if (textEl) {
          items.push({
            title: textEl.textContent.trim().substring(0, 100) + (textEl.textContent.length > 100 ? '...' : ''),
            content: textEl.textContent.trim(),
            link: linkEl ? linkEl.href : '',
            time: timeEl ? timeEl.getAttribute('datetime') : '',
            source: `Twitter: ${user}`
          });
        }
      });

      return items;
    }, username);

    return tweets.map(item => ({
      ...item,
      sourceColor: '#1DA1F2',
      timestamp: item.time ? Date.parse(item.time) : Date.now()
    }));

  } catch (error) {
    console.error(`Twitter (${username}) 抓取失败:`, error.message);
    return [];
  }
}

module.exports = { scrapeTwitter };
