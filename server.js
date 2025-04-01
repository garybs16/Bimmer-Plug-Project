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

app.use(cors());
app.use(express.static(path.join(__dirname))); // Serve static files from current dir

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

// Email settings
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
    return `[${msg.from.toUpperCase()}] ${msg.text} (${new Date(msg.timestamp).toLocaleString()})`;
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

// Socket.IO Events
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  socket.emit('chat history', chatHistory);

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

  socket.on('typing', (data) => {
    socket.broadcast.emit('typing', data);
  });

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Chat server running on http://localhost:${PORT}`);
});
