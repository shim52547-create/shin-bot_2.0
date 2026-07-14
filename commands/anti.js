const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "..", "data", "cache");
fs.ensureDirSync(CACHE_DIR);

const TYPES = ["namebox", "image", "nickname", "out", "emoji", "theme", "qtv"];
const LABELS = {
  namebox: "đổi tên nhóm",
  image: "đổi ảnh nhóm",
  nickname: "đổi biệt danh",
  out: "rời/bị kick khỏi nhóm",
  emoji: "đổi emoji nhóm",
  theme: "đổi chủ đề nhóm",
  qtv: "đổi quản trị viên nhóm"
};

module.exports = {
  config: {
    name: "anti",
    aliases: [],
    version: "2.0",
    role: 1,
    description: "Bật/tắt các chế độ chống đổi thông tin nhóm (anti change box)",
    usage: "anti <namebox|image|nickname|out|emoji|theme|qtv|list> [on/off]",
    category: "Box chat"
  },
  run: async ({ api, event, args, Threads }) => {
    const { threadID, messageID } = event;

    if (!args[0] || args[0] === "list") {
      const threadData = Threads.get(threadID);
      const anti = threadData.anti || {};
      const lines = TYPES.map(t => `|› ${t} (${LABELS[t]}): ${anti[t]?.enabled ? "bật ✅" : "tắt ❌"}`).join("\n");
      return api.sendMessage(
        `╭─────────────⭓\n│ Anti Change Info Group\n├─────⭔\n${lines}\n├────────⭔\n│ 📌 Dùng: anti <loại> on/off\n│ Ví dụ: anti namebox on\n╰─────────────⭓`,
        threadID, messageID
      );
    }

    const type = args[0].toLowerCase();
    if (!TYPES.includes(type)) {
      return api.sendMessage(`❎ Loại không hợp lệ. Chọn 1 trong: ${TYPES.join(", ")}`, threadID, messageID);
    }

    const action = (args[1] || "").toLowerCase();
    const threadData = Threads.get(threadID);
    const anti = threadData.anti || {};
    const current = anti[type]?.enabled || false;
    const turnOn = action === "on" ? true : action === "off" ? false : !current;

    if (turnOn === current) {
      return api.sendMessage(`ℹ️ Chế độ anti ${type} (${LABELS[type]}) đã đang ${current ? "bật" : "tắt"} rồi.`, threadID, messageID);
    }

    if (!turnOn) {
      anti[type] = { enabled: false };
      Threads.set(threadID, { anti });
      return api.sendMessage(`☑️ Tắt thành công chế độ anti ${type} (${LABELS[type]}).`, threadID, messageID);
    }

    // Bật -> lưu lại trạng thái gốc để làm mốc khôi phục
    const threadInfo = await api.getThreadInfo(threadID).catch(() => null);

    try {
      switch (type) {
        case "namebox": {
          anti.namebox = { enabled: true, name: threadInfo?.threadName || "" };
          break;
        }
        case "image": {
          const url = threadInfo?.imageSrc;
          const cachePath = path.join(CACHE_DIR, `box_${threadID}.jpg`);
          if (url) {
            const res = await axios.get(url, { responseType: "arraybuffer" });
            await fs.writeFile(cachePath, res.data);
          }
          anti.image = { enabled: true, cachePath: url ? cachePath : null };
          break;
        }
        case "nickname": {
          anti.nickname = { enabled: true, data: threadInfo?.nicknames || {} };
          break;
        }
        case "out": {
          anti.out = { enabled: true };
          break;
        }
        case "emoji": {
          anti.emoji = { enabled: true, emoji: threadInfo?.emoji || null };
          break;
        }
        case "theme": {
          anti.theme = { enabled: true, themeID: threadInfo?.color || threadInfo?.themeID || null };
          break;
        }
        case "qtv": {
          if (!threadInfo?.adminIDs?.some(a => a.id === api.getCurrentUserID())) {
            return api.sendMessage("❎ Bot cần quyền quản trị viên nhóm để dùng anti qtv.", threadID, messageID);
          }
          anti.qtv = { enabled: true, adminIDs: (threadInfo.adminIDs || []).map(a => a.id) };
          break;
        }
      }
    } catch (e) {
      return api.sendMessage(`❎ Lỗi khi bật anti ${type}: ${e.message}`, threadID, messageID);
    }

    data.anti = anti;
    await Threads.setData(String(threadID), { data });
    return api.sendMessage(`☑️ Bật thành công chế độ anti ${type} (${LABELS[type]}).`, threadID, messageID);
  }
};
