const express = require('express');
const db = require('../database/db');
const router = express.Router();

// Public user directory — no auth required (IDOR enumeration surface)
// Leaks username and role, allowing discovery of admin account by ID
router.get('/users/:id', (req, res) => {
    const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?')
        .get(req.params.id);

    if (!user) {
        return res.status(404).send('User not found.');
    }

    res.render('users/profile', { profile: user });
});

module.exports = router;
