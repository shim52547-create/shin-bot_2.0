"use strict";

/**
 * Rank card image generator.
 * Đè (overlay) thông tin người dùng lên trên ảnh nền template có sẵn
 * (assets/images/rank_card_bg.png) thay vì tự vẽ khung bằng canvas.
 *
 * Nếu muốn đổi giao diện thẻ, chỉ cần thay file ảnh trong
 * assets/images/rank_card_bg.png (giữ đúng kích thước 1690x931, hoặc
 * sửa lại các toạ độ LAYOUT bên dưới cho khớp ảnh mới).
 *
 * Requires: @napi-rs/canvas
 *   npm install @napi-rs/canvas
 */

const path = require("path");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

const FONT_DIR = path.join(__dirname, "..", "assets", "fonts");
const BG_PATH = path.join(__dirname, "..", "assets", "images", "rank_card_bg.png");

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  fontsRegistered = true;
  try {
    GlobalFonts.registerFromPath(path.join(FONT_DIR, "Poppins-Bold.ttf"), "Poppins Bold");
    GlobalFonts.registerFromPath(path.join(FONT_DIR, "Poppins-Medium.ttf"), "Poppins Medium");
    GlobalFonts.registerFromPath(path.join(FONT_DIR, "Poppins-Regular.ttf"), "Poppins Regular");
  } catch (e) {
    console.warn("[rankCard] Không load được font Poppins, dùng font mặc định:", e.message);
  }
}

// Cache ảnh nền để không phải đọc lại từ đĩa mỗi lần tạo card.
let bgImagePromise = null;
function loadBg() {
  if (!bgImagePromise) bgImagePromise = loadImage(BG_PATH);
  return bgImagePromise;
}

// Màu accent riêng cho từng rank (dùng cho thanh EXP + số Level + viền avatar).
const RANK_COLORS = {
  "Đồng": ["#8a5a2b", "#c98a4e"],
  "Bạc": ["#8a97a6", "#e3e9ef"],
  "Vàng": ["#c9971f", "#ffdd6b"],
  "Bạch Kim": ["#1fa8a0", "#6df0e0"],
  "Kim Cương": ["#3b6df0", "#a56bff"],
  "Cao Thủ": ["#8a2be8", "#e06bff"],
  "Đại Cao Thủ": ["#d63b3b", "#ff8a6b"],
  "Thách Đấu": ["#e0a72b", "#fff06b"]
};
const DEFAULT_COLORS = ["#3b6df0", "#a56bff"];
function getRankColors(rankName) {
  return RANK_COLORS[rankName] || DEFAULT_COLORS;
}

// ---- Toạ độ các vùng trống trên ảnh nền (1690x931) ----------------------
// Lấy được bằng cách quét các vùng pixel gần đen (chưa vẽ gì) trong ảnh gốc.
// Nếu đổi ảnh nền khác, chỉnh lại các số này cho khớp.
const LAYOUT = {
  avatar: { cx: 349, cy: 444, r: 183 },          // vòng tròn avatar bên trái
  namePanel: { x: 705, y: 235, w: 510, h: 115 }, // ô trên cùng bên phải -> Tên
  rankPanel: { x: 661, y: 432, w: 562, h: 80 },  // ô giữa -> Rank hiện tại
  expPanelOuter: { x: 618, y: 570, w: 931, h: 151 }, // ô dưới (khung ngoài)
  expBarTrack: { x: 652, y: 634, w: 862, h: 52 },    // thanh EXP (khung trong)
  shield: { cx: 1442, cy: 340, w: 200, h: 260 }  // khiên góc phải trên -> Level
};

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function hexAlpha(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatNum(n) {
  return Number(n || 0).toLocaleString("en-US");
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

function drawGlow(ctx, drawFn, color, blur) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  drawFn();
  ctx.restore();
}

// ---- main render --------------------------------------------------------

/**
 * @param {Object} opts
 * @param {string} opts.name          Tên hiển thị
 * @param {string} opts.uid           UID Facebook
 * @param {string} [opts.avatarURL]   URL ảnh đại diện
 * @param {{name:string, emoji?:string}} opts.rank      Rank hiện tại
 * @param {{name:string, minExp:number}|null} opts.nextRank  Rank kế tiếp (null nếu max)
 * @param {number} opts.exp           Tổng EXP hiện có
 * @param {number} opts.level         Level hiện tại
 * @param {number} opts.levelExpInto  EXP đã có trong level hiện tại
 * @param {number} opts.levelExpNeeded EXP cần để qua level tiếp theo
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateRankCard(opts) {
  ensureFonts();

  const {
    name = "Người dùng",
    uid = "",
    avatarURL = null,
    rank,
    nextRank = null,
    exp = 0,
    level = 1,
    levelExpInto = 0,
    levelExpNeeded = 100
  } = opts;

  const bg = await loadBg();
  const W = bg.width;
  const H = bg.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const [c1, c2] = getRankColors(rank?.name);

  // ---------- ảnh nền template ----------
  ctx.drawImage(bg, 0, 0, W, H);

  // ---------- avatar (đè vào vòng tròn trống) ----------
  const { cx: avCx, cy: avCy, r: avR } = LAYOUT.avatar;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#11131c";
  ctx.fillRect(avCx - avR, avCy - avR, avR * 2, avR * 2);

  let avatarImg = null;
  if (avatarURL) {
    try {
      avatarImg = await loadImage(avatarURL);
    } catch (e) {
      avatarImg = null;
    }
  }
  if (avatarImg) {
    const size = avR * 2;
    const scale = Math.max(size / avatarImg.width, size / avatarImg.height);
    const iw = avatarImg.width * scale;
    const ih = avatarImg.height * scale;
    ctx.drawImage(avatarImg, avCx - iw / 2, avCy - ih / 2, iw, ih);
  } else {
    const g = ctx.createLinearGradient(avCx - avR, avCy - avR, avCx + avR, avCy + avR);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(avCx - avR, avCy - avR, avR * 2, avR * 2);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "600 150px 'Poppins Bold'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((name[0] || "?").toUpperCase(), avCx, avCy + 12);
  }
  ctx.restore();

  // ---------- ô tên (namePanel) ----------
  {
    const { x, y, w, h } = LAYOUT.namePanel;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 46px 'Poppins Bold'";
    ctx.textAlign = "left";
    ctx.fillText(truncateText(ctx, name.toUpperCase(), w - 20), x + 10, y + h * 0.42);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "500 24px 'Poppins Medium'";
    ctx.fillText(`ID: ${uid || "—"}`, x + 10, y + h * 0.42 + 38);
  }

  // ---------- ô rank hiện tại (rankPanel) ----------
  {
    const { x, y, w, h } = LAYOUT.rankPanel;
    const midY = y + h / 2;

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "600 22px 'Poppins Medium'";
    ctx.fillText("RANK", x + 14, midY - 16);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 34px 'Poppins Bold'";
    ctx.fillText(`${rank?.emoji || ""} ${(rank?.name || "—").toUpperCase()}`, x + 14, midY + 16);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "500 24px 'Poppins Medium'";
    const label = nextRank
      ? (exp >= nextRank.minExp
          ? `Đủ điều kiện lên ${nextRank.name}!`
          : `Còn ${formatNum(nextRank.minExp - exp)} EXP tới ${nextRank.name}`)
      : "Rank cao nhất!";
    ctx.fillText(label, x + w - 14, midY);
  }

  // ---------- thanh EXP (expBarTrack, bên trong khung expPanelOuter) ----------
  {
    const outer = LAYOUT.expPanelOuter;
    const track = LAYOUT.expBarTrack;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "700 24px 'Poppins Bold'";
    ctx.fillText("EXP", outer.x + 14, track.y - 12);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "500 22px 'Poppins Medium'";
    ctx.fillText(`${formatNum(levelExpInto)} / ${formatNum(levelExpNeeded)} XP`, outer.x + outer.w - 14, track.y - 12);

    // nền thanh EXP (mờ)
    roundRectPath(ctx, track.x, track.y, track.w, track.h, track.h / 2);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();

    // phần đã lấp đầy
    const pct = clamp(levelExpNeeded > 0 ? levelExpInto / levelExpNeeded : 1, 0, 1);
    if (pct > 0) {
      ctx.save();
      roundRectPath(ctx, track.x, track.y, track.w, track.h, track.h / 2);
      ctx.clip();
      const fillGrad = ctx.createLinearGradient(track.x, 0, track.x + track.w, 0);
      fillGrad.addColorStop(0, c1);
      fillGrad.addColorStop(1, c2);
      ctx.fillStyle = fillGrad;
      drawGlow(ctx, () => {
        ctx.fillRect(track.x, track.y, track.w * pct, track.h);
      }, c1, 14);
      ctx.restore();
    }
  }

  // ---------- Level (trong khiên góc phải trên) ----------
  {
    const { cx, cy } = LAYOUT.shield;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "700 24px 'Poppins Bold'";
    ctx.fillText("LEVEL", cx, cy - 20);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 76px 'Poppins Bold'";
    drawGlow(ctx, () => {
      ctx.fillText(String(level), cx, cy + 45);
    }, c2, 12);
  }

  return canvas.encode("png");
}

module.exports = { generateRankCard, getRankColors };
