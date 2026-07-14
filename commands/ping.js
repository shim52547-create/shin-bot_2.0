module.exports = {
  config: {
    name: "ping",
    aliases: [],
    version: "1.0",
    role: 0,
    description: "Kiểm tra độ trễ phản hồi của bot",
    usage: "ping",
    category: "Hệ thống"
  },
  run: async ({ api, event }) => {
    const start = Date.now();
    const sent = await api.sendMessage("🏓 Đang đo...", event.threadID);
    const ping = Date.now() - start;
    api.editMessage
      ? api.editMessage(`🏓 Pong! ${ping}ms`, sent.messageID).catch(() => {})
      : api.sendMessage(`🏓 Pong! ${ping}ms`, event.threadID);
  }
};
