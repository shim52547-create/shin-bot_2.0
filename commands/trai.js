const fs = require("fs");
const path = require("path");

module.exports = {
    config: {
        name: "trai",
        version: "1.0.1",
        role: 0,
        credits: "MiraiBot-Clean",
        description: "Gửi 1 ảnh trai đẹp ngẫu nhiên từ thư mục máy tính",
        category: "Giải trí",
        usages: "trai",
        cooldowns: 5
    },

    run: async function ({ api, event }) {
        const { threadID, messageID } = event;
        
        // Đường dẫn tới thư mục chứa ảnh của bạn (tự động trỏ đúng theo project, chạy được cả local lẫn server)
        const dirPath = path.join(__dirname, "..", "assets", "images", "trai");

        try {
            // Kiểm tra xem thư mục có tồn tại không
            if (!fs.existsSync(dirPath)) {
                return api.sendMessage("❌ Thư mục chứa ảnh không tồn tại trên máy chủ bot.", threadID, messageID);
            }

            // Đọc toàn bộ các file trong thư mục
            const files = fs.readdirSync(dirPath);

            // Lọc ra các file có đuôi định dạng ảnh phổ biến (jpg, jpeg, png, gif)
            const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
            const images = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return validExtensions.includes(ext);
            });

            // Nếu thư mục trống hoặc không có ảnh hợp lệ
            if (images.length === 0) {
                return api.sendMessage("⚠️ Thư mục trống hoặc không tìm thấy định dạng ảnh hợp lệ (.jpg, .png...).", threadID, messageID);
            }

            // Bốc ngẫu nhiên 1 file ảnh
            const randomImage = images[Math.floor(Math.random() * images.length)];
            const fullPath = path.join(dirPath, randomImage);

            // Tạo read stream từ file cục bộ và gửi đi
            return api.sendMessage(
                {
                    body: "📸 Ảnh trai đẹp từ bộ sưu tập của bạn đây!",
                    attachment: fs.createReadStream(fullPath)
                },
                threadID,
                messageID
            );
        } catch (err) {
            console.error("[trai] error:", err);
            return api.sendMessage("❌ Có lỗi xảy ra khi đọc thư mục ảnh, thử lại sau nhé.", threadID, messageID);
        }
    }
};