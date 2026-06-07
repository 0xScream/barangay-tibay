const db = require('../database/db');

const requireAdmin = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
    
    if (!user || user.role !== 'admin') {
        return res.redirect('/dashboard');
    }

    next();
};

module.exports = requireAdmin;
