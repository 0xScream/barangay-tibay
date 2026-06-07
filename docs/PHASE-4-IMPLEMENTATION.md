# Phase 4: IDOR - Profile Takeover Implementation

## Implementation Status: ✅ COMPLETE

### Overview
Implemented a sophisticated IDOR vulnerability in the profile update mechanism using an opaque base64-encoded reference token that appears to be a CSRF protection mechanism but actually controls the target of the update operation.

---

## Key Components Implemented

### 1. Vulnerable Profile Route (`routes/profile.js`)
- **GET /profile**: Generates opaque ref token: `base64({ uid: user.id, role: user.role })`
- **POST /profile/update**: Blindly trusts decoded `uid` from ref token without session validation
- No ownership check between session user and target user
- Silent redirects on all outcomes (no enumeration oracle)

### 2. Admin Account Seeding (`scripts/seed.js`)
- Admin placed at **ID 47** (non-sequential, breaks assumption-based guessing)
- Resident accounts use sequential IDs: 1, 2, 3
- Gap from 3 → 47 requires methodical blind enumeration
- Default credentials: `admin` / `Admin@2024!`

### 3. Flag Integration (`views/admin/dashboard.html`)
- **Flag 1**: `BTF{0p4qu3_r3f_un0wn3d_pr0f1l3_t4k30v3r}`
- Displayed in prominent purple gradient banner on admin dashboard
- Only accessible to users with `role = 'admin'` via session

### 4. Red Herrings
- **Server-side comment** in profile.js suggests role field is validated (it's not)
- **Client-side comment** in public/js/profile.js claims ref token integrity is checked
- **Role field** in ref token appears to control privileges but has no actual effect
- Designed to waste attacker time exploring dead ends

---

## Attack Surface Summary

### Vulnerability Details
| Aspect | Implementation |
|--------|----------------|
| **Entry Point** | POST /profile/update with `ref` parameter |
| **Token Format** | Base64-encoded JSON: `{ "uid": N, "role": "..." }` |
| **Vulnerability** | No validation that `decoded.uid` matches `session.userId` |
| **Admin Target** | User ID 47 (non-obvious, requires enumeration) |
| **Oracle** | None - all updates return 302 redirect to /profile |
| **Red Herring** | `role` field in token appears significant but is ignored |

### Exploitation Path
1. Register/login as resident (any user)
2. Navigate to `/profile` → intercept update request
3. Extract `ref` hidden field from form
4. Decode base64 → discover `{ uid: N, role: "..." }` structure
5. Recognize `uid` controls update target (not session)
6. Blind enumeration: craft `ref = base64({ uid: X, role: "resident" })` for X in 1-100
7. Oracle: attempt login with test password after each update
8. Find admin at `uid = 47`
9. Craft winning payload: `ref = base64({ uid: 47, role: "resident" })`
10. Submit with new password → admin account hijacked
11. Login as `admin` with new password
12. Access `/admin` → capture Flag 1

### Difficulty Factors
- **Hard**: Opaque base64 token looks like CSRF protection, not object reference
- **Hard**: Admin ID (47) requires blind enumeration with no hints
- **Hard**: No direct oracle - must use login attempts as secondary oracle
- **Medium**: Role field red herring may waste time on privilege escalation attempts
- **Medium**: Comments suggest security measures that don't exist

---

## Testing & Validation

### Automated Tests
Two test scripts validate the vulnerability:

#### 1. `scripts/test-idor.js` (Database-level)
Tests core vulnerability logic:
- ✓ Admin at non-sequential ID 47
- ✓ Ref token structure correct
- ✓ Password takeover via crafted ref
- ✓ Role tampering has no effect
- ✓ No enumeration oracle exists

**Run**: `node scripts/test-idor.js`

#### 2. `scripts/test-idor-http.js` (End-to-End HTTP)
Tests full attack chain:
- ✓ Login as resident
- ✓ Extract ref token from profile page
- ✓ Craft malicious ref targeting uid=47
- ✓ Submit update with new admin password
- ✓ Login as admin with hijacked account
- ✓ Capture Flag 1 from admin dashboard

**Run**: `node scripts/test-idor-http.js` (requires server running)

### Manual Testing Checklist
- [x] Resident cannot access `/admin` without privilege
- [x] Profile update with own ref works normally
- [x] Profile update with crafted ref (uid=47) hijacks admin
- [x] Invalid uid updates return same response (no oracle)
- [x] Tampering with `role` field has no effect
- [x] Admin ID not discoverable without enumeration
- [x] Flag 1 renders only for admin sessions
- [x] Login as admin with new password grants full access

---

## Security Design Notes

### Why This Design Works for CTF

1. **Realistic Appearance**: Opaque token mimics common integrity protection patterns
2. **Subtle Flaw**: Bug is in missing validation, not obvious insecure code
3. **Multi-Step Exploitation**: Requires reconnaissance, analysis, scripting
4. **No Shortcuts**: Admin ID hidden, no endpoints leak user count/IDs
5. **Red Herrings**: Multiple false paths (role tampering, "verified" comments)

### Intentional Weaknesses
- No `uid` ownership check in update handler
- No HMAC/signature on ref token
- Admin ID placement at 47 (enumerable but tedious)
- Silent failure mode (no error differentiation)

### Not-Weaknesses (By Design)
- `role` field in token (red herring only)
- Session middleware (works correctly, doesn't check ownership)
- Password hashing (bcrypt, secure)
- SQL queries (parameterized, no SQLi)

---

## Files Modified/Created

### Core Implementation
- `routes/profile.js` - Vulnerable update handler
- `views/profile.html` - Form with hidden ref token
- `scripts/seed.js` - Admin at ID 47

### Polish & Flags
- `views/admin/dashboard.html` - Flag 1 banner
- `public/css/style.css` - Flag banner styling
- `public/js/profile.js` - Client-side red herring

### Testing
- `scripts/test-idor.js` - Database-level tests
- `scripts/test-idor-http.js` - HTTP end-to-end tests

---

## Next Steps

Phase 4 is **complete and validated**. Ready to proceed with:
- **Phase 5**: SSRF with Filter Bypass (internal API + vulnerable fetch endpoint)
- **Phase 6**: Breadcrumbs & Recon Surface (robots.txt, CHANGELOG.md, etc.)
- **Phase 7**: Full QA & Difficulty Calibration

---

*Phase 4 completed with full polish and validation*  
*IDOR difficulty: Hard (blind enumeration required)*  
*Attack chain verified end-to-end*
