const fs = require("fs-extra");
const path = require("path");

// Nếu muốn gửi kèm video, đặt file tại: data/assets/ngungon.mp4
const VIDEO_PATH = path.join(__dirname, "..", "data", "assets", "ngungon.mp4");
const TRIGGERS = ["ngủ ngon", "ngu ngon", "nn"];

async function replyNgungon(api, threadID, messageID) {
  const msg = { body: "😴 Em iu ngủ ngon nhaa" };
  if (fs.existsSync(VIDEO_PATH)) {
    msg.attachment = fs.createReadStream(VIDEO_PATH);
  }
  return api.sendMessage(msg, threadID, messageID);
}

module.exports = {
  config: {
    name: "ngungon",
    aliases: [],
    version: "1.0",
    role: 0,
    description: "Chúc ngủ ngon (gõ trực tiếp 'ngủ ngon' hoặc 'nn', không cần prefix)",
    usage: "ngungon (hoặc gõ thẳng \"ngủ ngon\" / \"nn\")",
    category: "Không cần dấu lệnh"
  },
  // Dùng lệnh có prefix
  run: async ({ api, event }) => {
    return replyNgungon(api, event.threadID, event.messageID);
  },
  // Bắt tin nhắn không có prefix, đúng như bot gốc
  onChat: async ({ api, event }) => {
    const body = (event.body || "").trim().toLowerCase();
    if (TRIGGERS.includes(body)) {
      return replyNgungon(api, event.threadID, event.messageID);
    }
  }
};
