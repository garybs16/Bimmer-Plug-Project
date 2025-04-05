require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname))); // Serve index.html, staff.html, etc.

// Allow frontend connections (local + deployed)
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5500', 'https://bimmerplug-work.onrender.com'],
    methods: ['GET', 'POST']
  }
});

// Load chat history from file
let chatHistory = [];
const historyFile = './chatHistory.json';
if (fs.existsSync(historyFile)) {
  try {
    chatHistory = JSON.parse(fs.readFileSync(historyFile));
  } catch (err) {
    console.error('⚠️ Failed to read chat history:', err);
    chatHistory = [];
  }
}

// Email setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function saveChatHistory() {
  try {
    fs.writeFileSync(historyFile, JSON.stringify(chatHistory, null, 2));
  } catch (err) {
    console.error('⚠️ Failed to save chat history:', err);
  }
}

function sendChatTranscript(messages) {
  const formatted = messages.map(msg => {
    const content = msg.text || msg.name || '[File]';
    return `[${msg.from.toUpperCase()}] ${content} (${new Date(msg.timestamp).toLocaleString()})`;
  }).join('\n');

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'support@bimmerplug.com',
    subject: 'Live Chat Ended - Transcript',
    text: `A user ended a live chat. Here's the transcript:\n\n${formatted}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('❌ Email error:', error);
    } else {
      console.log('✅ Email sent:', info.response);
    }
  });
}

// Socket.IO logic
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // Send chat history on connection
  socket.emit('chat history', chatHistory);

  // Handle new chat messages
  socket.on('chat message', (msg) => {
    const sanitizedText = (msg.text || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const message = {
      from: msg.from || 'unknown',
      text: sanitizedText,
      timestamp: new Date().toISOString()
    };
    chatHistory.push(message);
    saveChatHistory();
    io.emit('chat message', message);
  });

  // 🔥 Handle file attachments
  socket.on('chat file', (msg) => {
    const fileMessage = {
      from: msg.from || 'unknown',
      name: msg.name || 'attachment',
      type: msg.type || 'application/octet-stream',
      data: msg.data,
      timestamp: msg.timestamp || new Date().toISOString()
    };
    chatHistory.push(fileMessage);
    saveChatHistory();
    io.emit('chat file', fileMessage);
  });

  // Typing indicator
  socket.on('typing', (data) => {
    socket.broadcast.emit('typing', data);
  });

  // Chat end
  socket.on('end chat', () => {
    console.log('📩 Chat ended. Sending transcript...');
    sendChatTranscript(chatHistory);
    chatHistory = [];
    saveChatHistory();
    io.emit('chat ended');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Optional health check route
app.get('/ping', (req, res) => {
  res.send('pong');
});

// Optional fallback to index.html (useful for SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server (use Render-assigned PORT if available)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(🚀 Chat server running on http://localhost:${PORT});
});
