const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { ExpressPeerServer } = require("peer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Cấu hình PeerJS Server tích hợp sẵn
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: "/myapp",
});

app.use("/peerjs", peerServer);
app.use(express.static(path.join(__dirname, "public")));

// Route trang chủ
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Route tạo phòng
app.get("/create-room", (req, res) => {
  res.redirect(`/${uuidv4()}`);
});

// Route vào phòng cụ thể
app.get("/:room", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- SOCKET.IO LOGIC ---
const rooms = {}; // Lưu dữ liệu vẽ của phòng

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId, userName) => {
    socket.join(roomId);
    
    // Gửi lịch sử vẽ cho người mới vào
    if (rooms[roomId]) {
      socket.emit("load-canvas", rooms[roomId]);
    }

    socket.to(roomId).emit("user-connected", userId, userName);

    // Xử lý Chat
    socket.on("send-message", (message) => {
      io.to(roomId).emit("receive-message", {
        user: userName,
        text: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        self: false
      });
    });

    // Xử lý Vẽ Bảng (Whiteboard)
    socket.on("drawing", (data) => {
      if (!rooms[roomId]) rooms[roomId] = [];
      rooms[roomId].push(data);
      socket.to(roomId).emit("drawing", data);
    });

    socket.on("clear-board", () => {
      rooms[roomId] = [];
      io.to(roomId).emit("clear-board");
    });

    // Ngắt kết nối
    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", userId);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server đang chạy tại: http://localhost:${PORT}`);
});