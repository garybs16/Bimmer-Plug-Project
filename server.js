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
  console.log(`🚀 Chat server running on http://localhost:${PORT}`);
});



//extra
let botReplyTimer = null;

chatForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  const msg = {
    from: 'customer',
    text
  };
  socket.emit('chat message', msg);
  userInput.value = '';

  typingIndicator.classList.remove('hidden');

  if (botReplyTimer) clearTimeout(botReplyTimer);
  botReplyTimer = setTimeout(() => {
    typingIndicator.classList.add('hidden');
    const botReply = getBotReply(text);
    if (botReply) {
      const botMsg = {
        from: 'staff',
        text: botReply,
        timestamp: new Date().toISOString()
      };
      renderMessage(botMsg);
      saveMessage(botMsg);
    }
  }, 2000);
});

function getBotReply(userText) {
  const text = userText.toLowerCase();
  if (text.includes('return')) return "You can return products within 30 days. Please visit our return policy page.";
  if (text.includes('order')) return "Can you please provide your order number so we can assist?";
  if (text.includes('hello') || text.includes('hi')) return "Hi there! How can we help you today?";
  return "Thanks for your message! A staff member will respond shortly.";
}
