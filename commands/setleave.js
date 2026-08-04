const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

// Thư mục lưu gif tiễn biệt riêng theo từng nhóm (1 file <threadID>.gif).
const GIF_DIR = path.join(__dirname, "..", "events", "cache", "leaveGif");
fs.ensureDirSync(GIF_DIR);

function gifPath(threadID) {
  return path.join(GIF_DIR, `${threadID}.gif`);
}

const PLACEHOLDER_HELP =
  "Các biến dùng được trong nội dung:\n" +
  "{name} → tên thành viên vừa rời/bị kick\n" +
  "{threadName} → tên nhóm\n" +
  "{count} → số thành viên còn lại trong nhóm";

module.exports = {
  config: {
    name: "setleave",
    aliases: ["leavenoti", "outnoti"],
    version: "3.0",
    role: 1, // quản trị viên nhóm (hoặc admin bot)
    description: "Bật/tắt và tuỳ chỉnh text/gif thông báo khi có thành viên rời/bị kick khỏi nhóm",
    usage:
      "setleave on/off\n" +
      "setleave xem\n" +
      "setleave text <nội dung> | setleave text remove\n" +
      "setleave gif <url ảnh .gif> | setleave gif remove",
    category: "Quản trị nhóm"
  },
  run: async ({ api, event, args, Threads }) => {
    const { threadID, messageID } = event;
    const sub = (args[0] || "").toLowerCase();
    const threadData = Threads.get(threadID);

    // ---------- setleave on/off ----------
    if (sub === "on" || sub === "off") {
      const turnOn = sub === "on";
      Threads.set(threadID, { leaveNotify: turnOn });
      return api.sendMessage(
        `✅ Đã ${turnOn ? "bật" : "tắt"} thông báo thành viên rời nhóm cho nhóm này!`,
        threadID, messageID
      );
    }

    // ---------- setleave (không kèm gì) -> toggle nhanh ----------
    if (!sub) {
      const current = threadData.leaveNotify !== false;
      const turnOn = !current;
      Threads.set(threadID, { leaveNotify: turnOn });
      return api.sendMessage(
        `✅ Đã ${turnOn ? "bật" : "tắt"} thông báo thành viên rời nhóm cho nhóm này!`,
        threadID, messageID
      );
    }

    // ---------- setleave xem ----------
    if (sub === "xem") {
      const enabled = threadData.leaveNotify !== false;
      const lines = [
        `🔔 Thông báo rời nhóm hiện đang: ${enabled ? "BẬT" : "TẮT"}`,
        threadData.customLeave
          ? `📝 Nội dung tuỳ chỉnh:\n${threadData.customLeave}`
          : "📝 Đang dùng lời thông báo mặc định.",
        fs.existsSync(gifPath(threadID)) ? "🎞️ Nhóm này đã có gif tiễn biệt." : "🎞️ Nhóm này chưa có gif tiễn biệt."
      ];
      return api.sendMessage(`${lines.join("\n")}\n\n${PLACEHOLDER_HELP}`, threadID, messageID);
    }

    // ---------- setleave text ... ----------
    if (sub === "text") {
      const msg = args.slice(1).join(" ");

      if (msg === "remove") {
        Threads.set(threadID, { customLeave: "" });
        return api.sendMessage("✅ Đã gỡ nội dung tuỳ chỉnh, nhóm sẽ dùng lại thông báo mặc định.", threadID, messageID);
      }

      if (!msg) {
        return api.sendMessage(`⚠️ Thiếu nội dung.\nDùng: setleave text <nội dung>\n\n${PLACEHOLDER_HELP}`, threadID, messageID);
      }

      Threads.set(threadID, { customLeave: msg });

      const preview = msg
        .replace(/\{name\}/g, "Nguyễn Văn A")
        .replace(/\{threadName\}/g, "Tên nhóm mẫu")
        .replace(/\{count\}/g, "41");

      return api.sendMessage(`✅ Đã lưu nội dung thông báo mới! Preview:\n${preview}`, threadID, messageID);
    }

    // ---------- setleave gif ... ----------
    if (sub === "gif") {
      const msg = args.slice(1).join(" ");
      const pathGif = gifPath(threadID);

      if (msg === "remove") {
        if (!fs.existsSync(pathGif)) {
          return api.sendMessage("⚠️ Nhóm của bạn chưa từng cài gif tiễn biệt.", threadID, messageID);
        }
        fs.unlinkSync(pathGif);
        return api.sendMessage("✅ Đã gỡ bỏ gif tiễn biệt của nhóm.", threadID, messageID);
      }

      if (!/^https?:\/\/\S+\.gif(\?\S*)?$/i.test(msg)) {
        return api.sendMessage("⚠️ URL không hợp lệ, cần là link ảnh đuôi .gif.\nDùng: setleave gif <url>", threadID, messageID);
      }

      try {
        const res = await axios.get(msg, { responseType: "arraybuffer", timeout: 20000 });
        fs.writeFileSync(pathGif, Buffer.from(res.data));
      } catch (e) {
        return api.sendMessage("❌ Không tải được file, url không tồn tại hoặc bot gặp lỗi mạng.", threadID, messageID);
      }

      return api.sendMessage(
        { body: "✅ Đã lưu gif tiễn biệt của nhóm, preview:", attachment: fs.createReadStream(pathGif) },
        threadID, messageID
      );
    }

    return api.sendMessage(
      `⚠️ Sai cú pháp.\n${module.exports.config.usage}\n\n${PLACEHOLDER_HELP}`,
      threadID, messageID
    );
  }
};