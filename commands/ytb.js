const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const TEMP_DIR = path.join(__dirname, "..", "data", "temp");
fs.ensureDirSync(TEMP_DIR);

const YOUTUBE_URL_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/i;
const MAX_DURATION_SECONDS = 8 * 60; // Giới hạn 8 phút để tránh file quá nặng / tốn quota free RapidAPI

const RAPIDAPI_HOST = "youtube-media-downloader.p.rapidapi.com";

function getApiKey() {
  // Ưu tiên biến môi trường (Render > Environment > RAPIDAPI_KEY),
  // KHÔNG hardcode key thẳng vào code / commit lên GitHub.
  return process.env.RAPIDAPI_KEY || (global.config.RAPIDAPI_KEY || null);
}

function rapidGet(urlPath, params) {
  const apiKey = getApiKey();
  return axios.get(`https://${RAPIDAPI_HOST}${urlPath}`, {
    params,
    headers: {
      "x-rapidapi-host": RAPIDAPI_HOST,
      "x-rapidapi-key": apiKey
    }
  });
}

// Chuyển giây -> "Xp Ys" hoặc "Xh Yp Zs" cho dễ đọc
function formatDuration(totalSeconds) {
  const sec = Math.floor(totalSeconds || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}p ${s}s`;
  if (m > 0) return `${m}p ${s}s`;
  return `${s}s`;
}

module.exports = {
  config: {
    name: "ytb",
    aliases: ["ytv", "youtube"],
    version: "4.0.0",
    role: 0,
    description: "Tìm và gửi video YouTube trực tiếp vào khung chat (tên video, kênh, thời lượng)",
    usage: "ytb <tên video> | ytb <link youtube>",
    category: "Tiện ích",
    cooldowns: 10
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const query = args.join(" ").trim();

    if (!getApiKey()) {
      return api.sendMessage(
        "⚠️ Chưa cấu hình RAPIDAPI_KEY. Vào Render > Environment, thêm biến RAPIDAPI_KEY = key RapidAPI (gói Free) của bạn, rồi restart bot.",
        threadID, messageID
      );
    }

    if (!query) {
      return api.sendMessage(
        "⚠️ Cách dùng: ytb <tên video hoặc link YouTube>\nVí dụ: ytb lạc trôi",
        threadID,
        messageID
      );
    }

    const urlMatch = query.match(YOUTUBE_URL_REGEX);
    let videoId = urlMatch ? urlMatch[1] : null;
    const videoPath = path.join(TEMP_DIR, `ytb_${Date.now()}.mp4`);

    try {
      // Bước 1: nếu không phải link trực tiếp, tìm video theo từ khoá
      if (!videoId) {
        const searchRes = await rapidGet("/v2/search/videos", { keyword: query });
        const items = searchRes.data?.items || searchRes.data?.videos || [];
        const video = items.find(it => it.type === "video" || it.videoId) || items[0];
        if (!video) {
          return api.sendMessage(`❌ Không tìm thấy kết quả nào cho "${query}".`, threadID, messageID);
        }
        videoId = video.id || video.videoId;
      }

      // Bước 2: lấy chi tiết video (kèm link tải video/audio)
      const detailRes = await rapidGet("/v2/video/details", { videoId, urlAccess: "normal", videos: "true" });
      const detail = detailRes.data;

      if (!detail || detail.status === false || (!detail.videos && !detail.formats)) {
        return api.sendMessage(`❌ Không lấy được thông tin video (videoId: ${videoId}).`, threadID, messageID);
      }

      const videoTitle = detail.title || "Không rõ tên";
      const videoChannel = detail.channel?.name || detail.channel?.title || "Không rõ";
      const durationSec = detail.lengthSeconds || detail.duration || 0;
      const durationLabel = formatDuration(durationSec);

      if (durationSec && durationSec > MAX_DURATION_SECONDS) {
        return api.sendMessage(
          `⚠️ Video "${videoTitle}" dài ${durationLabel}, vượt quá ${Math.floor(MAX_DURATION_SECONDS / 60)} phút cho phép, bot không gửi để tránh file quá nặng / tốn quota.`,
          threadID, messageID
        );
      }

      api.sendMessage(`🔎 Đang tải video: ${videoTitle} (${durationLabel})\nVui lòng đợi trong ít phút...`, threadID, messageID);

      // Bước 3: chọn format video+audio ghép sẵn, ưu tiên chất lượng cao nhất có link trực tiếp
      const videoFormats = (detail.videos?.items || detail.videos || []).filter(f => f.url);
      if (videoFormats.length === 0) {
        return api.sendMessage("❌ Không tìm được link video khả dụng cho video này.", threadID, messageID);
      }
      videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0));
      const chosen = videoFormats.find(f => f.hasAudio !== false) || videoFormats[0];

      // Bước 4: tải file về temp rồi gửi (stream trực tiếp từ URL, không cần lưu cả vào RAM)
      // QUAN TRỌNG: googlevideo.com sẽ trả 403 nếu thiếu User-Agent/Referer giống trình duyệt thật.
      const writer = fs.createWriteStream(videoPath);
      const downloadRes = await axios.get(chosen.url, {
        responseType: "stream",
        timeout: 60000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Referer": "https://www.youtube.com/"
        }
      });
      await new Promise((resolve, reject) => {
        downloadRes.data.pipe(writer);
        downloadRes.data.on("error", reject);
        writer.on("error", reject);
        writer.on("finish", resolve);
      });

      // Bước 5: kiểm tra dung lượng trước khi gửi
      const stats = await fs.stat(videoPath);
      const sizeMB = stats.size / (1024 * 1024);
      if (sizeMB > 25) {
        return api.sendMessage(
          `⚠️ File video quá nặng (${sizeMB.toFixed(1)}MB), Messenger có thể không nhận. Hãy thử video ngắn hơn.`,
          threadID, messageID
        );
      }

      const resolutionLabel = chosen.qualityLabel || (chosen.height ? `${chosen.height}p` : "?");

      // Bước 6: gửi video kèm caption đầy đủ thông tin (tên + kênh + thời lượng + độ phân giải)
      await api.sendMessage(
        {
          body: `🎬 ${videoTitle}\n📺 ${videoChannel}\n⏱️ Thời lượng: ${durationLabel}\n🎞️ Chất lượng: ${resolutionLabel}`,
          attachment: fs.createReadStream(videoPath)
        },
        threadID,
        messageID
      );
    } catch (err) {
      const status = err?.response?.status;
      // Chỉ log status + message ngắn gọn, KHÔNG log err.response.data khi responseType là "stream"
      // (data lúc đó là object stream/socket lồng nhau rất lớn, log ra sẽ tràn cả console).
      console.error("[ytb] error:", status ? `HTTP ${status}` : (err.code || err.message || String(err)));

      let msg = "❌ Tải hoặc gửi video thất bại. Thử lại sau hoặc báo admin kiểm tra log để xem lỗi cụ thể.";
      if (status === 401 || status === 403) {
        msg = "❌ RAPIDAPI_KEY không hợp lệ hoặc chưa đăng ký gói cho API này trên RapidAPI. Kiểm tra lại key.";
      } else if (status === 429) {
        msg = "⚠️ Đã dùng hết quota miễn phí của RapidAPI trong tháng này (gói Free giới hạn số lượt gọi). Thử lại vào kỳ sau hoặc nâng cấp gói.";
      }
      return api.sendMessage(msg, threadID, messageID);
    } finally {
      fs.remove(videoPath).catch(() => {});
    }
  }
};
