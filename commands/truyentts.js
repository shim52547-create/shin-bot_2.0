const axios = require("axios");
const { JSDOM } = require("jsdom");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);

// ==== CẤU HÌNH GIỌNG ĐỌC GOOGLE TRANSLATE TTS ====
// tl: mã ngôn ngữ Google Translate dùng để đọc ("vi" = tiếng Việt)
const TTS_LANG = "vi";
// ttsspeed: "1" tốc độ bình thường, có thể thử giá trị nhỏ hơn 1 để đọc chậm hơn
const TTS_SPEED = "1";
// Google Translate TTS chỉ chấp nhận đoạn text ngắn (an toàn nhất là ~180-200 ký tự/request)
const TTS_MAX_CHUNK_LEN = 180;
// Số đoạn nhỏ được tải xong rồi mới ghép lại thành 1 file gửi đi. Đặt lớn
// (999) để mặc định GỘP CẢ CHƯƠNG thành 1 file duy nhất (ra 1 file 7-11
// phút/chương giống trước đây). Muốn chia nhỏ hơn thì giảm số này lại.
const TTS_GROUP_SIZE = 999;

// File nhạc nền cố định dùng chung cho mọi truyện. Tự upload file mp3 và đặt
// đúng đường dẫn này (tạo thư mục assets/audio nếu chưa có). Nếu file không
// tồn tại, bot sẽ tự bỏ qua bước trộn nhạc và gửi voice TTS như bình thường.
const BG_MUSIC_PATH = path.join(__dirname, "..", "assets", "audio", "truyentts-bg.mp3");
const BG_MUSIC_VOLUME = 0.15; // 0.0 - 1.0, càng nhỏ nhạc nền càng nhỏ so với giọng đọc

// Khoảng thời gian random chờ giữa 2 chương khi tự động đọc tiếp (tính bằng phút)
const AUTO_NEXT_MIN_MINUTES = 2;
const AUTO_NEXT_MAX_MINUTES = 5;

// Lấy prefix lệnh hiện tại của bot (nếu framework có global.config.PREFIX),
// dùng để hiển thị tin nhắn "lệnh ảo" giống hệt lệnh thật cho người dùng xem.
// Chỉ để hiển thị - KHÔNG dùng để tự kích hoạt lại command parser (đa số bot
// tự bỏ qua tin nhắn do chính nó gửi ra để tránh loop vô hạn).
function getPrefix() {
  try {
    return (global.config && global.config.PREFIX) ? global.config.PREFIX : "!";
  } catch (e) {
    return "!";
  }
}

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

// Trả về chuỗi mô tả lỗi đầy đủ nhất có thể lấy được từ 1 object lỗi bất kỳ,
// kể cả khi đó không phải là một instance của Error chuẩn (vd object websocket
// close event, plain object, string...). Dùng để log/debug thay vì chỉ in
// err.message (có thể là undefined và không nói lên bản chất lỗi thật).
function describeError(err) {
  if (err === null || err === undefined) return String(err);
  if (err instanceof Error) {
    const extra = { ...err };
    const extraStr = Object.keys(extra).length ? ` | extra=${safeStringify(extra)}` : "";
    return `${err.name || "Error"}: ${err.message || "(không có message)"}${err.stack ? `\n${err.stack}` : ""}${extraStr}`;
  }
  if (typeof err === "object") {
    return `[object không phải Error] ${safeStringify(err)}`;
  }
  return String(err);
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj, Object.getOwnPropertyNames(obj));
  } catch (e) {
    try {
      return String(obj);
    } catch (e2) {
      return "(không thể stringify lỗi)";
    }
  }
}

// Gửi tin nhắn và trả về Promise<messageID> (hoặc null nếu gửi lỗi/không lấy được id).
function sendTrackedMessage(api, body, threadID, messageID) {
  return new Promise((resolve) => {
    api.sendMessage(body, threadID, (err, info) => {
      if (err) {
        console.error("Lỗi gửi tin nhắn trạng thái:", describeError(err));
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
          if (err) console.error(`Không thể xóa tin nhắn ${id}:`, describeError(err));
          resolve();
        });
      });
    } catch (e) {
      console.error(`Lỗi khi xóa tin nhắn ${id}:`, describeError(e));
    }
  }
}

const COOLDOWN_MS = 30000;
const lastUsed = new Map();

// Các phiên "tự động đọc tiếp" đang chạy, khóa theo threadID.
const autoSessions = new Map();

function stopAutoSession(threadID) {
  const session = autoSessions.get(threadID);
  if (!session) return false;
  if (session.timer) clearTimeout(session.timer);
  autoSessions.delete(threadID);
  return true;
}

// Cắt text thành các đoạn tối đa maxLen ký tự, ưu tiên cắt tại dấu câu.
// Google Translate TTS chỉ chấp nhận đoạn ngắn (~180-200 ký tự/request).
function splitTextForTTS(text, maxLen = 180) {
  const chunks = [];
  let current = '';
  const parts = text.replace(/([.!?,;…])\s*/g, '$1|').split('|');

  for (const part of parts) {
    if (part.trim().length === 0) continue;

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

// Chuyển 1 đoạn text (ngắn, tối đa ~200 ký tự) thành buffer mp3 bằng endpoint
// text-to-speech không chính thức của Google Translate. Endpoint này miễn phí,
// không cần API key, nhưng giới hạn độ dài text mỗi request khá ngắn.
async function googleTtsToBuffer(text) {
  const response = await axios.get("https://translate.google.com/translate_tts", {
    params: {
      ie: "UTF-8",
      q: text,
      tl: TTS_LANG,
      client: "tw-ob",
      ttsspeed: TTS_SPEED
    },
    responseType: "arraybuffer",
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://translate.google.com/"
    }
  });
  return Buffer.from(response.data);
}

// Cào + chuyển 1 chương thành giọng nói rồi gửi vào thread.
// Trả về một trong các trạng thái: "ok", "not_found", "empty", "error".
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

    contentElement.querySelectorAll('em').forEach(em => {
      if (em.textContent.includes('nội dung ảnh')) {
        em.remove();
      }
    });

    contentElement.querySelectorAll('div[id^="ads-"]').forEach(div => div.remove());

    let content = contentElement.textContent.trim();
    content = content.replace(/\n\s*\n/g, ". ").replace(/\s{2,}/g, ' ').trim();
    content = content.replace(/\*?\s*Chương này có nội dung ảnh[^.]*\./gi, '').trim();

    if (!content) {
      await cleanupStatusMessages(api, statusMessageIDs);
      await api.sendMessage(`❌ Chương này không có nội dung.`, threadID, replyID);
      return "empty";
    }

    // 2. Cắt chữ thành các đoạn ngắn (Google Translate TTS giới hạn độ dài text/request)
    const textChunks = splitTextForTTS(content, TTS_MAX_CHUNK_LEN);

    const loadingId2 = await sendTrackedMessage(
      api,
      `🎙️ Bắt đầu đọc: ${storyName.toUpperCase()} - Chương ${chapterNum}\n📊 Tổng số đoạn âm thanh: ${textChunks.length} (gộp mỗi ${TTS_GROUP_SIZE} đoạn thành 1 file trước khi gửi)...`,
      threadID
    );
    statusMessageIDs.push(loadingId2);

    // 3. Sinh audio theo NHÓM (TTS_GROUP_SIZE đoạn) - tải xong đủ cả nhóm mới
    // ghép lại thành 1 file rồi gửi, thay vì gửi từng đoạn nhỏ lẻ tẻ.
    const MAX_RETRY = 3;
    let successGroupCount = 0;
    const failedIndexes = [];
    const totalGroups = Math.ceil(textChunks.length / TTS_GROUP_SIZE);

    for (let g = 0; g < totalGroups; g++) {
      const groupStart = g * TTS_GROUP_SIZE;
      const groupEnd = Math.min(groupStart + TTS_GROUP_SIZE, textChunks.length);
      const groupBuffers = [];

      // Tải TUẦN TỰ từng đoạn trong nhóm, đợi đoạn trước xong mới qua đoạn sau.
      for (let i = groupStart; i < groupEnd; i++) {
        let buffer = null;
        for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
          try {
            buffer = await googleTtsToBuffer(textChunks[i]);
            break; // thành công, thoát vòng retry
          } catch (err) {
            // Log đầy đủ lỗi thật (không chỉ err.message) để biết chính xác
            // nguyên nhân: timeout, connection reset, Space đang ngủ/khởi động, v.v.
            console.error(`Đoạn ${i + 1} lỗi (lần ${attempt}/${MAX_RETRY}): ${describeError(err)}`);
            if (attempt < MAX_RETRY) {
              await sleep(randomDelay(2000, 4000));
            }
          }
        }

        if (buffer) {
          groupBuffers.push(buffer);
        } else {
          failedIndexes.push(i + 1);
        }
      }

      if (groupBuffers.length === 0) {
        // Cả nhóm đều lỗi, không có gì để ghép/gửi - qua nhóm tiếp theo.
        continue;
      }

      // Ghép các đoạn trong nhóm lại thành 1 file
      const mergedBuffer = Buffer.concat(groupBuffers);

      let outputBuffer = mergedBuffer;
      try {
        const mixedBuffer = await mixWithBackgroundMusic(mergedBuffer);
        if (mixedBuffer) outputBuffer = mixedBuffer;
      } catch (mixErr) {
        console.error("Lỗi khi trộn nhạc nền TTS:", describeError(mixErr));
      }

      const finalStream = require("stream").Readable.from(outputBuffer);
      finalStream.path = `${slug}-chuong-${chapterNum}-nhom-${g + 1}.mp3`;

      const groupFailedCount = (groupEnd - groupStart) - groupBuffers.length;
      const bodyText = groupFailedCount > 0
        ? `🎧 ${storyName.toUpperCase()} - Chương ${chapterNum} (${groupBuffers.length}/${groupEnd - groupStart} đoạn thành công trong khoảng ${groupStart + 1}-${groupEnd}/${textChunks.length} - ⚠️ ${groupFailedCount} đoạn lỗi, audio có thể thiếu/ngắn)`
        : `🎧 ${storyName.toUpperCase()} - Chương ${chapterNum} (Đoạn ${groupStart + 1}-${groupEnd}/${textChunks.length})`;

      await new Promise((resolve) => {
        api.sendMessage({
          body: bodyText,
          attachment: finalStream
        }, threadID, (err) => {
          if (err) {
            console.error(`Lỗi gửi voice nhóm ${g + 1}:`, describeError(err));
            api.sendMessage(`❌ Gửi voice đoạn ${groupStart + 1}-${groupEnd} thất bại: ${err.message || describeError(err)}`, threadID, replyID);
          } else {
            successGroupCount++;
          }
          resolve();
        });
      });

      // Nghỉ ngắn giữa các lần gửi để tránh gửi dồn dập
      await sleep(randomDelay(1000, 2000));
    }

    if (successGroupCount === 0) {
      await cleanupStatusMessages(api, statusMessageIDs);
      await api.sendMessage(`❌ Không tạo được audio nào cho chương này (Google TTS có thể đang gặp sự cố). Vui lòng thử lại sau.`, threadID, replyID);
      return "error";
    }

    if (failedIndexes.length > 0) {
      api.sendMessage(`⚠️ ${failedIndexes.length}/${textChunks.length} đoạn tải âm thanh thất bại sau ${MAX_RETRY} lần thử, đã bỏ qua (đoạn số: ${failedIndexes.slice(0, 20).join(', ')}${failedIndexes.length > 20 ? '...' : ''}).`, threadID);
    }

    await cleanupStatusMessages(api, statusMessageIDs);
    return "ok";

  } catch (err) {
    await cleanupStatusMessages(api, statusMessageIDs);
    if (err.response && err.response.status === 404) {
      await api.sendMessage(`❌ Không tìm thấy truyện hoặc chương này!`, threadID, replyID);
      return "not_found";
    }
    console.error("Lỗi tổng thể khi xử lý chương:", describeError(err));
    await api.sendMessage(`❌ Lỗi khi xử lý: ${err.message || describeError(err)}`, threadID, replyID);
    return "error";
  }
}

// Đặt lịch tự động gửi chương kế tiếp sau 1 khoảng thời gian random (phút).
// Trước khi xử lý, bot gửi 1 tin nhắn dạng lệnh (vd "!truyentts đấu la 2") để
// người dùng thấy rõ bot đang "tự tiếp tục" - CHỈ mang tính hiển thị, không đi
// qua command parser thật. Tin nhắn lệnh ảo này được thu hồi sau khi xử lý xong.
function scheduleNextChapter(api, threadID, token) {
  const delayMs = randomDelay(AUTO_NEXT_MIN_MINUTES * 60 * 1000, AUTO_NEXT_MAX_MINUTES * 60 * 1000);

  const timer = setTimeout(async () => {
    let fakeCommandMsgID = null;
    try {
      const session = autoSessions.get(threadID);
      if (!session || session.token !== token) return;

      const chapterNum = session.nextChapter;
      const prefix = getPrefix();
      const fakeCommandText = `${prefix}truyentts ${session.storyName} ${chapterNum}`;

      fakeCommandMsgID = await sendTrackedMessage(api, fakeCommandText, threadID, null);

      console.log(`[truyentts] Auto chapter ${chapterNum} of "${session.storyName}" (thread ${threadID})`);

      const status = await fetchAndSendChapter({
        api,
        threadID,
        messageID: null,
        storyName: session.storyName,
        slug: session.slug,
        chapterNum,
        auto: true
      });

      console.log(`[truyentts] Chapter ${chapterNum} status: ${status}`);

      if (fakeCommandMsgID) {
        await cleanupStatusMessages(api, [fakeCommandMsgID]);
      }

      const currentSession = autoSessions.get(threadID);
      if (!currentSession || currentSession.token !== token) return;

      if (status === "ok") {
        currentSession.nextChapter = chapterNum + 1;
        scheduleNextChapter(api, threadID, token);
      } else if (status === "not_found") {
        api.sendMessage(`📕 Đã đọc hết truyện "${session.storyName.toUpperCase()}" (không tìm thấy chương ${chapterNum}). Dừng tự động đọc.`, threadID);
        autoSessions.delete(threadID);
      } else {
        api.sendMessage(`⚠️ Gặp lỗi khi tự động tải chương ${chapterNum} của "${session.storyName.toUpperCase()}". Đã dừng tự động đọc, bạn có thể gõ lại lệnh để tiếp tục thủ công.`, threadID);
        autoSessions.delete(threadID);
      }
    } catch (err) {
      console.error(`[truyentts] Lỗi không xác định trong scheduleNextChapter (thread ${threadID}):`, describeError(err));
      if (fakeCommandMsgID) {
        try { await cleanupStatusMessages(api, [fakeCommandMsgID]); } catch (_) {}
      }
      try {
        api.sendMessage(`⚠️ Bot gặp lỗi không xác định khi tự động đọc tiếp. Đã dừng tự động, vui lòng gõ lại lệnh.`, threadID);
      } catch (_) {}
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
    version: "3.0",
    role: 0,
    description: "Đọc truyện chữ bằng giọng nói Google TTS (Hỗ trợ truyện dài, tự động đọc tiếp)",
    usage: "truyentts <tên truyện> <số chương> | truyentts stop",
    category: "Giải trí"
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;

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