// Record a demo GIF of the hanzi-practice app using local Chrome via puppeteer-core.
// Frames are dumped as PNGs into assets/_frames, then merged into assets/demo.gif
// by the companion Python script (make_gif.py).
//
// Usage:
//   node record_demo.js
//
// Requires:
//   - A local HTTP server serving this folder at http://127.0.0.1:8765
//   - Google Chrome installed at the default Windows location

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const FRAME_DIR = path.join(__dirname, 'assets', '_frames');
const URL = 'http://127.0.0.1:8765/';
const VIEWPORT = { width: 420, height: 780, deviceScaleFactor: 1 };
const FRAME_MS = 180; // ~5.5 fps

let frameIdx = 0;
function frameName(prefix) {
  frameIdx += 1;
  return path.join(FRAME_DIR, `${String(frameIdx).padStart(4, '0')}_${prefix}.png`);
}

async function grabFrames(page, prefix, seconds) {
  const n = Math.max(1, Math.round((seconds * 1000) / FRAME_MS));
  for (let i = 0; i < n; i++) {
    try {
      await page.screenshot({ path: frameName(prefix), type: 'png', timeout: 15000 });
    } catch (e) {
      console.warn(`screenshot failed at ${prefix} #${i}: ${e.message}`);
      frameIdx -= 1; // roll back so next frame keeps numbering
    }
    await new Promise((r) => setTimeout(r, FRAME_MS));
  }
}

async function safeClick(page, selectorOrText) {
  try {
    if (selectorOrText.startsWith('text=')) {
      const label = selectorOrText.slice(5);
      const ok = await page.evaluate((txt) => {
        const els = Array.from(document.querySelectorAll('*'));
        const el = els.find((e) => e.textContent && e.textContent.trim() === txt);
        if (el) { el.click(); return true; }
        return false;
      }, label);
      return ok;
    }
    await page.click(selectorOrText);
    return true;
  } catch (e) {
    console.warn('click failed:', selectorOrText, e.message);
    return false;
  }
}

(async () => {
  if (!fs.existsSync(FRAME_DIR)) fs.mkdirSync(FRAME_DIR, { recursive: true });
  // Clean previous frames
  for (const f of fs.readdirSync(FRAME_DIR)) fs.unlinkSync(path.join(FRAME_DIR, f));

  console.log('Launching Chrome:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: VIEWPORT,
    protocolTimeout: 120000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--disable-gpu'],
  });
  const page = await browser.newPage();

  console.log('Opening', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Wait up to 20s for preload (homeGreeting drops '加载'); fall back to fixed wait
  await page
    .waitForFunction(
      () => {
        const el = document.getElementById('homeGreeting');
        return el && el.textContent.indexOf('加载') === -1;
      },
      { timeout: 20000, polling: 500 }
    )
    .catch(() => console.warn('preload wait timed out, continuing anyway'));
  await new Promise((r) => setTimeout(r, 800));

  // Scene 1: home
  console.log('[scene] home');
  await grabFrames(page, 'home', 1.6);

  // Scene 2: quiz
  console.log('[scene] quiz');
  await safeClick(page, 'text=笔顺大闯关');
  await new Promise((r) => setTimeout(r, 1500));
  await grabFrames(page, 'quiz_intro', 1.4);

  for (let i = 0; i < 3; i++) {
    await page.evaluate((idx) => {
      const btns = document.querySelectorAll('#quizOptions .opt-btn');
      if (btns.length) btns[idx % btns.length].click();
    }, i);
    await grabFrames(page, `quiz_q${i}`, 1.8);
    await new Promise((r) => setTimeout(r, 900));
  }

  // Scene 3: labels
  console.log('[scene] labels');
  await safeClick(page, '#screen-quiz .back-btn');
  await new Promise((r) => setTimeout(r, 500));
  await safeClick(page, 'text=火眼金睛');
  await new Promise((r) => setTimeout(r, 1500));
  await grabFrames(page, 'labels', 1.6);
  await safeClick(page, 'text=▶ 播放笔顺');
  await grabFrames(page, 'labels_play', 2.6);

  // Scene 4: write
  console.log('[scene] write');
  await safeClick(page, '#screen-labels .back-btn');
  await new Promise((r) => setTimeout(r, 500));
  await safeClick(page, 'text=妙笔生花');
  await new Promise((r) => setTimeout(r, 1500));
  await grabFrames(page, 'write_demo', 2.4);

  // Scene 5: collection
  console.log('[scene] collection');
  await safeClick(page, '#screen-write .back-btn');
  await new Promise((r) => setTimeout(r, 500));
  await safeClick(page, 'text=我的收藏');
  await new Promise((r) => setTimeout(r, 900));
  await grabFrames(page, 'collection', 1.6);

  await browser.close();
  console.log(`Done. ${frameIdx} frames written to ${FRAME_DIR}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
