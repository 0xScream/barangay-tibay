const express = require('express');
const db = require('../database/db');
const requireAuth = require('../middleware/requireAuth');
const router = express.Router();

// Dashboard - view own reports
router.get('/dashboard', requireAuth, (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    const reports = db.prepare('SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC').all(req.session.userId);
    
    res.render('dashboard', { user, reports });
});

module.exports = router;
