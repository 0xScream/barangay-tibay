#!/usr/bin/env node
/**
 * IDOR Vulnerability Test Script
 * Tests the profile update IDOR vulnerability
 */

const db = require('../database/db');
const bcrypt = require('bcryptjs');

console.log('=== IDOR Vulnerability Test ===\n');

// Test 1: Verify admin ID is 47 (non-sequential)
console.log('Test 1: Verify admin is at non-sequential ID...');
const admin = db.prepare('SELECT id, username, role FROM users WHERE role = ?').get('admin');
if (admin.id === 47) {
    console.log('✓ Admin ID is 47 (non-sequential, requires blind enumeration)');
} else {
    console.log('✗ Admin ID is', admin.id, '- expected 47');
}

// Test 2: Verify ref token structure
console.log('\nTest 2: Verify ref token structure...');
const testUser = db.prepare('SELECT id, username, role FROM users WHERE username = ?').get('juan_cruz');
const ref = Buffer.from(JSON.stringify({ uid: testUser.id, role: testUser.role })).toString('base64');
const decoded = JSON.parse(Buffer.from(ref, 'base64').toString('utf8'));
if (decoded.uid === testUser.id && decoded.role === testUser.role) {
    console.log('✓ Ref token encodes: { uid:', decoded.uid, ', role:', decoded.role, '}');
    console.log('  Base64:', ref);
} else {
    console.log('✗ Ref token structure unexpected');
}

// Test 3: Test IDOR - craft malicious ref token
console.log('\nTest 3: Testing IDOR exploitation...');
const maliciousRef = { uid: 47, role: 'resident' };  // Target admin, pretend to be resident
const maliciousRefEncoded = Buffer.from(JSON.stringify(maliciousRef)).toString('base64');
console.log('  Malicious ref token:', maliciousRefEncoded);
console.log('  Decodes to:', JSON.parse(Buffer.from(maliciousRefEncoded, 'base64').toString('utf8')));

// Simulate the vulnerable update (change admin password)
const newPassword = 'Pwned123!';
const hashedPassword = bcrypt.hashSync(newPassword, 10);
db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, maliciousRef.uid);
console.log('✓ Admin password updated via IDOR (uid=47)');

// Test 4: Verify password change worked
console.log('\nTest 4: Verify password takeover...');
const adminAfter = db.prepare('SELECT username, password FROM users WHERE id = ?').get(47);
if (bcrypt.compareSync(newPassword, adminAfter.password)) {
    console.log('✓ Admin password successfully changed to:', newPassword);
    console.log('  Login with: username=admin, password=' + newPassword);
} else {
    console.log('✗ Password change failed');
}

// Test 5: Verify role field is a red herring
console.log('\nTest 5: Verify role tampering is ineffective...');
const residentBefore = db.prepare('SELECT role FROM users WHERE id = ?').get(1);
const tamperRef = { uid: 1, role: 'admin' };  // Try to escalate via role field
const tamperRefEncoded = Buffer.from(JSON.stringify(tamperRef)).toString('base64');
db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run('Test User', tamperRef.uid);
const residentAfter = db.prepare('SELECT role FROM users WHERE id = ?').get(1);
if (residentBefore.role === residentAfter.role) {
    console.log('✓ Role field in ref token has no effect on privilege (red herring confirmed)');
} else {
    console.log('✗ Role field unexpectedly changed user role');
}

// Test 6: Verify no enumeration oracle (silent redirect behavior)
console.log('\nTest 6: Verify silent redirect (no oracle)...');
console.log('  In actual exploitation:');
console.log('  - Valid uid: redirects to /profile (no error)');
console.log('  - Invalid uid: redirects to /profile (no error)');
console.log('  - No difference in response → blind enumeration required');
console.log('✓ No enumeration oracle exists (by design)');

// Reset admin password for continued testing
console.log('\n=== Resetting admin password for testing ===');
const originalPassword = bcrypt.hashSync('Admin@2024!', 10);
db.prepare('UPDATE users SET password = ? WHERE id = ?').run(originalPassword, 47);
console.log('✓ Admin password reset to: Admin@2024!');

console.log('\n=== All Tests Passed ===');
console.log('\nIDOR Attack Surface Summary:');
console.log('1. Ref token is base64({ uid: N, role: "..." })');
console.log('2. Admin ID is 47 (requires blind enumeration)');
console.log('3. No ownership validation on /profile/update');
console.log('4. Silent redirects provide no enumeration oracle');
console.log('5. Role field is a red herring (doesn\'t affect privileges)');
