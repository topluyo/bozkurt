const https = require("https");
const fs = require("fs");
const path = require("path");
const { cpanel_user, cpanel_token, cpanel_host } = require("./.config.json");

const BLOCK_LOG = "./blocked_ips.log";

function blockIP(addresses, callback) {
    addresses.forEach(ip => {
        // Log locally first for speed
        fs.appendFile(BLOCK_LOG, `${new Date().toISOString()} - BLOCKED: ${ip}\n`, () => {});

        const options = {
            hostname: cpanel_host,
            port: 2083,
            path: `/execute/BlockIP/add_ip?ip=${ip}`,
            method: "GET",
            headers: {
                "Authorization": `cpanel ${cpanel_user}:${cpanel_token}`,
                "Accept": "application/json"
            },
            rejectUnauthorized: false
        };

        const req = https.request(options, res => {
            let data = "";
            res.on("data", chunk => { data += chunk; });
            res.on("end", () => {
                try {
                    const response = JSON.parse(data);
                    callback(`${ip}\t${response.status ? "✅ Blocked" : "❌ Failed"}`);
                } catch (e) {
                    callback(`${ip}\t❌ Parse Error`);
                }
            });
        });

        req.on("error", error => {
            callback(`Error blocking ${ip}: ${error.message}`);
        });
        req.end();
    });
}

exports.blockIP = blockIP;
