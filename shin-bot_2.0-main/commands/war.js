module.exports = {
    config: {
        name: "war",
        version: "1.0.0",
        role: 1, // Thay cho hasPermssion: 1
        credits: "đã fix",
        description: "War nát cái boxchat",
        category: "group", // Thay cho commandCategory
        usages: "war đậm chất",
        cooldowns: 10
    },

    run: async function({ api, event }) {
        const { threadID } = event;
        const send = (msg) => api.sendMessage(msg, threadID);

        send("Nghe bố mày chửi đây mấy thằng nhóc !");
        
        setTimeout(() => { send({ body: "Đ!t con mẹ chúng mày" }) }, 3000);
        setTimeout(() => { send({ body: "Mấy thằng ranh con ra nghe bố mày chửi" }) }, 5000);
        setTimeout(() => { send({ body: "Hiện hồn nhanh mấy con chó" }) }, 7000);
        setTimeout(() => { send({ body: "Hiện hồn bố mày hỏi tội" }) }, 9000);
        setTimeout(() => { send({ body: "Mấy thằng nhóc ranh thích war lắm à?" }) }, 12000);
        setTimeout(() => { send({ body: "Đ!t cụ chúng mày nữa" }) }, 15000);
        setTimeout(() => { send({ body: "Cho bố mày xin cái tuổi war cái" }) }, 17000);
        setTimeout(() => { send({ body: "Nhanh ra chửi nhau với tao" }) }, 20000);
        setTimeout(() => { send({ body: "Mấy thằng nhóc ác vắt mũi chưa sạch bày đặt war với bố mày à?" }) }, 23000);
        setTimeout(() => { send({ body: "Con cặc địt mẹ mày" }) }, 25000);
        setTimeout(() => { send({ body: "Ngon thì ẳng con mẹ lên" }) }, 28500);
        setTimeout(() => { send({ body: "Bố mày bắn rap chết cụ chúng mày giờ" }) }, 31000);
        setTimeout(() => { send({ body: "Xin cái tuổi ăn tao phát ?" }) }, 36000);
        setTimeout(() => { send({ body: "Ngon thì ăn bố mày đi này" }) }, 39000);
        setTimeout(() => { send({ body: "Trước đó cho tao xin nghỉ 1p nhé" }) }, 40000);
        setTimeout(() => { send({ body: "Xin phép mở đầu thì" }) }, 65000);
        setTimeout(() => { send({ body: "Đầu tiên tao xin phép địt từ trên xuống dưới con" }) }, 70000);
        setTimeout(() => { send({ body: "Tao địt từ lỗ lồn đến lỗ nhị con lồn" }) }, 75000);
        setTimeout(() => { send({ body: "Lồn thì to như lồn trâu thủ dâm ống cống ấy nhé con" }) }, 80000);
        setTimeout(() => { send({ body: "Tao địt chắc 2 thằng như tao chưa đủ lấp cái lỗ lồn nhà mày đâu" }) }, 85000);
        setTimeout(() => { send("Tao mệt rồi đéo chửi nữa") }, 90000);
        setTimeout(() => { send({ body: "Nào ông chủ update lyric thì war tiếp nhé" }) }, 95000);
        setTimeout(() => { send({ body: "Cảm ơn bạn đã nghe mình war nha" }) }, 100000);
        setTimeout(() => { send({ body: "Xin chào và hẹn gặp lại bạn ở chương trình lần sau nha" }) }, 105000);
        setTimeout(() => { send({ body: "Chào tạm biệt 🥺" }) }, 115000);
    }
};