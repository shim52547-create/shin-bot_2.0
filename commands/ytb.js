const fs = require("fs-extra");
const path = require("path");

// Dòng này_fix lỗi thiếu fetch cho Node.js dưới v18
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)); 

const { Readable } = require("stream");
const logger = require("../utils/log");

const CACHE_DIR = path.join(__dirname, "cache");
fs.ensureDirSync(CACHE_DIR);

const MAX_SIZE = 25 * 1024 * 1024; // 25MB

const RAPIDAPI_HOST = "youtube-mp3-audio-video-downloader.p.rapidapi.com";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

function rapidApiHeaders() {
  return {
    "x-rapidapi-key": RAPIDAPI_KEY,
    "x-rapidapi-host": RAPIDAPI_HOST,
  };
}

function extractVideoId(text) {
  const match = text.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

const MAX_DURATION = 10 * 60; // 10 phút

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

// ⚠️ LƯU Ý: Bạn PHẢI vào RapidAPI sửa đúng URL trong hàm này nếu nó báo lỗi 404
async function searchVideo(query) {
  const res = await fetch(
    `https://${RAPIDAPI_HOST}/search/${encodeURIComponent(query)}`, // <- Sửa dòng này theo docs của API
    { headers: rapidApiHeaders() }
  );
  if (!res.ok) throw new Error(`Tìm kiếm thất bại — HTTP ${res.status}`);
  const data = await res.json();
  
  const items = data.videos || data.results || data.items || [];
  return items
    .map((v) => ({
      id: v.videoId || v.id || v.video_id,
      title: v.title || v.name || v.id,
    }))
    .filter((v) => v.id);
}

// ⚠️ LƯU Ý: Bạn PHẢI vào RapidAPI sửa đúng URL trong hàm này nếu nó báo lỗi 404
async function downloadMp3(videoId, filePath) {
  const url = new URL(`https://${RAPIDAPI_HOST}/download-mp3/${videoId}`); // <- Sửa dòng này theo docs của API
  url.searchParams.set("quality", "low");

  const res = await fetch(url, { headers: rapidApiHeaders() });
  if (!res.ok || !res.body) {
    throw new Error(`Tải mp3 thất bại — HTTP ${res.status} (Kiểm tra lại Endpoint Download trên RapidAPI)`);
  }

  await new Promise((resolve, reject) => {
    const nodeStream = Readable.fromWeb(res.body);
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

module.exports = {
  config: {
    name: "ytb",
    aliases: ["youtube", "yt"],
    version: "2.0.1",
    role: 0,
    description: "Tìm và gửi audio YouTube (Dùng link để đảm bảo hoạt động ổn định nhất)",
    usage: "ytb <link YouTube>",
    category: "Media",
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const query = args.join(" ").trim();

    if (!query) {
      return api.sendMessage("⚠️ Nhập từ khoá hoặc link YouTube!\nCách dùng: ytb <link YouTube>", threadID, messageID);
    }

    if (!RAPIDAPI_KEY) {
      return api.sendMessage("❌ Bot chưa cấu hình RAPIDAPI_KEY. Admin vui lòng thêm biến môi trường!", threadID, messageID);
    }

    const filePath = path.join(CACHE_DIR, `${threadID}-${senderID}.mp3`);

    try {
      let videoId = extractVideoId(query);
      
      // Nếu là link thì lấy ID luôn, nếu là text thì đi tìm kiếm
      if (!videoId) {
        api.sendMessage("🔍 Đang tìm kiếm video trên YouTube...", threadID, messageID);
        const candidates = await searchVideo(query);
        if (candidates.length === 0) return api.sendMessage(`❌ Không tìm thấy video nào cho "${query}".`, threadID, messageID);
        videoId = candidates[0].id;
      }

      api.sendMessage(`⏳ Đang lấy thông tin và tải audio...`, threadID, messageID);

      const info = await getVideoInfo(videoId);
      if (info.durationSec > MAX_DURATION) {
        return api.sendMessage(`❌ "${info.title}" dài quá ${MAX_DURATION / 60} phút, bot không tải được.`, threadID, messageID);
      }

      await downloadMp3(videoId, filePath);

      if (fs.statSync(filePath).size > MAX_SIZE) {
        fs.unlinkSync(filePath);
        throw new Error(`Vượt quá 25MB, Messenger không cho phép gửi.`);
      }

      return api.sendMessage(
        {
          body: `✅ ${info.title}\n👤 ${info.author}\n🔗 https://youtu.be/${videoId}`,
          attachment: fs.createReadStream(filePath),
        },
        threadID,
        () => fs.unlink(filePath, () => {}),
        messageID
      );
    } catch (err) {
      fs.remove(filePath).catch(() => {});
      logger.error(`Lỗi lệnh ytb: ${err.message}`, "CMD");
      // In lỗi cụ thể ra tin nhắn để bạn dễ debug
      return api.sendMessage(`❌ Lỗi: ${err.message}`, threadID, messageID);
    }
  },
};
