export class Octokit {
  constructor(options: any) {}
  rest = {
    repos: {
      createForAuthenticatedUser: async () => ({ data: { clone_url: 'mock_url' } }),
      createCommit: async () => ({ data: { sha: 'mock_sha' } }),
      createTree: async () => ({ data: { sha: 'mock_tree_sha' } }),
      getCommit: async () => ({ data: { tree: { sha: 'mock_base_tree' } } }),
      updateBranch: async () => ({}),
      getBranch: async () => ({ data: { commit: { sha: 'mock_base_sha' } } })
    },
    git: {
      createRef: async () => ({}),
      createBlob: async () => ({ data: { sha: 'mock_blob' } }),
    }
  };
}
