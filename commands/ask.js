const { GoogleGenerativeAI } = require("@google/generative-ai");

// ĐÃ SỬA cho việc deploy lên Render/GitHub: ưu tiên lấy key từ biến môi trường
// GEMINI_API_KEY (đặt trong Render > Environment). Giữ tạm key cũ làm fallback
// để không vỡ bot nếu bạn chưa kịp cấu hình ENV, nhưng NÊN xoá dòng fallback
// và thu hồi/tạo lại key mới tại https://aistudio.google.com/apikey trước khi
// đẩy code lên GitHub công khai (key cũ này đã từng xuất hiện trong code).
const apiKey = process.env.GEMINI_API_KEY || "AIzaSyBg_sUgtULx43UkVNuC7zji26wlvnMLjFc";

// ĐÃ FIX: package cài trong node_modules là "@google/generative-ai" bản 0.24.1,
// bản này export class "GoogleGenerativeAI" (không phải "GoogleGenAI" của SDK mới
// "@google/genai" chưa được cài) -> khởi tạo đúng constructor + lấy model qua getGenerativeModel.
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

module.exports = {
    config: {
        name: "ask",
        version: "1.0.1",
        role: 0, // Thay cho hasPermssion theo chuẩn MiraiBot-Clean
        credits: "Gemini",
        description: "Hỏi đáp với AI Gemini miễn phí",
        category: "tiện ích", // Thay cho commandCategory
        usages: "[câu hỏi]",
        cooldowns: 5
    },

    run: async function ({ api, event, args }) {
        const { threadID, messageID } = event;
        const prompt = args.join(" ");

        // Kiểm tra nếu người dùng không nhập câu hỏi
        if (!prompt) {
            return api.sendMessage("⚠️ Vui lòng nhập câu hỏi sau lệnh ask. Ví dụ: /ask Công thức nấu phở ngon", threadID, messageID);
        }

        api.sendMessage("🤖 Gemini đang suy nghĩ, vui lòng chờ...", threadID, messageID);

        try {
            const result = await model.generateContent(prompt);
            const replyText = result.response.text();

            // Gửi câu trả lời về nhóm chat
            return api.sendMessage(replyText, threadID, messageID);

        } catch (error) {
            console.error("Lỗi Gemini API:", error);
            return api.sendMessage("❌ Đã xảy ra lỗi khi kết nối với AI hoặc API Key không hợp lệ. Vui lòng kiểm tra lại!", threadID, messageID);
        }
    }
};