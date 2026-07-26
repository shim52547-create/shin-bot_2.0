const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "cache");
fs.ensureDirSync(CACHE_DIR);

const MAX_SIZE = 25 * 1024 * 1024; // 25MB, giới hạn gửi file của Messenger

module.exports = {
  config: {
    name: "tiktok",
    aliases: ["tt", "tiktokdl"],
    version: "2.0.0",
    role: 0,
    description: "Tải video TikTok không logo",
    usage: "tiktok <url>",
    category: "Media"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;

    if (!args[0]) {
      return api.sendMessage("⚠️ Bạn phải nhập url video TikTok!\nCách dùng: tiktok <url>", threadID, messageID);
    }

    const filePath = path.join(CACHE_DIR, `${threadID}-${senderID}.mp4`);

    try {
      const { data } = await axios.get("https://www.tikwm.com/api/", {
        params: { url: args[0], hd: 1 }
      });

      if (!data || data.code !== 0 || !data.data?.play) {
        return api.sendMessage("❌ Không lấy được video, kiểm tra lại đường link nhé.", threadID, messageID);
      }

      const videoUrl = data.data.play;
      const videoRes = await axios.get(videoUrl, { responseType: "arraybuffer" });
      fs.writeFileSync(filePath, Buffer.from(videoRes.data));

      if (fs.statSync(filePath).size > MAX_SIZE) {
        fs.unlinkSync(filePath);
        return api.sendMessage("⚠️ Không thể gửi vì video dung lượng lớn hơn 25MB.", threadID, messageID);
      }

      return api.sendMessage(
        { body: `✅ Tải video TikTok thành công!\n👤 ${data.data.author?.nickname || "?"}`, attachment: fs.createReadStream(filePath) },
        threadID,
        () => fs.unlinkSync(filePath),
        messageID
      );
    } catch (err) {
      fs.remove(filePath).catch(() => {});
      return api.sendMessage("❌ Đã có lỗi xảy ra, vui lòng kiểm tra lại link hoặc thử lại sau.", threadID, messageID);
    }
  }
};
