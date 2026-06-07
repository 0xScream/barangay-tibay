const http = require('http');
const { exec } = require('child_process');

const PORT = process.env.INTERNAL_API_PORT || 8181;

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Root endpoint - API info
    if (url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Internal Barangay Admin API v1.2\nEndpoints: /env, /exec');
        return;
    }

    // Environment dump
    if (url.pathname === '/env') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        const envDump = `
=== Internal API Environment ===

System Information:
- Node Version: ${process.version}
- Platform: ${process.platform}
- Architecture: ${process.arch}
- PID: ${process.pid}

Environment Variables:
- INTERNAL_API_PORT: ${process.env.INTERNAL_API_PORT || '8181'}
- INTERNAL_API_PATH: /exec
- SESSION_SECRET: ${process.env.SESSION_SECRET || '[REDACTED]'}
- DEBUG: ${process.env.DEBUG || 'false'}

Note: /exec endpoint accepts 'cmd' query parameter for system commands
Example: /exec?cmd=whoami
`;
        res.end(envDump);
        return;
    }

    // Command execution - RCE endpoint
    if (url.pathname === '/exec') {
        const cmd = url.searchParams.get('cmd');
        
        if (!cmd) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing cmd parameter\nUsage: /exec?cmd=<command>');
            return;
        }

        exec(cmd, (error, stdout, stderr) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            
            let output = '=== Command Execution Result ===\n\n';
            output += `Command: ${cmd}\n\n`;
            
            if (error) {
                output += `Error: ${error.message}\n`;
                output += `Stderr: ${stderr}\n`;
            } else {
                output += `Output:\n${stdout}\n`;
                if (stderr) output += `\nStderr:\n${stderr}\n`;
            }
            
            res.end(output);
        });
        return;
    }

    // 404 for unknown endpoints
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`[Internal API] Running on http://127.0.0.1:${PORT}`);
    console.log('[Internal API] ONLY accessible from localhost');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Internal API] Shutting down...');
    server.close(() => process.exit(0));
});

module.exports = server;
