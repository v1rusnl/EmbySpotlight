# Security Policy

This project is provided "as is" without warranty. Use at your own risk. See LICENSE file for details on reusage.

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.0.8   | :white_check_mark: |
| < 0.0.8 | :x:                |


## External API Calls
- Spotlight.js communicates with the following external services:
- MDBList API (ratings data)
- TMDb API (movie/episode metadata)
- YouTube IFrame API (trailer playback)
- SponsorBlock API (video segment skipping)
- Wikidata SPARQL (metadata enrichment)
- AniList GraphQL API (anime ratings)

Privacy Notice - These API calls may expose:
- Movie/series titles
- IMDb/TMDb IDs
- User viewing preferences
- Proxy Usage

The script uses CORS proxies for certain API calls:
https://api.allorigins.win/raw?url=
https://api.codetabs.com/v1/proxy?quest=
Security Risk: Using third-party proxies can expose request data. 

Consider:
- Self-hosting a CORS proxy
- Removing proxy usage if possible
- Reviewing the PROXIES and DIRECT_DOMAINS configuration

## Best Practices

For Users:
- Review Code: This script runs in your browser - review it before use
- HTTPS Only: Ensure Emby is running over HTTPS
- Content Security Policy: Be aware this script loads external resources

For Contributors:
- No Secrets: Never commit API keys, tokens, or credentials

## Known Limitations
- Client-Side Execution: All code runs in the user's browser
- API Key Exposure: API keys in client-side code are visible to users
- Third-Party APIs: Dependent on external service availability and security
- CORS Proxies: May introduce additional security risks

## Reporting a Vulnerability

If you discover a security vulnerability in Spotlight.js, please report it responsibly:
- Do NOT create a public GitHub issue for security vulnerabilities
- Send a detailed report via GitHub Security Advisories

Please provide:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Suggested fix (if available)
- Affected versions