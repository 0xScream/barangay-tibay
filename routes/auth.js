const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const router = express.Router();

// Register page
router.get('/register', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('register', { error: null });
});

// Register handler
router.post('/register', (req, res) => {
    const { username, full_name, email, phone, address, password, confirm_password } = req.body;

    if (!username || !full_name || !email || !phone || !address || !password || !confirm_password) {
        return res.render('register', { error: 'All fields are required' });
    }

    if (password !== confirm_password) {
        return res.render('register', { error: 'Passwords do not match' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
        return res.render('register', { error: 'Username already taken' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare(
        'INSERT INTO users (username, password, full_name, address, role) VALUES (?, ?, ?, ?, ?)'
    ).run(username, hashedPassword, full_name, address, 'resident');

    req.session.userId = result.lastInsertRowid;
    res.redirect('/dashboard');
});

// Login page
router.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('login', { error: null });
});

// Login handler
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.render('login', { error: 'Invalid username or password' });
    }

    req.session.userId = user.id;
    
    if (user.role === 'admin') {
        return res.redirect('/admin');
    }
    res.redirect('/dashboard');
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports = router;
