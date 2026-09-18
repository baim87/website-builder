require('dotenv').config({ path: __dirname + '/../.env' });

async function run() {
  const token = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  
  if (!token) {
      console.log('No VERCEL_API_TOKEN');
      return;
  }

  let url = 'https://api.vercel.com/v9/projects';
  if (teamId) url += `?teamId=${teamId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'test-api-project-1234',
      framework: 'nextjs',
      repository: {
        type: 'github',
        repo: `ads-baim/offcut-interiors-home-remodeling-0de5`,
      },
    }),
  });

  const data = await response.json();
  console.log('Response Status:', response.status);
  console.log('Response Data:', JSON.stringify(data, null, 2));
}

run();
