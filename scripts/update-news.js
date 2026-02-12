const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// 导入所有抓取器
const { scrapeBlockBeats } = require('../scrapers/blockbeats');
const { scrapeChainCatcher } = require('../scrapers/chaincatcher');
const { scrapeForesight } = require('../scrapers/foresight');
const { scrapeUniversal, sourcesConfig } = require('../scrapers/universal');
const { scrapeExchange, exchangeSources } = require('../scrapers/exchanges');
const { scrapeTwitter } = require('../scrapers/twitter');

const DATA_FILE = path.join(__dirname, '../public/data.json');

async function run() {
  console.log('开始执行定时抓取任务...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  const allNews = [];

  try {
    // 1. 基础快讯
    console.log('正在抓取基础快讯 (BlockBeats/ChainCatcher/Foresight)...');
    const basePages = await Promise.all([browser.newPage(), browser.newPage(), browser.newPage()]);
    const baseResults = await Promise.allSettled([
      scrapeBlockBeats(basePages[0]),
      scrapeChainCatcher(basePages[1]),
      scrapeForesight(basePages[2])
    ]);
    baseResults.forEach(r => {
      if(r.status === 'fulfilled') allNews.push(...r.value);
    });
    await Promise.all(basePages.map(p => p.close().catch(() => {})));

    // 2. 通用源
    console.log('正在抓取通用源 (PR/HK/Depth)...');
    const universalSources = Object.keys(sourcesConfig);
    for (const source of universalSources) {
      const page = await browser.newPage();
      try {
        const results = await scrapeUniversal(page, source);
        allNews.push(...results);
        console.log(`- ${source}: ${results.length} 条`);
      } catch (e) {
        console.error(`- ${source} 失败: ${e.message}`);
      } finally {
        await page.close().catch(() => {});
      }
    }

    // 3. 交易所
    console.log('正在抓取交易所公告...');
    const exchanges = Object.keys(exchangeSources);
    for (const ex of exchanges) {
      const page = await browser.newPage();
      try {
        const results = await scrapeExchange(page, ex);
        allNews.push(...results);
        console.log(`- ${ex}: ${results.length} 条`);
      } catch (e) {
        console.error(`- ${ex} 失败: ${e.message}`);
      } finally {
        await page.close().catch(() => {});
      }
    }

    // 4. Twitter
    console.log('正在抓取 Twitter...');
    const twitterPage = await browser.newPage();
    try {
      const twitterResults = await scrapeTwitter(twitterPage, '_FORAB_');
      allNews.push(...twitterResults);
      console.log(`- Twitter: ${twitterResults.length} 条`);
    } catch (e) {
      console.error(`- Twitter 失败: ${e.message}`);
    } finally {
      await twitterPage.close().catch(() => {});
    }

  } catch (error) {
    console.error('抓取过程中发生严重错误:', error);
  } finally {
    await browser.close();
  }

  // 处理数据：去重、排序
  console.log('正在处理数据...');
  allNews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const deduplicated = [];
  const seenTitles = new Set();
  for (const news of allNews) {
    const normalizedTitle = news.title.replace(/\s+/g, '').substring(0, 40);
    if (!seenTitles.has(normalizedTitle)) {
      seenTitles.add(normalizedTitle);
      deduplicated.push(news);
    }
  }

  const output = {
    updateTime: Date.now(),
    count: deduplicated.length,
    data: deduplicated
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(output, null, 2));
  console.log(`抓取完成! 总计 ${deduplicated.length} 条数据。已写入 public/data.json`);
}

run();
