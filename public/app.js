const socket = io();

const loginView = document.getElementById("loginView");
const chatView = document.getElementById("chatView");
const person1Btn = document.getElementById("person1Btn");
const person2Btn = document.getElementById("person2Btn");
const currentRoleLabel = document.getElementById("currentRoleLabel");
const switchRoleBtn = document.getElementById("switchRoleBtn");
const messagesEl = document.getElementById("messages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const incomingToast = document.getElementById("incomingToast");

let audioCtx = null;
let toastHideTimer = null;

const roleNames = {
  person1: "user1",
  person2: "user2"
};

let currentRole = localStorage.getItem("chatRole");
let messages = [];

function formatTime(isoString) {
  try {
    return new Date(isoString).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (_) {
    return "";
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMessages() {
  messagesEl.innerHTML = "";

  if (!messages.length) {
    messagesEl.innerHTML = '<p class="meta-line">Пока что нихуя нет.</p>';
    return;
  }

  for (const msg of messages) {
    const wrapper = document.createElement("article");
    wrapper.className = `message ${msg.role === "person2" ? "from-person2" : "from-person1"}`;
    wrapper.innerHTML = `
      <div class="message-bubble">${escapeHtml(msg.text)}</div>
      <div class="meta-line">${roleNames[msg.role] || "Пользователь"} • ${formatTime(msg.createdAt)}</div>
    `;
    messagesEl.appendChild(wrapper);
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderView() {
  if (!currentRole || !roleNames[currentRole]) {
    loginView.classList.remove("hidden");
    chatView.classList.add("hidden");
    return;
  }

  loginView.classList.add("hidden");
  chatView.classList.remove("hidden");
  currentRoleLabel.textContent = `Вы вошли как: ${roleNames[currentRole]}`;
  messageInput.focus();
}

function requestNotificationPermissionIfNeeded() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "default") return;
  Notification.requestPermission();
}

async function playIncomingMessageSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    await audioCtx.resume();

    const now = audioCtx.currentTime;
    const master = audioCtx.createGain();
    master.gain.value = 0.11;
    master.connect(audioCtx.destination);

    function tone(freq, start, dur) {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.connect(g);
      g.connect(master);
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(1, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start);
      osc.stop(start + dur);
    }

    tone(659.25, now, 0.09);
    tone(880, now + 0.07, 0.11);
  } catch (_) {
    /* автовоспроизведение может быть заблокировано до жеста пользователя */
  }
}

function showIncomingToast(fromLabel) {
  if (!incomingToast) return;
  incomingToast.textContent = `Новое сообщение от ${fromLabel}`;
  incomingToast.classList.remove("hidden");
  if (toastHideTimer) clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(() => {
    incomingToast.classList.add("hidden");
    toastHideTimer = null;
  }, 4000);
}

async function alertIncomingFromOther(message) {
  const fromLabel = roleNames[message.role] || "собеседник";
  await playIncomingMessageSound();

  if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
    try {
      const preview =
        typeof message.text === "string" && message.text.length > 120
          ? `${message.text.slice(0, 117)}…`
          : message.text || "";
      new Notification("massager", {
        body: `${fromLabel}: ${preview}`,
        silent: true,
        tag: "chat-incoming"
      });
    } catch (_) {}
    return;
  }

  if (!document.hidden) {
    showIncomingToast(fromLabel);
  }
}

function chooseRole(role) {
  currentRole = role;
  localStorage.setItem("chatRole", role);
  requestNotificationPermissionIfNeeded();
  renderView();
}

person1Btn.addEventListener("click", () => chooseRole("person1"));
person2Btn.addEventListener("click", () => chooseRole("person2"));

switchRoleBtn.addEventListener("click", () => {
  localStorage.removeItem("chatRole");
  currentRole = null;
  renderView();
});

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!currentRole) return;

  const text = messageInput.value.trim();
  if (!text) return;

  socket.emit("chat:message", {
    role: currentRole,
    text
  });

  messageInput.value = "";
  messageInput.focus();
});

socket.on("chat:init", (initialMessages) => {
  messages = Array.isArray(initialMessages) ? initialMessages : [];
  renderMessages();
});

socket.on("chat:new-message", (message) => {
  messages.push(message);
  renderMessages();

  if (currentRole && message.role && message.role !== currentRole) {
    void alertIncomingFromOther(message);
  }
});

renderView();
