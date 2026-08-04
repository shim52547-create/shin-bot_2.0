const PLACEHOLDER_HELP =
  "Các biến dùng được trong nội dung:\n" +
  "{name} → tên thành viên vừa rời/bị kick\n" +
  "{threadName} → tên nhóm\n" +
  "{count} → số thành viên còn lại trong nhóm";

module.exports = {
  config: {
    name: "setleave",
    aliases: ["leavenoti", "outnoti"],
    version: "2.0",
    role: 1, // quản trị viên nhóm (hoặc admin bot)
    description: "Bật/tắt và tuỳ chỉnh thông báo khi có thành viên rời/bị kick khỏi nhóm",
    usage:
      "setleave on/off\n" +
      "setleave xem\n" +
      "setleave text <nội dung> | setleave text remove",
    category: "Quản trị nhóm"
  },
  run: async ({ api, event, args, Threads }) => {
    const { threadID, messageID } = event;
    const sub = (args[0] || "").toLowerCase();
    const threadData = Threads.get(threadID);

    // ---------- setleave on/off (giữ nguyên hành vi cũ) ----------
    if (sub === "on" || sub === "off") {
      const turnOn = sub === "on";
      Threads.set(threadID, { leaveNotify: turnOn });
      return api.sendMessage(
        `✅ Đã ${turnOn ? "bật" : "tắt"} thông báo thành viên rời nhóm cho nhóm này!`,
        threadID, messageID
      );
    }

    // ---------- setleave (không kèm gì) -> toggle nhanh, giữ hành vi cũ ----------
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
          : "📝 Đang dùng lời thông báo mặc định."
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

    return api.sendMessage(
      `⚠️ Sai cú pháp.\n${module.exports.config.usage}\n\n${PLACEHOLDER_HELP}`,
      threadID, messageID
    );
  }
};