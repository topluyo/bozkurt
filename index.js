const http = require('http');
const bozkurt = require("./bozkurt.js");
const block = require("./block.js");
const fs = require('fs');

let messageQueue = [];

// Start the Hunt
bozkurt.start([
    "/var/log/apache2/access.log", // Adjust to your actual log path
    "/var/log/nginx/access.log"
], (ip) => {
    console.log(`⚡ Blocking ${ip}...`);
    block.blockIP([ip], (res) => {
        messageQueue.push(res);
    });
});

http.createServer((req, res) => {
    if (req.url === '/events') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        const interval = setInterval(() => {
            if (messageQueue.length > 0) {
                res.write(`data: ${messageQueue.shift()}\n\n`);
            }
        }, 100);

        req.on('close', () => clearInterval(interval));
    } 
    
    if (req.url === '/') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        const index = fs.readFileSync('public/index.html');
        res.end(index);
    }

    // Serve static files
    const filePath = path.join(__dirname, 'public', path.normalize(req.url).replace(/^(\.\.[\/\\])+/, ''));
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const file = fs.readFileSync(filePath);
        let contentType = 'application/octet-stream';
        const extname = path.extname(filePath).toLowerCase();
        const types = {
            '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
            '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg'
        };
        if (types[extname]) contentType = types[extname];
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(file);
    }
}).listen(3000, () => console.log('🐺 Bozkurt Command Center running on http://localhost:3000'));
