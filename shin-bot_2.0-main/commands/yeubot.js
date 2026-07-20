/**
 * yeubot.js — Trả lời khi ai đó nhắn "yêu bot" (không cần gõ prefix)
 * Sửa lại từ bản gốc: bản gốc dùng handleEvent — hook này KHÔNG tồn tại trong
 * MiraiBot-Clean (handler.js chỉ gọi run() cho lệnh có prefix và onChat() cho
 * tin nhắn thường), nên lệnh gốc không bao giờ chạy. Đổi sang onChat.
 */

module.exports.config = {
    name: "yeubot",
    version: "1.0.2",
    role: 0,
    credits: "dungkon",
    description: "Phản hồi khi ai đó nhắn 'yêu bot' (không cần dấu lệnh)",
    category: "Không cần dấu lệnh",
    usages: "yêu bot",
    cooldowns: 5
};

module.exports.onChat = async function ({ api, event }) {
    const body = (event.body || "").trim().toLowerCase();
    if (body === "yêu bot" || body.startsWith("yêu bot ")) {
        return api.sendMessage(
            "cảm ơn cậu hihi😘, bot cũng yêu cậu😘",
            event.threadID,
            event.messageID
        );
    }
};

// Lệnh này không dùng qua prefix, nhưng vẫn cần khai báo run để tránh lỗi
// nếu có nơi khác trong bot kỳ vọng mọi command đều có hàm run.
module.exports.run = async function () {};
