module.exports = {
  config: {
    name: "in4",
    aliases: ["info2", "profile"],
    version: "1.0",
    role: 0,
    description: "Xem thông tin Facebook của bản thân hoặc người được tag/reply",
    usage: "in4 (tag/reply người khác để xem thông tin của họ)",
    category: "Tiện ích"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, senderID, messageReply, mentions } = event;

    // Xác định UID mục tiêu: ưu tiên reply, sau đó tag, mặc định là bản thân
    let targetID = senderID;
    if (messageReply) targetID = messageReply.senderID;
    else if (mentions && Object.keys(mentions).length > 0) targetID = Object.keys(mentions)[0];

    let data;
    try {
      data = await api.getUserInfo(targetID);
    } catch (e) {
      return api.sendMessage("⚠️ Không lấy được thông tin người dùng này.", threadID, messageID);
    }

    const info = data?.[targetID];
    if (!info) {
      return api.sendMessage("⚠️ Không tìm thấy thông tin cho UID này.", threadID, messageID);
    }

    const genderMap = { MALE: "Nam", FEMALE: "Nữ" };
    const gender = genderMap[info.gender] || "Không rõ / Khác";
    const isFriend = info.isFriend ? "Đã kết bạn với BOT" : "Chưa kết bạn với BOT";

    const body =
      `👤 Tên: ${info.name || "???"}\n` +
      `🆔 UID: ${targetID}\n` +
      `🚻 Giới tính: ${gender}\n` +
      `🤝 Tình trạng: ${isFriend}\n` +
      `🔗 Vanity: ${info.vanity || "Không có"}\n` +
      `🌐 Link FB: ${info.profileUrl || "Không có"}`;

    const avatarUrl = `https://graph.facebook.com/${targetID}/picture?width=512&height=512&access_token=6628568379|c1e620fa708a1d5696fb991c1bde5662`;

    let attachment = null;
    try {
      attachment = await global.utils.getStreamFromURL(avatarUrl);
    } catch (e) {
      attachment = null;
    }

    return api.sendMessage(attachment ? { body, attachment } : body, threadID, messageID);
  }
};