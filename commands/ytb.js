const { Innertube } = require("youtubei.js");
const { Readable } = require("stream");
const fs = require("fs-extra");
const path = require("path");

const TEMP_DIR = path.join(__dirname, "..", "data", "temp");
fs.ensureDirSync(TEMP_DIR);

const YOUTUBE_URL_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/i;
const MAX_DURATION_SECONDS = 8 * 60; // Giới hạn 8 phút để tránh file video quá nặng

// Dùng chung 1 client Innertube cho cả bot thay vì khởi tạo lại mỗi lần gọi lệnh
let ytClientPromise = null;
function getClient() {
  if (!ytClientPromise) ytClientPromise = Innertube.create();
  return ytClientPromise;
}

module.exports = {
  config: {
    name: "ytb",
    aliases: ["ytv"],
    version: "2.0",
    role: 0,
    description: "Tìm và gửi video YouTube trực tiếp vào khung chat (kèm tên video, kênh, độ phân giải)",
    usage: "ytb <tên video> | ytb <link youtube>",
    category: "Tiện ích",
    cooldowns: 10
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const query = args.join(" ").trim();

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
      const yt = await getClient();

      // Bước 1: nếu không phải link trực tiếp, tìm video theo từ khoá
      if (!videoId) {
        const search = await yt.search(query, { type: "video" });
        const video = search.videos?.[0];
        if (!video) {
          return api.sendMessage(`❌ Không tìm thấy kết quả nào cho "${query}".`, threadID, messageID);
        }
        videoId = video.id;
      }

      // Bước 2: lấy thông tin chi tiết video
      const info = await yt.getInfo(videoId);
      const videoTitle = info.basic_info?.title || "Không rõ tên";
      const videoChannel = info.basic_info?.channel?.name || info.basic_info?.author || "Không rõ";
      const videoDuration = info.basic_info?.duration || 0;

      if (videoDuration && videoDuration > MAX_DURATION_SECONDS) {
        return api.sendMessage(
          `⚠️ Video "${videoTitle}" dài quá ${Math.floor(MAX_DURATION_SECONDS / 60)} phút, bot không gửi để tránh file quá nặng.`,
          threadID,
          messageID
        );
      }

      api.sendMessage(`🔎 Đang tải video: ${videoTitle}\nVui lòng đợi trong ít phút...`, threadID, messageID);

      // Bước 3: chọn định dạng video+audio ghép sẵn, chất lượng tốt nhất có
      const format = info.chooseFormat({ type: "video+audio", quality: "best" });
      if (!format) {
        return api.sendMessage("❌ Không tìm được định dạng video+audio ghép sẵn cho video này.", threadID, messageID);
      }

      // Bước 4: tải về file tạm
      const webStream = await info.download({ type: "video+audio", quality: "best", format: "mp4" });
      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(videoPath);
        const nodeStream = Readable.fromWeb(webStream);
        nodeStream.pipe(writer);
        nodeStream.on("error", reject);
        writer.on("error", reject);
        writer.on("finish", resolve);
      });

      // Bước 5: kiểm tra dung lượng trước khi gửi
      const stats = await fs.stat(videoPath);
      const sizeMB = stats.size / (1024 * 1024);
      if (sizeMB > 25) {
        return api.sendMessage(
          `⚠️ File video quá nặng (${sizeMB.toFixed(1)}MB), Messenger có thể không nhận. Hãy thử video ngắn hơn.`,
          threadID,
          messageID
        );
      }

      const resolutionLabel = format.quality_label || (format.height ? `${format.height}p` : "?");

      // Bước 6: gửi video kèm caption
      await api.sendMessage(
        {
          body: `🎬 ${videoTitle}\n📺 ${videoChannel}\n⏱️ ${resolutionLabel}`,
          attachment: fs.createReadStream(videoPath)
        },
        threadID,
        messageID
      );
    } catch (err) {
      console.error("[ytb] error:", err);
      await api.sendMessage(
        "❌ Tải hoặc gửi video thất bại. Thử lại sau hoặc báo admin kiểm tra log để xem lỗi cụ thể.",
        threadID,
        messageID
      );
    } finally {
      fs.remove(videoPath).catch(() => {});
    }
  }
};