#!/usr/bin/env node
const { writeFileSync } = require('fs');
const { join } = require('path');
const https = require('https');

const API_KEY = process.env.NPS_API_KEY;
if (!API_KEY) {
  console.error('NPS_API_KEY env var required. Register free at https://www.nps.gov/subjects/developer/get-started.htm');
  process.exit(1);
}

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} from NPS API — check your API key`));
        res.resume();
        return;
      }
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Failed to parse NPS response: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const { data } = await get(
    `https://developer.nps.gov/api/v1/parks?limit=500&api_key=${API_KEY}`
  );

  const national = data
    .filter(p => p.designation === 'National Park')
    .map(p => ({
      id: p.parkCode,
      name: p.fullName,
      states: p.states,
      description: p.description.slice(0, 300),
      activities: p.activities.slice(0, 6).map(a => a.name),
      image: (p.images && p.images[0]) ? p.images[0].url : null,
      fee: (p.entranceFees && p.entranceFees[0]) ? p.entranceFees[0].cost : '0.00',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  writeFileSync(join(__dirname, 'parks-data.json'), JSON.stringify(national, null, 2));
  console.log(`Wrote ${national.length} parks to parks-data.json`);

  const slim = national.slice(0, 40).map(p => ({
    id: p.id,
    name: p.name,
    states: p.states,
    description: p.description.slice(0, 150),
    activities: p.activities,
    fee: p.fee,
  }));
  writeFileSync(join(__dirname, 'parks-data-slim.json'), JSON.stringify(slim));
  console.log(`Wrote ${slim.length} parks to parks-data-slim.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
