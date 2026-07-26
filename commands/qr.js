const { getStreamFromURL } = require("../utils/func");

module.exports = {
  config: {
    name: "qr",
    aliases: ["taoqr", "qrcode"],
    version: "1.0",
    role: 0,
    description: "Tạo mã QR từ văn bản, link,...",
    usage: "qr <nội dung>",
    category: "Tiện ích"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const content = args.join(" ").trim();

    if (!content) {
      return api.sendMessage("⚠️ Cách dùng: qr <nội dung>\nVí dụ: qr https://facebook.com", threadID, messageID);
    }
    if (content.length > 900) {
      return api.sendMessage("⚠️ Nội dung quá dài, vui lòng rút gọn (tối đa 900 ký tự).", threadID, messageID);
    }

    try {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=${encodeURIComponent(content)}`;
      const stream = await getStreamFromURL(url);

      return api.sendMessage(
        { body: `✅ Mã QR cho: "${content}"`, attachment: stream },
        threadID, messageID
      );
    } catch (e) {
      return api.sendMessage("❌ Tạo mã QR thất bại, vui lòng thử lại sau.", threadID, messageID);
    }
  }
};
