const fs = require("fs-extra");
const path = require("path");
const { Readable } = require("stream");
const { Innertube, ClientType, UniversalCache } = require("youtubei.js");

const logger = require("../utils/log");

const CACHE_DIR = path.join(__dirname, "cache");
fs.ensureDirSync(CACHE_DIR);

const MAX_SIZE = 25 * 1024 * 1024; // 25MB giới hạn gửi file của Messenger
const MAX_DURATION = 10 * 60; // 10 phút

// ==== Client YouTube dùng thư viện JS thuần youtubei.js (thay cho CLI yt-dlp) ====
// Dùng client ANDROID vì nó không đòi PoToken/BotGuard như client WEB (giống hệt
// lý do trước đây yt-dlp cũng được cấu hình player_client=android trong bản cũ),
// nên không cần cài thêm gì ở cấp hệ điều hành (không cần python3/ffmpeg/deno/Docker).
let innertubePromise = null;
function getInnertube() {
  if (!innertubePromise) {
    innertubePromise = Innertube.create({
      client_type: ClientType.ANDROID,
      cache: new UniversalCache(false),
      generate_session_locally: true,
    }).catch(err => {
      innertubePromise = null; // cho phép thử lại ở lần gọi sau nếu lần này lỗi
      throw err;
    });
  }
  return innertubePromise;
}

// Trích video ID từ 1 URL YouTube đầy đủ
function extractVideoId(text) {
  const match = text.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

// ==== Lấy metadata video (không tải file) ====
async function getVideoInfo(videoId) {
  const yt = await getInnertube();
  return yt.getBasicInfo(videoId);
}

// ==== Tải audio bằng youtubei.js, ghi ra file ở outputBase + đuôi phù hợp ====
async function downloadAudio(info, outputBase) {
  const stream = await info.download({
    type: "audio",
    quality: "best",
    format: "any", // audio-only có thể là mp4(m4a) hoặc webm(opus) tuỳ video
  });

  const chosen = info.chooseFormat({ type: "audio", quality: "best", format: "any" });
  const isWebm = (chosen?.mime_type || "").includes("webm");
  const ext = isWebm ? "webm" : "m4a";
  const filePath = `${outputBase}.${ext}`;

  const nodeStream = Readable.fromWeb(stream);
  const writeStream = fs.createWriteStream(filePath);

  await new Promise((resolve, reject) => {
    nodeStream.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("finish", resolve);
    nodeStream.pipe(writeStream);
  });

  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    throw new Error("File tải về rỗng hoặc không tạo được file audio.");
  }
  return filePath;
}

// ==== Khai báo lệnh cho Bot ====
module.exports = {
  config: {
    name: "ytb",
    aliases: ["youtube", "yt"],
    version: "5.0.0",
    role: 0,
    description: "Tải audio từ link YouTube (JS thuần, không cần Docker/yt-dlp)",
    usage: "ytb <link YouTube>",
    category: "Media",
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const query = args.join(" ").trim();

    if (!query) {
      return api.sendMessage(
        "⚠️ Bạn phải dán link YouTube vào!\nVí dụ: ytb https://youtu.be/dQw4w9WgXcQ",
        threadID,
        messageID
      );
    }

    const videoId = extractVideoId(query);
    if (!videoId) {
      return api.sendMessage(
        "❌ Link YouTube không hợp lệ. Vui lòng gửi đúng link video/shorts YouTube.",
        threadID,
        messageID
      );
    }

    const youtubeUrl = `https://youtu.be/${videoId}`;
    const outputBase = path.join(CACHE_DIR, `${threadID}-${senderID}`);
    let filePath = null;

    try {
      api.sendMessage(`⏳ Đang lấy thông tin và tải audio, chờ chút nhé...`, threadID, messageID);

      // 1. Lấy metadata trước để kiểm tra thời lượng, tránh tải phí công nếu quá dài
      const info = await getVideoInfo(videoId);
      const title = info.basic_info.title || videoId;
      const author = info.basic_info.author || info.basic_info.channel?.name || "?";
      const durationSec = info.basic_info.duration || 0;

      if (durationSec > MAX_DURATION) {
        return api.sendMessage(
          `❌ "${title}" dài quá ${MAX_DURATION / 60} phút, bot không tải được.`,
          threadID,
          messageID
        );
      }

      // 2. Tải audio
      filePath = await downloadAudio(info, outputBase);

      // 3. Kiểm tra dung lượng
      if (fs.statSync(filePath).size > MAX_SIZE) {
        fs.unlinkSync(filePath);
        throw new Error(`Vượt quá 25MB, Messenger không cho phép gửi.`);
      }

      // 4. Gửi tin nhắn
      return api.sendMessage(
        {
          body: `✅ ${title}\n👤 ${author}\n🔗 ${youtubeUrl}`,
          attachment: fs.createReadStream(filePath),
        },
        threadID,
        () => fs.unlink(filePath, () => {}), // Xóa file sau khi gửi xong
        messageID
      );
    } catch (err) {
      if (filePath) fs.remove(filePath).catch(() => {});
      const msg = err.message || String(err);
      logger.error(`Lỗi lệnh ytb: ${msg}`, "CMD");
      return api.sendMessage(`❌ Đã có lỗi: ${msg}`, threadID, messageID);
    }
  },
};
