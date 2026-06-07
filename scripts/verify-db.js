const db = require('../database/db');

console.log('\n=== DATABASE VERIFICATION ===\n');

// Check users
console.log('USERS:');
const users = db.prepare('SELECT id, username, role, full_name FROM users ORDER BY id').all();
users.forEach(user => {
    console.log(`  ID ${user.id}: ${user.username} (${user.role}) - ${user.full_name}`);
});

// Check reports
console.log('\nREPORTS:');
const reports = db.prepare('SELECT id, user_id, title, category, status FROM reports').all();
console.log(`  Total: ${reports.length} reports`);
reports.forEach(report => {
    console.log(`  ID ${report.id}: [${report.category}] ${report.title} (user_id: ${report.user_id}, status: ${report.status})`);
});

// Check admin logs
console.log('\nADMIN LOGS:');
const logs = db.prepare('SELECT * FROM admin_logs').all();
console.log(`  Total: ${logs.length} log entries`);

console.log('\n=== VERIFICATION COMPLETE ===\n');

db.close();
