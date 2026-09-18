const { Octokit } = require('@octokit/rest');
require('dotenv').config({ path: __dirname + '/../.env' });

async function run() {
  const token = process.env.GITHUB_API_TOKEN;
  const octokit = new Octokit({ auth: token });
  
  try {
    const { data } = await octokit.rest.apps.listInstallationsForAuthenticatedUser();
    console.log("Installations found:", data.total_count);
    for (const inst of data.installations) {
        console.log(`- App: ${inst.app_slug} (ID: ${inst.id})`);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
