const fs = require('fs');
const readline = require('readline');



let startLines = {}



function UnixTime(str) {
    // Define the regex pattern to extract components
    const regex = /(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([\+\-]\d{4})/;
    
    // Apply regex to extract components
    const match = str.match(regex);
  
    if (match) {
      // Extract the components from the regex match
      const day = match[1];
      const month = match[2];
      const year = match[3];
      const hours = match[4];
      const minutes = match[5];
      const seconds = match[6];
      const timezone = match[7];
  
      // Create a month-to-number mapping
      const months = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
      };
  
      // Create a Date object using UTC to ignore the local timezone effect
      const date = new Date(Date.UTC(
        year, 
        months[month], 
        day, 
        hours, 
        minutes, 
        seconds
      ));
  
      // Return Unix timestamp in seconds
      return Math.floor(date.getTime() / 1000);  // Convert milliseconds to seconds
    } else {
      //throw new Error('Invalid date format');
    }
}


function log(str) {
    //write log.txt file
    fs.appendFile('./blocked.log', str,()=>{});
}

  
function parse(logRow) {
    const logPattern = /(?<ip>\S+) \S+ \S+ \[(?<timestamp>[^\]]+)\] "(?<method>\S+) (?<url>\S+) (?<protocol>\S+)" (?<status_code>\d+) (?<bytes_sent>\S+) "(?<referrer>[^"]*)" "(?<user_agent>[^"]*)"/;
    const match = logRow.match(logPattern);
    if(match){
        const logData = match.groups;
        const date = new Date(logData.timestamp);
        const unixTimestamp = date.getTime() / 1000; // Convert to seconds
        // 05/Feb/2025:12:19:57 +0300
        // use with regexp
        let unixTime = UnixTime(logData.timestamp)

        return {
            ip:logData.ip,
            referrer:logData.referrer,
            url: logData.url,
            time: unixTime
        }
    }
    return null;
}





function linesAll(logFilePath, startLine, period, removePeriod ,callback) {
    return new Promise((res,rej)=>{
        list = []
        const logStream = fs.createReadStream(logFilePath);
        const rl = readline.createInterface({ input: logStream});
        let index=0;
        rl.on('line', (line) => {
            index++;
            if(startLines-period<index) return;
            const parsed = parse(line);
            if (parsed) {
                list.push(parsed)
            }
            if(list.length==period){
                callback(list)
                startLines[logFilePath] = index
                list.splice(0,removePeriod)
            }
        });
        rl.on('close', () => {
            res()
        });
    })
}



function linesLast(path,startLine,  period, removePeriod, callback) {
    return new Promise((res,rej)=>{
        let list = [];
        const stream = fs.createReadStream(path, { encoding: "utf-8" });
        const rl = readline.createInterface({
            input: stream,
            crlfDelay: Infinity,
        });
        rl.on("line", (line) => {
            const parsed = parse(line);
            if (parsed) {
                list.push(parsed)
            }
            if (list.length == period) {
                callback(list)
                res()
                rl.close();
            }
        });
        rl.on("close", () => {
            callback(list)
            res()
        });
    })
}






const filter = function (ips, second, callback) {
    // Sort by time (assuming ips is an array of request objects)
    ips.sort((a, b) => a.time - b.time);
    
    let detected = {};
    let datas = {};
    let flagged = [];

    for (let i = 0; i < ips.length; i++) {
        let ip = ips[i].ip;
        let time = ips[i].time;

        if (!detected[ip]){
            detected[ip] = [];
            datas[ip]    = [];
        }
        detected[ip].push(time);
        datas[ip].push(ips[i])

        // Remove outdated requests beyond the time window
        detected[ip] = detected[ip].filter(t => t >= time - second);
        datas[ip] = datas[ip].filter(t => t.time >= time - second);
        
        callback(Object.values(datas[ip]),flagged)
        
    }
    
    return flagged;
}




function listen(path,callback){
    let stop = false;
    fs.watchFile(path, (curr, prev) => {
        if(stop) return
        stop = true
        linesLast(path, 1000, (lines) => {
            stop = false
            find(lines.map(e=>parse(e)),callback)
        })
    });
}


let index=0;
function find(list,callback){
    let founded = new Set();

    var filtered = filter(list, 5, function(datas, flagged){
        let f = datas.filter(e=>e.url=="/" )
        if(f.length>10){
            flagged.push(f)
        }
    })
    filtered.map(addr=>{  founded.add(addr[0].ip) })

    var filtered = filter(list, 60, function(datas, flagged){
        let f = datas.filter(e=>e.url=="/" )
        if(f.length>120){
            flagged.push(f)
        }
    })

    filtered.map(addr=>{  founded.add(addr[0].ip) })
    
    callback(founded)
}




let ips = new Set();
let logs = [];
let logIndex = 0;
let method = linesAll;
function next(callback){
    logIndex = logIndex % logs.length;
    let file = logs[logIndex];
    method(file, startLines[file], 2000, 200, (data)=>{
        find(data, (_ips)=>{
            Array.from(_ips).map(ip=>{
                if(ips.has(ip)) return;
                ips.add(ip)
                log(ip+"\n");
                callback(ip)
            })
        })
    }).then(()=>{
        logIndex++;
        setTimeout(e=>{
            next(callback);
        },2000)
    })
}


function start(_logs=[],callback){
    logs = _logs;
    logs.map(e=>{
        startLines[e] = 0;
    })
    next(callback)
}




exports.start = start;


//^ USAGE
/*

start(["start.log","test.log"],function(ip){
    console.log(ip, "adresi blocklandı!")
})

*/

