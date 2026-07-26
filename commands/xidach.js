const { Currencies } = require("../utils/currency");

if (!global.moduleData) global.moduleData = {};
if (!global.moduleData.xidach) global.moduleData.xidach = new Map();

const MIN_BET = 50;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];

function drawCard() {
    const rankIdx = Math.floor(Math.random() * RANKS.length);
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    let value;
    if (rankIdx === 0) value = 11; // A, tự hạ xuống 1 nếu cần trong calcTotal
    else if (rankIdx >= 9) value = 10; // 10, J, Q, K
    else value = rankIdx + 1; // 2..9
    return { rank: RANKS[rankIdx], suit, value, isAce: rankIdx === 0 };
}

function calcTotal(cards) {
    let total = cards.reduce((sum, c) => sum + c.value, 0);
    let aces = cards.filter(c => c.isAce).length;
    while (total > 21 && aces > 0) {
        total -= 10; // hạ 1 con A từ 11 xuống 1
        aces--;
    }
    return total;
}

function cardText(c) {
    return `${c.rank}${c.suit}`;
}

function handText(cards) {
    return cards.map(cardText).join(" ");
}

function key(threadID, senderID) {
    return `${threadID}_${senderID}`;
}

function newGame(bet) {
    const player = [drawCard(), drawCard()];
    const dealer = [drawCard(), drawCard()];
    return { bet, player, dealer, finished: false };
}

// Nhà cái rút bài theo luật chuẩn: rút tới khi tổng >= 17
function playDealer(dealer) {
    while (calcTotal(dealer) < 17) {
        dealer.push(drawCard());
    }
    return dealer;
}

// Trả về { result: "win"|"lose"|"push", multiplier, note }
function settle(game) {
    const playerTotal = calcTotal(game.player);
    const dealerNaturalCheck = game.dealer.length === 2 && calcTotal(game.dealer) === 21;
    const playerNatural = game.player.length === 2 && playerTotal === 21;

    if (playerNatural && !dealerNaturalCheck) {
        return { result: "win", multiplier: 3, note: "🌟 Xì Bàn! (21 điểm ngay 2 lá đầu)" };
    }

    playDealer(game.dealer);
    const dealerTotal = calcTotal(game.dealer);

    if (game.player.length >= 5 && playerTotal <= 21) {
        return { result: "win", multiplier: 3, note: "🎉 Ngũ Linh! (5 lá không quá 21 điểm)" };
    }

    if (playerTotal > 21) return { result: "lose", multiplier: 0, note: "💥 Bạn bị quắc (quá 21 điểm)!" };
    if (dealerTotal > 21) return { result: "win", multiplier: 2, note: "💥 Nhà cái bị quắc!" };
    if (dealerNaturalCheck && !playerNatural) return { result: "lose", multiplier: 0, note: "🏦 Nhà cái Xì Bàn!" };
    if (playerTotal > dealerTotal) return { result: "win", multiplier: 2, note: "✅ Bạn có điểm cao hơn!" };
    if (playerTotal < dealerTotal) return { result: "lose", multiplier: 0, note: "❌ Nhà cái có điểm cao hơn!" };
    return { result: "push", multiplier: 1, note: "🤝 Hòa, hoàn lại xu cược." };
}

function finishGame(senderID, threadID, game, api, messageID) {
    game.finished = true;
    const outcome = settle(game);

    if (outcome.multiplier > 0) Currencies.increaseMoney(senderID, game.bet * outcome.multiplier);
    global.moduleData.xidach.delete(key(threadID, senderID));

    const playerTotal = calcTotal(game.player);
    const dealerTotal = calcTotal(game.dealer);

    let profitLine;
    if (outcome.result === "push") profitLine = `Hòa — nhận lại ${game.bet} xu.`;
    else if (outcome.result === "win") profitLine = `Thắng — nhận ${game.bet * outcome.multiplier} xu (x${outcome.multiplier}).`;
    else profitLine = `Thua — mất ${game.bet} xu.`;

    return api.sendMessage(
        `${outcome.note}\n` +
        `🃏 Bài của bạn: ${handText(game.player)} => ${playerTotal} điểm\n` +
        `🏦 Bài nhà cái: ${handText(game.dealer)} => ${dealerTotal} điểm\n\n` +
        profitLine,
        threadID, messageID
    );
}

module.exports = {
    config: {
        name: "xidach",
        aliases: ["21", "blackjack"],
        version: "1.0.0",
        role: 0,
        description: "Chơi Xì Dách (Blackjack 21) một mình đấu với nhà cái, dùng xu ảo",
        category: "Giải trí",
        usages:
            "xidach <số xu> — đặt cược, bắt đầu ván mới\n" +
            "xidach rut — rút thêm 1 lá\n" +
            "xidach dung — dừng, lật bài so với nhà cái\n" +
            "xidach huongdan — xem luật chơi",
        cooldowns: 3
    },

    run: async function ({ api, event, args }) {
        const { threadID, senderID, messageID } = event;
        const gameKey = key(threadID, senderID);
        const existing = global.moduleData.xidach.get(gameKey);
        const action = (args[0] || "").toLowerCase();

        if (!action || action === "huongdan" || action === "help") {
            return api.sendMessage(
                "🎴 LUẬT XÌ DÁCH (21):\n" +
                "- xidach <số xu>: đặt cược, nhận 2 lá bài đầu (nhà cái cũng có 2 lá, úp 1 lá).\n" +
                "- xidach rut: rút thêm 1 lá, cố gắng tiến gần 21 điểm mà không quá.\n" +
                "- xidach dung: dừng rút bài, nhà cái sẽ tự rút tới khi đủ 17 điểm rồi so bài.\n" +
                "- Quá 21 điểm là bị \"quắc\", thua ngay.\n" +
                "- Xì Bàn (21 điểm ngay 2 lá đầu) thắng x3.\n" +
                "- Ngũ Linh (5 lá mà không quá 21 điểm) thắng x3.\n" +
                "- Thắng thường x2, hòa được hoàn lại cược.\n" +
                `- Cược tối thiểu: ${MIN_BET} xu.`,
                threadID, messageID
            );
        }

        if (action === "rut" || action === "hit") {
            if (!existing || existing.finished) {
                return api.sendMessage("⚠️ Bạn chưa có ván nào đang chơi. Gõ: xidach <số xu> để bắt đầu.", threadID, messageID);
            }
            existing.player.push(drawCard());
            const total = calcTotal(existing.player);

            if (total > 21) {
                return finishGame(senderID, threadID, existing, api, messageID);
            }
            if (existing.player.length >= 5) {
                return finishGame(senderID, threadID, existing, api, messageID);
            }

            global.moduleData.xidach.set(gameKey, existing);
            return api.sendMessage(
                `🃏 Bài của bạn: ${handText(existing.player)} => ${total} điểm\n` +
                `Gõ "xidach rut" để rút thêm hoặc "xidach dung" để dừng.`,
                threadID, messageID
            );
        }

        if (action === "dung" || action === "stand" || action === "stop") {
            if (!existing || existing.finished) {
                return api.sendMessage("⚠️ Bạn chưa có ván nào đang chơi. Gõ: xidach <số xu> để bắt đầu.", threadID, messageID);
            }
            return finishGame(senderID, threadID, existing, api, messageID);
        }

        // Nếu không khớp các lệnh trên, coi đây là mức cược để bắt đầu ván mới
        if (existing && !existing.finished) {
            return api.sendMessage(
                `⚠️ Bạn đang có ván chơi dở (bài: ${handText(existing.player)}). Gõ "xidach rut" hoặc "xidach dung" trước.`,
                threadID, messageID
            );
        }

        const bet = parseInt(args[0], 10);
        if (isNaN(bet) || bet < MIN_BET) {
            return api.sendMessage(`⚠️ Cách dùng: xidach <số xu> (tối thiểu ${MIN_BET} xu). Gõ "xidach huongdan" để xem luật.`, threadID, messageID);
        }

        const moneyUser = Currencies.getData(senderID).money;
        if (moneyUser < bet) {
            return api.sendMessage(`⚡ Số dư của bạn không đủ ${bet} xu để chơi.`, threadID, messageID);
        }

        Currencies.decreaseMoney(senderID, bet);
        const game = newGame(bet);
        const playerTotal = calcTotal(game.player);

        // Cả 2 bên đều Xì Bàn ngay từ đầu -> kết thúc luôn
        if (playerTotal === 21 || calcTotal(game.dealer) === 21) {
            return finishGame(senderID, threadID, game, api, messageID);
        }

        global.moduleData.xidach.set(gameKey, game);
        return api.sendMessage(
            `🎲 Ván Xì Dách ${bet} xu đã bắt đầu!\n` +
            `🃏 Bài của bạn: ${handText(game.player)} => ${playerTotal} điểm\n` +
            `🏦 Bài nhà cái: ${cardText(game.dealer[0])} ❓ (1 lá úp)\n\n` +
            `Gõ "xidach rut" để rút thêm hoặc "xidach dung" để dừng.`,
            threadID, messageID
        );
    }
};
