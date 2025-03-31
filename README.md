⚠️ Important Note on Hosting
This project includes a real-time chat feature using Socket.IO, which requires a backend server. GitHub Pages only supports static files (HTML, CSS, JavaScript), and does not support hosting server-side code like Node.js or WebSocket servers.

To fully run this application, you’ll need to:

Host the front-end (this repo) on GitHub Pages or any static site host.

Deploy the backend server (Socket.IO) on a cloud platform such as Render, Railway, Glitch, or Vercel.

After deploying your backend, make sure to update the socket.io connection URL in the front-end code from http://localhost:3000 to your backend's public URL.
