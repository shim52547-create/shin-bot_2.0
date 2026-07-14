module.exports = {
  config: {
    name: "imgbox",
    aliases: ["doianh", "changebox"],
    version: "1.0",
    role: 1, // quản trị viên nhóm hoặc admin bot
    description: "Đổi ảnh đại diện (logo) của nhóm chat bằng ảnh được reply",
    usage: "Gửi 1 ảnh lên nhóm, sau đó reply ảnh đó kèm lệnh imgbox",
    category: "Box chat"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, messageReply } = event;

    if (!messageReply) {
      return api.sendMessage(
        "⚠️ Bạn cần reply vào 1 tin nhắn có ảnh kèm lệnh này để đổi ảnh nhóm.",
        threadID,
        messageID
      );
    }

    const attachments = messageReply.attachments || [];
    const photo = attachments.find(att => att.type === "photo" || att.type === "animated_image");

    if (!photo) {
      return api.sendMessage(
        "⚠️ Tin nhắn được reply không chứa ảnh. Hãy reply vào ảnh cần đặt làm logo nhóm.",
        threadID,
        messageID
      );
    }

    const imageUrl = photo.url || photo.largePreviewUrl || photo.previewUrl;
    if (!imageUrl) {
      return api.sendMessage("⚠️ Không lấy được đường dẫn ảnh, thử lại sau.", threadID, messageID);
    }

    try {
      const stream = await global.utils.getStreamFromURL(imageUrl);
      await api.changeGroupImage(stream, threadID);
      return api.sendMessage("✅ Đã đổi ảnh nhóm thành công!", threadID, messageID);
    } catch (e) {
      return api.sendMessage(
        "❌ Đổi ảnh nhóm thất bại: " + (e?.message || "lỗi không xác định"),
        threadID,
        messageID
      );
    }
  }
};
