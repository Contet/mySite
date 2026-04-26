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

const roleNames = {
  person1: "Человек 1",
  person2: "Человек 2"
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
    messagesEl.innerHTML = '<p class="meta-line">Пока нет сообщений.</p>';
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

function chooseRole(role) {
  currentRole = role;
  localStorage.setItem("chatRole", role);
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
});

renderView();
