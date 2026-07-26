const axios = require("axios");
const { JSDOM } = require("jsdom");
const { Readable } = require("stream"); // Fix lỗi Uint8Array
const fs = require("fs");
const os = require("os");
const path = require("path");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);

// File nhạc nền cố định dùng chung cho mọi truyện. Tự upload file mp3 và đặt
// đúng đường dẫn này (tạo thư mục assets/audio nếu chưa có). Nếu file không
// tồn tại, bot sẽ tự bỏ qua bước trộn nhạc và gửi voice TTS như bình thường.
const BG_MUSIC_PATH = path.join(__dirname, "..", "assets", "audio", "truyentts-bg.mp3");
const BG_MUSIC_VOLUME = 0.15; // 0.0 - 1.0, càng nhỏ nhạc nền càng nhỏ so với giọng đọc

// Khoảng thời gian random chờ giữa 2 chương khi tự động đọc tiếp (tính bằng phút)
const AUTO_NEXT_MIN_MINUTES = 2;
const AUTO_NEXT_MAX_MINUTES = 4;

// Trộn 1 buffer giọng đọc (mp3) với nhạc nền (loop cho đủ độ dài), trả về
// buffer mp3 đã trộn. Nếu không có file nhạc nền hoặc ffmpeg lỗi, trả về null
// để nơi gọi tự fallback dùng buffer gốc (không có nhạc nền).
function mixWithBackgroundMusic(narrationBuffer) {
  return new Promise((resolve) => {
    if (!fs.existsSync(BG_MUSIC_PATH)) return resolve(null);

    const tmpDir = os.tmpdir();
    const narrationPath = path.join(tmpDir, `tts-narration-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
    const outputPath = path.join(tmpDir, `tts-mixed-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);

    fs.writeFile(narrationPath, narrationBuffer, (writeErr) => {
      if (writeErr) return resolve(null);

      ffmpeg()
        .input(narrationPath)
        .input(BG_MUSIC_PATH)
        .inputOptions(["-stream_loop -1"]) // lặp nhạc nền vô hạn, ffmpeg tự cắt khi giọng đọc kết thúc
        .complexFilter(
          [
            `[1:a]volume=${BG_MUSIC_VOLUME}[bg]`,
            "[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[out]"
          ],
          "out"
        )
        .audioCodec("libmp3lame")
        .format("mp3")
        .on("error", () => {
          // Dọn file tạm rồi báo lỗi (fallback) cho nơi gọi
          fs.unlink(narrationPath, () => {});
          fs.unlink(outputPath, () => {});
          resolve(null);
        })
        .on("end", () => {
          fs.readFile(outputPath, (readErr, mixedBuffer) => {
            fs.unlink(narrationPath, () => {});
            fs.unlink(outputPath, () => {});
            if (readErr) return resolve(null);
            resolve(mixedBuffer);
          });
        })
        .save(outputPath);
    });
  });
}

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

// Gửi tin nhắn và trả về Promise<messageID> (hoặc null nếu gửi lỗi/không lấy được id).
// Dùng để theo dõi các tin nhắn "trạng thái" (đang tải, bắt đầu đọc...) nhằm tự xóa sau khi xong.
function sendTrackedMessage(api, body, threadID, messageID) {
  return new Promise((resolve) => {
    api.sendMessage(body, threadID, (err, info) => {
      if (err) {
        console.error("Lỗi gửi tin nhắn trạng thái:", err.message || err);
        return resolve(null);
      }
      resolve(info && info.messageID ? info.messageID : null);
    }, messageID);
  });
}

// Tự xóa (unsend) danh sách tin nhắn trạng thái sau khi đã gửi xong voice.
async function cleanupStatusMessages(api, ids) {
  for (const id of ids) {
    if (!id) continue;
    try {
      await new Promise((resolve) => {
        api.unsendMessage(id, (err) => {
          if (err) console.error(`Không thể xóa tin nhắn ${id}:`, err.message || err);
          resolve();
        });
      });
    } catch (e) {
      console.error(`Lỗi khi xóa tin nhắn ${id}:`, e.message || e);
    }
  }
}

const COOLDOWN_MS = 30000;
const lastUsed = new Map();

// Các phiên "tự động đọc tiếp" đang chạy, khóa theo threadID.
// session = { token, storyName, slug, nextChapter, timer, senderID }
const autoSessions = new Map();

// Dừng phiên tự động đang chạy trong 1 thread (nếu có). Trả về true nếu vừa dừng 1 phiên.
function stopAutoSession(threadID) {
  const session = autoSessions.get(threadID);
  if (!session) return false;
  if (session.timer) clearTimeout(session.timer);
  autoSessions.delete(threadID);
  return true;
}

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

// Cào + chuyển 1 chương thành giọng nói rồi gửi vào thread.
// Trả về một trong các trạng thái: "ok", "not_found", "empty", "error".
// messageID chỉ dùng để reply khi đây là lệnh do người dùng gõ trực tiếp (auto = false);
// khi tự động gửi (auto = true) không reply vào tin nhắn nào cả.
async function fetchAndSendChapter({ api, threadID, messageID, storyName, slug, chapterNum, auto }) {
  const url = `https://truyenfull.live/${slug}/chuong-${chapterNum}/`;
  const statusMessageIDs = [];
  const replyID = auto ? null : messageID;

  try {
    const loadingId1 = await sendTrackedMessage(api, `⏳ Đang tải và chuyển truyện thành giọng nói...`, threadID, replyID);
    statusMessageIDs.push(loadingId1);

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
      await cleanupStatusMessages(api, statusMessageIDs);
      await api.sendMessage(`❌ Không thể trích xuất nội dung. Web có thể đã đổi cấu trúc.`, threadID, replyID);
      return "error";
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
      await cleanupStatusMessages(api, statusMessageIDs);
      await api.sendMessage(`❌ Chương này không có nội dung.`, threadID, replyID);
      return "empty";
    }

    // 2. Cắt chữ thành các đoạn nhỏ
    const textChunks = splitTextForTTS(content, 200);

    const loadingId2 = await sendTrackedMessage(
      api,
      `🎙️ Bắt đầu đọc: ${storyName.toUpperCase()} - Chương ${chapterNum}\n📊 Tổng số đoạn âm thanh: ${textChunks.length} (Đang tải và ghép thành 1 file voice, có thể mất một lúc)...`,
      threadID
    );
    statusMessageIDs.push(loadingId2);

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
      await cleanupStatusMessages(api, statusMessageIDs);
      await api.sendMessage(`❌ Không tải được âm thanh cho chương này (có thể do Google TTS đang chặn). Vui lòng thử lại sau.`, threadID, replyID);
      return "error";
    }

    // Báo cho người dùng biết nếu có đoạn bị bỏ qua sau khi đã retry
    if (failedIndexes.length > 0) {
      api.sendMessage(`⚠️ ${failedIndexes.length}/${textChunks.length} đoạn tải âm thanh thất bại sau ${MAX_RETRY} lần thử, sẽ bị bỏ qua (đoạn số: ${failedIndexes.slice(0, 20).join(', ')}${failedIndexes.length > 20 ? '...' : ''}).`, threadID);
    }

    // 4. GHÉP ÂM THANH THÀNH CÁC FILE MP3, TỰ CẮT PHẦN KHI GẦN CHẠM GIỚI HẠN DUNG LƯỢNG
    const validBuffers = audioBuffers.filter(b => b !== null);

    if (validBuffers.length === 0) {
      await cleanupStatusMessages(api, statusMessageIDs);
      await api.sendMessage(`❌ Không có đoạn âm thanh nào tải thành công.`, threadID, replyID);
      return "error";
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

      // Thử trộn nhạc nền vào giọng đọc; nếu không có file nhạc nền hoặc
      // ffmpeg lỗi thì dùng bản gốc (không nhạc nền) để không làm gián đoạn lệnh.
      let outputBuffer = mergedBuffer;
      try {
        const mixedBuffer = await mixWithBackgroundMusic(mergedBuffer);
        if (mixedBuffer) outputBuffer = mixedBuffer;
      } catch (mixErr) {
        console.error("Lỗi khi trộn nhạc nền TTS:", mixErr.message || mixErr);
      }

      const finalStream = Readable.from(outputBuffer);
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
            api.sendMessage(`❌ Gửi file voice phần ${p + 1} thất bại: ${err.message || err}`, threadID, replyID);
          }
          resolve();
        });
      });

      // Nghỉ ngắn giữa các phần để tránh gửi dồn dập
      if (p < parts.length - 1) {
        await sleep(randomDelay(2000, 3500));
      }
    }

    // Đã gửi xong (các) file voice -> tự xóa các tin nhắn trạng thái (loading) ở trên
    await cleanupStatusMessages(api, statusMessageIDs);
    return "ok";

  } catch (err) {
    await cleanupStatusMessages(api, statusMessageIDs);
    if (err.response && err.response.status === 404) {
      await api.sendMessage(`❌ Không tìm thấy truyện hoặc chương này!`, threadID, replyID);
      return "not_found";
    }
    await api.sendMessage(`❌ Lỗi khi xử lý: ${err.message}`, threadID, replyID);
    return "error";
  }
}

// Đặt lịch tự động gửi chương kế tiếp sau 1 khoảng thời gian random (phút).
// Kiểm tra "token" trước khi chạy để chắc chắn phiên chưa bị stop / bị thay bởi phiên mới.
function scheduleNextChapter(api, threadID, token) {
  const delayMs = randomDelay(AUTO_NEXT_MIN_MINUTES * 60 * 1000, AUTO_NEXT_MAX_MINUTES * 60 * 1000);

  const timer = setTimeout(async () => {
    const session = autoSessions.get(threadID);
    // Phiên đã bị stop hoặc bị thay thế bởi 1 phiên khác -> không làm gì nữa
    if (!session || session.token !== token) return;

    const chapterNum = session.nextChapter;
    const status = await fetchAndSendChapter({
      api,
      threadID,
      messageID: null,
      storyName: session.storyName,
      slug: session.slug,
      chapterNum,
      auto: true
    });

    // Kiểm tra lại session (có thể vừa bị stop trong lúc đang tải/gửi)
    const currentSession = autoSessions.get(threadID);
    if (!currentSession || currentSession.token !== token) return;

    if (status === "ok") {
      currentSession.nextChapter = chapterNum + 1;
      scheduleNextChapter(api, threadID, token);
    } else if (status === "not_found") {
      api.sendMessage(`📕 Đã đọc hết truyện "${session.storyName.toUpperCase()}" (không tìm thấy chương ${chapterNum}). Dừng tự động đọc.`, threadID);
      autoSessions.delete(threadID);
    } else {
      // "error" hoặc "empty": dừng tự động để tránh lặp lỗi liên tục, người dùng có thể gọi lại thủ công
      api.sendMessage(`⚠️ Gặp lỗi khi tự động tải chương ${chapterNum} của "${session.storyName.toUpperCase()}". Đã dừng tự động đọc, bạn có thể gõ lại lệnh để tiếp tục thủ công.`, threadID);
      autoSessions.delete(threadID);
    }
  }, delayMs);

  const session = autoSessions.get(threadID);
  if (session && session.token === token) {
    session.timer = timer;
  }
}

module.exports = {
  config: {
    name: "truyentts",
    aliases: ["doctruyen tts"],
    version: "2.2",
    role: 0,
    description: "Đọc truyện chữ bằng giọng nói (Hỗ trợ truyện dài, tự động đọc tiếp)",
    usage: "truyentts <tên truyện> <số chương> | truyentts stop",
    category: "Giải trí"
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;

    // Lệnh dừng tự động đọc: !truyentts stop
    if (args.length === 1 && args[0].toLowerCase() === "stop") {
      const stopped = stopAutoSession(threadID);
      return api.sendMessage(
        stopped ? "🛑 Đã dừng tự động đọc truyện trong nhóm/hộp thoại này." : "ℹ️ Hiện không có phiên tự động đọc truyện nào đang chạy.",
        threadID,
        messageID
      );
    }

    const now = Date.now();
    const last = lastUsed.get(senderID) || 0;
    if (now - last < COOLDOWN_MS) {
      const remain = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
      return api.sendMessage(`⏳ Lệnh TTS cần thời gian xử lý, vui lòng đợi ${remain}s.`, threadID, messageID);
    }
    lastUsed.set(senderID, now);

    if (args.length < 2) {
      return api.sendMessage("⚠️ Cú pháp: truyentts <tên truyện> <số chương>\nVí dụ: truyentts đấu la đại lục 1\nDùng \"truyentts stop\" để dừng tự động đọc tiếp.", threadID, messageID);
    }

    const argsString = args.join(" ").toLowerCase();
    const match = argsString.match(/(.*?)\s+(?:chuong|chương|-)?\s*(\d+)$/i);

    if (!match) {
      return api.sendMessage("❌ Không nhận diện được số chương.", threadID, messageID);
    }

    const storyName = match[1].trim();
    const chapterNum = parseInt(match[2], 10);
    const slug = createSlug(storyName);

    // Nếu thread này đang có 1 phiên tự động khác chạy, dừng nó lại trước khi bắt đầu phiên mới
    stopAutoSession(threadID);

    const status = await fetchAndSendChapter({
      api,
      threadID,
      messageID,
      storyName,
      slug,
      chapterNum,
      auto: false
    });

    // Chỉ bắt đầu tự động đọc tiếp nếu chương vừa rồi gửi thành công
    if (status === "ok") {
      const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      autoSessions.set(threadID, {
        token,
        storyName,
        slug,
        nextChapter: chapterNum + 1,
        timer: null,
        senderID
      });
      await api.sendMessage(
        `🔁 Sẽ tự động gửi chương ${chapterNum + 1} sau khoảng ${AUTO_NEXT_MIN_MINUTES}-${AUTO_NEXT_MAX_MINUTES} phút. Gõ "truyentts stop" bất cứ lúc nào để dừng.`,
        threadID
      );
      scheduleNextChapter(api, threadID, token);
    }
  }
};
