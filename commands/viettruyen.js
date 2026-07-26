const { GoogleGenerativeAI } = require("@google/generative-ai");

// Dùng chung 1 API key với lệnh "ask" (GEMINI_API_KEY trong Render > Environment).
const apiKey = process.env.GEMINI_API_KEY;

let model = null;
function getModel() {
    if (!apiKey) return null;
    if (!model) {
        const genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    }
    return model;
}

// Tách "nhân vật | bối cảnh" nếu user dùng dấu "|" để phân tách 2 phần.
// Nếu không có "|", toàn bộ nội dung được xem là gợi ý/chủ đề chung.
function parseInput(raw) {
    if (!raw) return { nhanVat: null, boiCanh: null, goiY: null };
    if (raw.includes("|")) {
        const [nv, bc] = raw.split("|").map(s => s.trim()).filter(Boolean);
        return { nhanVat: nv || null, boiCanh: bc || null, goiY: null };
    }
    return { nhanVat: null, boiCanh: null, goiY: raw.trim() };
}

function buildPrompt({ nhanVat, boiCanh, goiY }) {
    let yeuCau = "";
    if (nhanVat || boiCanh) {
        if (nhanVat) yeuCau += `- Nhân vật chính: ${nhanVat}\n`;
        if (boiCanh) yeuCau += `- Bối cảnh: ${boiCanh}\n`;
    } else if (goiY) {
        yeuCau += `- Chủ đề/gợi ý: ${goiY}\n`;
    } else {
        yeuCau += "- Tự do sáng tạo nhân vật và bối cảnh sao cho thú vị, bất ngờ.\n";
    }

    return (
        "Bạn là một cây bút viết truyện ngắn tiếng Việt sáng tạo, văn phong mượt mà, giàu hình ảnh.\n" +
        "Hãy viết một truyện ngắn hoàn chỉnh (khoảng 350-600 chữ) bằng tiếng Việt theo yêu cầu sau:\n" +
        yeuCau +
        "\nYêu cầu định dạng:\n" +
        "- Dòng đầu tiên là tiêu đề truyện, in đậm kiểu: 📖 Tên truyện\n" +
        "- Sau đó là nội dung truyện, chia đoạn rõ ràng, có mở đầu - cao trào - kết thúc.\n" +
        "- Không thêm lời dẫn, giải thích hay ghi chú nào ngoài truyện.\n"
    );
}

module.exports = {
    config: {
        name: "viettruyen",
        aliases: ["story", "kechuyen"],
        version: "1.0.0",
        role: 0,
        credits: "Gemini",
        description: "AI viết truyện ngắn tiếng Việt, có thể tùy chỉnh nhân vật + bối cảnh",
        category: "Giải trí",
        usages:
            "viettruyen — để AI tự do sáng tác\n" +
            "viettruyen <chủ đề/gợi ý>\n" +
            "viettruyen <nhân vật> | <bối cảnh>",
        cooldowns: 10
    },

    run: async function ({ api, event, args }) {
        const { threadID, messageID } = event;
        const raw = args.join(" ").trim();
        const parsed = parseInput(raw);

        const geminiModel = getModel();
        if (!geminiModel) {
            console.error("[viettruyen command] Thiếu biến môi trường GEMINI_API_KEY.");
            return api.sendMessage(
                "❌ Bot chưa được cấu hình GEMINI_API_KEY. Vào Render > Environment, thêm biến GEMINI_API_KEY rồi redeploy lại nhé.",
                threadID,
                messageID
            );
        }

        api.sendMessage("✍️ AI đang sáng tác truyện, vui lòng chờ...", threadID, messageID);

        try {
            const prompt = buildPrompt(parsed);
            const result = await geminiModel.generateContent(prompt);
            const truyen = result.response.text();

            return api.sendMessage(truyen, threadID, messageID);
        } catch (error) {
            console.error("Lỗi Gemini API (viettruyen):", error);
            return api.sendMessage(
                "❌ Đã xảy ra lỗi khi kết nối với AI hoặc API Key không hợp lệ. Vui lòng kiểm tra lại!",
                threadID,
                messageID
            );
        }
    }
};
