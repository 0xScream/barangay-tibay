const db = require('../database/db');
const bcrypt = require('bcryptjs');

console.log('[Seed] Starting database seeding...');

// Clear existing data
db.prepare('DELETE FROM reports').run();
db.prepare('DELETE FROM admin_logs').run();
db.prepare('DELETE FROM users').run();

// Reset autoincrement
db.prepare('DELETE FROM sqlite_sequence').run();

// Insert resident accounts first (IDs will be 1, 2, 3)
const residents = [
    { username: 'juan_cruz', password: 'password123', full_name: 'Juan dela Cruz', address: '123 Rizal St., Tibay' },
    { username: 'maria_santos', password: 'password123', full_name: 'Maria Santos', address: '456 Bonifacio Ave., Tibay' },
    { username: 'pedro_reyes', password: 'password123', full_name: 'Pedro Reyes', address: '789 Mabini St., Tibay' }
];

const insertResident = db.prepare(`
    INSERT INTO users (username, password, full_name, address, role)
    VALUES (?, ?, ?, ?, 'resident')
`);

residents.forEach(resident => {
    const hashedPassword = bcrypt.hashSync(resident.password, 10);
    insertResident.run(resident.username, hashedPassword, resident.full_name, resident.address);
});

console.log('[Seed] Resident accounts created (3 accounts)');

// Insert admin account with ID 47 (non-sequential for blind enumeration)
const adminPassword = bcrypt.hashSync('Admin@2024!', 10);
db.prepare(`INSERT INTO users (id, username, password, full_name, address, role)
    VALUES (47, 'admin', ?, 'Barangay Administrator', 'Barangay Hall, Tibay', 'admin')
`).run(adminPassword);

console.log('[Seed] Admin account created (ID: 47)');

// Insert sample reports
const reports = [
    { user_id: 1, title: 'Broken streetlight on Rizal St.', category: 'infrastructure', description: 'The streetlight near house #125 has been broken for 2 weeks. It gets very dark at night.' },
    { user_id: 1, title: 'Noise complaint - Karaoke', category: 'noise', description: 'Neighbor has been playing loud karaoke music past midnight.' },
    { user_id: 2, title: 'Pothole on Bonifacio Ave.', category: 'infrastructure', description: 'Large pothole forming near the intersection. Safety hazard for motorcycles.' },
    { user_id: 2, title: 'Stray dogs in the area', category: 'safety', description: 'Several stray dogs roaming the street, some appear aggressive.' },
    { user_id: 3, title: 'Garbage collection missed', category: 'infrastructure', description: 'Garbage has not been collected for the past week in our street.' },
    { user_id: 3, title: 'Illegal parking blocking driveway', category: 'safety', description: 'Vehicle has been parked blocking my driveway for 3 days.' }
];

const insertReport = db.prepare(`
    INSERT INTO reports (user_id, title, category, description, status)
    VALUES (?, ?, ?, ?, 'pending')
`);

reports.forEach(report => {
    insertReport.run(report.user_id, report.title, report.category, report.description);
});

console.log('[Seed] Sample reports created (6 reports)');

// Insert initial admin log
db.prepare(`
    INSERT INTO admin_logs (action) VALUES ('System initialized')
`).run();

console.log('[Seed] Database seeding completed successfully!');
console.log('[Seed] Test credentials:');
console.log('  Admin: username=admin, password=Admin@2024!');
console.log('  Resident: username=juan_cruz, password=password123');

db.close();
