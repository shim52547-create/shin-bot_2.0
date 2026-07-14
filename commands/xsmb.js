/**
 * xsmb.js — Xem kết quả xổ số miền Bắc hôm nay
 * Viết lại sạch từ bản gốc bị obfuscate (không có backdoor, chỉ giấu logic scrape).
 * Nguồn dữ liệu: https://xosodaiphat.com/xsmb-xo-so-mien-bac.html (trang công khai, hợp lệ)
 */

const axios = require("axios");
const cheerio = require("cheerio");

module.exports.config = {
    name: "xsmb",
    version: "3.0.0",
    role: 0,
    credits: "MiraiBot-Clean",
    description: "Xem thông tin xổ số miền Bắc hôm nay",
    category: "general",
    usages: "xsmb",
    cooldowns: 5
};

module.exports.run = async function ({ api, event }) {
    const { threadID, messageID } = event;

    try {
        const { data: html } = await axios.get(
            "https://xosodaiphat.com/xsmb-xo-so-mien-bac.html",
            { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 15000 }
        );
        const $ = cheerio.load(html);

        // Bảng kết quả gần nhất là bảng đầu tiên trên trang có chứa dòng "G.ĐB"
        let targetTable = null;
        $("table").each((i, table) => {
            if (targetTable) return;
            if ($(table).text().includes("G.ĐB")) targetTable = table;
        });

        if (!targetTable) {
            return api.sendMessage(
                "Không lấy được kết quả xổ số miền Bắc lúc này, thử lại sau nhé.",
                threadID,
                messageID
            );
        }

        // Tiêu đề ngày quay nằm ở heading ngay phía trên bảng
        let dateTitle = "";
        const heading = $(targetTable).prevAll("h2, h3").first();
        if (heading.length) dateTitle = heading.text().replace(/\s+/g, " ").trim();

        const rows = [];
        $(targetTable)
            .find("tr")
            .each((i, tr) => {
                const cells = $(tr)
                    .find("td, th")
                    .map((j, cell) => $(cell).text().replace(/\s+/g, " ").trim())
                    .get();
                if (cells.length >= 2 && cells[0] && cells[1]) rows.push(cells);
            });

        if (rows.length === 0) {
            return api.sendMessage(
                "Không đọc được dữ liệu xổ số miền Bắc, có thể trang nguồn đã đổi giao diện.",
                threadID,
                messageID
            );
        }

        let msg = `🎉 KẾT QUẢ XỔ SỐ MIỀN BẮC${dateTitle ? " - " + dateTitle : ""}\n\n`;
        for (const [label, value] of rows) {
            msg += `${label}: ${value}\n`;
        }

        return api.sendMessage(msg.trim(), threadID, messageID);
    } catch (err) {
        console.log("[xsmb] error:", err.message);
        return api.sendMessage(
            "Đã có lỗi khi lấy kết quả xổ số miền Bắc, thử lại sau nhé.",
            threadID,
            messageID
        );
    }
};
