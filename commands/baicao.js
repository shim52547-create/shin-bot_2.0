const { Currencies } = require("../utils/currency");

if (!global.moduleData) global.moduleData = {};
if (!global.moduleData.baicao) global.moduleData.baicao = new Map();

function calcTong(c1, c2, c3) {
  let tong = c1 + c2 + c3;
  if (tong >= 20) tong -= 20;
  if (tong >= 10) tong -= 10;
  return tong;
}

module.exports = {
  config: {
    name: "baicao",
    aliases: [],
    version: "2.0",
    role: 0,
    description: "Game bài cào dùng xu ảo trong bot (không phải tiền thật, giải trí nhóm)",
    usage: "baicao <create|join|start|info|leave|huongdan>",
    category: "Giải trí"
  },

  // Xử lý các tin nhắn thường (không có prefix) trong lúc ván bài đang diễn ra
  onChat: async ({ api, event }) => {
    const { senderID, threadID, body, messageID } = event;
    const table = global.moduleData.baicao.get(threadID);
    if (!table || table.start !== 1) return;

    const text = (body || "").trim();

    if (/^chia bài$/i.test(text) && senderID === table.author) {
      if (table.chiabai === 1) return;
      for (const p of table.player) {
        const c1 = Math.floor(Math.random() * 9) + 1;
        const c2 = Math.floor(Math.random() * 9) + 1;
        const c3 = Math.floor(Math.random() * 9) + 1;
        p.card1 = c1; p.card2 = c2; p.card3 = c3;
        p.tong = calcTong(c1, c2, c3);
        api.sendMessage(`🃏 Bài của bạn: ${c1} | ${c2} | ${c3}\nTổng bài của bạn: ${p.tong}`, p.id);
      }
      table.chiabai = 1;
      global.moduleData.baicao.set(threadID, table);
      return api.sendMessage("⚡️Bài đã được chia! Mỗi người có 2 lượt đổi bài — kiểm tra tin nhắn riêng nếu không thấy bài.", threadID);
    }

    if (/^đổi bài$/i.test(text)) {
      if (table.chiabai !== 1) return;
      const p = table.player.find(x => x.id === senderID);
      if (!p) return;
      if (p.doibai <= 0) return api.sendMessage("⚡️Bạn đã dùng hết lượt đổi bài.", threadID, messageID);
      if (p.ready) return api.sendMessage("⚡️Bạn đã ready, không thể đổi bài!", threadID, messageID);
      const key = ["card1", "card2", "card3"][Math.floor(Math.random() * 3)];
      p[key] = Math.floor(Math.random() * 9) + 1;
      p.tong = calcTong(p.card1, p.card2, p.card3);
      p.doibai -= 1;
      global.moduleData.baicao.set(threadID, table);
      return api.sendMessage(`⚡️Bài sau khi đổi: ${p.card1} | ${p.card2} | ${p.card3}\nTổng bài: ${p.tong}`, p.id);
    }

    if (/^ready$/i.test(text)) {
      if (table.chiabai !== 1) return;
      const p = table.player.find(x => x.id === senderID);
      if (!p || p.ready) return;
      p.ready = true;
      table.ready += 1;
      global.moduleData.baicao.set(threadID, table);
      api.sendMessage(`⚡️${await getName(senderID)} đã sẵn sàng lật bài. Còn ${table.player.length - table.ready} người chưa ready.`, threadID);

      if (table.ready === table.player.length) {
        const players = [...table.player].sort((a, b) => b.tong - a.tong);
        const lines = [];
        let num = 1;
        for (const p2 of players) {
          lines.push(`${num++}. ${await getName(p2.id)} — ${p2.card1}|${p2.card2}|${p2.card3} => ${p2.tong} nút`);
        }
        const prize = table.rateBet * players.length;
        Currencies.increaseMoney(players[0].id, prize);
        global.moduleData.baicao.delete(threadID);
        return api.sendMessage(`⚡️Kết quả:\n${lines.join("\n")}\n\n🏆 Người thắng nhận ${prize} xu.`, threadID);
      }
      return;
    }

    if (/^nonready$/i.test(text)) {
      const names = [];
      for (const p of table.player.filter(x => !x.ready)) names.push(await getName(p.id));
      if (names.length) return api.sendMessage("⚡️Chưa ready: " + names.join(", "), threadID);
    }
  },

  run: async ({ api, event, args }) => {
    const { senderID, threadID, messageID } = event;
    const table = global.moduleData.baicao.get(threadID);
    const userData = Currencies.getData(senderID);

    if (args[0] === "create") {
      if (global.moduleData.baicao.has(threadID)) return api.sendMessage("⚡️Nhóm này đang có bàn bài cào đang mở.", threadID, messageID);
      const bet = parseInt(args[1]);
      if (!args[1] || isNaN(bet) || bet <= 1) return api.sendMessage("⚡️Mức cược không hợp lệ (phải là số > 1).", threadID, messageID);
      if (userData.money < bet) return api.sendMessage(`⚡️Bạn không đủ xu để tạo bàn ${bet} xu (hiện có ${userData.money}).`, threadID, messageID);

      Currencies.decreaseMoney(senderID, bet);
      global.moduleData.baicao.set(threadID, {
        author: senderID, start: 0, chiabai: 0, ready: 0, rateBet: bet,
        player: [{ id: senderID, card1: 0, card2: 0, card3: 0, tong: 0, doibai: 2, ready: false }]
      });
      return api.sendMessage(`⚡️Bàn bài cào ${bet} xu đã được tạo! Gõ "baicao join" để tham gia (chủ bàn không cần join).`, threadID, messageID);
    }

    if (args[0] === "join") {
      if (!table) return api.sendMessage("⚡️Chưa có bàn nào. Tạo bằng: baicao create <mức cược>", threadID, messageID);
      if (table.player.find(p => p.id === senderID)) return api.sendMessage("⚡️Bạn đã tham gia rồi!", threadID, messageID);
      if (table.start === 1) return api.sendMessage("⚡️Bàn đã bắt đầu, không thể tham gia thêm.", threadID, messageID);
      if (userData.money < table.rateBet) return api.sendMessage(`⚡️Bạn không đủ xu để tham gia (cần ${table.rateBet}).`, threadID, messageID);

      Currencies.decreaseMoney(senderID, table.rateBet);
      table.player.push({ id: senderID, card1: 0, card2: 0, card3: 0, tong: 0, doibai: 2, ready: false });
      global.moduleData.baicao.set(threadID, table);
      return api.sendMessage("⚡️Tham gia thành công!", threadID, messageID);
    }

    if (args[0] === "info") {
      if (!table) return api.sendMessage("⚡️Chưa có bàn bài cào nào.", threadID, messageID);
      return api.sendMessage(`=== Bàn Bài Cào ===\nChủ bàn: ${table.author}\nSố người chơi: ${table.player.length}\nMức cược: ${table.rateBet} xu`, threadID, messageID);
    }

    if (args[0] === "leave") {
      if (!table) return api.sendMessage("⚡️Chưa có bàn bài cào nào.", threadID, messageID);
      if (!table.player.some(p => p.id === senderID)) return api.sendMessage("⚡️Bạn chưa tham gia bàn này.", threadID, messageID);
      if (table.start === 1) return api.sendMessage("⚡️Bàn đã bắt đầu, không thể rời.", threadID, messageID);

      if (table.author === senderID) {
        for (const p of table.player) Currencies.increaseMoney(p.id, table.rateBet);
        global.moduleData.baicao.delete(threadID);
        return api.sendMessage("⚡️Chủ bàn đã rời — bàn bị giải tán, hoàn xu cho mọi người.", threadID, messageID);
      } else {
        table.player.splice(table.player.findIndex(p => p.id === senderID), 1);
        Currencies.increaseMoney(senderID, table.rateBet);
        global.moduleData.baicao.set(threadID, table);
        return api.sendMessage("⚡️Bạn đã rời bàn, xu đã được hoàn lại.", threadID, messageID);
      }
    }

    if (args[0] === "start") {
      if (!table) return api.sendMessage("⚡️Chưa có bàn bài cào nào.", threadID, messageID);
      if (table.author !== senderID) return api.sendMessage("⚡️Chỉ chủ bàn mới được bắt đầu.", threadID, messageID);
      if (table.player.length <= 1) return api.sendMessage("⚡️Cần ít nhất 2 người chơi. Mời thêm người dùng: baicao join", threadID, messageID);
      if (table.start === 1) return api.sendMessage("⚡️Bàn đã được bắt đầu rồi.", threadID, messageID);
      table.start = 1;
      global.moduleData.baicao.set(threadID, table);
      return api.sendMessage('⚡️Bàn đã bắt đầu! Chủ bàn gõ "Chia bài" để chia, người chơi gõ "Đổi bài" / "Ready".', threadID, messageID);
    }

    return api.sendMessage(
      `⚡️Hướng dẫn bài cào:\nbaicao create <xu> — tạo bàn\nbaicao join — tham gia\nbaicao start — bắt đầu (chủ bàn)\nChia bài — chủ bàn chia bài\nĐổi bài — đổi 1 lá (tối đa 2 lần)\nReady — hạ bài\nbaicao info — xem thông tin bàn\nbaicao leave — rời bàn\n\n⚠️ Xu chỉ là điểm ảo trong bot, không quy đổi tiền thật.`,
      threadID, messageID
    );
  }
};

async function getName(uid) {
  try {
    const info = await global.client.api.getUserInfo(uid);
    return info?.[uid]?.name || uid;
  } catch (e) {
    return uid;
  }
}
