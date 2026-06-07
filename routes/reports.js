const express = require('express');
const db = require('../database/db');
const requireAuth = require('../middleware/requireAuth');
const router = express.Router();

// New report form
router.get('/reports/new', requireAuth, (req, res) => {
    res.render('reports/new', { error: null });
});

// Submit new report
router.post('/reports/new', requireAuth, (req, res) => {
    const { title, category, description } = req.body;

    if (!title || !category || !description) {
        return res.render('reports/new', { error: 'All fields are required' });
    }

    db.prepare('INSERT INTO reports (user_id, title, category, description) VALUES (?, ?, ?, ?)')
        .run(req.session.userId, title, category, description);

    res.redirect('/dashboard');
});

// View single report
router.get('/reports/:id', requireAuth, (req, res) => {
    const report = db.prepare('SELECT * FROM reports WHERE id = ? AND user_id = ?')
        .get(req.params.id, req.session.userId);

    if (!report) {
        return res.status(404).send('Report not found');
    }

    res.render('reports/detail', { report });
});

module.exports = router;
