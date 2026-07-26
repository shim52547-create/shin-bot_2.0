"use strict";

/**
 * LỆNH ADMIN (role 2): dùng Meta AI có sẵn trong đoạn chat (Messenger) để vẽ ảnh minh hoạ
 * cho TỪNG cá/rác/cần câu trong game câu cá, lưu mỗi ảnh vào 1 file riêng đặt đúng tên
 * vật phẩm (assets/images/cauca/fish/<tên>.png và assets/images/cauca/rod/<tên>.png).
 *
 * CÁCH HOẠT ĐỘNG:
 * 1) "taoanhvatpham start" -> bot tìm Meta AI trong đoạn chat hiện tại (participant có tên
 *    khớp "Meta AI"), dựng danh sách vật phẩm CHƯA có ảnh, rồi tag Meta AI nhờ vẽ TỪNG
 *    vật phẩm MỘT (tuần tự, không gửi song song, để không bị lẫn ảnh của nhau).
 * 2) Sau khi gửi 1 yêu cầu, bot chờ Meta AI trả lời (có ảnh đính kèm) trong CHÍNH đoạn chat
 *    đó -> việc bắt tin nhắn trả lời này nằm ở hàm onChat() bên dưới (chạy cho MỌI tin nhắn
 *    thường, không cần prefix).
 * 3) Có ảnh -> tải về, lưu file, nghỉ vài giây rồi tự động gửi yêu cầu cho vật phẩm kế tiếp.
 *    Không thấy ảnh sau một khoảng thời gian chờ -> tự thử lại, quá số lần thì bỏ qua vật
 *    phẩm đó (đánh dấu thất bại) và đi tiếp, KHÔNG dừng cả tiến trình.
 * 4) Vì tệp ảnh đã lưu chính là "dấu mốc hoàn thành", nên nếu bot bị restart giữa chừng,
 *    chỉ cần gõ lại "taoanhvatpham start" là tiếp tục đúng chỗ đã dừng, không tạo trùng.
 *
 * LƯU Ý QUAN TRỌNG:
 * - Tính năng @Meta chỉ hoạt động nếu Meta AI thực sự có mặt trong đoạn chat đó.
 * - Vì có hàng ngàn vật phẩm, quá trình có thể chạy liên tục nhiều giờ. Nên chạy thử với
 *   số lượng nhỏ trước bằng "taoanhvatpham start 10" (giới hạn 10 ảnh) để kiểm tra Meta AI
 *   phản hồi đúng như mong đợi, rồi mới chạy "taoanhvatpham start" (không giới hạn) cho
 *   toàn bộ phần còn lại.
 */

const fs = require("fs-extra");
const axios = require("axios");
const logger = require("../utils/log");
const { buildQueue, countTotalItems, countDone } = require("../utils/itemArtQueue");
const MetaAiStore = require("../utils/metaAiStore");

const WAIT_TIMEOUT_MS = 90 * 1000;      // chờ tối đa 90s cho mỗi lần Meta AI trả lời
const MAX_RETRY_PER_ITEM = 2;           // thử lại tối đa 2 lần/vật phẩm nếu không thấy ảnh
const PAUSE_AFTER_SUCCESS_MS = 6000;    // nghỉ giữa 2 vật phẩm để đỡ giống spam
const PAUSE_BEFORE_RETRY_MS = 4000;

// Job DUY NHẤT cho toàn bộ bot (không chạy song song 2 job cùng lúc, tránh lẫn ảnh)
let job = null;

function resetJob() {
  if (job?.waitTimer) clearTimeout(job.waitTimer);
  job = null;
}

function pickAttachmentUrl(att) {
  if (!att) return null;
  return (
    att.url ||
    att.previewUrl ||
    att.largePreviewUrl?.url ||
    att.largePreviewUrl ||
    att.thumbnailUrl ||
    att.hiresUrl ||
    null
  );
}

function isImageAttachment(att) {
  if (!att) return false;
  const t = String(att.type || "").toLowerCase();
  return t.includes("photo") || t.includes("image") || t === "sticker" || t === "animated_image";
}

// Đọc field `mentions` của 1 tin nhắn ĐÃ tag Meta AI thật (người dùng tự gõ "@" chọn Meta AI)
// để "học" ra ID thật của nó — vì Meta AI không phải thành viên nhóm nên không dò qua
// getThreadInfo được (xem giải thích trong utils/metaAiStore.js).
function tryLearnMetaFromMentions(event) {
  const mentions = event.mentions || {};
  for (const [id, tagText] of Object.entries(mentions)) {
    if (/meta\s*ai/i.test(tagText || "")) {
      const saved = MetaAiStore.get();
      if (!saved || saved.id !== id) {
        MetaAiStore.set(id, tagText);
        logger.success(`[taoanhvatpham] Đã học được ID của Meta AI: ${id} (${tagText})`, "TAOANH");
      }
      return true;
    }
  }
  return false;
}

async function sendCurrentItem(api) {
  if (!job) return;
  const item = job.queue[job.index];

  if (!item) {
    // Hết hàng đợi -> tổng kết
    const summary =
      `🏁 ĐÃ TẠO XONG (trong lượt chạy này)!\n` +
      `——————————————\n` +
      `✅ Thành công: ${job.doneCount}\n` +
      `❌ Bỏ qua (không nhận được ảnh): ${job.failCount}\n` +
      (job.limit ? `⚠️ Đã đạt giới hạn ${job.limit} ảnh/lượt bạn đặt ra.\n` : "") +
      `Gõ "taoanhvatpham status" để xem còn thiếu bao nhiêu ảnh, hoặc "taoanhvatpham start" để chạy tiếp phần còn lại.`;
    const threadID = job.threadID;
    resetJob();
    return api.sendMessage(summary, threadID);
  }

  try {
    await api.sendMessage(
      { body: item.prompt, mentions: [{ tag: job.metaTag, id: job.metaID }] },
      job.threadID
    );
  } catch (e) {
    logger.error(`[taoanhvatpham] Lỗi gửi yêu cầu cho "${item.name}": ${e.message}`, "TAOANH");
  }

  job.state = "waiting";
  job.waitStartedAt = Date.now();
  job.waitTimer = setTimeout(() => handleTimeout(api), WAIT_TIMEOUT_MS);
}

async function handleTimeout(api) {
  if (!job) return;
  const item = job.queue[job.index];
  if (job.retryCount < MAX_RETRY_PER_ITEM) {
    job.retryCount++;
    logger.warn(`[taoanhvatpham] Không thấy ảnh cho "${item?.name}", thử lại lần ${job.retryCount}...`, "TAOANH");
    setTimeout(() => sendCurrentItem(api), PAUSE_BEFORE_RETRY_MS);
  } else {
    logger.warn(`[taoanhvatpham] Bỏ qua "${item?.name}" (không nhận được ảnh sau ${MAX_RETRY_PER_ITEM} lần thử).`, "TAOANH");
    job.failCount++;
    job.index++;
    job.retryCount = 0;
    setTimeout(() => sendCurrentItem(api), PAUSE_BEFORE_RETRY_MS);
  }
}

module.exports = {
  config: {
    name: "taoanhvatpham",
    aliases: ["genanh", "taoanh"],
    version: "1.0.0",
    role: 2,
    description: "Tag @Meta để tự động vẽ và lưu ảnh cho từng cá/rác/cần câu trong game câu cá",
    category: "Quản trị",
    usages:
      "taoanhvatpham start [số_lượng] — bắt đầu/tiếp tục tạo ảnh (giới hạn số ảnh nếu muốn chạy thử)\n" +
      "taoanhvatpham stop — dừng tiến trình đang chạy\n" +
      "taoanhvatpham status — xem tiến độ hiện tại",
    cooldowns: 3
  },

  run: async function ({ api, event, args }) {
    const { threadID, messageID } = event;
    const sub = (args[0] || "start").toLowerCase();

    if (sub === "stop") {
      if (!job) return api.sendMessage("ℹ️ Hiện không có tiến trình tạo ảnh nào đang chạy.", threadID, messageID);
      resetJob();
      return api.sendMessage("🛑 Đã dừng tiến trình tạo ảnh. Gõ \"taoanhvatpham start\" để chạy tiếp phần còn lại sau.", threadID, messageID);
    }

    if (sub === "status") {
      const total = countTotalItems();
      const done = countDone();
      let msg =
        `📊 TIẾN ĐỘ TẠO ẢNH VẬT PHẨM\n` +
        `——————————————\n` +
        `🐟 Cá/vật phẩm: ${done.fishDone}/${total.fishTotal}\n` +
        `🎋 Cần câu: ${done.rodDone}/${total.rodTotal}\n` +
        `📦 Tổng: ${done.total}/${total.total}\n`;
      if (job) {
        const cur = job.queue[job.index];
        msg += `——————————————\n▶️ Đang chạy tại nhóm này${job.threadID !== threadID ? " (ở nhóm khác)" : ""}, mục hiện tại: ${cur ? cur.name : "(đang kết thúc)"}\n`;
      } else {
        msg += `——————————————\n⏸️ Không có tiến trình nào đang chạy.`;
      }
      return api.sendMessage(msg, threadID, messageID);
    }

    // ---------------- START ----------------
    if (job) {
      return api.sendMessage(
        `⚠️ Đang có 1 tiến trình tạo ảnh chạy rồi (mục hiện tại: ${job.queue[job.index]?.name || "?"}).\n` +
        `Gõ "taoanhvatpham stop" nếu muốn dừng nó trước.`,
        threadID, messageID
      );
    }

    const limit = args[1] ? parseInt(args[1], 10) : 0;

    const meta = MetaAiStore.get();
    if (!meta) {
      return api.sendMessage(
        `⚠️ Bot chưa "học" được ID thật của Meta AI.\n` +
        `Meta AI không phải thành viên nhóm nên bot không tự dò ra ID được — cần 1 lần tag THẬT từ tay bạn:\n` +
        `1) Gõ "@" trong ô chat này, chọn "Meta AI" trong menu gợi ý hiện ra (giống ảnh bạn vừa gửi).\n` +
        `2) Gửi tin nhắn đó đi (nội dung gì cũng được, ví dụ "@Meta AI xin chào").\n` +
        `3) Gõ lại "taoanhvatpham start" — bot sẽ tự học được ID ngay từ tin nhắn đó và chạy tiếp.`,
        threadID, messageID
      );
    }

    const metaTag = meta.tag;
    let queue = buildQueue(metaTag);

    if (!queue.length) {
      return api.sendMessage("✅ Đã có đủ ảnh cho toàn bộ vật phẩm rồi, không cần tạo thêm gì nữa!", threadID, messageID);
    }

    if (limit > 0) queue = queue.slice(0, limit);

    job = {
      threadID,
      metaID: meta.id,
      metaTag,
      queue,
      index: 0,
      doneCount: 0,
      failCount: 0,
      retryCount: 0,
      limit: limit > 0 ? limit : 0,
      state: "sending",
      waitTimer: null
    };

    await api.sendMessage(
      `🎨 BẮT ĐẦU TẠO ẢNH VẬT PHẨM\n` +
      `——————————————\n` +
      `Đã tìm thấy: ${metaTag}\n` +
      `Số ảnh cần tạo trong lượt này: ${queue.length}${limit > 0 ? ` (đã giới hạn ${limit})` : ""}\n` +
      `Bot sẽ tag ${metaTag} lần lượt từng vật phẩm một, chờ ảnh trả về rồi lưu lại.\n` +
      `Gõ "taoanhvatpham status" để xem tiến độ, hoặc "taoanhvatpham stop" để dừng bất cứ lúc nào.`,
      threadID, messageID
    );

    return sendCurrentItem(api);
  },

  // Chạy cho MỌI tin nhắn thường (không cần prefix) — dùng để bắt tin nhắn trả lời của Meta AI
  onChat: async function ({ api, event }) {
    if (!job || job.state !== "waiting") return;
    if (event.threadID !== job.threadID) return;
    if (event.senderID !== job.metaID) return;

    const attachments = event.attachments || [];
    const imgAtt = attachments.find(isImageAttachment);
    if (!imgAtt) return; // Meta trả lời nhưng không có ảnh -> để timeout tự retry

    const url = pickAttachmentUrl(imgAtt);
    if (!url) return;

    const item = job.queue[job.index];
    if (job.waitTimer) clearTimeout(job.waitTimer);

    try {
      const res = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });
      await fs.writeFile(item.filePath, Buffer.from(res.data));
      job.doneCount++;
      logger.success(`[taoanhvatpham] Đã lưu ảnh "${item.name}" (${job.doneCount + job.failCount}/${job.queue.length})`, "TAOANH");
    } catch (e) {
      logger.error(`[taoanhvatpham] Lỗi tải/lưu ảnh cho "${item.name}": ${e.message}`, "TAOANH");
      job.failCount++;
    }

    job.index++;
    job.retryCount = 0;
    job.state = "sending";
    setTimeout(() => sendCurrentItem(api), PAUSE_AFTER_SUCCESS_MS);
  }
};