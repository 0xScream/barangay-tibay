require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);

// Inject user context into all views
app.use((req, res, next) => {
    res.locals.user = null;
    if (req.session.userId) {
        const db = require('./database/db');
        res.locals.user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.session.userId);
    }
    next();
});

// Use express-ejs-layouts
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const reportsRoutes = require('./routes/reports');
const profileRoutes = require('./routes/profile');
const adminRoutes = require('./routes/admin');
const usersRoutes = require('./routes/users');

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(reportsRoutes);
app.use(profileRoutes);
app.use(adminRoutes);
app.use(usersRoutes);

// Landing page
app.get('/', (req, res) => {
    if (req.session.userId) {
        const db = require('./database/db');
        const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
        if (user.role === 'admin') {
            return res.redirect('/admin');
        }
        return res.redirect('/dashboard');
    }
    res.render('index');
});

// Start server
app.listen(PORT, () => {
    console.log(`[Server] Barangay Tibay running on http://localhost:${PORT}`);
    if (process.env.DEBUG === 'true') {
        console.log('[DEBUG] Debug mode enabled');
    }
});

// Start internal API service (SSRF target)
require('./services/internalApi');
