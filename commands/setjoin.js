const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const { Threads } = require("../utils/database");

// Thư mục lưu gif chào mừng riêng theo từng nhóm (1 file <threadID>.gif).
const GIF_DIR = path.join(__dirname, "..", "events", "cache", "joinGif");
fs.ensureDirSync(GIF_DIR);

function gifPath(threadID) {
  return path.join(GIF_DIR, `${threadID}.gif`);
}

const PLACEHOLDER_HELP =
  "Các biến dùng được trong nội dung:\n" +
  "{name} → tên thành viên mới\n" +
  "{threadName} → tên nhóm";

module.exports = {
  config: {
    name: "setjoin",
    aliases: [],
    version: "2.0",
    role: 1, // quản trị viên nhóm (hoặc admin bot)
    description: "Chỉnh văn bản/gif chào mừng khi có thành viên mới tham gia nhóm",
    usage:
      "setjoin xem\n" +
      "setjoin text <nội dung> | setjoin text remove\n" +
      "setjoin gif <url ảnh .gif> | setjoin gif remove",
    category: "Quản trị nhóm"
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const threadData = Threads.get(threadID);

    // ---------- setjoin xem ----------
    if (!args[0] || args[0] === "xem") {
      const lines = [
        threadData.customJoin
          ? `📝 Lời chào tuỳ chỉnh:\n${threadData.customJoin}`
          : "📝 Đang dùng lời chào mặc định.",
        fs.existsSync(gifPath(threadID)) ? "🎞️ Nhóm này đã có gif chào mừng." : "🎞️ Nhóm này chưa có gif chào mừng."
      ];
      return api.sendMessage(`${lines.join("\n")}\n\n${PLACEHOLDER_HELP}`, threadID, messageID);
    }

    // ---------- setjoin text ... ----------
    if (args[0] === "text") {
      const msg = args.slice(1).join(" ");

      if (msg === "remove") {
        Threads.set(threadID, { customJoin: "" });
        return api.sendMessage("✅ Đã gỡ lời chào tuỳ chỉnh, nhóm sẽ dùng lại lời chào mặc định.", threadID, messageID);
      }

      if (!msg) {
        return api.sendMessage(`⚠️ Thiếu nội dung.\nDùng: setjoin text <nội dung>\n\n${PLACEHOLDER_HELP}`, threadID, messageID);
      }

      Threads.set(threadID, { customJoin: msg });

      const preview = msg
        .replace(/\{name\}/g, "Nguyễn Văn A")
        .replace(/\{threadName\}/g, "Tên nhóm mẫu");

      return api.sendMessage(`✅ Đã lưu lời chào mới! Preview:\n${preview}`, threadID, messageID);
    }

    // ---------- setjoin gif ... ----------
    if (args[0] === "gif") {
      const msg = args.slice(1).join(" ");
      const pathGif = gifPath(threadID);

      if (msg === "remove") {
        if (!fs.existsSync(pathGif)) {
          return api.sendMessage("⚠️ Nhóm của bạn chưa từng cài gif chào mừng.", threadID, messageID);
        }
        fs.unlinkSync(pathGif);
        return api.sendMessage("✅ Đã gỡ bỏ gif chào mừng của nhóm.", threadID, messageID);
      }

      if (!/^https?:\/\/\S+\.gif(\?\S*)?$/i.test(msg)) {
        return api.sendMessage("⚠️ URL không hợp lệ, cần là link ảnh đuôi .gif.\nDùng: setjoin gif <url>", threadID, messageID);
      }

      try {
        const res = await axios.get(msg, { responseType: "arraybuffer", timeout: 20000 });
        fs.writeFileSync(pathGif, Buffer.from(res.data));
      } catch (e) {
        return api.sendMessage("❌ Không tải được file, url không tồn tại hoặc bot gặp lỗi mạng.", threadID, messageID);
      }

      return api.sendMessage(
        { body: "✅ Đã lưu gif chào mừng của nhóm, preview:", attachment: fs.createReadStream(pathGif) },
        threadID, messageID
      );
    }

    return api.sendMessage(
      `⚠️ Sai cú pháp.\n${module.exports.config.usage}\n\n${PLACEHOLDER_HELP}`,
      threadID, messageID
    );
  }
};
