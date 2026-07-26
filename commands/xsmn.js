/**
 * xsmn.js — Xem kết quả xổ số miền Nam hôm nay
 * Viết lại sạch từ bản gốc bị obfuscate.
 * Nguồn dữ liệu: https://xskt.com.vn/xsmn (trang công khai, hợp lệ)
 *
 * Lưu ý: bản gốc có đoạn code kiểm tra "credits" và tự gọi process.exit(1)
 * nếu bị đổi/xoá credit — đây là cơ chế tự phá bot khi bị sửa, đã BỎ HẲN
 * ở bản này vì có thể khiến cả bot sập bất ngờ, không phù hợp để giữ lại.
 */

const axios = require("axios");
const cheerio = require("cheerio");

module.exports.config = {
    name: "xsmn",
    version: "2.0.0",
    role: 0,
    credits: "MiraiBot-Clean",
    description: "Xem thông tin xổ số miền Nam hôm nay",
    category: "general",
    usages: "xsmn",
    cooldowns: 5
};

module.exports.run = async function ({ api, event }) {
    const { threadID, messageID } = event;

    try {
        const { data: html } = await axios.get("https://xskt.com.vn/xsmn", {
            headers: { "User-Agent": "Mozilla/5.0" },
            timeout: 15000
        });
        const $ = cheerio.load(html);

        // Bảng kết quả gần nhất là bảng đầu tiên trên trang có chứa dòng "ĐB"
        // và không phải bảng thống kê lôtô (bảng lôtô có chữ "Đầu" ở góc trên).
        let targetTable = null;
        $("table").each((i, table) => {
            if (targetTable) return;
            const text = $(table).text();
            if (text.includes("ĐB") && !text.includes("Thống kê lôtô")) targetTable = table;
        });

        if (!targetTable) {
            return api.sendMessage(
                "Không lấy được kết quả xổ số miền Nam lúc này, thử lại sau nhé.",
                threadID,
                messageID
            );
        }

        // Tiêu đề ngày quay nằm ở heading ngay phía trên bảng
        let dateTitle = "";
        const heading = $(targetTable).prevAll("h2, h3").first();
        if (heading.length) dateTitle = heading.text().replace(/\s+/g, " ").trim();

        // Hàng đầu tiên của bảng là tên các đài (Hồ Chí Minh, Đồng Tháp, Cà Mau...)
        const provinces = $(targetTable)
            .find("tr")
            .first()
            .find("th, td")
            .map((i, cell) => $(cell).text().replace(/\s+/g, " ").trim())
            .get()
            .slice(1); // bỏ ô đầu (Thứ mấy / ngày)

        if (provinces.length === 0) {
            return api.sendMessage(
                "Không đọc được dữ liệu xổ số miền Nam, có thể trang nguồn đã đổi giao diện.",
                threadID,
                messageID
            );
        }

        // Các hàng còn lại: [tên giải, kết quả đài 1, kết quả đài 2, ...]
        const prizeRows = [];
        $(targetTable)
            .find("tr")
            .each((i, tr) => {
                if (i === 0) return; // đã lấy làm header rồi
                const cells = $(tr)
                    .find("td, th")
                    .map((j, cell) => $(cell).text().replace(/\s+/g, " ").trim())
                    .get();
                if (cells.length >= 2) prizeRows.push(cells);
            });

        if (prizeRows.length === 0) {
            return api.sendMessage(
                "Không đọc được dữ liệu xổ số miền Nam, có thể trang nguồn đã đổi giao diện.",
                threadID,
                messageID
            );
        }

        let msg = `🎉 KẾT QUẢ XỔ SỐ MIỀN NAM${dateTitle ? " - " + dateTitle : ""}\n`;

        provinces.forEach((province, idx) => {
            msg += `\n==== ${province} ====\n`;
            for (const row of prizeRows) {
                const label = row[0];
                const value = row[idx + 1];
                if (label && value) msg += `${label}: ${value}\n`;
            }
        });

        return api.sendMessage(msg.trim(), threadID, messageID);
    } catch (err) {
        console.log("[xsmn] error:", err.message);
        return api.sendMessage(
            "Đã có lỗi khi lấy kết quả xổ số miền Nam, thử lại sau nhé.",
            threadID,
            messageID
        );
    }
};
