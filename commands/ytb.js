const fs = require("fs-extra");
const path = require("path");
const vm = require("node:vm");
const { Readable } = require("stream");
const { Innertube, Log, Platform } = require("youtubei.js");
const logger = require("../utils/log");

// Tắt log cảnh báo nội bộ của youtubei.js kiểu "[Parser]: TicketEvent changed!"
// (chỉ là cảnh báo lược đồ dữ liệu YouTube thay đổi, không phải lỗi, nhưng spam log server)
Log.setLevel(Log.Level.ERROR);

// Từ bản 17.x, youtubei.js không còn tự giải mã signature video (bỏ trình thông dịch JS
// tích hợp sẵn) — bắt buộc phải tự cấp 1 "JS evaluator" để nó chạy đoạn script YouTube
// dùng giải mã link tải. Dùng module "vm" có sẵn của Node, không cần cài thêm gì.
Platform.shim.eval = (code, env) => {
  // Script của YouTube kết thúc bằng "return process(...)" ở ngoài cùng — phải bọc
  // trong 1 hàm thì "return" mới hợp lệ (nếu không sẽ báo "Illegal return statement").
  const script = new vm.Script(`(function(){\n${code.output}\n})()`);
  const context = vm.createContext(env);
  return script.runInContext(context);
};

const CACHE_DIR = path.join(__dirname, "cache");
fs.ensureDirSync(CACHE_DIR);

const MAX_SIZE = 25 * 1024 * 1024; // 25MB, giới hạn gửi file của Messenger
const MAX_DURATION = 10 * 60; // 10 phút — chặn video quá dài
const MAX_RESULTS_TO_TRY = 3; // nếu video đầu tiên lỗi, thử tiếp các kết quả sau

// Client để thử lấy info/stream tải xuống. Giữ danh sách này để phòng trường hợp
// một video cụ thể bị hạn chế theo client (ví dụ video nhạc bản quyền), nhưng thực tế
// nếu IP server bị YouTube chặn ở mức "Sign in to confirm you're not a bot" thì đổi
// client KHÔNG giải quyết được — phải dùng cookie (xem readCookie() bên dưới).
const CLIENTS_TO_TRY = ["ANDROID", "IOS", "TV_EMBEDDED", "WEB"];

// ==== Đọc cookie YouTube (tài khoản Google đã đăng nhập) ====
// Ưu tiên biến môi trường YT_COOKIE (dùng khi deploy Render/GitHub, giống cách FB_APPSTATE
// được đọc trong mirai.js), nếu không có thì đọc file yt_cookie.txt ở thư mục gốc project.
//
// CÁCH LẤY COOKIE:
// 1. Dùng 1 tài khoản Google PHỤ (không dùng tài khoản chính) để tránh rủi ro bị khoá.
// 2. Đăng nhập youtube.com trên trình duyệt bằng tài khoản đó.
// 3. Dùng extension "Cookie-Editor" (Chrome/Firefox) trên tab youtube.com, chọn Export
//    → "Header String" (dạng "SID=...; HSID=...; SSID=...; APISID=...; SAPISID=...; ...").
// 4. Dán nguyên chuỗi đó vào biến môi trường YT_COOKIE trên Render (Environment tab),
//    hoặc lưu vào file yt_cookie.txt (đã thêm vào .gitignore, KHÔNG được commit lên GitHub —
//    ai có cookie này đăng nhập được vào tài khoản Google đó).
function readCookie() {
  if (process.env.YT_COOKIE && process.env.YT_COOKIE.trim()) {
    return process.env.YT_COOKIE.trim();
  }
  const cookiePath = path.join(__dirname, "..", "yt_cookie.txt");
  if (fs.existsSync(cookiePath)) {
    const raw = fs.readFileSync(cookiePath, "utf8").trim();
    if (raw) return raw;
  }
  return undefined;
}

let ytPromise = null;
function getYt() {
  if (!ytPromise) {
    const cookie = readCookie();
    if (!cookie) {
      logger.warn(
        "ytb: chưa cấu hình YT_COOKIE / yt_cookie.txt — nếu bị lỗi \"Sign in to confirm you're not a bot\" thì đây là lý do, xem hướng dẫn trong commands/ytb.js.",
        "CMD"
      );
    }
    ytPromise = Innertube.create({ cookie });
  }
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

async function downloadToFile(yt, info, filePath) {
  // Lấy format muxed (video+audio ghép sẵn) tốt nhất có thể. youtubei.js không có khái
  // niệm "lowest" riêng cho loại muxed — nó chỉ tồn tại ở vài mức cố định (thường 360p/720p),
  // nên không có gì để "fallback" thật sự — bỏ qua ý tưởng đó.
  const format =
    info.chooseFormat({ type: "video+audio", quality: "best", format: "mp4" }) ||
    info.chooseFormat({ type: "video+audio" });

  if (!format) {
    throw new Error("Video này không có định dạng video+audio (mp4 ghép sẵn) nào khả dụng.");
  }

  const url = format.decipher(yt.session.player);

  // Tự fetch thủ công thay vì dùng info.download() — để lấy được status code THẬT
  // và nội dung lỗi (thường googlevideo trả về XML/text giải thích lý do) khi bị từ chối,
  // thay vì lỗi chung chung "non 2xx status code" mà youtubei.js ném ra.
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    let bodyPreview = "";
    try {
      bodyPreview = (await res.text()).slice(0, 300).replace(/\s+/g, " ").trim();
    } catch (e) {
      // bỏ qua nếu không đọc được body
    }
    throw new Error(`Tải trực tiếp thất bại — HTTP ${res.status} ${res.statusText || ""}${bodyPreview ? ` | ${bodyPreview}` : ""}`);
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
    throw new Error("File tải về rỗng — video này có thể không có luồng video+audio mp4 ghép sẵn.");
  }
}

module.exports = {
  config: {
    name: "ytb",
    aliases: ["youtube", "yt"],
    version: "1.2.0",
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
          await downloadToFile(yt, info, filePath);

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

      const hint = readCookie()
        ? ""
        : "\n💡 Chưa cấu hình YT_COOKIE — xem hướng dẫn trong commands/ytb.js để hết lỗi này.";
      throw new Error((lastErr?.message || "Không tải được video nào phù hợp.") + hint);
    } catch (err) {
      fs.remove(filePath).catch(() => {});
      logger.error(`Lỗi lệnh ytb: ${err.stack || err.message}`, "CMD");
      return api.sendMessage(`❌ Đã có lỗi khi tải video: ${err.message}`, threadID, messageID);
    }
  }
};