require('dotenv').config({ path: __dirname + '/../.env' });

async function run() {
  const token = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  
  if (!token) return;

  let url = 'https://api.vercel.com/v10/projects';
  if (teamId) url += `?teamId=${teamId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'test-sso-bypass-33',
      framework: 'nextjs',
      gitRepository: {
        type: 'github',
        repo: `ads-baim/offcut-interiors-home-remodeling-0de5`,
      },
      ssoProtection: null
    }),
  });

  const data = await response.json();
  console.log('Response Status:', response.status);
  console.log('SSO Protection:', data.ssoProtection);
}

run();
