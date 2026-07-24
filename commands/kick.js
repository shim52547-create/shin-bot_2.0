module.exports = {
  config: {
    name: "kick",
    aliases: [],
    version: "1.1",
    role: 1,
    description: "Kick thành viên khỏi nhóm (khuyến khích dùng Reply để chắc chắn nhất)",
    usage: "kick (tag hoặc reply người cần kick)",
    category: "Quản trị nhóm"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, messageReply, mentions, senderID } = event;
    let targetID = null;

    // Ưu tiên số 1: Kiểm tra xem có Reply tin nhắn không
    if (messageReply && messageReply.senderID) {
      targetID = messageReply.senderID;
    } 
    
    // Ưu tiên số 2: Kiểm tra xem có Tag không (Xử lý an toàn hơn cho mọi trường hợp object)
    if (!targetID && mentions) {
      // Đôi khi mentions là mảng, đôi khi là object, dòng này sẽ lấy được ID trong cả 2 trường hợp
      const mentionKeys = Object.keys(mentions);
      if (mentionKeys.length > 0) {
        targetID = mentionKeys[0];
      }
    }

    // Nếu vẫn không tìm thấy ID
    if (!targetID) {
      return api.sendMessage(
        "⚠️ Không tìm thấy người để kick.\n\n💡 Nguyên nhân & Cách khắc phục:\n" +
        "1. Lỗi font chữ: Chữ bạn tag không khớp font hệ thống -> Hãy dùng tính năng 'Reply' vào tin nhắn của người đó rồi gõ 'kick'.\n" +
        "2. Bạn tự tag chính mình (Bot có thể chặn việc kick admin).",
        threadID,
        messageID
      );
    }

    // Chống self-kick (ngăn bot kick chính người dùng lệnh)
    if (targetID === senderID) {
      return api.sendMessage("🤦 Bạn không thể tự kick chính mình được!", threadID, messageID);
    }

    try {
      await api.removeUserFromGroup(targetID, threadID);
      return api.sendMessage("✅ Đã kick thành viên khỏi nhóm.", threadID, messageID);
    } catch (err) {
      console.error(err); // In lỗi gốc ra console để admin kiểm tra
      return api.sendMessage(
        "❌ Không thể kick người này.\nNguyên nhân có thể là:\n" +
        "- Bot chưa được làm Quản trị viên.\n" +
        "- Người này là QTV của nhóm.", 
        threadID, 
        messageID
      );
    }
  }
};
