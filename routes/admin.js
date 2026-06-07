const express = require('express');
const db = require('../database/db');
const requireAdmin = require('../middleware/requireAdmin');
const router = express.Router();

// Admin dashboard overview
router.get('/admin', requireAdmin, (req, res) => {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('resident').count;
    const reportCount = db.prepare('SELECT COUNT(*) as count FROM reports').get().count;
    const pendingCount = db.prepare('SELECT COUNT(*) as count FROM reports WHERE status = ?').get('pending').count;
    const recentReports = db.prepare('SELECT r.*, u.username FROM reports r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC LIMIT 5').all();
    
    res.render('admin/dashboard', { userCount, reportCount, pendingCount, recentReports });
});

// All reports management
router.get('/admin/reports', requireAdmin, (req, res) => {
    const reports = db.prepare('SELECT r.*, u.username, u.full_name FROM reports r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC').all();
    res.render('admin/reports', { reports });
});

// Update report status
router.post('/admin/reports/:id/status', requireAdmin, (req, res) => {
    const { status } = req.body;
    db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, req.params.id);
    res.redirect('/admin/reports');
});

// Users list
router.get('/admin/users', requireAdmin, (req, res) => {
    const users = db.prepare('SELECT id, username, full_name, address, role, created_at FROM users ORDER BY created_at DESC').all();
    res.render('admin/users', { users });
});

// Fetch report template (SSRF entry point - VULNERABLE)
router.get('/admin/fetch-report', requireAdmin, (req, res) => {
    res.render('admin/fetch-report', { content: null, url: null, error: null });
});

router.post('/admin/fetch-report', requireAdmin, async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.render('admin/fetch-report', { content: null, url: null, error: 'URL is required' });
    }

    // VULNERABLE: Naive blocklist - bypassable with alternative IP representations
    const BLOCKLIST = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    const isBlocked = BLOCKLIST.some(blocked => url.toLowerCase().includes(blocked));
    
    if (isBlocked) {
        return res.render('admin/fetch-report', { 
            content: null, 
            url, 
            error: 'URL not allowed for security reasons' 
        });
    }

    try {
        const response = await fetch(url);
        const content = await response.text();
        res.render('admin/fetch-report', { content, url, error: null });
    } catch (e) {
        res.render('admin/fetch-report', { 
            content: null, 
            url, 
            error: 'Failed to fetch URL: ' + e.message 
        });
    }
});

module.exports = router;
