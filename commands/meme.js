const axios = require("axios");

module.exports = {
  config: {
    name: "meme",
    aliases: ["anhche"],
    version: "1.0",
    role: 0,
    description: "Gửi 1 ảnh chế/meme ngẫu nhiên cho box đỡ nhạt",
    usage: "meme",
    category: "Giải trí"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID } = event;

    try {
      const res = await axios.get("https://meme-api.com/gimme", { timeout: 10000 });
      const data = res.data;
      const url = data?.url;
      const title = data?.title || "Meme ngẫu nhiên";

      if (!url) throw new Error("Không lấy được ảnh");

      const attachment = await global.utils.getStreamFromURL(url);
      return api.sendMessage({ body: `😂 ${title}`, attachment }, threadID, messageID);
    } catch (err) {
      return api.sendMessage("❌ Không lấy được meme lúc này, thử lại sau nhé.", threadID, messageID);
    }
  }
};
