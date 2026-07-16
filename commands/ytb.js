const fs = require("fs-extra");
const path = require("path");
const { Readable } = require("stream");
const { Innertube, Log } = require("youtubei.js");
const logger = require("../utils/log");

// Tắt log cảnh báo nội bộ của youtubei.js kiểu "[Parser]: TicketEvent changed!"
// (chỉ là cảnh báo lược đồ dữ liệu YouTube thay đổi, không phải lỗi, nhưng spam log server)
Log.setLevel(Log.Level.ERROR);

const CACHE_DIR = path.join(__dirname, "cache");
fs.ensureDirSync(CACHE_DIR);

const MAX_SIZE = 25 * 1024 * 1024; // 25MB, giới hạn gửi file của Messenger
const MAX_DURATION = 10 * 60; // 10 phút — chặn video quá dài
const MAX_RESULTS_TO_TRY = 3; // nếu video đầu tiên lỗi, thử tiếp các kết quả sau

// Thứ tự client để thử lấy info/stream tải xuống. "WEB" (mặc định) rất hay bị YouTube
// trả về playability_status = LOGIN_REQUIRED khi chạy trên IP datacenter (Render, VPS...),
// nên ưu tiên thử ANDROID/IOS/TV_EMBEDDED trước — các client này ít bị chặn kiểu này hơn.
const CLIENTS_TO_TRY = ["ANDROID", "IOS", "TV_EMBEDDED", "WEB"];

let ytPromise = null;
function getYt() {
  if (!ytPromise) ytPromise = Innertube.create();
  return ytPromise;
}

// Thử lấy VideoInfo lần lượt qua nhiều client, trả về info đầu tiên PLAYABLE.
async function getPlayableInfo(yt, videoId) {
  let lastErr;
  for (const client of CLIENTS_TO_TRY) {
    try {
      const info = await yt.getInfo(videoId, { client });
      const status = info?.playability_status?.status;
      if (status && status !== "OK") {
        lastErr = new Error(`[${client}] ${status}: ${info.playability_status?.reason || ""}`);
        continue;
      }
      return info;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Không lấy được thông tin video.");
}

async function downloadToFile(info, filePath) {
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
}

module.exports = {
  config: {
    name: "ytb",
    aliases: ["youtube", "yt"],
    version: "1.1.0",
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

      const search = await yt.search(query, { type: "video" });
      const candidates = (search?.videos || []).filter(v => v?.id).slice(0, MAX_RESULTS_TO_TRY);

      if (candidates.length === 0) {
        return api.sendMessage(`❌ Không tìm thấy video nào cho "${query}".`, threadID, messageID);
      }

      api.sendMessage(`🔎 Tìm thấy: ${candidates[0].title?.text || candidates[0].id}\n⏳ Đang tải video, chờ chút nhé...`, threadID, messageID);

      let lastErr;
      for (const video of candidates) {
        const title = video.title?.text || video.id;
        const durationSec = video.duration?.seconds || 0;

        if (durationSec > MAX_DURATION) {
          lastErr = new Error(`"${title}" dài quá ${MAX_DURATION / 60} phút, bỏ qua.`);
          continue;
        }

        try {
          const info = await getPlayableInfo(yt, video.id);
          await downloadToFile(info, filePath);

          if (fs.statSync(filePath).size > MAX_SIZE) {
            fs.unlinkSync(filePath);
            lastErr = new Error(`"${title}" vượt quá 25MB, không thể gửi qua Messenger.`);
            continue;
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
          logger.warn(`ytb: bỏ qua video ${video.id} (${title}): ${err.message}`, "CMD");
          lastErr = err;
          fs.remove(filePath).catch(() => {});
        }
      }

      throw lastErr || new Error("Không tải được video nào phù hợp.");
    } catch (err) {
      fs.remove(filePath).catch(() => {});
      logger.error(`Lỗi lệnh ytb: ${err.stack || err.message}`, "CMD");
      return api.sendMessage(`❌ Đã có lỗi khi tải video: ${err.message}`, threadID, messageID);
    }
  }
};