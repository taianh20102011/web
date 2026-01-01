// --- 1. IMPORT FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// !!! THAY THẾ BẰNG CONFIG CỦA BẠN !!!
const firebaseConfig = {
  apiKey: "AIzaSyDNy9Rh32Tf5kFeeVS2BygQ-XPrZV5lo2g",
  authDomain: "webnoi.firebaseapp.com",
  projectId: "webnoi",
  storageBucket: "webnoi.firebasestorage.app",
  messagingSenderId: "889019651682",
  appId: "1:889019651682:web:140d4559c15ca5419f633b",
  measurementId: "G-3V9NMC86HT"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- 2. XỬ LÝ GIAO DIỆN AUTH ---
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const authScreen = document.getElementById('auth-screen');
const appContainer = document.getElementById('app-container');

// Chuyển Tab
tabLogin.addEventListener('click', () => {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
});

tabRegister.addEventListener('click', () => {
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
});

// Xử lý Đăng Ký
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const name = document.getElementById('reg-name').value;
    const errorMsg = document.getElementById('reg-error');

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Cập nhật tên hiển thị ngay sau khi tạo
        await updateProfile(userCredential.user, { displayName: name });
        // Tự động trigger onAuthStateChanged để vào app
    } catch (error) {
        errorMsg.innerText = getErrorMessage(error.code);
    }
});

// Xử lý Đăng Nhập
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error');

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        errorMsg.innerText = getErrorMessage(error.code);
    }
});

// Đăng xuất
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => {
        location.reload(); // Reload lại trang để reset state socket
    });
});

function getErrorMessage(code) {
    switch(code) {
        case 'auth/email-already-in-use': return "Email này đã được đăng ký!";
        case 'auth/invalid-email': return "Email không hợp lệ!";
        case 'auth/weak-password': return "Mật khẩu quá yếu (cần 6+ ký tự)";
        case 'auth/user-not-found': return "Tài khoản không tồn tại!";
        case 'auth/wrong-password': return "Sai mật khẩu!";
        case 'auth/invalid-credential': return "Sai thông tin đăng nhập!";
        default: return "Lỗi: " + code;
    }
}

// --- 3. LOGIC APP CHÍNH (Chạy khi đã Login) ---
let socket;
let myName = "User";

// Lắng nghe trạng thái đăng nhập
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Đã đăng nhập -> Vào App
        myName = user.displayName || user.email.split('@')[0];
        document.getElementById('user-display-name').innerText = myName;
        authScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');
        
        // Khởi động Logic Real-time
        initAppLogic();
    } else {
        // Chưa đăng nhập -> Hiện Auth Screen
        authScreen.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
});

// Bọc toàn bộ logic cũ vào hàm initAppLogic để chỉ chạy khi user đã login
function initAppLogic() {
    socket = io("/"); // Kết nối Socket.io
    const videoGrid = document.getElementById("video-grid");
    const myVideo = document.createElement("video");
    myVideo.muted = true;
    const peers = {};
    let myVideoStream;

    const peer = new Peer(undefined, {
        path: '/peerjs',
        host: '/',
        port: window.location.port || 443
    });

    // Lấy ID phòng
    const ROOM_ID = window.location.pathname.substring(1) || "lofi-room";

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
        myVideoStream = stream;
        addVideoStream(myVideo, stream, "Bạn (" + myName + ")");

        peer.on("call", call => {
            call.answer(stream);
            const video = document.createElement("video");
            call.on("stream", userVideoStream => {
                // Tạm thời chưa lấy được tên người gọi ngay lập tức qua peer simple, 
                // dùng socket để map tên sau này nếu cần nâng cao.
                addVideoStream(video, userVideoStream, "Đồng nghiệp");
            });
        });

        socket.on("user-connected", (userId, userName) => {
            connectToNewUser(userId, stream, userName, peer, peers);
            appendMessage("System", `👋 ${userName} đã vào phòng!`, "sys");
        });
    });

    peer.on("open", id => {
        socket.emit("join-room", ROOM_ID, id, myName);
    });

    socket.on("receive-message", data => {
        appendMessage(data.user, data.text, "other");
    });

    socket.on("user-disconnected", userId => {
        if (peers[userId]) peers[userId].close();
    });

    // --- BUTTON HANDLERS ---
    // Do dùng type="module", các hàm không còn global. Phải addEventListener thủ công.
    
    // Mic & Cam
    document.getElementById('mic-btn').addEventListener('click', function() {
        const enabled = myVideoStream.getAudioTracks()[0].enabled;
        if (enabled) {
            myVideoStream.getAudioTracks()[0].enabled = false;
            this.classList.add("active");
            this.innerHTML = '<i class="fas fa-microphone-slash"></i>';
        } else {
            myVideoStream.getAudioTracks()[0].enabled = true;
            this.classList.remove("active");
            this.innerHTML = '<i class="fas fa-microphone"></i>';
        }
    });

    document.getElementById('cam-btn').addEventListener('click', function() {
        const enabled = myVideoStream.getVideoTracks()[0].enabled;
        if (enabled) {
            myVideoStream.getVideoTracks()[0].enabled = false;
            this.classList.add("active");
            this.innerHTML = '<i class="fas fa-video-slash"></i>';
        } else {
            myVideoStream.getVideoTracks()[0].enabled = true;
            this.classList.remove("active");
            this.innerHTML = '<i class="fas fa-video"></i>';
        }
    });

    // Theme
    document.getElementById('theme-btn').addEventListener('click', function() {
        document.body.classList.toggle("light-mode");
        this.innerHTML = document.body.classList.contains("light-mode") ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    });

    // Sidebar & Chat
    document.getElementById('chat-btn').addEventListener('click', () => {
        const sidebar = document.getElementById("sidebar");
        sidebar.classList.toggle("open"); // Mobile
        if(window.innerWidth > 768) sidebar.classList.toggle("collapsed");
    });

    document.getElementById('chat-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById("msg-input");
        const msg = input.value;
        if(msg) {
            socket.emit("send-message", msg);
            appendMessage("Bạn", msg, "my-msg");
            input.value = "";
        }
    });

    // --- MUSIC PLAYER ---
    let player;
    window.onYouTubeIframeAPIReady = function() { // Global func for YT API
        player = new YT.Player('yt-player', {
            height: '0', width: '0',
            videoId: 'rHKCWKZA6RI',
            playerVars: { 'autoplay': 0, 'controls': 0, 'loop': 1 }
        });
    };
    
    let isPlaying = false;
    document.getElementById('play-pause').addEventListener('click', function() {
        if(!player) return;
        if(isPlaying) {
            player.pauseVideo();
            this.innerHTML = '<i class="fas fa-play"></i>';
        } else {
            player.playVideo();
            this.innerHTML = '<i class="fas fa-pause"></i>';
        }
        isPlaying = !isPlaying;
    });

    // --- WHITEBOARD SETUP ---
    setupWhiteboard(socket);
}

// --- HELPER FUNCTIONS ---
function connectToNewUser(userId, stream, userName, peer, peers) {
    const call = peer.call(userId, stream);
    const video = document.createElement("video");
    call.on("stream", userVideoStream => {
        addVideoStream(video, userVideoStream, userName);
    });
    call.on("close", () => video.parentElement.remove());
    peers[userId] = call;
}

function addVideoStream(video, stream, name) {
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", () => video.play());
    const videoCard = document.createElement("div");
    videoCard.className = "video-card";
    const nameTag = document.createElement("span");
    nameTag.innerText = name;
    videoCard.append(video);
    videoCard.append(nameTag);
    document.getElementById("video-grid").append(videoCard);
}

function appendMessage(user, text, type) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message");
    if (type === "my-msg") msgDiv.classList.add("my-msg");
    else if (type === "sys") { msgDiv.style.alignSelf = "center"; msgDiv.style.opacity = 0.7; }
    else msgDiv.classList.add("other-msg");
    msgDiv.innerHTML = `${text} <small>${user}</small>`;
    const container = document.getElementById("chat-messages");
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function setupWhiteboard(socket) {
    const canvas = document.getElementById("whiteboard");
    const ctx = canvas.getContext("2d");
    const tools = document.getElementById("draw-tools");
    let drawing = false;
    let current = { x: 0, y: 0 };

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    // Button Events
    document.getElementById('board-btn').addEventListener('click', function() {
        canvas.classList.toggle("hidden");
        tools.classList.toggle("hidden");
        this.classList.toggle("active-board");
    });
    document.getElementById('close-board-btn').addEventListener('click', () => {
        canvas.classList.add("hidden");
        tools.classList.add("hidden");
        document.getElementById('board-btn').classList.remove("active-board");
    });
    document.getElementById('clear-board-btn').addEventListener('click', () => {
        ctx.clearRect(0,0, canvas.width, canvas.height);
        socket.emit("clear-board");
    });

    // Drawing Logic
    const drawLine = (x0, y0, x1, y1, color, emit) => {
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.stroke(); ctx.closePath();
        if (!emit) return;
        socket.emit('drawing', { x0, y0, x1, y1, color });
    };

    const onMouseDown = (e) => {
        drawing = true;
        current.x = e.clientX || e.touches[0].clientX;
        current.y = e.clientY || e.touches[0].clientY;
    };
    const onMouseUp = (e) => {
        if (!drawing) return;
        drawing = false;
        drawLine(current.x, current.y, e.clientX || e.changedTouches[0].clientX, e.clientY || e.changedTouches[0].clientY, document.getElementById("color-picker").value, true);
    };
    const onMouseMove = (e) => {
        if (!drawing) return;
        drawLine(current.x, current.y, e.clientX || e.touches[0].clientX, e.clientY || e.touches[0].clientY, document.getElementById("color-picker").value, true);
        current.x = e.clientX || e.touches[0].clientX;
        current.y = e.clientY || e.touches[0].clientY;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', throttle(onMouseMove, 10));
    canvas.addEventListener('touchstart', onMouseDown);
    canvas.addEventListener('touchend', onMouseUp);
    canvas.addEventListener('touchmove', throttle(onMouseMove, 10));

    socket.on('drawing', (data) => drawLine(data.x0, data.y0, data.x1, data.y1, data.color, false));
    socket.on('clear-board', () => ctx.clearRect(0,0, canvas.width, canvas.height));
    socket.on('load-canvas', (data) => data.forEach(l => drawLine(l.x0, l.y0, l.x1, l.y1, l.color, false)));
}

function throttle(callback, delay) {
    let previousCall = new Date().getTime();
    return function() {
        const time = new Date().getTime();
        if ((time - previousCall) >= delay) { previousCall = time; callback.apply(null, arguments); }
    };
}