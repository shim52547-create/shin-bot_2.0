module.exports = {
  config: {
    name: "antitag",
    aliases: ["antitagall"],
    version: "1.1",
    role: 1, // quản trị viên nhóm hoặc admin bot
    description: "Bật/tắt chống spam tag hàng loạt (tag @all), tự cảnh cáo người vi phạm",
    usage: "antitag on/off | antitag limit <số người>",
    category: "Box chat"
  },

  run: async ({ api, event, args, Threads }) => {
    const { threadID, messageID } = event;
    const threadData = Threads.get(threadID);
    const anti = threadData.anti || {};
    const cfg = anti.tagall || { enabled: false, limit: 5 };

    const action = (args[0] || "").toLowerCase();

    if (action === "limit") {
      const n = parseInt(args[1], 10);
      if (!n || n < 2) {
        return api.sendMessage("⚠️ Nhập số hợp lệ (>= 2). VD: antitag limit 5", threadID, messageID);
      }
      anti.tagall = { ...cfg, limit: n };
      Threads.set(threadID, { anti });
      return api.sendMessage(`✅ Đã đặt ngưỡng phát hiện tag hàng loạt: từ ${n} người được tag trong 1 tin nhắn.`, threadID, messageID);
    }

    const turnOn = action === "on" ? true : action === "off" ? false : !cfg.enabled;
    anti.tagall = { ...cfg, enabled: turnOn };
    Threads.set(threadID, { anti });

    return api.sendMessage(
      `✅ Đã ${turnOn ? "bật" : "tắt"} chống spam tag hàng loạt (tag @all).\n` +
      `╰─ Ngưỡng phát hiện: ${anti.tagall.limit || 5} người được tag / tin nhắn (chỉ cảnh cáo, không kick)`,
      threadID, messageID
    );
  },

  // Chạy trên MỌI tin nhắn thường (không cần prefix) để bắt các tin nhắn tag nhiều người
  onChat: async ({ api, event, Threads }) => {
    const { threadID, senderID, mentions } = event;
    if (!mentions) return;

    const mentionCount = Object.keys(mentions).length;
    if (mentionCount < 2) return;

    const threadData = Threads.get(threadID);
    const cfg = threadData.anti?.tagall;
    if (!cfg?.enabled) return;

    const limit = cfg.limit || 5;
    if (mentionCount < limit) return;

    // Miễn trừ cho quản trị viên nhóm / admin bot
    if (global.config?.ADMIN_BOT?.includes(senderID)) return;
    try {
      const threadInfo = await api.getThreadInfo(threadID).catch(() => null);
      if (threadInfo?.adminIDs?.some(a => a.id === senderID)) return;
    } catch (_) {}

    return api.sendMessage(
      `⚠️ Phát hiện tag hàng loạt (${mentionCount} người)! Vui lòng không spam tag/tag @all trong nhóm.`,
      threadID
    );
  }
};
