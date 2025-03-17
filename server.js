const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname)));

// Store connected clients
const clients = new Set();

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle WebSocket connections
wss.on("connection", (ws) => {
  clients.add(ws);
  console.log("New client connected");

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'system',
    text: 'Connected to server. Waiting for another user...'
  }));

  // Try to pair clients
  if (clients.size >= 2) {
    const clientArray = Array.from(clients);
    const client1 = clientArray[clientArray.length - 2];
    const client2 = clientArray[clientArray.length - 1];

    // Notify both clients they are connected
    client1.send(JSON.stringify({
      type: 'system',
      text: 'Connected to a stranger!'
    }));
    client2.send(JSON.stringify({
      type: 'system',
      text: 'Connected to a stranger!'
    }));

    // Create WebRTC connection
    client1.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'offer') {
          client2.send(JSON.stringify({
            type: 'offer',
            offer: data.offer
          }));
        } else if (data.type === 'candidate') {
          client2.send(JSON.stringify({
            type: 'candidate',
            candidate: data.candidate
          }));
        } else if (data.type === 'chat') {
          client2.send(JSON.stringify({
            type: 'chat',
            text: data.text
          }));
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    client2.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'answer') {
          client1.send(JSON.stringify({
            type: 'answer',
            answer: data.answer
          }));
        } else if (data.type === 'candidate') {
          client1.send(JSON.stringify({
            type: 'candidate',
            candidate: data.candidate
          }));
        } else if (data.type === 'chat') {
          client1.send(JSON.stringify({
            type: 'chat',
            text: data.text
          }));
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });
  }

  // Handle client disconnection
  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected');

    // Notify remaining clients
    clients.forEach(client => {
      client.send(JSON.stringify({
        type: 'system',
        text: 'The other user has disconnected.'
      }));
    });
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});