const axios = require("axios");

module.exports = {
  config: {
    name: "trans",
    aliases: ["translate", "dich"],
    version: "1.0",
    role: 0,
    description: "Dịch văn bản sang tiếng Việt (hoặc ngôn ngữ chỉ định)",
    usage: "trans <nội dung> | trans <mã ngôn ngữ đích> <nội dung>",
    category: "Tiện ích"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    if (!args.length) {
      return api.sendMessage("⚠️ Cách dùng: trans <nội dung> hoặc trans <mã ngôn ngữ> <nội dung>\nVí dụ: trans en xin chào", threadID, messageID);
    }

    let target = "vi";
    let text = args.join(" ");
    if (args[0].length <= 5 && /^[a-z-]+$/i.test(args[0]) && args.length > 1) {
      target = args[0];
      text = args.slice(1).join(" ");
    }

    try {
      const res = await axios.get("https://translate.googleapis.com/translate_a/single", {
        params: { client: "gtx", sl: "auto", tl: target, dt: "t", q: text }
      });
      const translated = res.data[0].map(chunk => chunk[0]).join("");
      return api.sendMessage(`🌐 ${translated}`, threadID, messageID);
    } catch (err) {
      return api.sendMessage("❌ Dịch thất bại, thử lại sau.", threadID, messageID);
    }
  }
};
