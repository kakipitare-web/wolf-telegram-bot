// Wolf Telegram Bot - Simple & Clean
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) { console.error('ERROR: Set TELEGRAM_BOT_TOKEN in .env'); process.exit(1); }

const TEMPLATE_PATH = path.join(__dirname, 'template.png');
const OUTPUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// Load Hebrew/English font that works on Linux
try {
  const fontsDir = path.join(__dirname, 'fonts');
  if (fs.existsSync(fontsDir)) {
    const boldPath = path.join(fontsDir, 'Heebo-Bold.ttf');
    const regPath = path.join(fontsDir, 'Heebo-Regular.ttf');
    if (fs.existsSync(boldPath)) {
      GlobalFonts.registerFromPath(boldPath, 'Heebo Bold');
      console.log('Registered Heebo Bold');
    }
    if (fs.existsSync(regPath)) {
      GlobalFonts.registerFromPath(regPath, 'Heebo');
      console.log('Registered Heebo Regular');
    }
  }
} catch(e) {
  console.log('Font registration error:', e.message);
}

const bot = new TelegramBot(TOKEN, { polling: true });
console.log('🐺 Wolf Bot started.');

bot.on('message', (msg) => {
  console.log(`[${msg.from.username || msg.from.first_name}] ${msg.text || '[photo]'}`);
});

// Size modes: 'story' (1080x1920) or 'post' (1080x1080)
const SIZES = {
  story: { W: 1080, H: 1920 },
  post: { W: 1080, H: 1080 }
};
let currentSize = 'story';
let W = SIZES.story.W, H = SIZES.story.H;

// ============ HELPERS ============
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function parseMessage(text) {
  const data = {};
  text.split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;
    const key = line.substring(0, colonIdx).trim().toLowerCase();
    const value = line.substring(colonIdx + 1).trim();
    if (key && value) data[key] = value;
  });
  return data;
}

function drawGreenCheck(ctx, x, y, size = 44) {
  ctx.save();
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.13;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - size * 0.22, y + size * 0.03);
  ctx.lineTo(x - size * 0.04, y + size * 0.2);
  ctx.lineTo(x + size * 0.25, y - size * 0.15);
  ctx.stroke();
  ctx.restore();
}

function drawBettingSlip(ctx, data, x, y, w) {
  const bets = [];
  for (let i = 1; i <= 5; i++) {
    const market = data[`bet${i}`];
    if (market) {
      bets.push({
        market,
        odds: data[`odds${i}`] || '',
        detail: data[`detail${i}`] || ''
      });
    }
  }
  if (bets.length === 0) return 0;

  const showChecks = !(data.lost === 'yes' || data.lost === '1');

  // Scale based on canvas size
  const isPost = currentSize === 'post';
  const rowH = isPost ? 90 : 120;
  const headerH = isPost ? 70 : 90;
  const h = headerH + bets.length * rowH + (isPost ? 20 : 30);

  // White card with shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 15;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, x, y, w, h, 24);
  ctx.fill();
  ctx.restore();

  // Orange top band
  ctx.fillStyle = '#ff6b00';
  roundRect(ctx, x, y, w, 8, 4);
  ctx.fill();
  ctx.fillRect(x, y + 4, w, 4);

  // Header: "המלצת הזאב"
  ctx.fillStyle = '#0a0a0a';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillText('המלצת הזאב', x + w - 30, y + headerH / 2 + 10);
  ctx.direction = 'ltr';

  // Count badge
  ctx.fillStyle = '#ff6b00';
  const bcx = x + 50;
  const bcy = y + headerH / 2 + 10;
  ctx.beginPath();
  ctx.arc(bcx, bcy, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(bets.length), bcx, bcy);

  // Separator
  ctx.strokeStyle = '#E5E5E5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 30, y + headerH);
  ctx.lineTo(x + w - 30, y + headerH);
  ctx.stroke();

  // Bet rows
  let curY = y + headerH + 15;
  bets.forEach((bet, i) => {
    // Green check on right side
    let marketRightX = x + w - 30;
    if (showChecks) {
      drawGreenCheck(ctx, x + w - 50, curY + rowH / 2 - 15, 48);
      marketRightX = x + w - 95;
    }

    // Market name (Hebrew RTL)
    ctx.fillStyle = '#0a0a0a';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(bet.market, marketRightX, curY + 30);

    // Detail
    if (bet.detail) {
      ctx.fillStyle = '#888888';
      ctx.font = '400 24px sans-serif';
      ctx.fillText(bet.detail, marketRightX, curY + 72);
    }

    // Odds pill - black with orange text
    if (bet.odds) {
      ctx.save();
      ctx.font = 'bold 36px sans-serif';
      const oddsW = ctx.measureText(bet.odds).width + 40;
      const oddsH = 60;
      const oddsX = x + 40;
      const oddsY = curY + rowH / 2 - oddsH / 2 - 15;
      ctx.fillStyle = '#0a0a0a';
      roundRect(ctx, oddsX, oddsY, oddsW, oddsH, 12);
      ctx.fill();
      ctx.fillStyle = '#ff6b00';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bet.odds, oddsX + oddsW / 2, oddsY + oddsH / 2);
      ctx.restore();
    }

    // Divider
    if (i < bets.length - 1) {
      ctx.strokeStyle = '#F0F0F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 30, curY + rowH - 5);
      ctx.lineTo(x + w - 30, curY + rowH - 5);
      ctx.stroke();
    }
    curY += rowH;
  });

  return h;
}

async function generateImage(data) {
  if (!fs.existsSync(TEMPLATE_PATH)) throw new Error('template.png not found');

  const template = await loadImage(TEMPLATE_PATH);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Black background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);

  // Wolf - preserve aspect ratio (no squishing)
  const wolfDisplayH = currentSize === 'post' ? 380 : 800;
  const srcH = template.height * 0.55;
  const srcAspect = template.width / srcH;
  // Scale to fill width while preserving aspect
  const drawW = W;
  const drawH = drawW / srcAspect;
  const actualDrawH = Math.min(drawH, wolfDisplayH);
  const actualSrcH = (actualDrawH / drawH) * srcH;

  ctx.drawImage(template, 0, 0, template.width, actualSrcH, 0, 0, drawW, actualDrawH);

  // Fade
  const fadeY = actualDrawH;
  const fadeGrad = ctx.createLinearGradient(0, fadeY - 150, 0, fadeY);
  fadeGrad.addColorStop(0, 'rgba(10,10,10,0)');
  fadeGrad.addColorStop(1, 'rgba(10,10,10,1)');
  ctx.fillStyle = fadeGrad;
  ctx.fillRect(0, fadeY - 150, W, 150);

  // Fill below wolf with black (no leftover template bottom)
  if (actualDrawH < wolfDisplayH) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, actualDrawH, W, wolfDisplayH - actualDrawH);
  }

  // League/time badge (top center)
  if (data.league || data.time) {
    const badgeText = [data.league, data.time].filter(Boolean).join(' · ');
    ctx.font = 'bold 26px sans-serif';
    const bw = ctx.measureText(badgeText).width + 50;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeStyle = '#ff6b00';
    ctx.lineWidth = 2;
    roundRect(ctx, W / 2 - bw / 2, 70, bw, 55, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff6b00';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, W / 2, 97);
  }

  // Match title (below wolf)
  let contentY = wolfDisplayH + 20;
  if (data.match) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${currentSize === 'post' ? 40 : 54}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(data.match, W / 2, contentY);
    contentY += currentSize === 'post' ? 30 : 45;
  }

  // Orange line
  ctx.fillStyle = '#ff6b00';
  ctx.fillRect(W / 2 - 50, contentY, 100, 3);
  contentY += currentSize === 'post' ? 25 : 50;

  // Bet slip
  drawBettingSlip(ctx, data, 60, contentY, W - 120);

  // Footer
  ctx.fillStyle = '#ff6b00';
  ctx.font = `bold ${currentSize === 'post' ? 22 : 28}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('@thewolfbet', W / 2, H - 40);

  const outputPath = path.join(OUTPUT_DIR, `tip_${Date.now()}.png`);
  const buffer = await canvas.encode('png');
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

// ============ TEMPLATE (easy to copy-paste with spaces) ============

const TEMPLATE_TEXT = `match:


league:


time:



bet1:

odds1:

detail1:



bet2:

odds2:

detail2:



bet3:

odds3:

detail3: `;

function sendTemplate(chatId) {
  // Send ONLY the template, no extra text
  bot.sendMessage(chatId, '```\n' + TEMPLATE_TEXT + '\n```', { parse_mode: 'Markdown' });
}

// All these commands send the blank template: /start, /t, /tem, /template, /new
bot.onText(/^\/(start|t|tem|template|new)$/, (msg) => {
  sendTemplate(msg.chat.id);
});

// Size switchers + send template
bot.onText(/^\/story$/, (msg) => {
  currentSize = 'story';
  W = SIZES.story.W;
  H = SIZES.story.H;
  sendTemplate(msg.chat.id);
});

bot.onText(/^\/post$/, (msg) => {
  currentSize = 'post';
  W = SIZES.post.W;
  H = SIZES.post.H;
  sendTemplate(msg.chat.id);
});

// Accept filled template (any text with "match:" or "bet1:")
bot.on('text', async (msg) => {
  const text = msg.text;
  if (!text || text.startsWith('/')) return;
  if (!/match\s*:|bet1\s*:/i.test(text)) return;

  const chatId = msg.chat.id;
  try {
    const data = parseMessage(text);

    if (Object.keys(data).length === 0) {
      return bot.sendMessage(chatId, '⚠️ התבנית ריקה. מלא לפחות match ו-bet1 עם odds1');
    }

    if (!data.bet1) {
      return bot.sendMessage(chatId, '⚠️ חסר bet1. מלא לפחות הימור אחד');
    }

    await bot.sendMessage(chatId, '🎨 Generating...');
    const outputPath = await generateImage(data);
    await bot.sendPhoto(chatId, outputPath, { caption: '✅ Preview' });
    await bot.sendDocument(chatId, outputPath, { caption: '🔥 Full quality' });
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, 'Error: ' + err.message);
  }
});

bot.on('polling_error', (err) => console.log('Polling error:', err.message));
