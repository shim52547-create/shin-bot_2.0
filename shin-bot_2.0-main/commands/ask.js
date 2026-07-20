const { GoogleGenerativeAI } = require("@google/generative-ai");

// Bắt buộc lấy key từ biến môi trường GEMINI_API_KEY (đặt trong Render > Environment).
// KHÔNG hardcode key trong code nữa — key cũ từng bị lộ trong file này đã được thu hồi,
// nếu bạn chưa thu hồi thì làm ngay tại https://aistudio.google.com/apikey
const apiKey = process.env.GEMINI_API_KEY;

// Khởi tạo model kiểu "lazy" (chỉ tạo khi thực sự dùng) để nếu thiếu ENV thì bot
// vẫn load được toàn bộ command khác bình thường, chỉ lệnh "ask" báo lỗi rõ ràng
// khi được gọi, thay vì làm sập cả quá trình loadCommands() lúc khởi động.
let model = null;
function getModel() {
    if (!apiKey) return null;
    if (!model) {
        const genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    }
    return model;
}

module.exports = {
    config: {
        name: "ask",
        version: "1.1.0",
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

        if (!prompt) {
            return api.sendMessage("⚠️ Vui lòng nhập câu hỏi sau lệnh ask. Ví dụ: /ask Công thức nấu phở ngon", threadID, messageID);
        }

        const geminiModel = getModel();
        if (!geminiModel) {
            console.error("[ask command] Thiếu biến môi trường GEMINI_API_KEY.");
            return api.sendMessage(
                "❌ Bot chưa được cấu hình GEMINI_API_KEY. Vào Render > Environment, thêm biến GEMINI_API_KEY rồi redeploy lại nhé.",
                threadID,
                messageID
            );
        }

        api.sendMessage("🤖 Gemini đang suy nghĩ, vui lòng chờ...", threadID, messageID);

        try {
            const result = await geminiModel.generateContent(prompt);
            const replyText = result.response.text();

            // Gửi câu trả lời về nhóm chat
            return api.sendMessage(replyText, threadID, messageID);

        } catch (error) {
            console.error("Lỗi Gemini API:", error);
            return api.sendMessage("❌ Đã xảy ra lỗi khi kết nối với AI hoặc API Key không hợp lệ. Vui lòng kiểm tra lại!", threadID, messageID);
        }
    }
};
