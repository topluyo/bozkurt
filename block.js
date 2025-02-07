const https = require("https");
const fs = require("fs");
const path = require("path");

// Load cPanel credentials
const { cpanel_user, cpanel_token, cpanel_host } = require("./.config.json");

function blockIP(addresses,callback) {
    addresses.forEach(ip => {
        const options = {
            hostname: cpanel_host,
            port: 2083,
            path: `/execute/BlockIP/add_ip?ip=${ip}`,
            method: "GET",
            headers: {
                "Authorization": `cpanel ${cpanel_user}:${cpanel_token}`,
                "Accept": "application/json"
            },
            rejectUnauthorized: false // Bypassing SSL verification (not recommended for production)
        };

        const req = https.request(options, res => {
            let data = "";
            res.on("data", chunk => { data += chunk; });
            res.on("end", () => {
                const response = JSON.parse(data);
                callback(`${ip}\t${response.status ? "✅" : ""}`);
            });
        });

        req.on("error", error => {
            callback(`Error blocking ${ip}:`, error.message);
        });

        req.end();
    });
}

/*
const filePath = path.join(__dirname, "Block.txt");
const source = fs.readFileSync(filePath, "utf8").split(" ");
blockIP(source);
*/

exports.blockIP = blockIP;