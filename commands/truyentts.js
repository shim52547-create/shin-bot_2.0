const axios = require("axios");
const { JSDOM } = require("jsdom");
const { Readable } = require("stream"); // Fix lỗi Uint8Array

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const COOLDOWN_MS = 30000;
const lastUsed = new Map();

// Hàm cắt text thông minh hơn, tối đa 200 ký tự/đoạn để Google TTS đọc tốt nhất
function splitTextForTTS(text, maxLen = 200) {
  const chunks = [];
  let current = '';
  // Tách theo dấu câu để bot đọc có nghỉ hơi
  const parts = text.replace(/([.!?,;…])\s*/g, '$1|').split('|');

  for (const part of parts) {
    if (part.trim().length === 0) continue;

    // Nếu 1 câu dài bất thường (không có dấu chấm), ép cắt bằng khoảng trắng
    if (part.length > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      const words = part.split(' ');
      current = '';
      for (const word of words) {
        if ((current + ' ' + word).trim().length > maxLen) {
          if (current.trim()) chunks.push(current.trim());
          current = word;
        } else {
          current = current ? current + ' ' + word : word;
        }
      }
    } else {
      if ((current + ' ' + part).trim().length > maxLen) {
        if (current.trim()) chunks.push(current.trim());
        current = part;
      } else {
        current = current ? current + ' ' + part : part;
      }
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

module.exports = {
  config: {
    name: "truyentts",
    aliases: ["doctruyen tts"],
    version: "2.1",
    role: 0,
    description: "Đọc truyện chữ bằng giọng nói (Hỗ trợ truyện dài)",
    usage: "truyentts <tên truyện> <số chương>",
    category: "Giải trí"
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;

    const now = Date.now();
    const last = lastUsed.get(senderID) || 0;
    if (now - last < COOLDOWN_MS) {
      const remain = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
      return api.sendMessage(`⏳ Lệnh TTS cần thời gian xử lý, vui lòng đợi ${remain}s.`, threadID, messageID);
    }
    lastUsed.set(senderID, now);

    if (args.length < 2) {
      return api.sendMessage("⚠️ Cú pháp: truyentts <tên truyện> <số chương>\nVí dụ: truyentts đấu la đại lục 1", threadID, messageID);
    }

    const argsString = args.join(" ").toLowerCase();
    const match = argsString.match(/(.*?)\s+(?:chuong|chương|-)?\s*(\d+)$/i);

    if (!match) {
      return api.sendMessage("❌ Không nhận diện được số chương.", threadID, messageID);
    }

    const storyName = match[1].trim();
    const chapterNum = match[2];
    const slug = createSlug(storyName);
    const url = `https://truyenfull.live/${slug}/chuong-${chapterNum}/`;

    try {
      api.sendMessage(`⏳ Đang tải và chuyển truyện thành giọng nói...`, threadID, messageID);

      // 1. Cào nội dung truyện
      const { data } = await axios.get(url, {
        timeout: 15000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        }
      });

      const dom = new JSDOM(data);
      const document = dom.window.document;

      const contentElement =
        document.querySelector("#chapter-c") ||
        document.querySelector(".chapter-c") ||
        document.querySelector("#chapter-content") ||
        document.querySelector(".chapter-content");

      if (!contentElement) {
        return api.sendMessage(`❌ Không thể trích xuất nội dung. Web có thể đã đổi cấu trúc.`, threadID, messageID);
      }

      // Xóa thẻ <em> cảnh báo "chương có nội dung ảnh..." nếu có, không đọc vào TTS
      contentElement.querySelectorAll('em').forEach(em => {
        if (em.textContent.includes('nội dung ảnh')) {
          em.remove();
        }
      });

      // Xóa các div quảng cáo lồng bên trong nội dung chương (ví dụ #ads-chapter-top/bottom)
      contentElement.querySelectorAll('div[id^="ads-"]').forEach(div => div.remove());

      // Lấy toàn bộ nội dung thô, không lọc bớt phần nào — chỉ dọn khoảng trắng thừa.
      let content = contentElement.textContent.trim();
      content = content.replace(/\n\s*\n/g, ". ").replace(/\s{2,}/g, ' ').trim();

      // Lớp phòng hờ: nếu web đổi cấu trúc và câu cảnh báo không còn nằm trong <em>,
      // vẫn cố loại bỏ theo nội dung câu.
      content = content.replace(/\*?\s*Chương này có nội dung ảnh[^.]*\./gi, '').trim();

      if (!content) {
        return api.sendMessage(`❌ Chương này không có nội dung.`, threadID, messageID);
      }

      // 2. Cắt chữ thành các đoạn nhỏ
      const textChunks = splitTextForTTS(content, 200);

      api.sendMessage(`🎙️ Bắt đầu đọc: ${storyName.toUpperCase()} - Chương ${chapterNum}\n📊 Tổng số đoạn âm thanh: ${textChunks.length} (Đang tải và ghép thành 1 file voice, có thể mất một lúc)...`, threadID);

      // 3. Tải toàn bộ âm thanh trước (để kiểm tra lỗi rồi mới gửi)
      const MAX_RETRY = 3;
      const audioBuffers = [];
      const failedIndexes = [];

      for (let i = 0; i < textChunks.length; i++) {
        const encodedText = encodeURIComponent(textChunks[i]);
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodedText}`;

        let buffer = null;
        for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
          try {
            const audioRes = await axios.get(ttsUrl, {
              responseType: "arraybuffer",
              timeout: 10000,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Referer": "https://translate.google.com/"
              }
            });
            buffer = Buffer.from(audioRes.data);
            break; // thành công, thoát vòng retry
          } catch (err) {
            console.error(`Đoạn ${i + 1} lỗi (lần ${attempt}/${MAX_RETRY}): ${err.message}`);
            if (attempt < MAX_RETRY) {
              await sleep(randomDelay(1000, 2000)); // chờ lâu hơn trước khi thử lại
            }
          }
        }

        if (buffer) {
          audioBuffers.push(buffer);
        } else {
          audioBuffers.push(null);
          failedIndexes.push(i + 1);
        }

        // Nghỉ ngắn giữa các lần gọi TTS để tránh bị Google chặn/rate-limit
        await sleep(randomDelay(300, 700));
      }

      // Nếu toàn bộ đoạn đều lỗi thì báo và dừng lại
      if (audioBuffers.every(b => b === null)) {
        return api.sendMessage(`❌ Không tải được âm thanh cho chương này (có thể do Google TTS đang chặn). Vui lòng thử lại sau.`, threadID, messageID);
      }

      // Báo cho người dùng biết nếu có đoạn bị bỏ qua sau khi đã retry
      if (failedIndexes.length > 0) {
        api.sendMessage(`⚠️ ${failedIndexes.length}/${textChunks.length} đoạn tải âm thanh thất bại sau ${MAX_RETRY} lần thử, sẽ bị bỏ qua (đoạn số: ${failedIndexes.slice(0, 20).join(', ')}${failedIndexes.length > 20 ? '...' : ''}).`, threadID);
      }

      // 4. GHÉP ÂM THANH THÀNH CÁC FILE MP3, TỰ CẮT PHẦN KHI GẦN CHẠM GIỚI HẠN DUNG LƯỢNG
      const validBuffers = audioBuffers.filter(b => b !== null);

      if (validBuffers.length === 0) {
        return api.sendMessage(`❌ Không có đoạn âm thanh nào tải thành công.`, threadID, messageID);
      }

      // Facebook Messenger giới hạn dung lượng file đính kèm khoảng 25MB.
      // Để an toàn, mỗi phần chỉ gộp tối đa ~24MB rồi cắt sang phần mới.
      const MAX_PART_BYTES = 24 * 1024 * 1024;

      const parts = [];
      let currentPart = [];
      let currentSize = 0;

      for (const buffer of validBuffers) {
        // Nếu thêm buffer này vào sẽ vượt ngưỡng, chốt phần hiện tại lại trước
        if (currentSize + buffer.length > MAX_PART_BYTES && currentPart.length > 0) {
          parts.push(currentPart);
          currentPart = [];
          currentSize = 0;
        }
        currentPart.push(buffer);
        currentSize += buffer.length;
      }
      if (currentPart.length > 0) parts.push(currentPart);

      // Nối các buffer mp3 lại với nhau. Với mp3 do Google TTS trả về (không có
      // header/ID3 phức tạp), nối buffer trực tiếp vẫn phát được liền mạch.
      for (let p = 0; p < parts.length; p++) {
        const mergedBuffer = Buffer.concat(parts[p]);

        const finalStream = Readable.from(mergedBuffer);
        // QUAN TRỌNG: phải gán .path giả cho stream, vì FCA đọc thuộc tính này
        // để xác định tên file/mimetype khi upload. Thiếu .path sẽ gây lỗi
        // "Cannot convert undefined or null to object" trong uploadAttachment.
        const partLabel = parts.length > 1 ? `-phan-${p + 1}` : '';
        finalStream.path = `${slug}-chuong-${chapterNum}${partLabel}.mp3`;

        const bodyText = parts.length > 1
          ? `🎧 ${storyName.toUpperCase()} - Chương ${chapterNum} (Phần ${p + 1}/${parts.length})`
          : `🎧 ${storyName.toUpperCase()} - Chương ${chapterNum} (${validBuffers.length}/${textChunks.length} đoạn)`;

        await new Promise((resolve) => {
          api.sendMessage({
            body: bodyText,
            attachment: finalStream
          }, threadID, (err) => {
            if (err) {
              console.error(`Lỗi gửi file voice phần ${p + 1}:`, err.message || err);
              api.sendMessage(`❌ Gửi file voice phần ${p + 1} thất bại: ${err.message || err}`, threadID, messageID);
            }
            resolve();
          });
        });

        // Nghỉ ngắn giữa các phần để tránh gửi dồn dập
        if (p < parts.length - 1) {
          await sleep(randomDelay(2000, 3500));
        }
      }

    } catch (err) {
      if (err.response && err.response.status === 404) {
        return api.sendMessage(`❌ Không tìm thấy truyện hoặc chương này!`, threadID, messageID);
      }
      return api.sendMessage(`❌ Lỗi khi xử lý: ${err.message}`, threadID, messageID);
    }
  }
};
