const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "adbot",
    aliases: ["owner", "chusohuu"],
    version: "1.0.2",
    role: 0,
    description: "Xem thông tin chủ sở hữu và admin điều hành bot",
    usage: "adbot",
    category: "Hệ thống"
  },

  run: async ({ api, event }) => {
    const { threadID, messageID } = event;
    const adminList = global.config.ADMIN_BOT || [];
    // Ghi chú thêm cho từng admin (không bắt buộc), điền trong config.json:
    // "ADMIN_INFO": { "<uid>": { "note": "..." } }
    const extraInfo = global.config.ADMIN_INFO || {};

    if (adminList.length === 0) {
      return api.sendMessage("⚠️ Hiện chưa cấu hình admin bot nào trong config.json (mục ADMIN_BOT).", threadID, messageID);
    }

    let userData = {};
    try {
      userData = await api.getUserInfo(adminList);
    } catch (e) {
      userData = {};
    }

    const targetID = adminList[0]; // admin đầu tiên = chủ sở hữu
    const name = userData[targetID] ? userData[targetID].name : "Không xác định";

    // Tạo danh sách các admin điều hành khác (kèm URL cá nhân nếu có)
    const otherLines = adminList.slice(1).map(uid => {
      const n = userData[uid] ? userData[uid].name : "Không xác định";
      const u = userData[uid] ? userData[uid].profileUrl : "";
      const note = extraInfo[uid] && extraInfo[uid].note ? ` — ${extraInfo[uid].note}` : "";
      const urlText = u ? `\n   🔗 Link: ${u}` : "";
      return `• ${n} (UID: ${uid})${note}${urlText}`;
    }).join("\n");

    const ownerNote = extraInfo[targetID] && extraInfo[targetID].note ? `📝 Ghi chú: ${extraInfo[targetID].note}\n` : "";

    // ĐÃ FIX: Không cho hiện dòng "🏝 URL cá nhân:" của Chủ sở hữu bot
    const body =
      `👑 CHỦ SỞ HỮU BOT 👑\n\n` +
      `😚 Tên: ${name}\n` +
      `🐧 UID: ${targetID}\n` +
      `🐧 Hiện đang thực hiện NVQS vui lòng chỉ tag người điều hành\n` +
      ownerNote +
      (otherLines ? `\n🛡️ Admin điều hành khác:\n${otherLines}\n` : "") +
      `\n🤖 Bot: ${global.config.BOT_NAME}`;

    // Lấy ảnh từ cache cục bộ (data/cache)
    const cacheDir = path.join(__dirname, "..", "data", "cache");
    const possibleExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    let imagePath = null;
    
    for (const ext of possibleExts) {
      const p = path.join(cacheDir, `adbot${ext}`);
      if (fs.existsSync(p)) {
        imagePath = p;
        break;
      }
    }

    let attachment = null;
    if (imagePath) {
      attachment = fs.createReadStream(imagePath);
    }

    try {
      if (attachment) {
        return await api.sendMessage({ body, attachment }, threadID, messageID);
      }
      return await api.sendMessage(body, threadID, messageID);
    } catch (e) {
      console.error("[adbot] Lỗi gửi attachment, fallback về text:", e.message);
      return api.sendMessage(body, threadID, messageID);
    }
  }
};