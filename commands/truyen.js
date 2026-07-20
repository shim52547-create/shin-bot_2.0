const axios = require("axios");
const { JSDOM } = require("jsdom"); // Sử dụng jsdom đã có trong package.json

// Hàm chuyển đổi chuỗi tiếng Việt sang dạng slug (VD: Đấu La Đại Lục -> dau-la-dai-luc)
function createSlug(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// Hàm chia nhỏ tin nhắn nếu dài hơn giới hạn ký tự (Giới hạn của Messenger ~2000)
function splitMessage(text, chunkSize = 1800) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

// Trả về số ms ngẫu nhiên trong khoảng [min, max] để tránh gửi tin theo chu kỳ cố định
// (chu kỳ cố định rất dễ bị hệ thống chống spam của Facebook nhận diện)
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Chống spam lệnh: mỗi user chỉ được gọi lệnh này cách nhau tối thiểu COOLDOWN_MS
const COOLDOWN_MS = 15000; // 15 giây
const lastUsed = new Map(); // key: senderID, value: timestamp

// Giới hạn số đoạn (chunk) gửi tối đa trong 1 lần gọi lệnh, tránh việc 1 chương quá dài
// làm bot dội hàng chục tin nhắn liên tiếp vào cùng 1 luồng chat
const MAX_CHUNKS_PER_CALL = 6;

module.exports = {
  config: {
    name: "truyen",
    aliases: ["doctruyen", "fulltruyen"],
    version: "1.2.0",
    role: 0,
    description: "Đọc truyện chữ từ trang truyenfull.live",
    usage: "truyen <tên truyện> <chương>",
    category: "Giải trí"
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;

    // --- Chống spam lệnh theo user ---
    const now = Date.now();
    const last = lastUsed.get(senderID) || 0;
    if (now - last < COOLDOWN_MS) {
      const remain = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
      return api.sendMessage(`⏳ Bạn thao tác quá nhanh, vui lòng đợi ${remain}s rồi thử lại.`, threadID, messageID);
    }
    lastUsed.set(senderID, now);

    // Yêu cầu người dùng nhập đủ arg
    if (args.length < 2) {
      return api.sendMessage("⚠️ Cú pháp không hợp lệ!\nCách dùng: truyen <tên truyện> <số chương>\nVí dụ: truyen đấu la đại lục 1", threadID, messageID);
    }

    // Gộp args lại thành một chuỗi để tách tên truyện và chương
    const argsString = args.join(" ").toLowerCase();

    // Regex tìm số chương ở cuối câu (Hỗ trợ định dạng: "tên truyện chuong 1" hoặc "tên truyện 1")
    const match = argsString.match(/(.*?)\s+(?:chuong|chương|-)?\s*(\d+)$/i);

    if (!match) {
      return api.sendMessage("❌ Không nhận diện được số chương. Vui lòng thử lại!\nVí dụ: truyen phàm nhân tu tiên 10", threadID, messageID);
    }

    const storyName = match[1].trim();
    const chapterNum = match[2];
    const slug = createSlug(storyName);

    // URL thực tế của truyenfull.live: <slug>/chuong-<n>/
    const url = `https://truyenfull.live/${slug}/chuong-${chapterNum}/`;

    try {
      api.sendMessage(`⏳ Đang tải chương ${chapterNum} của truyện "${storyName}", vui lòng đợi...`, threadID, messageID);

      const { data } = await axios.get(url, {
        timeout: 15000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        }
      });

      const dom = new JSDOM(data);
      const document = dom.window.document;

      // Class nội dung chương phổ biến trên các site họ truyenfull
      const contentElement =
        document.querySelector("#chapter-c") ||
        document.querySelector(".chapter-c") ||
        document.querySelector("#chapter-content") ||
        document.querySelector(".chapter-content");

      if (!contentElement) {
        return api.sendMessage(`❌ Không thể trích xuất nội dung từ trang web. Có thể website đã thay đổi cấu trúc giao diện.`, threadID, messageID);
      }

      // Lấy nội dung text và làm sạch các khoảng trắng dư thừa
      let content = contentElement.textContent.trim();
      content = content.replace(/\n\s*\n/g, "\n\n"); // Xóa các dòng trống thừa

      if (!content) {
        return api.sendMessage(`❌ Chương này dường như không có nội dung.`, threadID, messageID);
      }

      const header = `📖 ${storyName.toUpperCase()} - CHƯƠNG ${chapterNum}\n────────────────\n`;
      const fullText = header + content;

      // Chia nhỏ nội dung
      const chunks = splitMessage(fullText);
      const totalChunks = chunks.length;
      const chunksToSend = chunks.slice(0, MAX_CHUNKS_PER_CALL);

      // Gửi tuần tự, đợi callback gửi xong mới gửi tiếp, với độ trễ ngẫu nhiên giữa các tin
      for (const [index, chunk] of chunksToSend.entries()) {
        // Đánh số phần nếu nội dung bị cắt thành nhiều tin
        const partLabel = totalChunks > 1 ? `\n\n[Phần ${index + 1}/${totalChunks}]` : "";
        await new Promise(resolve => {
          api.sendMessage(chunk + partLabel, threadID, () => resolve());
        });

        if (index < chunksToSend.length - 1) {
          // Giãn cách ngẫu nhiên 3-6 giây thay vì cố định 1.5s, giảm nguy cơ bị đánh dấu spam
          await sleep(randomDelay(3000, 6000));
        }
      }

      // Nếu nội dung còn dư mà chưa gửi hết, báo cho người dùng thay vì dội hết luôn
      if (totalChunks > MAX_CHUNKS_PER_CALL) {
        await sleep(randomDelay(2000, 4000));
        api.sendMessage(
          `ℹ️ Chương này khá dài (${totalChunks} phần). Đã gửi ${MAX_CHUNKS_PER_CALL} phần đầu. Gõ lại lệnh "truyen ${storyName} ${chapterNum}" sau ít phút để xem tiếp (hoặc cân nhắc đọc trực tiếp trên web nếu quá dài).`,
          threadID
        );
      }

    } catch (err) {
      if (err.response && err.response.status === 404) {
        return api.sendMessage(`❌ Không tìm thấy truyện hoặc chương này trên hệ thống! Vui lòng kiểm tra lại tên truyện.`, threadID, messageID);
      }
      if (err.code === "ECONNABORTED") {
        return api.sendMessage(`❌ Trang web phản hồi quá lâu, vui lòng thử lại sau.`, threadID, messageID);
      }
      return api.sendMessage(`❌ Đã có lỗi xảy ra khi tải truyện: ${err.message}`, threadID, messageID);
    }
  }
};
