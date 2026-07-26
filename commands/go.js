module.exports = {
    config: {
        name: "go",
        version: "1.0.0",
        role: 1, // 1: Quản trị viên nhóm & Admin bot mới có quyền dùng
        credits: "MiraiBot-Clean",
        description: "Gỡ tin nhắn của bot bằng cách reply tin nhắn",
        category: "Quản trị",
        usages: "reply vào tin nhắn của bot rồi gõ /go",
        cooldowns: 2
    },

    run: async function ({ api, event }) {
        const { threadID, messageID, messageReply, senderID } = event;

        // Kiểm tra xem người dùng có reply vào tin nhắn nào không
        if (!messageReply) {
            return api.sendMessage("⚠️ Bạn phải reply (phản hồi) vào tin nhắn của bot cần gỡ.", threadID, messageID);
        }

        // Kiểm tra xem tin nhắn được reply có phải là của bot hay không
        if (messageReply.senderID !== api.getCurrentUserID()) {
            return api.sendMessage("❌ Tôi chỉ có thể gỡ tin nhắn của chính tôi thôi.", threadID, messageID);
        }

        try {
            // Thực hiện gỡ tin nhắn
            return api.unsendMessage(messageReply.messageID);
        } catch (err) {
            console.error("[go] error:", err);
            return api.sendMessage("❌ Không thể gỡ tin nhắn này, có thể tin nhắn đã quá thời gian cho phép gỡ.", threadID, messageID);
        }
    }
};