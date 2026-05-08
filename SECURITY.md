# WH Tracker Security Policy

## Supported Versions

Security updates are maintained for the current release only. Older versions are not actively patched.

| Version | Supported          |
| ------- | ------------------ |
| 0.9.x   | Yes                |
| < 0.9   | No                 |

## Reporting a Vulnerability

Security issues should be reported privately rather than disclosed publicly. Preferred approaches:

- Use GitHub's private vulnerability reporting feature on this repository
- Email `roshanmohapatra.2001@gmail.com` with the subject line: "Security Vulnerability: WH Tracker"

When submitting a report, please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof of concept
- The affected version and browser environment
- Any relevant screenshots, logs, or links

Reports are typically acknowledged within a week. On acceptance, a fix will be prepared and released before any public disclosure is made.

## Scope

WH Tracker is a single-file, client-side application with no server, no authentication system, and no network requests. All data is stored in the browser's localStorage. The primary security surface is the browser environment itself.

Areas in scope include:

- Cross-site scripting (XSS) via user-supplied input rendered to the DOM
- Malicious JSON payloads processed during the import flow
- Data leakage through localStorage access patterns

Out of scope: server-side vulnerabilities, denial of service, social engineering.
