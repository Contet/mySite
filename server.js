const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// In-memory chat history (resets on server restart).
const messages = [];

app.use(express.static("public"));
app.use(express.json());

app.get("/api/messages", (req, res) => {
  res.json(messages);
});

io.on("connection", (socket) => {
  socket.emit("chat:init", messages);

  socket.on("chat:message", (payload) => {
    const role = payload?.role;
    const text = payload?.text;

    if (!["person1", "person2"].includes(role)) return;
    if (typeof text !== "string") return;

    const cleanedText = text.trim();
    if (!cleanedText) return;
    if (cleanedText.length > 1000) return;

    const message = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role,
      text: cleanedText,
      createdAt: new Date().toISOString()
    };

    messages.push(message);
    io.emit("chat:new-message", message);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
