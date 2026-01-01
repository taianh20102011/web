const socket = io("/");
const videoGrid = document.getElementById("video-grid");
const myVideo = document.createElement("video");
myVideo.muted = true;

const peer = new Peer(undefined, { host: "0.peerjs.com", port: 443, secure: true });

let myStream;
const peers = {};

// 1. Kết nối Camera & Mic
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    myStream = stream;
    addVideoStream(myVideo, stream, "BẠN");

    peer.on("call", call => {
        call.answer(stream);
        const video = document.createElement("video");
        call.on("stream", userStream => addVideoStream(video, userStream, "KHÁCH"));
    });

    socket.on("user-connected", userId => {
        setTimeout(() => connectToNewUser(userId, stream), 1000);
    });
});

function connectToNewUser(userId, stream) {
    const call = peer.call(userId, stream);
    const video = document.createElement("video");
    call.on("stream", userStream => addVideoStream(video, userStream, "KHÁCH"));
    call.on("close", () => video.remove());
    peers[userId] = call;
}

function addVideoStream(video, stream, label) {
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", () => video.play());
    const wrapper = document.createElement('div');
    wrapper.className = "relative h-40 lg:h-64 glass rounded-2xl overflow-hidden shadow-xl";
    wrapper.innerHTML = `<div class="absolute top-2 left-2 z-10 text-[9px] glass px-2 py-1 rounded-full text-indigo-400 font-bold">${label}</div>`;
    wrapper.append(video);
    videoGrid.append(wrapper);
}

// 2. Whiteboard
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
let drawing = false;

function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 500);

canvas.addEventListener('mousedown', () => drawing = true);
canvas.addEventListener('mouseup', () => { drawing = false; ctx.beginPath(); });
canvas.addEventListener('mousemove', e => {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    socket.emit('draw', { x, y, room: window.location.pathname.substring(1) });
    drawLocal(x, y);
});

function drawLocal(x, y) {
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#6366f1';
    ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
}
socket.on('draw', data => drawLocal(data.x, data.y));

// 3. UI/Tabs/Music
function toggleTab(tab) {
    const isChat = tab === 'chat';
    document.getElementById('chat-section').classList.toggle('hidden', !isChat);
    document.getElementById('board-section').classList.toggle('hidden', isChat);
    document.getElementById('btn-chat').style.background = isChat ? "rgba(255,255,255,0.1)" : "none";
    document.getElementById('btn-board').style.background = isChat ? "none" : "rgba(255,255,255,0.1)";
    if(!isChat) resizeCanvas();
}

let musicOn = true;
function toggleMusic() {
    const player = document.getElementById('lofi-player');
    musicOn = !musicOn;
    player.src = musicOn ? "https://www.youtube.com/embed/rHKCWKZA6RI?autoplay=1&mute=0" : "";
    document.getElementById('music-btn').innerText = musicOn ? "🎵" : "🔇";
}

// Peer & Socket Init
peer.on("open", id => {
    const roomId = window.location.pathname.substring(1);
    socket.emit("join-room", roomId, id);
    document.getElementById('room-id').innerText = `ROOM ID: ${roomId}`;
});

// Chat form
const chatForm = document.getElementById('chat-form');
chatForm.addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    if(input.value) { socket.emit('message', input.value); input.value = ''; }
});

socket.on('createMessage', (msg, userId) => {
    const div = document.createElement('div');
    div.className = "bg-white/5 p-3 rounded-xl border border-white/5";
    div.innerHTML = `<span class="text-[9px] text-indigo-400 block mb-1">USER_${userId.substring(0,4)}</span>${msg}`;
    const container = document.getElementById('chat-messages');
    container.append(div);
    container.scrollTop = container.scrollHeight;
});
// Khi gửi tin nhắn
chatForm.addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    if(input.value && window.currentUser) { 
        socket.emit('message', {
            text: input.value,
            name: window.currentUser.displayName,
            photo: window.currentUser.photoURL
        }); 
        input.value = ''; 
    }
});

// Khi nhận tin nhắn
socket.on('createMessage', (data, userId) => {
    const div = document.createElement('div');
    div.className = "flex gap-3 mb-4";
    div.innerHTML = `
        <img src="${data.photo}" class="w-8 h-8 rounded-full border border-white/10">
        <div class="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5">
            <span class="text-[10px] text-indigo-400 block font-bold uppercase">${data.name}</span>
            <p class="text-white/80 text-sm">${data.text}</p>
        </div>
    `;
    const container = document.getElementById('chat-messages');
    container.append(div);
    container.scrollTop = container.scrollHeight;
});