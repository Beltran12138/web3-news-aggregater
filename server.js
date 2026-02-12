const express = require('express');
const cors = require('cors');
const path = require('path');
const puppeteer = require('puppeteer');

const { scrapeBlockBeats } = require('./scrapers/blockbeats');
const { scrapeChainCatcher } = require('./scrapers/chaincatcher');
const { scrapeForesight } = require('./scrapers/foresight');
const { scrapeUniversal, sourcesConfig } = require('./scrapers/universal');
const { scrapeExchange, exchangeSources } = require('./scrapers/exchanges');
const { scrapeTwitter } = require('./scrapers/twitter');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// 缓存
let newsCache = {
  data: [],
  lastUpdate: 0,
  isUpdating: false
};

const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 浏览器实例
let browser = null;

async function getBrowser() {
  if (!browser) {
    console.log('启动浏览器...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });
  }
  return browser;
}

// 聚合抓取所有平台
async function fetchAllNews() {
  if (newsCache.isUpdating) {
    console.log('正在更新中，返回缓存数据');
    return newsCache.data;
  }

  // 检查缓存是否有效
  if (Date.now() - newsCache.lastUpdate < CACHE_DURATION && newsCache.data.length > 0) {
    console.log('返回缓存数据');
    return newsCache.data;
  }

  newsCache.isUpdating = true;
  console.log('开始抓取所有平台...');

  try {
    const browserInstance = await getBrowser();
    const allNews = [];
    
    // 分批抓取，避免内存占用过高
    // 1. 基础快讯
    const basePages = await Promise.all([
      browserInstance.newPage(),
      browserInstance.newPage(),
      browserInstance.newPage()
    ]);

    const baseResults = await Promise.allSettled([
      scrapeBlockBeats(basePages[0]),
      scrapeChainCatcher(basePages[1]),
      scrapeForesight(basePages[2])
    ]);

    baseResults.forEach(r => r.status === 'fulfilled' && allNews.push(...r.value));
    await Promise.all(basePages.map(p => p.close().catch(() => {})));

    // 2. 通用源 (PR, HK, etc)
    const universalSources = Object.keys(sourcesConfig);
    for (const source of universalSources) {
      const page = await browserInstance.newPage();
      try {
        const results = await scrapeUniversal(page, source);
        allNews.push(...results);
      } finally {
        await page.close().catch(() => {});
      }
    }

    // 3. 交易所公告
    const exchanges = Object.keys(exchangeSources);
    for (const ex of exchanges) {
      const page = await browserInstance.newPage();
      try {
        const results = await scrapeExchange(page, ex);
        allNews.push(...results);
      } finally {
        await page.close().catch(() => {});
      }
    }

    // 4. Twitter
    const twitterPage = await browserInstance.newPage();
    try {
      const twitterResults = await scrapeTwitter(twitterPage, '_FORAB_');
      allNews.push(...twitterResults);
    } finally {
      await twitterPage.close().catch(() => {});
    }

    // 按时间排序 (最新的在前)
    allNews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // 去重
    const deduplicated = [];
    const seenTitles = new Set();

    for (const news of allNews) {
      const normalizedTitle = news.title.replace(/\s+/g, '').substring(0, 40);
      if (!seenTitles.has(normalizedTitle)) {
        seenTitles.add(normalizedTitle);
        deduplicated.push(news);
      }
    }

    newsCache.data = deduplicated;
    newsCache.lastUpdate = Date.now();

    console.log(`总计: ${deduplicated.length} 条去重后的快讯`);

    return deduplicated;

  } catch (error) {
    console.error('抓取失败:', error);
    return newsCache.data;
  } finally {
    newsCache.isUpdating = false;
  }
}

// API 路由
app.get('/api/news', async (req, res) => {
  try {
    const news = await fetchAllNews();
    res.json({
      success: true,
      count: news.length,
      lastUpdate: newsCache.lastUpdate,
      data: news
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 强制刷新
app.get('/api/refresh', async (req, res) => {
  newsCache.lastUpdate = 0; // 清除缓存
  try {
    const news = await fetchAllNews();
    res.json({
      success: true,
      count: news.length,
      lastUpdate: newsCache.lastUpdate,
      data: news
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    cacheAge: Date.now() - newsCache.lastUpdate,
    newsCount: newsCache.data.length
  });
});

// 首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║          Web3 新闻聚合器已启动                              ║
╠═══════════════════════════════════════════════════════════╣
║  访问地址: http://localhost:${PORT}                          ║
║                                                           ║
║  数据源:                                                   ║
║  - BlockBeats 律动                                         ║
║  - ChainCatcher 链捕手                                     ║
║  - Foresight News                                         ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // 预热: 启动时抓取一次
  fetchAllNews().then(() => {
    console.log('初始数据加载完成');
  });
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n正在关闭...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});
