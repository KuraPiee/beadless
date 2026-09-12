import { simpleGit, SimpleGit } from 'simple-git';

export class GitManager {
  private git: SimpleGit;
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.git = simpleGit(cwd);
  }

  async isGitRepo(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch {
      return false;
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const branchSummary = await this.git.branch();
      return branchSummary.current || 'main';
    } catch {
      return 'main';
    }
  }

  async getLatestCommit(): Promise<string | undefined> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      return log.latest?.hash;
    } catch {
      return undefined;
    }
  }

  async getAuthor(): Promise<string> {
    try {
      const name = await this.git.raw(['config', 'user.name']).catch(() => '');
      return name.trim() || 'AI Agent';
    } catch {
      return 'AI Agent';
    }
  }

  async autoCommit(message: string, prefix = 'chore(beadless): '): Promise<string | null> {
    try {
      const isRepo = await this.isGitRepo();
      if (!isRepo) return null;

      await this.git.add(['.beadless', '.gitmem']);
      const status = await this.git.status();
      
      const hasChanges = status.staged.some(f => f.startsWith('.beadless') || f.startsWith('.gitmem'));
      if (!hasChanges) {
        return null;
      }

      const commitResult = await this.git.commit(`${prefix}${message}`);
      return commitResult.commit;
    } catch {
      return null;
    }
  }
}
