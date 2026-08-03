"use strict";

/**
 * Ghép đôi card generator.
 * Vẽ 2 avatar tròn cạnh nhau, 1 icon tim ở giữa, tên 2 người dưới avatar
 * và % độ hợp (love meter) bằng thanh progress hồng.
 *
 * Requires: @napi-rs/canvas (đã có sẵn trong project, dùng chung với rankCard.js)
 */

const path = require("path");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

const FONT_DIR = path.join(__dirname, "..", "assets", "fonts");

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  fontsRegistered = true;
  try {
    GlobalFonts.registerFromPath(path.join(FONT_DIR, "Poppins-Bold.ttf"), "Poppins Bold");
    GlobalFonts.registerFromPath(path.join(FONT_DIR, "Poppins-Medium.ttf"), "Poppins Medium");
    GlobalFonts.registerFromPath(path.join(FONT_DIR, "Poppins-Regular.ttf"), "Poppins Regular");
  } catch (e) {
    console.warn("[ghepCard] Không load được font Poppins, dùng font mặc định:", e.message);
  }
}

function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Vẽ 1 trái tim đặc, tâm tại (cx, cy), kích thước tổng quát ~ size
function drawHeart(ctx, cx, cy, size, fillStyle) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = size / 100;
  ctx.beginPath();
  ctx.moveTo(0, 28 * s);
  ctx.bezierCurveTo(-60 * s, -20 * s, -10 * s, -55 * s, 0, -18 * s);
  ctx.bezierCurveTo(10 * s, -55 * s, 60 * s, -20 * s, 0, 28 * s);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
}

async function loadAvatarSafe(url) {
  try {
    return await loadImage(url);
  } catch (e) {
    return null;
  }
}

function drawCircleAvatar(ctx, img, cx, cy, r, fallbackLetter) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#1c1425";
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  if (img) {
    const size = r * 2;
    const scale = Math.max(size / img.width, size / img.height);
    const iw = img.width * scale;
    const ih = img.height * scale;
    ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
  } else {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, "#ff6fa5");
    g.addColorStop(1, "#a56bff");
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `600 ${Math.floor(r * 0.8)}px 'Poppins Bold'`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((fallbackLetter || "?").toUpperCase(), cx, cy + r * 0.06);
  }
  ctx.restore();

  // viền tròn màu hồng-tím quanh avatar
  ctx.save();
  const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ringGrad.addColorStop(0, "#ff6fa5");
  ringGrad.addColorStop(1, "#a56bff");
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = ringGrad;
  ctx.shadowColor = "#ff6fa5";
  ctx.shadowBlur = 20;
  ctx.stroke();
  ctx.restore();
}

/**
 * @param {Object} opts
 * @param {string} opts.name1        Tên người 1
 * @param {string} [opts.avatarURL1] Ảnh đại diện người 1
 * @param {string} opts.name2        Tên người 2
 * @param {string} [opts.avatarURL2] Ảnh đại diện người 2
 * @param {number} [opts.percent]    % độ hợp (0-100), random nếu không truyền
 * @param {string} [opts.quote]      Câu quote hiển thị dưới cùng
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateGhepCard(opts) {
  ensureFonts();

  const {
    name1 = "Người 1",
    avatarURL1 = null,
    name2 = "Người 2",
    avatarURL2 = null,
    percent = Math.floor(Math.random() * 101),
    quote = ""
  } = opts;

  const W = 1280;
  const H = 720;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // ---------- nền gradient ----------
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#1a0f2b");
  bgGrad.addColorStop(0.5, "#2b1338");
  bgGrad.addColorStop(1, "#3a1330");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // vài trái tim nhỏ bay lơ lửng trang trí nền
  const decoRand = (seed) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 18; i++) {
    const dx = decoRand(i + 1) * W;
    const dy = decoRand(i + 50) * H;
    const dsize = 10 + decoRand(i + 100) * 22;
    ctx.save();
    ctx.globalAlpha = 0.08 + decoRand(i + 5) * 0.1;
    drawHeart(ctx, dx, dy, dsize, "#ff9dc4");
    ctx.restore();
  }

  // ---------- tiêu đề ----------
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 54px 'Poppins Bold'";
  ctx.shadowColor = "rgba(255,111,165,0.6)";
  ctx.shadowBlur = 18;
  ctx.fillText("💘 GHÉP ĐÔI 💘", W / 2, 90);
  ctx.shadowBlur = 0;

  // ---------- avatar 2 người ----------
  const avR = 170;
  const cy = 300;
  const cx1 = W / 2 - 260;
  const cx2 = W / 2 + 260;

  const [img1, img2] = await Promise.all([
    avatarURL1 ? loadAvatarSafe(avatarURL1) : null,
    avatarURL2 ? loadAvatarSafe(avatarURL2) : null
  ]);

  drawCircleAvatar(ctx, img1, cx1, cy, avR, name1[0]);
  drawCircleAvatar(ctx, img2, cx2, cy, avR, name2[0]);

  // trái tim to ở giữa
  drawHeart(ctx, W / 2, cy, 130, "#ff4d7d");

  // ---------- tên 2 người ----------
  ctx.font = "700 40px 'Poppins Bold'";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(truncateText(ctx, name1, 320), cx1, cy + avR + 60);
  ctx.fillText(truncateText(ctx, name2, 320), cx2, cy + avR + 60);

  // ---------- % độ hợp ----------
  const barW = 700;
  const barH = 46;
  const barX = W / 2 - barW / 2;
  const barY = cy + avR + 110;

  ctx.textAlign = "center";
  ctx.font = "600 28px 'Poppins Medium'";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`Độ hợp: ${percent}%`, W / 2, barY - 16);

  roundRectPath(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();

  const fillW = Math.max(barH, (barW * percent) / 100);
  ctx.save();
  roundRectPath(ctx, barX, barY, barW, barH, barH / 2);
  ctx.clip();
  const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  fillGrad.addColorStop(0, "#ff6fa5");
  fillGrad.addColorStop(1, "#ff4d7d");
  ctx.fillStyle = fillGrad;
  ctx.fillRect(barX, barY, fillW, barH);
  ctx.restore();

  // ---------- câu quote ----------
  if (quote) {
    ctx.font = "500 26px 'Poppins Medium'";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.textAlign = "center";
    ctx.fillText(truncateText(ctx, quote, W - 120), W / 2, barY + barH + 60);
  }

  return canvas.encode("png");
}

module.exports = { generateGhepCard };
