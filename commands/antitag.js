const KICK_AFTER = 3; // Quá 3 lần nhắc nhở -> kick thẳng ở lần vi phạm thứ 4

module.exports = {
  config: {
    name: "antitag",
    aliases: ["antitagall"],
    version: "1.2",
    role: 1, // quản trị viên nhóm hoặc admin bot
    description: "Bật/tắt chống spam tag hàng loạt (tag @all), cảnh cáo và tự kick nếu vi phạm quá 3 lần",
    usage: "antitag on/off | antitag limit <số người>",
    category: "Box chat"
  },

  run: async ({ api, event, args, Threads }) => {
    const { threadID, messageID } = event;
    const threadData = Threads.get(threadID);
    const anti = threadData.anti || {};
    const cfg = anti.tagall || { enabled: false, limit: 5, violations: {} };

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
      `╰─ Ngưỡng phát hiện: ${anti.tagall.limit || 5} người được tag / tin nhắn\n` +
      `╰─ Vi phạm quá ${KICK_AFTER} lần (từ lần thứ ${KICK_AFTER + 1}) sẽ bị kick khỏi nhóm`,
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

    // Đếm số lần vi phạm của người này trong nhóm
    const anti = threadData.anti || {};
    const tagall = anti.tagall || { enabled: true, limit };
    const violations = { ...(tagall.violations || {}) };
    const count = (violations[senderID] || 0) + 1;
    violations[senderID] = count;
    anti.tagall = { ...tagall, violations };
    Threads.set(threadID, { anti });

    // Vượt quá số lần cho phép -> kick thẳng
    if (count > KICK_AFTER) {
      delete violations[senderID];
      anti.tagall = { ...tagall, violations };
      Threads.set(threadID, { anti });

      try {
        await api.sendMessage(
          `🚫 Đã cảnh cáo ${KICK_AFTER} lần nhưng vẫn tiếp tục spam tag hàng loạt (${mentionCount} người) -> kick khỏi nhóm.`,
          threadID
        );
        await api.removeUserFromGroup(senderID, threadID);
      } catch (e) {
        api.sendMessage("❌ Không thể kick người vi phạm (có thể do bot chưa là quản trị viên nhóm).", threadID);
      }
      return;
    }

    return api.sendMessage(
      `⚠️ Cảnh cáo (${count}/${KICK_AFTER}): Phát hiện tag hàng loạt (${mentionCount} người)! ` +
      `Vui lòng không spam tag/tag @all trong nhóm.\n` +
      `╰─ Vi phạm quá ${KICK_AFTER} lần sẽ bị kick khỏi nhóm.`,
      threadID
    );
  }
};