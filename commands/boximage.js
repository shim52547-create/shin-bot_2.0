const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

module.exports = {
  config: {
    name: "boximage",
    aliases: [],
    version: "1.0",
    role: 1,
    description: "Đổi ảnh đại diện nhóm (reply vào 1 ảnh)",
    usage: "boximage (reply vào ảnh)",
    category: "Box chat"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, type, messageReply } = event;
    if (type !== "message_reply" || !messageReply?.attachments?.length) {
      return api.sendMessage("❌ Bạn phải reply vào một ảnh nào đó", threadID, messageID);
    }
    if (messageReply.attachments.length > 1) {
      return api.sendMessage("❌ Vui lòng reply chỉ 1 ảnh!", threadID, messageID);
    }
    const url = messageReply.attachments[0].url;
    const cacheDir = path.join(__dirname, "..", "data", "cache");
    await fs.ensureDir(cacheDir);
    const imgPath = path.join(cacheDir, `boximage_${threadID}.png`);

    try {
      const res = await axios.get(url, { responseType: "arraybuffer" });
      await fs.writeFile(imgPath, Buffer.from(res.data));
      await api.changeGroupImage(fs.createReadStream(imgPath), threadID);
      await fs.unlink(imgPath).catch(() => {});
      return api.sendMessage("🔨 Bot đã đổi ảnh nhóm thành công!", threadID, messageID);
    } catch (e) {
      return api.sendMessage("❌ Đổi ảnh thất bại — bot cần quyền quản trị viên nhóm.", threadID, messageID);
    }
  }
};
