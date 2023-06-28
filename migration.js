const axios = require('axios');
const fs = require('fs');

const bitbucketServerUrl = 'https://bitbucket.hyland.com';
const personalAccessToken = '--- Bitbukcet PAT Token ---';
const projectKey = '~{bitbucket username}';
const repoSlug = '--- bitbucket repo slug ---';

const apiUrl = `${bitbucketServerUrl}/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/pull-requests`;

const axiosInstance = axios.create({
  baseURL: bitbucketServerUrl,
  headers: {
    'Authorization': `Bearer ${personalAccessToken}`,
    'Content-Type': 'application/json'
  }
});

function fetchActivities(pullRequestId) {
  const activitiesUrl = `${apiUrl}/${pullRequestId}/activities`;
  return axiosInstance.get(activitiesUrl);
}

const githubBaseUrl = 'https://api.github.com';
const githubOwner = '--- Github Username ---';
const githubRepo = '--- destination repo ---';
const githubAccessToken = '--- Github PAT Token---';

const githubAxiosInstance = axios.create({
  baseURL: `${githubBaseUrl}/repos/${githubOwner}/${githubRepo}`,
  headers: {
    'Authorization': `Bearer ${githubAccessToken}`,
    'Content-Type': 'application/json'
  }
});

async function pushPullRequestsToGitHub(pullRequests) {
  for (const pullRequest of pullRequests) {
    const { pullRequestId, activities } = pullRequest;
    const githubPRData = {
      title: `PR #${pullRequestId}`,
      body: '',
      head: 'feature',
      base: 'main'
    };
    try {
      const githubCreatePRResponse = await githubAxiosInstance.post('/pulls', githubPRData);
      const githubPRNumber = githubCreatePRResponse.data.number;

      for (const activity of activities) {
        if (activity.comment && activity.comment.text) {
          const commentData = {
            body: `@${activity.user.slug} commented on ${activity.createdDate}:\n\n${activity.comment.text}`
          };
          await githubAxiosInstance.post(`/issues/${githubPRNumber}/comments`, commentData);
        }
      }

      console.log(`PR #${pullRequestId} and comments pushed to GitHub successfully.`);
    } catch (error) {
      console.error(`Error pushing PR #${pullRequestId} to GitHub:`, error.response ? error.response.data : error.message);
    }
  }
}

async function fetchAllPullRequests() {
  try {
    const response = await axiosInstance.get(apiUrl);
    const pullRequests = response.data.values;

    const pullRequestActivities = [];

    for (const pullRequest of pullRequests) {
      const pullRequestId = pullRequest.id;

      const activitiesResponse = await fetchActivities(pullRequestId);
      const activities = activitiesResponse.data.values;

      pullRequestActivities.push({
        pullRequestId,
        activities
      });
    }

    const outputFilePath = './pull_request_activities.json';
    fs.writeFileSync(outputFilePath, JSON.stringify(pullRequestActivities, null, 2));

    console.log(`Pull request activities have been saved to ${outputFilePath}`);

    await pushPullRequestsToGitHub(pullRequestActivities);
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

fetchAllPullRequests();