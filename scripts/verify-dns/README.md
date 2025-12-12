# DNS Verification Tool

A simple TypeScript tool to verify DNS records from a CSV file against specified nameservers.

## Features

- Reads DNS records from a CSV file
- Verifies records against multiple nameservers
- Supports multiple record types: A, CNAME, TXT, MX, and NETLIFY
- Provides detailed verification results with color-coded output
- Shows summary statistics

## Prerequisites

- Node.js (v16 or higher)
- pnpm or npm

## Installation

```bash
pnpm install
```

Or if using npm:

```bash
npm install
```

## Usage

Run the verification script:

```bash
pnpm start
```

Or with a custom CSV file:

```bash
pnpm start path/to/your-dns-records.csv
```

Using tsx directly:

```bash
tsx verify-dns.ts "vibes.diy (DNS Records).csv"
```

## CSV Format

The CSV file should have the following columns:

```csv
name,ttl,type,value
vibes.diy,3600,NETLIFY,fireproof-ai-builder.netlify.app
www.vibes.diy,3600,NETLIFY,fireproof-ai-builder.netlify.app
_atproto.vibes.diy,3600,TXT,did=did:plc:crdpshctu3eqcfz3diehf3yp
```

### Supported Record Types

- **A**: IPv4 address records
- **CNAME**: Canonical name records
- **TXT**: Text records
- **MX**: Mail exchange records
- **NETLIFY**: Special type that checks both A and CNAME records

## Output

The tool provides:

- ✅ Success: Record matches expected value
- ⚠️  Warning: Record exists but doesn't match expected value
- ❌ Error: No records found or query failed

Example output:

```
🔍 Verifying: vibes.diy (TXT)
   Expected: google-site-verification=txO1AuhHWbHV6pKkhMD54dlRZ_UL7gH3Yk8k5ZnNFzQ
   ✅ dns4.p02.nsone.net: google-site-verification=txO1AuhHWbHV6pKkhMD54dlRZ_UL7gH3Yk8k5ZnNFzQ
   ✅ naomi.ns.cloudflare.com: google-site-verification=txO1AuhHWbHV6pKkhMD54dlRZ_UL7gH3Yk8k5ZnNFzQ
```

## Configuration

To change the nameservers, edit the `NAMESERVERS` constant in `verify-dns.ts`:

```typescript
const NAMESERVERS = ['dns4.p02.nsone.net', 'naomi.ns.cloudflare.com'];
```

## License

MIT
