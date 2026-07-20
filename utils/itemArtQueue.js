"use strict";

/**
 * Hàng đợi tạo ảnh minh hoạ cho TOÀN BỘ vật phẩm câu cá (cá/rác + cần câu) bằng cách
 * tag @Meta (Meta AI trong Messenger) trong đoạn chat, nhờ vẽ, rồi lưu ảnh Meta trả về
 * thành 1 file riêng đặt theo đúng tên vật phẩm.
 *
 * Nguồn dữ liệu: lấy lại từ utils/fishData.js (FISH_INDEX + RODS[].pool) để không phải
 * đọc trùng utils/data/*.json lần nữa.
 *
 * Cơ chế "chỉ cần chạy 1 lần": trạng thái "đã có ảnh hay chưa" được xác định bằng việc
 * FILE ẢNH đã tồn tại trên đĩa hay chưa (không cần file tiến trình riêng) -> buildQueue()
 * luôn tự động bỏ qua vật phẩm đã có ảnh, nên có thể dừng/chạy lại bao nhiêu lần cũng được,
 * không tạo trùng, không mất tiến độ khi bot phải khởi động lại.
 */

const fs = require("fs-extra");
const path = require("path");

const { TIERS, FISH_INDEX, RODS } = require("./fishData");

const OUT_DIR = path.join(__dirname, "..", "assets", "images", "cauca");
const FISH_DIR = path.join(OUT_DIR, "fish");
const ROD_DIR = path.join(OUT_DIR, "rod");
fs.ensureDirSync(FISH_DIR);
fs.ensureDirSync(ROD_DIR);

// Chỉ "/" mới thực sự cấm trên Linux, nhưng vẫn lọc thêm vài ký tự hay gây lỗi khi
// đồng bộ qua Windows/zip để an toàn. Giữ nguyên dấu tiếng Việt, khoảng trắng, "#", "【】"...
function safeFileName(name) {
  return String(name)
    .replace(/[\/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function buildFishPrompt(tagText, name, tierLabel, info) {
  const weightPart = info.weightKg != null ? `, cân nặng khoảng ${info.weightKg}kg` : "";
  const valuePart = info.value > 0 ? "" : " (là rác/phế phẩm, trông cũ nát/rẻ tiền)";
  return (
    `${tagText} Vẽ giúp mình 1 ảnh minh hoạ phong cách game tiên hiệp/fantasy cho vật phẩm câu cá tên ` +
    `"${name}", phẩm cấp ${tierLabel}${weightPart}${valuePart}. ` +
    `Ảnh vuông, bố cục đơn giản, làm nổi bật chủ thể, không chèn chữ, không watermark.`
  );
}

function buildRodPrompt(tagText, item, rodTier) {
  return (
    `${tagText} Vẽ giúp mình 1 ảnh minh hoạ phong cách game tiên hiệp/fantasy cho cây cần câu tên ` +
    `"${item.name}", phẩm cấp ${rodTier.label}. Mô tả: ${item.desc || "không có"}. ` +
    `Ảnh vuông, bố cục đơn giản, làm nổi bật cây cần câu, không chèn chữ, không watermark.`
  );
}

/**
 * @param {string} tagText chuỗi mention hiển thị, ví dụ "@Meta AI" (phải khớp tag trong mentions[])
 * @returns {Array<{type:"fish"|"rod", tierKey:string, name:string, filePath:string, prompt:string}>}
 */
function buildQueue(tagText) {
  const queue = [];
  const queuedPaths = new Set(); // chặn trùng NGAY TRONG lượt build này (vd nhiều cần câu cùng tên/cùng phẩm cấp)

  // ---- Cá / vật phẩm (bao gồm rác) ----
  for (const [name, info] of Object.entries(FISH_INDEX)) {
    const filePath = path.join(FISH_DIR, `${safeFileName(name)}.png`);
    if (fs.existsSync(filePath) || queuedPaths.has(filePath)) continue; // đã có ảnh hoặc đã xếp hàng rồi -> bỏ qua
    queuedPaths.add(filePath);
    const tier = TIERS[info.tier];
    queue.push({
      type: "fish",
      tierKey: info.tier,
      name,
      filePath,
      prompt: buildFishPrompt(tagText, name, tier?.label || info.tier, info)
    });
  }

  // ---- Cần câu ----
  for (const rodTier of RODS.slice(1)) {
    for (const item of rodTier.pool) {
      const filePath = path.join(ROD_DIR, `${safeFileName(item.name)}.png`);
      if (fs.existsSync(filePath) || queuedPaths.has(filePath)) continue;
      queuedPaths.add(filePath);
      queue.push({
        type: "rod",
        tierKey: rodTier.key,
        name: item.name,
        filePath,
        prompt: buildRodPrompt(tagText, item, rodTier)
      });
    }
  }

  return queue;
}

function countTotalItems() {
  const fishTotal = Object.keys(FISH_INDEX).length;
  const rodNames = new Set();
  for (const rodTier of RODS.slice(1)) {
    for (const item of rodTier.pool) rodNames.add(item.name);
  }
  return { fishTotal, rodTotal: rodNames.size, total: fishTotal + rodNames.size };
}

function countDone() {
  let fishDone = 0, rodDone = 0;
  try { fishDone = fs.readdirSync(FISH_DIR).filter(f => f.endsWith(".png")).length; } catch (e) {}
  try { rodDone = fs.readdirSync(ROD_DIR).filter(f => f.endsWith(".png")).length; } catch (e) {}
  return { fishDone, rodDone, total: fishDone + rodDone };
}

module.exports = {
  FISH_DIR,
  ROD_DIR,
  safeFileName,
  buildQueue,
  countTotalItems,
  countDone
};
