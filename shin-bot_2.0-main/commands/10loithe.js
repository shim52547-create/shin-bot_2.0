/**
 * 10loithe.js — Gõ thẳng "10 lời thề" (không cần prefix) để bot gửi video
 * "10 Lời Thề Danh Dự Của Quân Đội Nhân Dân Việt Nam".
 *
 * Yêu cầu: đặt file video vào đúng đường dẫn assets/videos/10loithedanhdu.mp4
 * (hoặc đổi VIDEO_PATH bên dưới nếu bạn để tên khác).
 */

const fs = require("fs");
const path = require("path");

const VIDEO_PATH = path.join(__dirname, "..", "assets", "videos", "10loithedanhdu.mp4");

// Chuẩn hoá chuỗi tiếng Việt về cùng 1 dạng Unicode (NFC) trước khi so sánh.
// Nếu không làm bước này, chữ có dấu gõ từ Messenger gửi lên có thể ở dạng
// Unicode khác với chuỗi viết sẵn trong file .js (nhìn giống hệt nhau nhưng
// máy so sánh thấy khác byte) -> lệnh không bao giờ khớp, không lỗi, không
// phản hồi gì cả -> tưởng lệnh "không hoạt động".
function normalizeText(str) {
    return (str || "").normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
}

const TRIGGER = normalizeText("10 lời thề");

module.exports.config = {
    name: "10loithe",
    version: "1.0.0",
    role: 0,
    credits: "MiraiBot-Clean",
    description: "Gửi video 10 Lời Thề Danh Dự QĐNDVN (gõ thẳng '10 lời thề', không cần prefix)",
    category: "Không cần dấu lệnh",
    usages: "10 lời thề",
    cooldowns: 10
};

module.exports.onChat = async function ({ api, event }) {
    const body = normalizeText(event.body);
    if (body !== TRIGGER && !body.startsWith(TRIGGER + " ")) return;

    const { threadID, messageID } = event;

    if (!fs.existsSync(VIDEO_PATH)) {
        return api.sendMessage(
            "⚠️ Chưa có sẵn file video 10 lời thề trong bot. Vui lòng đặt file vào assets/videos/10loithedanhdu.mp4 rồi thử lại.",
            threadID,
            messageID
        );
    }

    try {
        await api.sendMessage(
            {
                body: "🎖️ 10 LỜI THỀ DANH DỰ CỦA QUÂN ĐỘI NHÂN DÂN VIỆT NAM",
                attachment: fs.createReadStream(VIDEO_PATH)
            },
            threadID,
            messageID
        );
    } catch (err) {
        console.log("[10loithe] error:", err.message);
        return api.sendMessage("❌ Gửi video thất bại, thử lại sau nhé.", threadID, messageID);
    }
};

module.exports.run = async function () {};
