const ytdl = require("@distube/ytdl-core");
const yts = require("yt-search");
const fs = require("fs-extra");
const path = require("path");

const TEMP_DIR = path.join(__dirname, "..", "data", "temp");
fs.ensureDirSync(TEMP_DIR);

const YOUTUBE_URL_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/i;
const MAX_DURATION_SECONDS = 8 * 60; // Giới hạn 8 phút để tránh file video quá nặng, gửi lỗi hoặc treo bot

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

module.exports = {
  config: {
    name: "ytb",
    aliases: ["ytv"],
    version: "1.0",
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

    let videoUrl, videoTitle, videoChannel, videoDuration;
    const urlMatch = query.match(YOUTUBE_URL_REGEX);

    // Bước 1: xác định video (từ link trực tiếp hoặc tìm kiếm theo từ khoá)
    try {
      if (urlMatch) {
        videoUrl = `https://www.youtube.com/watch?v=${urlMatch[1]}`;
        const info = await ytdl.getBasicInfo(videoUrl);
        videoTitle = info.videoDetails.title;
        videoChannel = info.videoDetails.author?.name || info.videoDetails.ownerChannelName || "Không rõ";
        videoDuration = Number(info.videoDetails.lengthSeconds);
      } else {
        const result = await yts(query);
        const video = result.videos[0];
        if (!video) {
          return api.sendMessage(`❌ Không tìm thấy kết quả nào cho "${query}".`, threadID, messageID);
        }
        videoUrl = video.url;
        videoTitle = video.title;
        videoChannel = video.author?.name || "Không rõ";
        videoDuration = video.seconds;
      }
    } catch (err) {
      console.error("[ytb] lookup error:", err);
      return api.sendMessage(
        "❌ Không lấy được thông tin video. YouTube có thể vừa thay đổi cơ chế, hãy thử lại sau hoặc cập nhật gói @distube/ytdl-core.",
        threadID,
        messageID
      );
    }

    if (videoDuration && videoDuration > MAX_DURATION_SECONDS) {
      return api.sendMessage(
        `⚠️ Video "${videoTitle}" dài quá ${Math.floor(MAX_DURATION_SECONDS / 60)} phút, bot không gửi để tránh file quá nặng.`,
        threadID,
        messageID
      );
    }

    api.sendMessage(`🔎 Đang tải video: ${videoTitle}\nVui lòng đợi trong ít phút...`, threadID, messageID);

    const videoPath = path.join(TEMP_DIR, `ytb_${Date.now()}.mp4`);

    try {
      // Bước 2: chọn format video+audio ghép sẵn (progressive), YouTube giới hạn tối đa 360p cho loại này
      const info = await ytdl.getInfo(videoUrl);
      const format = ytdl.chooseFormat(info.formats, { quality: "highest", filter: "videoandaudio" });

      if (!format) {
        return api.sendMessage("❌ Không tìm được định dạng video phù hợp để gửi (có audio+video ghép sẵn).", threadID, messageID);
      }

      // Bước 3: tải video về file tạm
      await new Promise((resolve, reject) => {
        const stream = ytdl(videoUrl, { format });
        const writer = fs.createWriteStream(videoPath);
        stream.pipe(writer);
        stream.on("error", reject);
        writer.on("error", reject);
        writer.on("finish", resolve);
      });

      // Bước 4: kiểm tra dung lượng file trước khi gửi (tránh vượt giới hạn upload của Messenger)
      const stats = await fs.stat(videoPath);
      const sizeMB = stats.size / (1024 * 1024);
      if (sizeMB > 25) {
        return api.sendMessage(
          `⚠️ File video quá nặng (${sizeMB.toFixed(1)}MB), Messenger có thể không nhận. Hãy thử video ngắn hơn.`,
          threadID,
          messageID
        );
      }

      const resolutionLabel = format.qualityLabel || (format.height ? `${format.height}p` : "?");

      // Bước 5: gửi video kèm caption vào khung chat
      await api.sendMessage(
        {
          body: `🎬 ${videoTitle}\n📺 ${videoChannel}\n⏱️ ${resolutionLabel}`,
          attachment: fs.createReadStream(videoPath)
        },
        threadID,
        messageID
      );
    } catch (err) {
      console.error("[ytb] download/send error:", err);
      await api.sendMessage(
        "❌ Tải hoặc gửi video thất bại. Nếu lỗi lặp lại nhiều lần, hãy cập nhật gói: npm update @distube/ytdl-core (YouTube thường thay đổi cách mã hoá khiến các thư viện tải video bị lỗi tạm thời).",
        threadID,
        messageID
      );
    } finally {
      fs.remove(videoPath).catch(() => {});
    }
  }
};
