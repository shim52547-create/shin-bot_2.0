const { Currencies } = require("../utils/currency");

// Danh sách từ khởi động ngẫu nhiên (từ có 2 âm tiết) để bot ra đề mở màn
const STARTER_WORDS = [
  "học sinh", "con mèo", "bầu trời", "hoa hồng", "máy tính",
  "sách vở", "con đường", "buổi sáng", "trái tim", "mùa xuân"
];

const REWARD_PER_WORD = 10;
const TURN_TIMEOUT_MS = 60 * 1000;

// state theo từng nhóm: { lastWord, usedWords: Set, lastPlayer, timer }
const games = new Map();

function normalize(str) {
  return str.trim().toLowerCase().replace(/\s+/g, " ");
}

function lastSyllable(phrase) {
  const parts = normalize(phrase).split(" ");
  return parts[parts.length - 1];
}
function firstSyllable(phrase) {
  const parts = normalize(phrase).split(" ");
  return parts[0];
}

function endGame(threadID, api, reason) {
  const game = games.get(threadID);
  if (game?.timer) clearTimeout(game.timer);
  games.delete(threadID);
  if (reason) api.sendMessage(reason, threadID);
}

function resetTimer(threadID, api) {
  const game = games.get(threadID);
  if (!game) return;
  if (game.timer) clearTimeout(game.timer);
  game.timer = setTimeout(() => {
    api.sendMessage(
      `⏰ Hết giờ! Không ai nối được từ "${game.lastWord}".\nVán chơi kết thúc, gõ "noitu batdau" để chơi lại.`,
      threadID
    );
    games.delete(threadID);
  }, TURN_TIMEOUT_MS);
}

module.exports = {
  config: {
    name: "noitu",
    aliases: ["ndt"],
    version: "1.0",
    role: 0,
    description: "Chơi nối từ tiếng Việt trong nhóm, nối đúng được cộng xu",
    usage: "noitu batdau | noitu <từ của bạn> | noitu dừng",
    category: "Giải trí"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const sub = normalize(args.join(" "));

    if (!sub || sub === "batdau" || sub === "bắt đầu") {
      if (games.has(threadID)) {
        const g = games.get(threadID);
        return api.sendMessage(`🔤 Ván chơi đang diễn ra! Từ hiện tại: "${g.lastWord}"\nHãy nối bằng: noitu <từ bắt đầu bằng "${lastSyllable(g.lastWord)}">`, threadID, messageID);
      }
      const starter = STARTER_WORDS[Math.floor(Math.random() * STARTER_WORDS.length)];
      games.set(threadID, { lastWord: starter, usedWords: new Set([normalize(starter)]), lastPlayer: null });
      resetTimer(threadID, api);
      return api.sendMessage(
        `🎮 NỐI TỪ bắt đầu!\nTừ đầu tiên: "${starter}"\n` +
        `Hãy gõ: noitu <từ bắt đầu bằng "${lastSyllable(starter)}">\n` +
        `Mỗi từ nối đúng được +${REWARD_PER_WORD} xu. Có ${TURN_TIMEOUT_MS / 1000}s cho mỗi lượt.`,
        threadID, messageID
      );
    }

    if (sub === "dừng" || sub === "dung" || sub === "stop") {
      if (!games.has(threadID)) return api.sendMessage("⚠️ Hiện không có ván nối từ nào đang chạy.", threadID, messageID);
      endGame(threadID, api, "🛑 Đã dừng ván nối từ.");
      return;
    }

    // Người chơi nối từ
    const game = games.get(threadID);
    if (!game) {
      return api.sendMessage('⚠️ Chưa có ván nào bắt đầu. Gõ "noitu batdau" để bắt đầu chơi.', threadID, messageID);
    }

    const word = sub;
    const parts = word.split(" ");
    if (parts.length < 2) {
      return api.sendMessage("⚠️ Vui lòng nối bằng cụm từ ít nhất 2 âm tiết (VD: 'sinh viên').", threadID, messageID);
    }

    if (firstSyllable(word) !== lastSyllable(game.lastWord)) {
      return api.sendMessage(`❌ Sai rồi! Từ mới phải bắt đầu bằng "${lastSyllable(game.lastWord)}".`, threadID, messageID);
    }

    if (game.usedWords.has(word)) {
      return api.sendMessage("❌ Từ này đã được dùng trong ván này rồi, thử từ khác nhé.", threadID, messageID);
    }

    game.usedWords.add(word);
    game.lastWord = word;
    game.lastPlayer = senderID;
    resetTimer(threadID, api);

    const newBalance = Currencies.increaseMoney(senderID, REWARD_PER_WORD);
    return api.sendMessage(
      `✅ Chuẩn! Từ tiếp theo phải bắt đầu bằng "${lastSyllable(word)}".\n+${REWARD_PER_WORD} xu (số dư: ${newBalance})`,
      threadID, messageID
    );
  }
};
