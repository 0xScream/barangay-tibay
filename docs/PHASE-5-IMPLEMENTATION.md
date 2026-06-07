# Phase 5: SSRF with Filter Bypass Implementation

## Implementation Status: ✅ COMPLETE

### Overview
Implemented a Server-Side Request Forgery (SSRF) vulnerability in the admin "Fetch Report Template" feature. The endpoint uses a naive blocklist filter that blocks obvious localhost payloads but can be bypassed using alternative IP representations. Exploitation leads to access to an internal API service with environment disclosure and remote code execution capabilities.

---

## Key Components Implemented

### 1. Internal API Service (`services/internalApi.js`)
Lightweight HTTP server running on `127.0.0.1:8181` (localhost-only):

**Endpoints:**
- `GET /` - API info banner
- `GET /env` - Environment dump with Flag 2 and hints
- `GET /exec?cmd=<command>` - Command execution (RCE) with Flag 3

**Security Posture:**
- Only binds to 127.0.0.1 (not accessible externally)
- No authentication required (assumes localhost = trusted)
- Never referenced in frontend or public documentation
- Port number only discoverable through exploitation

### 2. SSRF Vulnerable Endpoint (`routes/admin.js`)
Admin-only feature to "fetch external report templates":

**Vulnerable Implementation:**
```javascript
const BLOCKLIST = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
const isBlocked = BLOCKLIST.some(blocked => url.toLowerCase().includes(blocked));

if (isBlocked) {
    return res.render('admin/fetch-report', { 
        content: null, url, error: 'URL not allowed for security reasons' 
    });
}

const response = await fetch(url);  // Server-side fetch with user-controlled URL
const content = await response.text();
res.render('admin/fetch-report', { content, url, error: null });
```

**Vulnerability Details:**
| Aspect | Implementation |
|--------|----------------|
| **Entry Point** | POST /admin/fetch-report with `url` parameter |
| **Filter Type** | Naive string-based blocklist |
| **Blocked Values** | localhost, 127.0.0.1, 0.0.0.0, ::1 |
| **Bypass Method** | Alternative IP representations |
| **Impact** | Access to internal API → environment disclosure → RCE |

### 3. Flags Integration
- **Flag 2**: `BTF{1nt3rn4l_s3rv1c3_3xp0s3d_v14_ssrf}` (in /env response)
- **Flag 3**: `BTF{rc3_v14_1nt3rn4l_4p1_pwn3d}` (in /exec response)

---

## Attack Surface Summary

### Filter Bypass Vectors

| Technique | Payload Example | Status |
|-----------|-----------------|--------|
| **Decimal IP** | `http://2130706433:8181/env` | ✓ Bypasses filter |
| **Octal IP** | `http://0177.0.0.1:8181/env` | ✓ Bypasses filter |
| **Hex IP** | `http://0x7f.0.0.1:8181/env` | ✓ Bypasses filter |
| **IPv6 Loopback** | `http://[::]:8181/env` | ⚠ Bypasses but may fail to connect |
| **Standard Localhost** | `http://localhost:8181/env` | ✗ Blocked by filter |
| **Dotted Decimal** | `http://127.0.0.1:8181/env` | ✗ Blocked by filter |

**Primary Bypass (Recommended):** Decimal IP notation `2130706433`
- Calculation: `127 * 256³ + 0 * 256² + 0 * 256 + 1 = 2130706433`
- Most reliable across platforms
- Common in CTF SSRF challenges

### Exploitation Path

1. **Prerequisites**: Admin access (obtained via Phase 4 IDOR)
2. **Access SSRF endpoint**: Navigate to `/admin/fetch-report`
3. **Test blocklist**: Confirm `http://127.0.0.1:8181` is blocked
4. **Bypass filter**: Use `http://2130706433:8181/env`
5. **Capture Flag 2**: Extract from environment dump
6. **Discover /exec**: Read hint in env response: `INTERNAL_API_PATH: /exec`
7. **Achieve RCE**: Request `http://2130706433:8181/exec?cmd=whoami`
8. **Capture Flag 3**: Extract from command execution response
9. **Establish foothold**: Execute arbitrary commands for persistence

### Internal API Endpoints

#### GET / (Root)
```
Internal Barangay Admin API v1.2
Endpoints: /env, /exec
```

#### GET /env (Environment Disclosure)
Returns:
- Flag 2
- System information (Node version, platform, architecture)
- Environment variables (including SESSION_SECRET if set)
- Hint about /exec endpoint location

#### GET /exec?cmd=<command> (RCE)
- Executes arbitrary shell commands via `child_process.exec()`
- Returns Flag 3 on successful execution
- No authentication or authorization checks
- Direct shell injection (intentional vulnerability)

---

## Testing & Validation

### Automated Test Script: `scripts/test-ssrf.js`

**Tests Performed:**
1. ✓ Internal API is accessible on 127.0.0.1:8181
2. ✓ Admin authentication works
3. ✓ Blocklist blocks obvious payloads (localhost, 127.0.0.1, 0.0.0.0, ::1)
4. ✓ Decimal IP bypass (2130706433) works
5. ✓ Octal IP bypass (0177.0.0.1) works
6. ✓ Hex IP bypass (0x7f.0.0.1) works
7. ✓ Flag 2 extracted from /env
8. ✓ /exec endpoint discovered via env dump
9. ✓ Flag 3 extracted via RCE
10. ✓ Command execution confirmed (whoami)

**Run Tests:**
```bash
# Start server
npm start

# In another terminal
node scripts/test-ssrf.js
```

**Expected Output:**
```
=== Test Summary ===

Blocklist Effectiveness:
  - Blocks obvious payloads: ✓ (localhost, 127.0.0.1, 0.0.0.0, ::1)
  - Vulnerable to bypass: ✓ (alternative IP representations)

Successful Bypass Techniques: Decimal IP notation, Octal IP notation, Mixed notation

✓ FLAG 2 CAPTURED: BTF{1nt3rn4l_s3rv1c3_3xp0s3d_v14_ssrf}
✓ FLAG 3 CAPTURED: BTF{rc3_v14_1nt3rn4l_4p1_pwn3d}
```

### Manual Testing Checklist

- [x] Internal API runs on 127.0.0.1:8181 (not accessible externally)
- [x] SSRF endpoint requires admin authentication
- [x] `http://localhost:8181/env` returns "URL not allowed"
- [x] `http://127.0.0.1:8181/env` returns "URL not allowed"
- [x] `http://2130706433:8181/env` successfully fetches content
- [x] Flag 2 visible in /env response
- [x] /exec endpoint mentioned in env dump
- [x] `http://2130706433:8181/exec?cmd=whoami` executes command
- [x] Flag 3 visible in /exec response
- [x] Arbitrary commands can be executed via /exec

---

## Security Design Notes

### Why This Design Works for CTF

1. **Realistic Vulnerability**: SSRF with blocklist bypasses are common in real-world applications
2. **Progressive Difficulty**: 
   - SSRF entry point is obvious (admin feature with URL input)
   - Blocklist existence is clear from error message
   - Bypass requires intermediate knowledge (decimal IP conversion)
   - Internal service discovery requires observation (no hints)
   - Port 8181 must be guessed or brute-forced (unless breadcrumbs added in Phase 6)
3. **Chained Exploitation**: Requires Phase 4 completion (admin access via IDOR)
4. **Multi-Stage Impact**: Disclosure → Hint Discovery → RCE
5. **Educational Value**: Teaches filter bypass techniques common in bug bounties

### Intentional Weaknesses

| Weakness | Why |
|----------|-----|
| String-based blocklist | Doesn't canonicalize input before checking |
| No URL parsing | Doesn't validate hostname against resolved IP |
| No allowlist | Only blocks specific values, doesn't restrict to safe targets |
| Internal API on predictable port | Port 8181 is guessable (testing range: 8000-9000) |
| No internal API auth | Assumes localhost = trusted (common misconfiguration) |
| Direct command execution | `/exec` has no input sanitization (intentional RCE) |

### Not-Weaknesses (By Design)

- Admin-only access (correct - feature legitimately needs admin privileges)
- Server-side fetch (correct - this is the intended feature)
- Error messages (appropriate - don't leak internal details beyond filter existence)
- Internal API in separate service (realistic - microservices architecture)

---

## Bypass Technique Deep Dive

### Decimal IP Conversion

**Concept**: IP addresses can be represented as 32-bit integers

**Calculation for 127.0.0.1:**
```
127.0.0.1 = (127 << 24) | (0 << 16) | (0 << 8) | 1
          = 2130706432 + 0 + 0 + 1
          = 2130706433
```

**JavaScript Helper:**
```javascript
function ipToDecimal(ip) {
    return ip.split('.').reduce((acc, octet, i) => 
        acc + (parseInt(octet) * Math.pow(256, 3 - i)), 0);
}

ipToDecimal('127.0.0.1'); // 2130706433
```

### Octal IP Conversion

**Concept**: Leading `0` indicates octal notation

**Examples:**
- `0177.0.0.1` = `127.0.0.1` (0177 octal = 127 decimal)
- `0177.0.0.01` = same (leading zeros on last octet don't matter)

### Hexadecimal IP Conversion

**Concept**: `0x` prefix indicates hex notation

**Examples:**
- `0x7f.0.0.1` = `127.0.0.1` (0x7f hex = 127 decimal)
- Can mix notations: `0x7f.0.0.0x1`

---

## Files Modified/Created

### Core Implementation
- `services/internalApi.js` - Internal API with /env and /exec endpoints
- `routes/admin.js` - SSRF vulnerable fetch-report handler
- `server.js` - Internal API startup integration
- `.env` - INTERNAL_API_PORT=8181

### Testing
- `scripts/test-ssrf.js` - Comprehensive SSRF exploitation tests

### Documentation
- `docs/PHASE-5-IMPLEMENTATION.md` - This file

---

## Full Attack Chain (Phase 4 + 5)

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: IDOR Profile Takeover                              │
├─────────────────────────────────────────────────────────────┤
│ 1. Register as resident                                     │
│ 2. Decode profile ref token → { uid: N, role: "..." }      │
│ 3. Enumerate uid 1-100 to find admin at uid=47             │
│ 4. Craft ref=base64({ uid: 47, role: "resident" })         │
│ 5. Update admin password → login as admin                  │
│ 6. Capture FLAG 1 from /admin dashboard                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 5: SSRF Filter Bypass                                 │
├─────────────────────────────────────────────────────────────┤
│ 7. Access /admin/fetch-report (admin feature)              │
│ 8. Test http://127.0.0.1:8181 → blocked                    │
│ 9. Bypass with http://2130706433:8181/env                  │
│ 10. Capture FLAG 2 from environment dump                   │
│ 11. Discover /exec endpoint from env hints                 │
│ 12. RCE via http://2130706433:8181/exec?cmd=<cmd>          │
│ 13. Capture FLAG 3 from command execution                  │
│ 14. Server foothold achieved → pivot/persist                │
└─────────────────────────────────────────────────────────────┘
```

---

## Difficulty Assessment

**Phase 5 Difficulty:** Intermediate

### Easy Aspects
- SSRF entry point is obvious (URL input field)
- Blocklist existence is clear from error message
- Admin access already obtained from Phase 4

### Intermediate Aspects
- Requires knowledge of decimal IP conversion (not trivial)
- Internal port 8181 must be discovered (guessing/bruteforce)
- Multi-stage exploitation (disclosure → hint → RCE)

### Hard Aspects
- None for intermediate players with CTF experience
- Players without SSRF bypass knowledge may struggle

### Recommended Difficulty Adjustments

**To Make Easier:**
- Add breadcrumb in Phase 6 (CHANGELOG mentions port 8181)
- Add hint in error message ("IP filtering in place")

**To Make Harder:**
- Randomize internal API port (require full port scan)
- Add rate limiting (slow down enumeration)
- Require multiple bypass techniques in sequence

---

## Next Steps

Phase 5 is **complete and validated**. Ready to proceed with:
- **Phase 6**: Intentional Breadcrumbs & Recon Surface
- **Phase 7**: QA & Difficulty Validation

---

*Phase 5 completed with full polish and validation*  
*SSRF difficulty: Intermediate (filter bypass required)*  
*Attack chain verified end-to-end*  
*3 flags total: Phase 4 (1) + Phase 5 (2)*
