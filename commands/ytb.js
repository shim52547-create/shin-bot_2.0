const fs = require("fs-extra");
const path = require("path");
const { Readable } = require("stream");
const { Innertube } = require("youtubei.js");
const logger = require("../utils/log");

const CACHE_DIR = path.join(__dirname, "cache");
fs.ensureDirSync(CACHE_DIR);

const MAX_SIZE = 25 * 1024 * 1024; // 25MB, giới hạn gửi file của Messenger
const MAX_DURATION = 10 * 60; // 10 phút — chặn video quá dài (dễ vượt 25MB / tải lâu)

// Dùng chung 1 instance Innertube cho cả bot, khởi tạo 1 lần (tốn ~1-2s) rồi tái sử dụng
let ytPromise = null;
function getYt() {
  if (!ytPromise) ytPromise = Innertube.create();
  return ytPromise;
}

module.exports = {
  config: {
    name: "ytb",
    aliases: ["youtube", "yt"],
    version: "1.0.0",
    role: 0,
    description: "Tìm và gửi video YouTube theo từ khoá",
    usage: "ytb <từ khoá>",
    category: "Media"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;

    const query = args.join(" ").trim();
    if (!query) {
      return api.sendMessage("⚠️ Bạn phải nhập từ khoá cần tìm!\nCách dùng: ytb <từ khoá>", threadID, messageID);
    }

    const filePath = path.join(CACHE_DIR, `${threadID}-${senderID}.mp4`);

    try {
      const yt = await getYt();

      // Tìm kiếm, chỉ lấy kết quả loại video (bỏ qua playlist/channel/kênh trực tiếp)
      const search = await yt.search(query, { type: "video" });
      const video = search?.videos?.find(v => v?.id);

      if (!video) {
        return api.sendMessage(`❌ Không tìm thấy video nào cho "${query}".`, threadID, messageID);
      }

      const title = video.title?.text || video.id;
      const durationSec = video.duration?.seconds || 0;

      if (durationSec > MAX_DURATION) {
        return api.sendMessage(
          `⚠️ Video "${title}" dài khoảng ${Math.round(durationSec / 60)} phút, vượt quá giới hạn ${MAX_DURATION / 60} phút nên bot không tải.`,
          threadID, messageID
        );
      }

      api.sendMessage(`🔎 Tìm thấy: ${title}\n⏳ Đang tải video, chờ chút nhé...`, threadID, messageID);

      const info = await yt.getInfo(video.id);

      // Ưu tiên luồng "video+audio" ghép sẵn (progressive) để không cần ffmpeg mux thêm.
      // Nhược điểm: thường chỉ có sẵn ở chất lượng thấp/trung bình (360p-720p), không phải 1080p+.
      const stream = await info.download({
        type: "video+audio",
        quality: "best",
        format: "mp4"
      });

      await new Promise((resolve, reject) => {
        const nodeStream = Readable.fromWeb(stream);
        const writeStream = fs.createWriteStream(filePath);
        nodeStream.on("error", reject);
        writeStream.on("error", reject);
        writeStream.on("finish", resolve);
        nodeStream.pipe(writeStream);
      });

      if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
        throw new Error("File tải về rỗng — video này có thể không có luồng video+audio mp4 ghép sẵn.");
      }

      if (fs.statSync(filePath).size > MAX_SIZE) {
        fs.unlinkSync(filePath);
        return api.sendMessage(`⚠️ Video "${title}" vượt quá 25MB, không thể gửi qua Messenger.`, threadID, messageID);
      }

      return api.sendMessage(
        {
          body: `✅ ${title}\n👤 ${video.author?.name || "?"}\n🔗 https://youtu.be/${video.id}`,
          attachment: fs.createReadStream(filePath)
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
  }
};