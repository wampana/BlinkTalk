const express = require("express");
const http = require("http");
const https = require("https");
const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");

const app = express();
let server;

// Check if SSL certificates exist
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'private.key')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl', 'certificate.crt'))
};

try {
    // Try to create HTTPS server
    server = https.createServer(sslOptions, app);
} catch (error) {
    console.log('SSL certificates not found, falling back to HTTP');
    server = http.createServer(app);
}

const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname)));

// Store connected clients
const clients = new Set();

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle WebSocket connections
wss.on("connection", (ws, req) => {
    console.log(`New client connected from ${req.socket.remoteAddress}`);
    clients.add(ws);

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
                console.error('Error handling message from client1:', error);
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
                console.error('Error handling message from client2:', error);
            }
        });
    }

    // Handle client disconnection
    ws.on('close', () => {
        clients.delete(ws);
        console.log(`Client disconnected from ${req.socket.remoteAddress}`);

        // Notify remaining clients
        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'system',
                    text: 'The other user has disconnected.'
                }));
            }
        });
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

// Error handling for the server
server.on('error', (error) => {
    console.error('Server error:', error);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`WebSocket server is ready for connections`);
});