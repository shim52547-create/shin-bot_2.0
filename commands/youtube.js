const ytdl = require("@distube/ytdl-core");
const yts = require("yt-search");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const fs = require("fs-extra");
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegPath);

const TEMP_DIR = path.join(__dirname, "..", "data", "temp");
fs.ensureDirSync(TEMP_DIR);

const YOUTUBE_URL_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/i;
const MAX_DURATION_SECONDS = 10 * 60; // Giới hạn 10 phút / bài để tránh file quá nặng, treo bot

module.exports = {
  config: {
    name: "nhac",
    aliases: ["yt", "ytmp3", "youtube"],
    version: "1.0",
    role: 0,
    description: "Tìm và tải nhạc từ YouTube gửi vào khung chat (dạng mp3)",
    usage: "youtube <tên bài hát> | nhac <link youtube>",
    category: "Tiện ích"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const query = args.join(" ").trim();

    if (!query) {
      return api.sendMessage(
        "⚠️ Cách dùng: nhac <tên bài hát hoặc link YouTube>\nVí dụ: nhac Hãy Trao Cho Anh",
        threadID,
        messageID
      );
    }

    let videoUrl, videoTitle, videoDuration;
    const urlMatch = query.match(YOUTUBE_URL_REGEX);

    // Bước 1: xác định video (từ link trực tiếp hoặc tìm kiếm theo từ khoá)
    try {
      if (urlMatch) {
        videoUrl = `https://www.youtube.com/watch?v=${urlMatch[1]}`;
        const info = await ytdl.getBasicInfo(videoUrl);
        videoTitle = info.videoDetails.title;
        videoDuration = Number(info.videoDetails.lengthSeconds);
      } else {
        const result = await yts(query);
        const video = result.videos[0];
        if (!video) {
          return api.sendMessage(`❌ Không tìm thấy kết quả nào cho "${query}".`, threadID, messageID);
        }
        videoUrl = video.url;
        videoTitle = video.title;
        videoDuration = video.seconds;
      }
    } catch (err) {
      return api.sendMessage(
        "❌ Không lấy được thông tin video. YouTube có thể vừa thay đổi cơ chế, hãy thử lại sau hoặc cập nhật gói @distube/ytdl-core.",
        threadID,
        messageID
      );
    }

    if (videoDuration && videoDuration > MAX_DURATION_SECONDS) {
      return api.sendMessage(
        `⚠️ Bài "${videoTitle}" dài quá ${Math.floor(MAX_DURATION_SECONDS / 60)} phút, bot không tải để tránh quá tải server.`,
        threadID,
        messageID
      );
    }

    api.sendMessage(`🔎 Đang tải: ${videoTitle}\nVui lòng đợi trong ít phút...`, threadID, messageID);

    const safeName = `yt_${Date.now()}`;
    const rawPath = path.join(TEMP_DIR, `${safeName}.webm`);
    const mp3Path = path.join(TEMP_DIR, `${safeName}.mp3`);

    try {
      // Bước 2: tải luồng audio chất lượng cao nhất về file tạm
      await new Promise((resolve, reject) => {
        const stream = ytdl(videoUrl, { filter: "audioonly", quality: "highestaudio" });
        const writer = fs.createWriteStream(rawPath);
        stream.pipe(writer);
        stream.on("error", reject);
        writer.on("error", reject);
        writer.on("finish", resolve);
      });

      // Bước 3: chuyển sang mp3 bằng ffmpeg để tương thích tốt với Messenger
      await new Promise((resolve, reject) => {
        ffmpeg(rawPath)
          .audioBitrate(128)
          .toFormat("mp3")
          .on("error", reject)
          .on("end", resolve)
          .save(mp3Path);
      });

      // Bước 4: gửi file mp3 vào khung chat
      await api.sendMessage(
        {
          body: `🎵 ${videoTitle}`,
          attachment: fs.createReadStream(mp3Path)
        },
        threadID,
        messageID
      );
    } catch (err) {
      await api.sendMessage(
        "❌ Tải nhạc thất bại. Nếu lỗi lặp lại nhiều lần, hãy cập nhật gói: npm update @distube/ytdl-core (YouTube thường thay đổi cách mã hoá khiến các thư viện tải video bị lỗi tạm thời).",
        threadID,
        messageID
      );
    } finally {
      // Dọn file tạm dù thành công hay lỗi
      fs.remove(rawPath).catch(() => {});
      fs.remove(mp3Path).catch(() => {});
    }
  }
};