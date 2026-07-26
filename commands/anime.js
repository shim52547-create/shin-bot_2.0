const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

module.exports = {
  config: {
    name: "anime",
    aliases: ["waifu"],
    version: "10.0",
    role: 0,
    description: "Xem ảnh anime ngẫu nhiên từ NekosAPI",
    usage: "anime",
    category: "Giải trí"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID } = event;

    // Thư mục cache tạm để lưu ảnh trước khi gửi
    const cacheDir = path.join(__dirname, "cache");
    await fs.ensureDir(cacheDir);

    const imgPath = path.join(cacheDir, `anime_${Date.now()}.jpg`);

    try {
      // Gọi thẳng endpoint random file của NekosAPI (rating=safe cho an toàn)
      const res = await axios.get(
        "https://api.nekosapi.com/v4/images/random/file",
        {
          params: { rating: "safe" },
          responseType: "arraybuffer",
          timeout: 15000
        }
      );

      // Lưu ảnh xuống ổ đĩa tạm
      await fs.writeFile(imgPath, Buffer.from(res.data));

      return api.sendMessage(
        {
          body: "✨ Ảnh anime của bạn đây",
          attachment: fs.createReadStream(imgPath)
        },
        threadID,
        () => fs.unlink(imgPath).catch(() => {}), // xoá file tạm sau khi gửi xong
        messageID
      );
    } catch (err) {
      console.error("Lỗi lệnh anime:", err.message);
      fs.unlink(imgPath).catch(() => {});
      return api.sendMessage("❌ Lỗi khi lấy ảnh từ NekosAPI. Thử lại sau nhé.", threadID, messageID);
    }
  }
};