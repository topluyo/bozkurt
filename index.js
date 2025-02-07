const http = require('http')
const bozkurt = require("./bozkurt.js")
const block = require("./block.js")

const fs = require('fs');
const path = require('path');

let temp = []
let list = []
let message = []
bozkurt.start([
    "./test/botnet.log",
], (ip) => {
    list.push(ip)
    temp.push(ip)
    console.log("ip",ip)
    block.blockIP([ip], (res) => {
        console.log("block",res)
        message.push(res)
    })
})






http.createServer((req, res) => {
    if (req.url === '/events') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        let count = 0;
        const interval = setInterval(() => {
            if(message.length>0){
                res.write(`data: ${message.shift()}\n\n`);
            }
        }, 100);

        req.on('close', () => clearInterval(interval));
    } 
    
    if(req.url === '/'){
        res.writeHead(200, {'Content-Type': 'text/html'});
        const index = fs.readFileSync('public/index.html');
        res.end(index);
    }

    // if req in public folder return the file



    const filePath = path.join(__dirname, 'public', path.normalize(req.url).replace(/^(\.\.[\/\\])+/, ''));

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const file = fs.readFileSync(filePath);
        
        // Default content type (can be extended for specific types)
        let contentType = 'application/octet-stream';
        const extname = path.extname(filePath).toLowerCase();
        
        if (extname === '.html') {
            contentType = 'text/html';
        } else if (extname === '.css') {
            contentType = 'text/css';
        } else if (extname === '.js') {
            contentType = 'application/javascript';
        } else if (extname === '.json') {
            contentType = 'application/json';
        } else if (extname === '.png') {
            contentType = 'image/png';
        } else if (extname === '.jpg' || extname === '.jpeg') {
            contentType = 'image/jpeg';
        } else if (extname === '.gif') {
            contentType = 'image/gif';
        } else if (extname === '.svg') {
            contentType = 'image/svg+xml';
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(file);
    }

    

}).listen(3000, () => console.log('Server running on http://localhost:3000'));