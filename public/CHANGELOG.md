# Barangay Tibay Portal - Change Log

## Version 1.2 (Current)
**Release Date:** June 2024

### Changes
- Updated user registration form with additional fields
- Improved profile management interface
- Enhanced admin dashboard statistics
- Minor UI/UX improvements

### Bug Fixes
- Fixed session timeout issues
- Resolved form validation edge cases

---

## Version 1.1
**Release Date:** April 2024

### New Features
- **Added URL template fetching for admin dashboard**
  - Allows administrators to fetch external report templates
  - Implemented security filtering for local IP addresses
  - Blocklist includes: localhost, 127.0.0.1, 0.0.0.0, ::1

### Changes
- Enhanced report status tracking
- Improved admin user management

### Security
- Added IP filtering to prevent access to internal services
- Session security improvements

---

## Version 1.0
**Release Date:** January 2024

### Initial Release
- User registration and authentication
- Report submission system
- Admin dashboard
- Profile management
- Basic reporting features

---

## Internal Notes
- Internal API running on port 8181 (localhost only)
- Consider implementing rate limiting for fetch feature
- Review SSRF protections in future releases
