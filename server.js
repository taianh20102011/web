const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { v4: uuidv4 } = require("uuid");

app.use(express.static("public"));

// Tự động tạo phòng ngẫu nhiên nếu truy cập trang chủ
app.get("/", (req, res) => {
    res.redirect(`/${uuidv4()}`);
});

app.get("/:room", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

io.on("connection", (socket) => {
    socket.on("join-room", (roomId, userId) => {
        socket.join(roomId);
        socket.to(roomId).emit("user-connected", userId);

        socket.on("message", (msg) => {
            io.to(roomId).emit("createMessage", msg, userId);
        });

        socket.on("draw", (data) => {
            socket.to(roomId).emit("draw", data);
        });

        socket.on("disconnect", () => {
            socket.to(roomId).emit("user-disconnected", userId);
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Space Station at http://localhost:${PORT}`));