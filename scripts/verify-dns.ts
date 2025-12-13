#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve as resolveDNS, Resolver, resolve4 } from 'dns';
import { promisify } from 'util';

const resolveDNSPromise = promisify(resolveDNS);
const resolve4Promise = promisify(resolve4);

interface DNSRecord {
  name: string;
  ttl: string;
  type: string;
  value: string;
}

const NAMESERVERS = ['dns4.p02.nsone.net', 'naomi.ns.cloudflare.com'];
const nameserverIPs = new Map<string, string>();

// Resolve nameserver hostname to IP
async function resolveNameserver(nameserver: string): Promise<string> {
  if (nameserverIPs.has(nameserver)) {
    return nameserverIPs.get(nameserver)!;
  }

  try {
    const addresses = await resolve4Promise(nameserver);
    const ip = addresses[0];
    nameserverIPs.set(nameserver, ip);
    return ip;
  } catch (error) {
    throw new Error(`Failed to resolve nameserver ${nameserver}: ${(error as Error).message}`);
  }
}

// Parse CSV file
function parseCSV(filename: string): DNSRecord[] {
  const content = readFileSync(filename, 'utf-8');
  const lines = content.trim().split('\n');
  const records: DNSRecord[] = [];

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Parse CSV with quoted fields - split by comma but respect quotes
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());

    if (fields.length < 4) continue;

    const [name, ttl, type, value] = fields;
    records.push({ name, ttl, type, value });
  }

  return records;
}

// Query DNS record from specific nameserver
async function queryNameserver(
  nameserver: string,
  fqdn: string,
  recordType: string
): Promise<string[]> {
  const nameserverIP = await resolveNameserver(nameserver);
  const resolver = new Resolver();
  resolver.setServers([nameserverIP]);

  return new Promise((resolve, reject) => {
    // Map NETLIFY to multiple record types to check
    const types = recordType === 'NETLIFY' ? ['A', 'CNAME'] : [recordType];

    const promises = types.map(type =>
      new Promise<string[]>((res) => {
        const method = `resolve${type === 'TXT' ? '4' : type === 'A' ? '4' : ''}` as any;

        switch (type) {
          case 'A':
            resolver.resolve4(fqdn, (err, addresses) => {
              res(err ? [] : addresses);
            });
            break;
          case 'CNAME':
            resolver.resolveCname(fqdn, (err, addresses) => {
              res(err ? [] : addresses);
            });
            break;
          case 'TXT':
            resolver.resolveTxt(fqdn, (err, records) => {
              res(err ? [] : records.flat());
            });
            break;
          case 'MX':
            resolver.resolveMx(fqdn, (err, addresses) => {
              res(err ? [] : addresses.map(mx => mx.exchange));
            });
            break;
          default:
            res([]);
        }
      })
    );

    Promise.all(promises).then(results => {
      const flattened = results.flat();
      resolve(flattened);
    });
  });
}

// Verify a single DNS record
async function verifyRecord(record: DNSRecord): Promise<{ success: boolean; warnings: number; errors: number }> {
  console.log(`\n🔍 Verifying: ${record.name} (${record.type})`);
  console.log(`   Expected: ${record.value}`);

  let success = true;
  let warnings = 0;
  let errors = 0;

  for (const nameserver of NAMESERVERS) {
    try {
      const results = await queryNameserver(nameserver, record.name, record.type);

      if (results.length === 0) {
        console.log(`   ❌ ${nameserver}: No records found`);
        errors++;
        success = false;
        continue;
      }

      // Check if expected value is in results (case-insensitive)
      const expectedLower = record.value.toLowerCase().replace(/\.$/, '');
      const match = results.some(result =>
        result.toLowerCase().replace(/\.$/, '') === expectedLower
      );

      if (match) {
        console.log(`   ✅ ${nameserver}: ${results.join(', ')}`);
      } else {
        console.log(`   ⚠️  ${nameserver}: ${results.join(', ')} (expected ${record.value})`);
        warnings++;
        success = false;
      }
    } catch (error) {
      console.log(`   ❌ ${nameserver}: Error - ${(error as Error).message}`);
      errors++;
      success = false;
    }
  }

  return { success, warnings, errors };
}

// Main function
async function main() {
  const csvFile = process.argv[2] || 'vibes.diy (DNS Records).csv';

  console.log(`📋 Reading DNS records from: ${csvFile}`);
  console.log(`🌐 Nameservers: ${NAMESERVERS.join(', ')}\n`);

  const records = parseCSV(csvFile);
  console.log(`Found ${records.length} DNS records to verify`);

  let totalSuccess = 0;
  let totalWarnings = 0;
  let totalErrors = 0;

  for (const record of records) {
    const result = await verifyRecord(record);
    if (result.success) totalSuccess++;
    totalWarnings += result.warnings;
    totalErrors += result.errors;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Total records: ${records.length}`);
  console.log(`   ✅ Fully verified: ${totalSuccess}`);
  console.log(`   ⚠️  Warnings: ${totalWarnings}`);
  console.log(`   ❌ Errors: ${totalErrors}`);
  console.log('='.repeat(60) + '\n');

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log('✨ All DNS records verified successfully!\n');
  } else {
    console.log('⚠️  Some records have warnings or errors. Review output above.\n');
  }
}

main().catch(console.error);
