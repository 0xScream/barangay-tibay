const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const requireAuth = require('../middleware/requireAuth');
const router = express.Router();

// Profile view - generates opaque ref token
router.get('/profile', requireAuth, (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    
    // Generate opaque reference token - base64({ uid: user.id, role: user.role })
    // Looks like a CSRF/integrity token but actually controls update target
    const ref = Buffer.from(JSON.stringify({ uid: user.id, role: user.role })).toString('base64');
    
    res.render('profile', { user, ref });
});

// Profile update - VULNERABLE: trusts decoded ref without session validation
router.post('/profile/update', requireAuth, (req, res) => {
    const { ref, full_name, address, password, confirm_password } = req.body;

    let decoded;
    try {
        // BUG: decodes and trusts ref without verifying against session
        decoded = JSON.parse(Buffer.from(ref, 'base64').toString('utf8'));
    } catch {
        return res.status(400).send('Invalid request.');
    }

    // VULNERABILITY: decoded.uid is used directly - no session ownership check
    const uid = decoded.uid;
    
    // Note: role field in token is verified server-side during session checks
    // Tampering with it won't bypass privilege checks (handled by middleware)

    const updates = [full_name, address];
    let query = 'UPDATE users SET full_name = ?, address = ?';

    if (password && password.trim() !== '') {
        // Validate password confirmation
        if (password !== confirm_password) {
            return res.status(400).send('Passwords do not match.');
        }
        query += ', password = ?';
        updates.push(bcrypt.hashSync(password, 10));
    }

    query += ' WHERE id = ?';
    updates.push(uid);  // Using uid from decoded ref instead of session!

    db.prepare(query).run(...updates);

    // Silent redirect - no success/failure distinction exposed
    res.redirect('/profile');
});

module.exports = router;
