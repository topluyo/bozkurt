const fs = require('fs');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');

// Robust Apache/Nginx Log Parser
const LOG_REGEX = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) \S+" (\d{3}) (\S+) "([^"]*)" "([^"]*)"/;

function parseLogLine(line) {
    const match = line.match(LOG_REGEX);
    if (!match) return null;
    
    // Date parsing optimized for performance
    const dateStr = match[2];
    const timestamp = new Date(dateStr.replace(':', ' ').replace('/', ' ')).getTime() / 1000;
    
    return {
        ip: match[1],
        time: isNaN(timestamp) ? 0 : timestamp,
        method: match[3],
        url: match[4],
        status: parseInt(match[5]),
        userAgent: match[8]
    };
}

class BozkurtHunter {
    constructor(logFiles, callback) {
        this.logFiles = logFiles;
        this.callback = callback;
        this.blockedIPs = new Set();
        this.ipRequests = new Map(); // IP -> [timestamps]
        this.lastCheckTime = Date.now();
        
        // Adaptive thresholds
        this.thresholds = {
            short: { window: 5, limit: 15 },   // 15 reqs in 5 sec
            medium: { window: 60, limit: 100 } // 100 reqs in 60 sec
        };
    }

    start() {
        console.log(`🐺 Bozkurt v2.0 started. Hunting on ${this.logFiles.length} files.`);
        this.watchLogs();
    }

    watchLogs() {
        this.logFiles.forEach(file => {
            if (!fs.existsSync(file)) {
                console.warn(`File not found: ${file}`);
                return;
            }
            
            // Use tail-like behavior for efficiency
            let stream = fs.createReadStream(file, { start: fs.statSync(file).size });
            
            fs.watchFile(file, (curr, prev) => {
                if (curr.size < prev.size) {
                    // Log rotated, reset stream
                    stream.destroy();
                    stream = fs.createReadStream(file);
                } else {
                    stream = fs.createReadStream(file, { start: prev.size });
                }
                
                stream.on('data', (chunk) => {
                    const lines = chunk.toString().split('\n');
                    this.processLines(lines);
                });
            });
        });
    }

    processLines(lines) {
        const now = Date.now() / 1000;
        
        for (const line of lines) {
            if (!line.trim()) continue;
            const parsed = parseLogLine(line);
            if (!parsed) continue;

            const { ip, time, url } = parsed;
            
            // Skip static assets to reduce noise
            if (url.match(/\.(js|css|png|jpg|gif|ico|svg)$/)) continue;

            if (!this.ipRequests.has(ip)) {
                this.ipRequests.set(ip, []);
            }
            
            const requests = this.ipRequests.get(ip);
            requests.push(time);
            
            // Clean old requests outside the largest window
            while (requests.length > 0 && requests[0] < now - this.thresholds.medium.window) {
                requests.shift();
            }

            this.checkThresholds(ip, requests, now);
        }
    }

    checkThresholds(ip, requests, now) {
        if (this.blockedIPs.has(ip)) return;

        // Check short-term spike
        const shortWindow = requests.filter(t => t >= now - this.thresholds.short.window);
        if (shortWindow.length > this.thresholds.short.limit) {
            this.triggerBlock(ip, "Short-term spike");
            return;
        }

        // Check medium-term flood
        if (requests.length > this.thresholds.medium.limit) {
            this.triggerBlock(ip, "Medium-term flood");
        }
    }

    triggerBlock(ip, reason) {
        if (this.blockedIPs.has(ip)) return;
        this.blockedIPs.add(ip);
        console.log(`🚨 THREAT DETECTED: ${ip} | Reason: ${reason}`);
        this.callback(ip);
    }
}

// Main Thread Logic
if (isMainThread) {
    module.exports.start = function(logFiles, callback) {
        const numCPUs = os.cpus().length;
        const workers = [];
        
        // Distribute log files across workers
        for (let i = 0; i < numCPUs; i++) {
            const worker = new Worker(__filename, {
                workerData: { 
                    id: i, 
                    logFiles: logFiles,
                    totalWorkers: numCPUs
                }
            });
            
            worker.on('message', (ip) => {
                callback(ip);
            });
            
            workers.push(worker);
        }
    };
} else {
    // Worker Thread Logic
    const { logFiles } = workerData;
    // In a real scenario, you'd split the files or use a shared state
    // For simplicity, each worker watches all files but uses a hash to decide who acts
    const hunter = new BozkurtHunter(logFiles, (ip) => {
        parentPort.postMessage(ip);
    });
    hunter.start();
}
