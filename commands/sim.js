const axios = require("axios");

module.exports = {
  config: {
    name: "sim",
    aliases: ["bot", "chat"],
    version: "1.0",
    role: 0,
    description: "Chat vui vẻ với bot Simsimi",
    usage: "sim <tin nhắn>",
    category: "Giải trí"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const text = args.join(" ");

    if (!text) return api.sendMessage("⚠️ Hãy nhập tin nhắn để chat với bot.", threadID, messageID);

    try {
      const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(text)}&lc=vn`);
      
      if (res.data.success) {
        return api.sendMessage(res.data.message, threadID, messageID);
      } else {
        return api.sendMessage("🤔 Mình không hiểu bạn nói gì hết...", threadID, messageID);
      }
    } catch (e) {
      return api.sendMessage("❌ Bot Simsimi đang bận hoặc lỗi mạng.", threadID, messageID);
    }
  }
};
