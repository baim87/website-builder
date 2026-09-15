require('dotenv').config();
const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN;
const TEAM_ID = process.env.VERCEL_TEAM_ID;
async function main() {
  let url = 'https://api.vercel.com/v10/projects';
  if (TEAM_ID) url += `?teamId=${TEAM_ID}`;
  const createRes = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: "test-proj-baim-1111", framework: "nextjs" })
  });
  const proj = await createRes.json();
  console.log("PROJECT CREATED:", proj.id);
  const pid = proj.id;
  if (!pid) return;
  
  const envVars = [
    { key: 'NEXT_PUBLIC_API_URL', value: 'http://localhost:3000', target: ['production', 'preview', 'development'], type: 'plain' },
    { key: 'NEXT_PUBLIC_PROJECT_ID', value: 'some-id', target: ['production', 'preview', 'development'], type: 'plain' }
  ];

  let envUrl = `https://api.vercel.com/v10/projects/${pid}/env`;
  if (TEAM_ID) envUrl += `?teamId=${TEAM_ID}`;
  
  const res = await fetch(envUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(envVars)
  });
  console.log('ARRAY RESULT:', res.status, await res.text());
}
main();
