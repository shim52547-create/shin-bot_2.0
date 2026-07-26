module.exports = {
  config: {
    name: "uptime",
    aliases: [],
    version: "1.0",
    role: 0,
    description: "Xem thời gian bot đã chạy liên tục",
    usage: "uptime",
    category: "Hệ thống"
  },
  run: async ({ api, event }) => {
    const ms = Date.now() - global.client.timeStart;
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000) % 60;
    const h = Math.floor(ms / 3600000) % 24;
    const d = Math.floor(ms / 86400000);
    return api.sendMessage(`⏱️ Bot đã chạy: ${d} ngày ${h} giờ ${m} phút ${s} giây`, event.threadID, event.messageID);
  }
};
