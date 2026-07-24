const fs = require("fs-extra");
const path = require("path");

// Fix lỗi thiếu fetch cho Node.js dưới v18, tương thích với Node.js >= 18
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const { Readable } = require("stream");
const logger = require("../utils/log");

const CACHE_DIR = path.join(__dirname, "cache");
fs.ensureDirSync(CACHE_DIR);

const MAX_SIZE = 25 * 1024 * 1024; // 25MB giới hạn gửi file của Messenger
const MAX_DURATION = 10 * 60; // 10 phút

// ==== Cấu hình RapidAPI ====
const RAPIDAPI_HOST = "youtube-mp3-audio-video-downloader.p.rapidapi.com";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

function rapidApiHeaders() {
  return {
    "x-rapidapi-key": RAPIDAPI_KEY,
    "x-rapidapi-host": RAPIDAPI_HOST,
  };
}

// Trích video ID từ 1 URL YouTube đầy đủ
function extractVideoId(text) {
  const match = text.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

// ==== Lấy metadata video ====
async function getVideoInfo(videoId) {
  const url = new URL(`https://${RAPIDAPI_HOST}/get-video-info/${videoId}`);
  url.searchParams.set("response_mode", "default");

  const res = await fetch(url, { headers: rapidApiHeaders() });
  if (!res.ok) throw new Error(`Lấy thông tin video thất bại — HTTP ${res.status}`);
  const data = await res.json();
  return {
    title: data.title || videoId,
    author: data.author || data.ownerChannelName || "?",
    durationSec: parseInt(data.lengthSeconds, 10) || 0,
  };
}

// ==== Tải file MP3 trực tiếp (Đã fix lỗi PassThrough) ====
async function downloadMp3(videoId, filePath) {
  const url = new URL(`https://${RAPIDAPI_HOST}/download-mp3/${videoId}`);
  url.searchParams.set("quality", "low");

  const res = await fetch(url, { headers: rapidApiHeaders() });
  if (!res.ok || !res.body) {
    throw new Error(`Tải mp3 thất bại — HTTP ${res.status}. (Kiểm tra lại Endpoint Download trên RapidAPI)`);
  }

  await new Promise((resolve, reject) => {
    let nodeStream;

    // XỬ LÝ TƯƠNG THÍCH STREAM: Phân biệt node-fetch và fetch mặc định của Node.js
    if (typeof res.body.pipe === 'function') {
      // Đây là Stream của thư viện node-fetch -> Dùng trực tiếp
      nodeStream = res.body;
    } else {
      // Đây là Web Stream mặc định của Node.js >= 18 -> Chuyển đổi
      nodeStream = Readable.fromWeb(res.body);
    }

    const writeStream = fs.createWriteStream(filePath);
    nodeStream.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("finish", resolve);
    nodeStream.pipe(writeStream);
  });

  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    throw new Error("File tải về rỗng.");
  }
}

// ==== Khai báo lệnh cho Bot ====
module.exports = {
  config: {
    name: "ytb",
    aliases: ["youtube", "yt"],
    version: "2.0.3",
    role: 0,
    description: "Tải audio MP3 từ link YouTube",
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

    if (!RAPIDAPI_KEY) {
      return api.sendMessage(
        "❌ Bot chưa cấu hình RAPIDAPI_KEY. Admin vui lòng thêm biến môi trường!",
        threadID,
        messageID
      );
    }

    // Bắt buộc người dùng gửi link
    const videoId = extractVideoId(query);
    if (!videoId) {
      return api.sendMessage(
        "❌ Link YouTube không hợp lệ. Vui lòng gửi đúng link video/shorts YouTube.",
        threadID,
        messageID
      );
    }

    const filePath = path.join(CACHE_DIR, `${threadID}-${senderID}.mp3`);

    try {
      api.sendMessage(`⏳ Đang lấy thông tin và tải audio, chờ chút nhé...`, threadID, messageID);

      // 1. Lấy thông tin
      const info = await getVideoInfo(videoId);
      
      if (info.durationSec > MAX_DURATION) {
        return api.sendMessage(
          `❌ "${info.title}" dài quá ${MAX_DURATION / 60} phút, bot không tải được.`,
          threadID,
          messageID
        );
      }

      // 2. Tải file
      await downloadMp3(videoId, filePath);

      // 3. Kiểm tra dung lượng
      if (fs.statSync(filePath).size > MAX_SIZE) {
        fs.unlinkSync(filePath);
        throw new Error(`Vượt quá 25MB, Messenger không cho phép gửi.`);
      }

      // 4. Gửi tin nhắn
      return api.sendMessage(
        {
          body: `✅ ${info.title}\n👤 ${info.author}\n🔗 https://youtu.be/${videoId}`,
          attachment: fs.createReadStream(filePath),
        },
        threadID,
        () => fs.unlink(filePath, () => {}), // Xóa file sau khi gửi xong
        messageID
      );
    } catch (err) {
      // Xóa file rác nếu có lỗi xảy ra
      fs.remove(filePath).catch(() => {});
      logger.error(`Lỗi lệnh ytb: ${err.message}`, "CMD");
      return api.sendMessage(`❌ Đã có lỗi: ${err.message}`, threadID, messageID);
    }
  },
};
