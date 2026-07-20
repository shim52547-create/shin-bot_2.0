const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);
const logger = require("../utils/log");

const CACHE_DIR = path.join(__dirname, "cache");
fs.ensureDirSync(CACHE_DIR);

const MAX_SIZE = 25 * 1024 * 1024; // 25MB, giới hạn gửi file của Messenger
const MAX_DURATION_MS = 10 * 60 * 1000; // 10 phút — chặn bài quá dài
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

// ==== Lấy client_id public của SoundCloud ====
// SoundCloud không yêu cầu đăng ký API để phát nhạc trên web — trang chủ tự nhúng
// 1 client_id (public, không phải secret) vào các file JS của nó. Cách lấy này là
// cách phổ biến các thư viện kiểu "soundcloud-downloader"/scdl vẫn dùng.
let cachedClientId = null;
let clientIdFetchedAt = 0;
const CLIENT_ID_TTL = 60 * 60 * 1000; // cache 1 tiếng, đỡ phải bóc lại mỗi lần dùng lệnh

async function getClientId() {
  if (cachedClientId && Date.now() - clientIdFetchedAt < CLIENT_ID_TTL) {
    return cachedClientId;
  }

  const { data: html } = await axios.get("https://soundcloud.com/", {
    headers: { "User-Agent": UA },
  });

  const scriptUrls = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);
  // client_id thường nằm trong 1 trong các file JS cuối (bundle chính) -> duyệt từ cuối lên
  for (const url of scriptUrls.reverse()) {
    try {
      const { data: js } = await axios.get(url, { headers: { "User-Agent": UA } });
      const match = js.match(/client_id\s*[:=]\s*"([a-zA-Z0-9]{16,})"/);
      if (match) {
        cachedClientId = match[1];
        clientIdFetchedAt = Date.now();
        return cachedClientId;
      }
    } catch (e) {
      // thử file JS tiếp theo
    }
  }
  throw new Error("Không lấy được client_id từ SoundCloud (có thể trang đã đổi cấu trúc).");
}

function isSoundCloudUrl(text) {
  return /^https?:\/\/(www\.|m\.|on\.)?soundcloud\.com\//i.test((text || "").trim());
}

async function scRequest(url, params, clientId) {
  const { data } = await axios.get(url, {
    params: { ...params, client_id: clientId },
    headers: { "User-Agent": UA },
  });
  return data;
}

// Đưa 1 link SoundCloud (bài hát, có thể là link rút gọn on.soundcloud.com) về đúng track object
async function resolveTrack(url, clientId) {
  const data = await scRequest("https://api-v2.soundcloud.com/resolve", { url }, clientId);
  if (!data || data.kind !== "track") {
    throw new Error("Link này không phải 1 bài hát SoundCloud hợp lệ (có thể là playlist/album).");
  }
  return data;
}

async function searchTracks(query, clientId, limit = 5) {
  const data = await scRequest(
    "https://api-v2.soundcloud.com/search/tracks",
    { q: query, limit },
    clientId
  );
  return (data.collection || []).filter((t) => t.streamable !== false);
}

// Lấy link stream thật (mp3 progressive hoặc hls) từ media transcodings của track
async function getStreamInfo(track, clientId) {
  const transcodings = track.media?.transcodings || [];
  if (!transcodings.length) {
    throw new Error("Bài này không cho phép tải/nghe (không có transcoding).");
  }

  // Ưu tiên progressive (trả thẳng file mp3, dễ tải) hơn hls (m3u8, phải ghép bằng ffmpeg)
  const progressive = transcodings.find((t) => t.format?.protocol === "progressive");
  const hls = transcodings.find((t) => t.format?.protocol === "hls");
  const chosen = progressive || hls;
  if (!chosen) throw new Error("Không tìm thấy định dạng phát phù hợp cho bài này.");

  const meta = await scRequest(chosen.url, {}, clientId);
  if (!meta?.url) throw new Error("Không lấy được link phát nhạc thật.");

  return { streamUrl: meta.url, isHls: chosen.format.protocol === "hls" };
}

// Tải file mp3 trực tiếp (progressive) bằng axios stream
function downloadProgressive(url, filePath) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await axios.get(url, { responseType: "stream", headers: { "User-Agent": UA } });
      const writer = fs.createWriteStream(filePath);
      res.data.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
      res.data.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

// Ghép playlist HLS (.m3u8) thành 1 file mp3 bằng ffmpeg (khi bài không có bản progressive)
function downloadHls(url, filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg(url)
      .audioBitrate(128)
      .format("mp3")
      .on("error", reject)
      .on("end", resolve)
      .save(filePath);
  });
}

function formatDuration(ms) {
  const totalSec = Math.floor((ms || 0) / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

module.exports = {
  config: {
    name: "scl",
    aliases: ["soundcloud", "sc"],
    version: "1.0.0",
    role: 0,
    description: "Nghe/tải nhạc từ SoundCloud bằng từ khoá hoặc link",
    usage: "scl <từ khoá hoặc link SoundCloud>",
    category: "Media",
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const query = args.join(" ").trim();

    if (!query) {
      return api.sendMessage(
        "⚠️ Bạn phải nhập từ khoá hoặc link SoundCloud!\nCách dùng: scl <từ khoá|link>",
        threadID,
        messageID
      );
    }

    const filePath = path.join(CACHE_DIR, `${threadID}-${senderID}.mp3`);

    try {
      const clientId = await getClientId();

      let track;
      if (isSoundCloudUrl(query)) {
        track = await resolveTrack(query, clientId);
      } else {
        const results = await searchTracks(query, clientId, 5);
        if (!results.length) {
          return api.sendMessage(`❌ Không tìm thấy bài nào cho "${query}".`, threadID, messageID);
        }
        track = results[0];
      }

      if (track.duration > MAX_DURATION_MS) {
        return api.sendMessage(
          `❌ "${track.title}" dài ${formatDuration(track.duration)}, vượt quá giới hạn ${MAX_DURATION_MS / 60000} phút.`,
          threadID,
          messageID
        );
      }

      api.sendMessage(
        `🔎 Tìm thấy: ${track.title}\n👤 ${track.user?.username || "?"}\n⏳ Đang tải, chờ chút nhé...`,
        threadID,
        messageID
      );

      const { streamUrl, isHls } = await getStreamInfo(track, clientId);

      if (isHls) {
        await downloadHls(streamUrl, filePath);
      } else {
        await downloadProgressive(streamUrl, filePath);
      }

      if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
        throw new Error("File tải về rỗng.");
      }

      if (fs.statSync(filePath).size > MAX_SIZE) {
        fs.unlinkSync(filePath);
        return api.sendMessage("⚠️ Không thể gửi vì file lớn hơn 25MB.", threadID, messageID);
      }

      return api.sendMessage(
        {
          body: `✅ ${track.title}\n👤 ${track.user?.username || "?"}\n⏱️ ${formatDuration(track.duration)}\n🔗 ${track.permalink_url}`,
          attachment: fs.createReadStream(filePath),
        },
        threadID,
        () => fs.unlink(filePath, () => {}),
        messageID
      );
    } catch (err) {
      fs.remove(filePath).catch(() => {});
      logger.error(`Lỗi lệnh scl: ${err.stack || err.message}`, "CMD");
      return api.sendMessage(`❌ Đã có lỗi khi tải nhạc SoundCloud: ${err.message}`, threadID, messageID);
    }
  },
};
