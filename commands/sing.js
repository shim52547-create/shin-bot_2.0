const fs = require('fs');
const path = require('path');
const ytdl = require('@distube/ytdl-core');

module.exports.config = {
    name: "sing",
    version: "2.1.0",
    role: 0,
    credits: "",
    description: "Phát nhạc/video từ YouTube",
    category: "Giải trí",
    usage: "[tên bài hát]",
    cooldowns: 5
};

module.exports.convertHMS = function(value) {
    const sec = parseInt(value, 10);
    let hours   = Math.floor(sec / 3600);
    let minutes = Math.floor((sec - (hours * 3600)) / 60);
    let seconds = sec - (hours * 3600) - (minutes * 60);
    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return (hours !== '00' ? hours+':' : '') + minutes+':'+seconds;
}

// Giới hạn dung lượng file gửi qua Messenger, giống chuẩn dùng trong ytb.js
const MAX_SIZE_MB = 25;

module.exports.handleReply = async function ({ api, event, handleReply, Users }) {
    const { threadID, messageID, body, senderID } = event;
    if (handleReply.author !== senderID) return;

    if (handleReply.type === "search") {
        const choice = parseInt(body.trim());
        if (isNaN(choice) || choice < 1 || choice > handleReply.results.length) {
            return api.sendMessage("⚠️ Lựa chọn không hợp lệ.", threadID, messageID);
        }

        const video = handleReply.results[choice - 1];

        return api.sendMessage(`✅ Bạn đã chọn: ${video.title}\n\n👇 Vui lòng reply tin nhắn này để chọn định dạng tải:\n1. 🎬 Tải Video\n2. 🎵 Tải Audio`, threadID, (err, info) => {
            global.client.handleReply.push({
                type: "download",
                name: this.config.name,
                author: senderID,
                messageID: info.messageID,
                video
            });
        }, messageID);
    }

    if (handleReply.type === "download") {
        const choice = parseInt(body.trim());
        if (choice !== 1 && choice !== 2) {
            return api.sendMessage("⚠️ Lựa chọn không hợp lệ. Vui lòng reply 1 cho Video hoặc 2 cho Audio.", threadID, messageID);
        }

        await api.unsendMessage(handleReply.messageID);
        const video = handleReply.video;
        const isAudio = choice === 2;
        const formatName = isAudio ? "Audio" : "Video";

        const timeStart = Date.now();
        const cacheDir = path.join(__dirname, "cache");
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

        api.setMessageReaction("⏳", messageID, (err) => {}, true);
        let infoMsg = await api.sendMessage(`⏳ Đang xử lý ${formatName} "${video.title}"...`, threadID, messageID);
        let fileSent = false;

        const baseName = Date.now();
        const finalFilePath = path.join(cacheDir, isAudio ? `${baseName}.m4a` : `${baseName}.mp4`);

        try {
            if (!ytdl.validateURL(video.url)) {
                throw new Error("Link video không hợp lệ với ytdl-core.");
            }

            await new Promise((resolve, reject) => {
                const stream = ytdl(video.url, isAudio
                    ? { filter: "audioonly", quality: "highestaudio" }
                    : { filter: "audioandvideo", quality: "highest" }
                );
                const writer = fs.createWriteStream(finalFilePath);
                stream.on("error", reject);
                writer.on("error", reject);
                writer.on("finish", resolve);
                stream.pipe(writer);
            });

            if (fs.existsSync(finalFilePath)) {
                const sizeMB = fs.statSync(finalFilePath).size / (1024 * 1024);
                if (sizeMB > MAX_SIZE_MB) {
                    fs.unlinkSync(finalFilePath);
                    throw new Error(`File quá nặng (${sizeMB.toFixed(1)}MB), vượt giới hạn ${MAX_SIZE_MB}MB của Messenger.`);
                }

                const processTime = Math.floor((Date.now() - timeStart) / 1000);
                const userName = await Users.getNameUser(senderID);
                const msgBody = ` ㅤㅤㅤ───『 Tiệm Nhạc 』───\n▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱\n🎧 Bài hát: ${video.title}\n⏰ Thời lượng: ${video.timestamp || 'Không rõ'}\n🌐 Tên kênh: ${video.author ? video.author.name : 'Không rõ'}\n👁️ Lượt xem: ${video.views || 'Không rõ'}\n👤 Order by: ${userName}\n⌛ Time xử lí: ${processTime} giây\n ⇆ㅤㅤㅤ◁ㅤㅤ❚❚ㅤㅤ▷ㅤㅤㅤ↻\n▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱`;

                await new Promise((resolve, reject) => {
                    api.sendMessage({
                        body: msgBody,
                        attachment: fs.createReadStream(finalFilePath)
                    }, threadID, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                fs.unlinkSync(finalFilePath);
                api.setMessageReaction("✅", messageID, (err) => {}, true);
                fileSent = true;
            }
        } catch (error) {
            console.error(`[SING] ytdl-core lỗi:`, error.message || error);
            if (fs.existsSync(finalFilePath)) fs.unlinkSync(finalFilePath);
        }

        if (infoMsg && infoMsg.messageID) api.unsendMessage(infoMsg.messageID);
        if (!fileSent) {
            api.setMessageReaction("❌", messageID, (err) => {}, true);
            api.sendMessage("❌ Không thể tải bài hát này, vui lòng thử lại.", threadID);
        }
    }
};

module.exports.run = async function ({ api, event, args, Users }) {
    const query = args.join(" ");
    if (!query) return api.sendMessage("👉 Nhập tên bài hát!", event.threadID, event.messageID);
    try {
        const name = await Users.getNameUser(event.senderID);
        const yts = require("yt-search");
        const search = await yts(query);
        const results = search.videos.slice(0, 5);
        if (!results.length) return api.sendMessage("❌ Không tìm thấy kết quả.", event.threadID);

        const msg = results.map((v, i) => `➣ Kết quả: ${i + 1} - ${v.title}\n➣ Kênh: ${v.author ? v.author.name : 'Không xác định'}\n➣ Thời lượng: ${v.timestamp || 'Không xác định'}\n────────────────\n`).join("");
        const body = `『 MENU CHỌN BÀI HÁT 』\n────────────────\n${msg}➝ Mời ${name} trả lời (reply) tin nhắn này kèm số thứ tự bài hát mà bạn muốn chọn.`;

        api.sendMessage(body, event.threadID, (err, info) => {
            global.client.handleReply.push({ type: "search", name: this.config.name, author: event.senderID, messageID: info.messageID, results });
        });
    } catch (error) {
        console.error("Lỗi:", error);
        api.sendMessage("❌ Đã có lỗi xảy ra.", event.threadID);
    }
};
