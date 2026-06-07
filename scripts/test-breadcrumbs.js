#!/usr/bin/env node
/**
 * Phase 6 - Breadcrumb Discovery Test
 * Validates all intentional reconnaissance hints are accessible
 */

const http = require('http');

console.log('=== Phase 6: Breadcrumb Discovery Test ===\n');

function request(path) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:3000${path}`, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body }));
        }).on('error', reject);
    });
}

async function testBreadcrumbs() {
    console.log('Test 1: robots.txt accessibility...');
    try {
        const robots = await request('/robots.txt');
        if (robots.statusCode === 200) {
            console.log('✓ robots.txt accessible');
            
            if (robots.body.includes('/admin')) {
                console.log('  ✓ Contains /admin hint');
            }
            if (robots.body.includes('/api/internal')) {
                console.log('  ✓ Contains /api/internal hint');
            }
        } else {
            console.log('✗ robots.txt not accessible');
        }
    } catch (e) {
        console.log('✗ Error fetching robots.txt:', e.message);
    }

    console.log('\nTest 2: CHANGELOG.md accessibility...');
    try {
        const changelog = await request('/CHANGELOG.md');
        if (changelog.statusCode === 200) {
            console.log('✓ CHANGELOG.md accessible');
            
            if (changelog.body.includes('URL template fetching')) {
                console.log('  ✓ Mentions URL template fetching feature');
            }
            if (changelog.body.includes('Blocklist includes')) {
                console.log('  ✓ Reveals SSRF filter blocklist');
            }
            if (changelog.body.includes('port 8181')) {
                console.log('  ✓ Discloses internal API port');
            }
            if (changelog.body.includes('localhost only')) {
                console.log('  ✓ Confirms internal API is localhost-only');
            }
        } else {
            console.log('✗ CHANGELOG.md not accessible');
        }
    } catch (e) {
        console.log('✗ Error fetching CHANGELOG.md:', e.message);
    }

    console.log('\nTest 3: profile.js TODO comment...');
    try {
        const profileJs = await request('/js/profile.js');
        if (profileJs.statusCode === 200) {
            console.log('✓ profile.js accessible');
            
            if (profileJs.body.includes('TODO')) {
                console.log('  ✓ Contains TODO comment');
            }
            if (profileJs.body.includes('ref token')) {
                console.log('  ✓ Mentions ref token validation');
            }
        } else {
            console.log('✗ profile.js not accessible');
        }
    } catch (e) {
        console.log('✗ Error fetching profile.js:', e.message);
    }

    console.log('\nTest 4: Admin fetch-report HTML comments...');
    console.log('  Note: Requires admin authentication to view');
    console.log('  HTML comments confirm:');
    console.log('    - Feature accepts any valid http:// URL');
    console.log('    - IP filtering blocks localhost access');

    console.log('\n=== Breadcrumb Summary ===\n');
    
    console.log('Public Reconnaissance Surface:');
    console.log('1. /robots.txt → reveals /admin and /api/internal paths');
    console.log('2. /CHANGELOG.md → reveals:');
    console.log('   - URL template fetching feature existence');
    console.log('   - SSRF filter implementation (blocklist values)');
    console.log('   - Internal API on port 8181 (localhost-only)');
    console.log('3. /js/profile.js → TODO comment about ref token validation');
    console.log('4. HTML comments in fetch-report page → feature details');
    
    console.log('\nReconnaissance Flow:');
    console.log('• Discover /robots.txt → find /admin path');
    console.log('• Read /CHANGELOG.md → learn about SSRF feature + port 8181');
    console.log('• Inspect /js/profile.js → ref token hint for IDOR');
    console.log('• View page source on fetch-report → confirm URL acceptance');
}

testBreadcrumbs().catch(err => {
    console.error('Error:', err.message);
    console.log('\nNote: Server must be running on localhost:3000');
    console.log('Start with: npm start');
});
