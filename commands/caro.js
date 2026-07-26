const SIZE = 9; // bàn cờ 9x9
const WIN_LEN = 5; // cần 5 quân liên tiếp để thắng
const COLS = "ABCDEFGHI".slice(0, SIZE);
const KEYCAPS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
const REGIONAL = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮"];
const EMPTY = "⬜";
const MARKS = ["❌", "⭕"];

// state theo từng nhóm (threadID -> game)
const games = new Map();

function newBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0)); // 0 = trống, 1/2 = người chơi
}

function renderBoard(game) {
  let msg = "　" + REGIONAL.join("") + "\n";
  for (let r = 0; r < SIZE; r++) {
    let row = KEYCAPS[r];
    for (let c = 0; c < SIZE; c++) {
      const v = game.board[r][c];
      row += v === 0 ? EMPTY : MARKS[v - 1];
    }
    msg += row + "\n";
  }
  return msg.trim();
}

function parseMove(str) {
  const m = (str || "").trim().match(/^([a-iA-I])\s*([1-9])$/) || (str || "").trim().match(/^([1-9])\s*([a-iA-I])$/);
  if (!m) return null;
  let colChar, rowChar;
  if (/[a-iA-I]/.test(m[1])) {
    colChar = m[1];
    rowChar = m[2];
  } else {
    rowChar = m[1];
    colChar = m[2];
  }
  const c = COLS.indexOf(colChar.toUpperCase());
  const r = parseInt(rowChar, 10) - 1;
  if (c < 0 || r < 0 || r >= SIZE) return null;
  return { r, c };
}

function checkWin(board, r, c, player) {
  const dirs = [
    [0, 1], [1, 0], [1, 1], [1, -1]
  ];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (const sign of [1, -1]) {
      let rr = r + dr * sign;
      let cc = c + dc * sign;
      while (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && board[rr][cc] === player) {
        count++;
        rr += dr * sign;
        cc += dc * sign;
      }
    }
    if (count >= WIN_LEN) return true;
  }
  return false;
}

function isBoardFull(board) {
  return board.every(row => row.every(v => v !== 0));
}

async function getName(api, id) {
  try {
    const info = await api.getUserInfo(id);
    return info?.[id]?.name || "Người chơi";
  } catch (e) {
    return "Người chơi";
  }
}

function turnText(game) {
  const currentID = game.players[game.turn];
  return `${MARKS[game.turn]} Lượt của: ${game.names[currentID]}\n📝 Đánh bằng toạ độ, VD: c5`;
}

module.exports = {
  config: {
    name: "caro",
    aliases: ["gomoku"],
    version: "1.0",
    role: 0,
    description: "Chơi cờ caro (gomoku) 2 người trong nhóm, ai đủ 5 quân liên tiếp thắng",
    usage: "caro @tag (thách đấu) | caro <toạ độ vd c5> | caro dừng",
    category: "Giải trí"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID, mentions, messageReply } = event;
    const sub = (args[0] || "").toLowerCase();

    // ---- Dừng ván đang chơi ----
    if (["dừng", "dung", "stop", "huy", "hủy"].includes(sub)) {
      const game = games.get(threadID);
      if (!game) return api.sendMessage("⚠️ Hiện không có ván caro nào đang diễn ra.", threadID, messageID);
      if (!game.players.includes(senderID)) {
        return api.sendMessage("⚠️ Chỉ 2 người đang chơi mới được dừng ván.", threadID, messageID);
      }
      games.delete(threadID);
      return api.sendMessage("🛑 Đã dừng ván caro.", threadID, messageID);
    }

    // ---- Thách đấu (tag hoặc reply người chơi) ----
    const mentionIDs = Object.keys(mentions || {}).filter(id => id !== global?.client?.botID);
    const targetID = messageReply?.senderID || mentionIDs[0];

    if (targetID || (!games.has(threadID) && !parseMove(args.join(" ")))) {
      if (games.has(threadID)) {
        const game = games.get(threadID);
        return api.sendMessage(
          `⚠️ Nhóm đang có 1 ván caro giữa ${game.names[game.players[0]]} và ${game.names[game.players[1]]}.\n` +
          `Gõ "caro dừng" để huỷ ván trước khi tạo ván mới.`,
          threadID, messageID
        );
      }
      if (!targetID) {
        return api.sendMessage(
          "⚠️ Hãy tag hoặc reply người bạn muốn thách đấu.\nCách dùng: caro @tag",
          threadID, messageID
        );
      }
      if (targetID === senderID) {
        return api.sendMessage("⚠️ Bạn không thể tự thách đấu chính mình.", threadID, messageID);
      }

      const [name1, name2] = await Promise.all([getName(api, senderID), getName(api, targetID)]);
      const game = {
        board: newBoard(),
        players: [senderID, targetID],
        names: { [senderID]: name1, [targetID]: name2 },
        turn: 0
      };
      games.set(threadID, game);

      return api.sendMessage(
        `🎮 CỜ CARO bắt đầu!\n${MARKS[0]} ${name1}  vs  ${MARKS[1]} ${name2}\n\n` +
        renderBoard(game) + "\n\n" + turnText(game),
        threadID, messageID
      );
    }

    // ---- Đánh cờ ----
    const game = games.get(threadID);
    if (!game) {
      return api.sendMessage('⚠️ Chưa có ván caro nào. Gõ "caro @tag" để thách đấu.', threadID, messageID);
    }
    if (!game.players.includes(senderID)) {
      return api.sendMessage("⚠️ Bạn không tham gia ván caro này.", threadID, messageID);
    }
    if (game.players[game.turn] !== senderID) {
      return api.sendMessage(`⚠️ Chưa tới lượt bạn.\n${turnText(game)}`, threadID, messageID);
    }

    const move = parseMove(args.join(" "));
    if (!move) {
      return api.sendMessage("⚠️ Toạ độ không hợp lệ. Ví dụ: caro c5 (cột C, hàng 5).", threadID, messageID);
    }
    if (game.board[move.r][move.c] !== 0) {
      return api.sendMessage("⚠️ Ô này đã có quân, hãy chọn ô khác.", threadID, messageID);
    }

    const player = game.turn + 1;
    game.board[move.r][move.c] = player;

    if (checkWin(game.board, move.r, move.c, player)) {
      const winnerName = game.names[senderID];
      games.delete(threadID);
      return api.sendMessage(
        renderBoard(game) + `\n\n🏆 ${MARKS[player - 1]} ${winnerName} đã thắng! Chúc mừng!`,
        threadID, messageID
      );
    }

    if (isBoardFull(game.board)) {
      games.delete(threadID);
      return api.sendMessage(renderBoard(game) + "\n\n🤝 Hoà! Bàn cờ đã đầy.", threadID, messageID);
    }

    game.turn = game.turn === 0 ? 1 : 0;
    return api.sendMessage(renderBoard(game) + "\n\n" + turnText(game), threadID, messageID);
  }
};
