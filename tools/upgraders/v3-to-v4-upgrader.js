const fs = require('node:fs/promises');
const path = require('node:path');
const fsExtra = require('fs-extra');

class V3ToV4Upgrader {
  constructor({ logger = console } = {}) {
    this.logger = logger;
  }

  async upgrade(options = {}) {
    const {
      projectPath = process.cwd(),
      dryRun = false,
      backup = true,
    } = options;

    const targetPath = path.resolve(projectPath || process.cwd());

    await this.assertProjectExists(targetPath);

    this.logger.log(`Starting BMAD V3 → V4 upgrade for: ${targetPath}`);

    const migrationPlan = await this.generateMigrationPlan(targetPath);

    if (migrationPlan.actions.length === 0) {
      this.logger.log('Project already uses the latest layout. No changes required.');
      return;
    }

    if (dryRun) {
      this.logger.log('Dry run enabled. Planned actions:');
      for (const action of migrationPlan.actions) {
        this.logger.log(`  • ${action.description}`);
      }
      this.logger.log('No files were modified.');
      return;
    }

    if (backup) {
      await this.createBackup(targetPath, migrationPlan.backupDirName);
    }

    for (const action of migrationPlan.actions) {
      await action.execute();
      this.logger.log(`  ✓ ${action.description}`);
    }

    this.logger.log('Upgrade complete! Review the changes before continuing.');
  }

  async assertProjectExists(projectPath) {
    const exists = await fsExtra.pathExists(projectPath);
    if (!exists) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }
  }

  async generateMigrationPlan(projectPath) {
    const actions = [];

    const legacyConfigPath = path.join(projectPath, 'bmad.config.json');
    const modernConfigPath = path.join(projectPath, 'bmad.config.yaml');

    const hasLegacyConfig = await fsExtra.pathExists(legacyConfigPath);
    const hasModernConfig = await fsExtra.pathExists(modernConfigPath);

    if (hasLegacyConfig && !hasModernConfig) {
      const convertConfig = {
        description: 'Convert bmad.config.json to bmad.config.yaml',
        execute: async () => {
          const raw = await fs.readFile(legacyConfigPath, 'utf8');
          const parsed = JSON.parse(raw);
          const yaml = require('js-yaml');
          const serialized = yaml.dump(parsed, { lineWidth: 100 });
          await fs.writeFile(modernConfigPath, serialized, 'utf8');
        },
      };

      const removeLegacy = {
        description: 'Remove legacy bmad.config.json',
        execute: async () => {
          await fs.unlink(legacyConfigPath);
        },
      };

      actions.push(convertConfig, removeLegacy);
    }

    const legacyAgentsDir = path.join(projectPath, 'agents');
    const newAgentsDir = path.join(projectPath, 'bmad-core', 'agents');

    if (await this.shouldMoveDirectory(legacyAgentsDir, newAgentsDir)) {
      actions.push({
        description: 'Move agents/ to bmad-core/agents',
        execute: () => this.moveDirectory(legacyAgentsDir, newAgentsDir),
      });
    }

    const legacyTeamsDir = path.join(projectPath, 'teams');
    const newTeamsDir = path.join(projectPath, 'bmad-core', 'teams');

    if (await this.shouldMoveDirectory(legacyTeamsDir, newTeamsDir)) {
      actions.push({
        description: 'Move teams/ to bmad-core/teams',
        execute: () => this.moveDirectory(legacyTeamsDir, newTeamsDir),
      });
    }

    return {
      actions,
      backupDirName: `.bmad-backup-${Date.now()}`,
    };
  }

  async shouldMoveDirectory(sourceDir, targetDir) {
    const sourceExists = await fsExtra.pathExists(sourceDir);
    if (!sourceExists) return false;

    const targetExists = await fsExtra.pathExists(targetDir);
    if (targetExists) return false;

    const entries = await fs.readdir(sourceDir);
    return entries.length > 0;
  }

  async moveDirectory(sourceDir, targetDir) {
    await fsExtra.ensureDir(path.dirname(targetDir));
    await fsExtra.move(sourceDir, targetDir, { overwrite: false });
  }

  async createBackup(projectPath, backupDirName) {
    const backupRoot = path.join(projectPath, backupDirName);
    await fsExtra.ensureDir(backupRoot);

    this.logger.log(`Creating backup at ${backupRoot}`);
    await fsExtra.copy(projectPath, backupRoot, {
      filter: (src) => !src.includes(backupDirName),
    });
  }
}

module.exports = V3ToV4Upgrader;
