const fs = require("fs-extra");
const path = require("path");
const { Readable } = require("stream");
const logger = require("../utils/log");

const CACHE_DIR = path.join(__dirname, "cache");
fs.ensureDirSync(CACHE_DIR);

const MAX_SIZE = 25 * 1024 * 1024; // 25MB, giới hạn gửi file của Messenger

// ==== Cấu hình RapidAPI ====
// Đặt biến môi trường RAPIDAPI_KEY trên Render (Environment tab), giống cách
// FB_APPSTATE được đọc trong mirai.js. KHÔNG hardcode key vào code / .env commit lên GitHub.
const RAPIDAPI_HOST = "youtube-mp3-audio-video-downloader.p.rapidapi.com";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

function rapidApiHeaders() {
  return {
    "x-rapidapi-key": RAPIDAPI_KEY,
    "x-rapidapi-host": RAPIDAPI_HOST,
  };
}

// Trích video ID từ 1 URL YouTube đầy đủ (nếu người dùng dán link thay vì từ khoá)
function extractVideoId(text) {
  const match = text.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

const MAX_DURATION = 10 * 60; // 10 phút — chặn video quá dài

// ==== Lấy metadata video (endpoint "Get Video Information") ====
// Response thật trả về: { title, description, author, lengthSeconds, viewCount,
// thumbnail: [{url,...}], ownerChannelName, publishDate, ... }
async function getVideoInfo(videoId) {
  const url = new URL(`https://${RAPIDAPI_HOST}/get-video-info/${videoId}`);
  url.searchParams.set("response_mode", "default");

  const res = await fetch(url, { headers: rapidApiHeaders() });
  if (!res.ok) {
    throw new Error(`Lấy thông tin video thất bại — HTTP ${res.status}`);
  }
  const data = await res.json();
  return {
    title: data.title || videoId,
    author: data.author || data.ownerChannelName || "?",
    durationSec: parseInt(data.lengthSeconds, 10) || 0,
  };
}

// ==== Bước 1: tìm video theo từ khoá (dùng endpoint search sẵn có của app, nếu app
// bạn có endpoint "Search Video" trong nhóm "Youtube API (Search, etc)") ====
async function searchVideo(query) {
  // TODO: thay URL/param đúng theo tab "Params"/"Code Snippets" của endpoint Search Video
  // thực tế trong app RapidAPI của bạn — đây chỉ là khung mẫu.
  const res = await fetch(
    `https://${RAPIDAPI_HOST}/search/${encodeURIComponent(query)}`,
    { headers: rapidApiHeaders() }
  );
  if (!res.ok) {
    throw new Error(`Tìm kiếm thất bại — HTTP ${res.status}`);
  }
  const data = await res.json();
  logger.info(`[ytb] search raw: ${JSON.stringify(data).slice(0, 300)}`, "CMD");
  // Chuẩn hoá về { id, title } — SỬA lại field cho đúng response thật của bạn
  const items = data.videos || data.results || data.items || [];
  return items
    .map((v) => ({
      id: v.videoId || v.id || v.video_id,
      title: v.title || v.name || v.id,
    }))
    .filter((v) => v.id);
}

// ==== Bước 2: lấy link tải trực tiếp cho 1 video ID (mp3) ====
// Giả định response giống endpoint get_m4a_download_link (cùng nhà cung cấp):
//   { comment, file: "<link tải, hiệu lực ~10 phút>", reserved_file: "<link mirror dự phòng>" }
// TODO: xác nhận lại field thật sau khi Test Endpoint — nếu khác, sửa 2 dòng data.file/data.reserved_file bên dưới.
const DOWNLOAD_ENDPOINT_PATH = "download-mp3";
const DOWNLOAD_QUALITY = "low"; // "low" | "medium" | "high" tuỳ API hỗ trợ — chỉnh nếu muốn chất lượng khác

async function getDirectDownloadUrl(videoId) {
  const url = new URL(`https://${RAPIDAPI_HOST}/${DOWNLOAD_ENDPOINT_PATH}/${videoId}`);
  url.searchParams.set("quality", DOWNLOAD_QUALITY);

  const res = await fetch(url, { headers: rapidApiHeaders() });
  if (!res.ok) {
    let bodyPreview = "";
    try {
      bodyPreview = (await res.text()).slice(0, 300);
    } catch (e) {}
    throw new Error(`Lấy link tải thất bại — HTTP ${res.status} ${bodyPreview}`);
  }
  const data = await res.json();

  const directUrl = data.file || data.reserved_file;
  if (!directUrl) {
    throw new Error(
      `Không tìm thấy link tải trong response: ${JSON.stringify(data).slice(0, 300)}`
    );
  }

  return { directUrl, reservedUrl: data.reserved_file };
}

// ==== Bước 3: tải file về từ link trực tiếp (thử link chính, rồi link mirror) ====
async function downloadToFile(urls, filePath) {
  const candidates = Array.isArray(urls) ? urls.filter(Boolean) : [urls];
  let lastErr;

  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok || !res.body) {
        let bodyPreview = "";
        try {
          bodyPreview = (await res.text()).slice(0, 300).replace(/\s+/g, " ").trim();
        } catch (e) {}
        throw new Error(
          `HTTP ${res.status} ${res.statusText || ""}${bodyPreview ? ` | ${bodyPreview}` : ""}`
        );
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
      return; // thành công
    } catch (err) {
      lastErr = err;
      fs.remove(filePath).catch(() => {});
    }
  }
  throw new Error(`Tải file thất bại (đã thử ${candidates.length} link) — ${lastErr?.message}`);
}

module.exports = {
  config: {
    name: "ytb",
    aliases: ["youtube", "yt"],
    version: "2.0.0",
    role: 0,
    description: "Tìm và gửi video/audio YouTube theo từ khoá (qua RapidAPI)",
    usage: "ytb <từ khoá hoặc link YouTube>",
    category: "Media",
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const query = args.join(" ").trim();

    if (!query) {
      return api.sendMessage(
        "⚠️ Bạn phải nhập từ khoá hoặc link YouTube!\nCách dùng: ytb <từ khoá|link>",
        threadID,
        messageID
      );
    }

    if (!RAPIDAPI_KEY) {
      return api.sendMessage(
        "❌ Chưa cấu hình RAPIDAPI_KEY (biến môi trường). Xem hướng dẫn trong commands/ytb.js.",
        threadID,
        messageID
      );
    }

    const filePath = path.join(CACHE_DIR, `${threadID}-${senderID}.mp3`);

    try {
      // Nếu người dùng dán thẳng link YouTube thì lấy ID luôn, khỏi search
      let videoId = extractVideoId(query);
      let title = null;

      if (!videoId) {
        const candidates = await searchVideo(query);
        if (candidates.length === 0) {
          return api.sendMessage(`❌ Không tìm thấy video nào cho "${query}".`, threadID, messageID);
        }
        videoId = candidates[0].id;
        title = candidates[0].title;
      }

      // Lấy metadata trước để check thời lượng + hiển thị tên/tác giả chuẩn
      const info = await getVideoInfo(videoId);
      if (info.durationSec > MAX_DURATION) {
        return api.sendMessage(
          `❌ "${info.title}" dài quá ${MAX_DURATION / 60} phút, bỏ qua.`,
          threadID,
          messageID
        );
      }

      api.sendMessage(
        `🔎 Tìm thấy: ${info.title}\n⏳ Đang lấy link tải, chờ chút nhé...`,
        threadID,
        messageID
      );

      // Link tải chỉ có hiệu lực ~10 phút — phải tải ngay sau khi lấy, không cache lại.
      const { directUrl, reservedUrl } = await getDirectDownloadUrl(videoId);
      await downloadToFile([directUrl, reservedUrl], filePath);

      if (fs.statSync(filePath).size > MAX_SIZE) {
        fs.unlinkSync(filePath);
        throw new Error(`Vượt quá 25MB, không thể gửi qua Messenger.`);
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
      logger.error(`Lỗi lệnh ytb: ${err.stack || err.message}`, "CMD");
      return api.sendMessage(`❌ Đã có lỗi khi tải video: ${err.message}`, threadID, messageID);
    }
  },
};