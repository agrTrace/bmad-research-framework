/**
 * 完整优化后的 Electron 主进程入口文件
 *
 * 主要改进点：
 * - 对 services/saas 下的依赖（如 js-yaml）缺失做了健壮处理：不再在 require 时直接崩溃，
 *   而是延迟到使用时返回清晰的错误信息，并在应用初始化阶段弹窗提示。
 * - 动态导入 electron-store 时增加了错误处理，避免因缺少包导致整个 app 崩溃。
 * - 对 IPC handler 增加了可用性检查，缺失 service 时会返回可识别的错误（不会导致进程退出）。
 * - 保存窗口状态的逻辑增加了容错，避免在保存时抛出未捕获异常。
 *
 * 使用说明：
 * - 如果控制台或弹窗提示缺少某些 npm 包（例如 js-yaml），请在仓库根目录或 services/saas 目录下运行：
 *     npm install
 *   或者针对缺失的包：
 *     npm install js-yaml
 */

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { app, BrowserWindow, ipcMain, nativeTheme, screen, dialog } = require('electron');

let Store; // 将通过 dynamic import 导入 electron-store（兼容 ESM 包）
let store;

let rootDir = path.resolve(__dirname, '..', '..');

let catalogService = null;
let projectService = null;
let servicesAvailable = true;
let servicesUnavailableReason = null;
let moduleSearchPaths = [];

let mainWindow = null;
let handlersRegistered = false;

/**
 * 当服务不可用时，构造统一的错误信息
 */
function buildServiceUnavailableMsg(missingModules) {
  const modulesList = Array.from(new Set(missingModules)).join(', ');
  return `Required service dependencies missing: ${modulesList}.
Please run "npm install" in the project root or install the specific package(s): ${modulesList}.
Example: npm install ${modulesList}
`;
}

/**
 * 初始化服务模块（延迟加载/捕获缺失依赖）
 * - 如果 require 抛出 MODULE_NOT_FOUND，会将 servicesAvailable 标记为 false，
 *   并保留错误信息供 UI/IPC 使用。
 */
function initializeServices() {
  servicesAvailable = true;
  servicesUnavailableReason = null;
  catalogService = null;
  projectService = null;
  const missing = [];

  try {
    // 尝试加载 catalog service factory
    const createCatalogService = require(path.join(rootDir, 'services', 'saas', 'src', 'services', 'catalog-service'));
    try {
      catalogService = createCatalogService({ rootDir, dependencySearchPaths: moduleSearchPaths });
    } catch (err) {
      // 如果工厂函数执行时内部依赖缺失，也要捕获
      if (err && err.code === 'MODULE_NOT_FOUND') {
        const m = (err.message || '').match(/Cannot find module '([^']+)'/);
        if (m) missing.push(m[1]);
      }
      console.error('Failed to instantiate catalogService:', err);
      missing.push('catalog-service (instantiation error)');
    }
  } catch (err) {
    console.error('Failed to require catalog-service:', err && err.message ? err.message : err);
    if (err && err.code === 'MODULE_NOT_FOUND') {
      const m = (err.message || '').match(/Cannot find module '([^']+)'/);
      if (m) missing.push(m[1]);
    } else {
      missing.push('catalog-service (require error)');
    }
  }

  try {
    // 尝试加载 project service factory
    const createProjectService = require(path.join(rootDir, 'services', 'saas', 'src', 'services', 'project-service'));
    try {
      projectService = createProjectService({ rootDir, catalogService, dependencySearchPaths: moduleSearchPaths });
    } catch (err) {
      if (err && err.code === 'MODULE_NOT_FOUND') {
        const m = (err.message || '').match(/Cannot find module '([^']+)'/);
        if (m) missing.push(m[1]);
      }
      console.error('Failed to instantiate projectService:', err);
      missing.push('project-service (instantiation error)');
    }
  } catch (err) {
    console.error('Failed to require project-service:', err && err.message ? err.message : err);
    if (err && err.code === 'MODULE_NOT_FOUND') {
      const m = (err.message || '').match(/Cannot find module '([^']+)'/);
      if (m) missing.push(m[1]);
    } else {
      missing.push('project-service (require error)');
    }
  }

  if (missing.length > 0) {
    servicesAvailable = false;
    servicesUnavailableReason = buildServiceUnavailableMsg(missing);
    // 将 service 实例置为 null（或保留已成功创建的那部分）
    if (!catalogService) catalogService = null;
    if (!projectService) projectService = null;
  }
}

function resolveRootDir() {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return path.resolve(__dirname, '..', '..');
}

function computeModuleSearchPaths(baseDir) {
  const candidates = new Set();
  const push = (value) => {
    if (!value) return;
    candidates.add(path.normalize(value));
  };

  push(path.join(__dirname, 'node_modules'));
  push(path.join(__dirname, '..', 'node_modules'));
  push(path.join(__dirname, '..', '..', 'node_modules'));

  if (baseDir) {
    push(path.join(baseDir, 'node_modules'));
    push(path.join(baseDir, 'desktop', 'electron', 'node_modules'));
    push(path.join(baseDir, 'services', 'saas', 'node_modules'));
  }

  const cwd = process.cwd();
  if (cwd) {
    push(path.join(cwd, 'node_modules'));
  }

  if (typeof app?.getAppPath === 'function') {
    const appPath = app.getAppPath();
    push(appPath);
    push(path.dirname(appPath));
    push(path.join(appPath, 'node_modules'));
  }

  if (process.resourcesPath) {
    push(process.resourcesPath);
    push(path.join(process.resourcesPath, 'app'));
    push(path.join(process.resourcesPath, 'app.asar'));
    push(path.join(process.resourcesPath, 'node_modules'));
    push(path.join(process.resourcesPath, 'app.asar', 'node_modules'));
  }

  return Array.from(candidates);
}

function ensureModuleSearchPaths(searchPaths) {
  if (!Array.isArray(searchPaths) || searchPaths.length === 0) {
    return process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter).filter(Boolean) : [];
  }

  const existing = process.env.NODE_PATH
    ? process.env.NODE_PATH.split(path.delimiter).filter(Boolean)
    : [];

  const normalisedExisting = existing.map((item) => path.normalize(item));
  let updated = false;

  for (const candidate of searchPaths) {
    const normalisedCandidate = path.normalize(candidate);
    if (normalisedExisting.includes(normalisedCandidate)) {
      continue;
    }

    let candidateExists = false;
    try {
      candidateExists = fs.existsSync(candidate);
    } catch (_) {
      candidateExists = false;
    }

    if (!candidateExists && !candidate.includes('.asar')) {
      continue;
    }

    existing.push(candidate);
    normalisedExisting.push(normalisedCandidate);
    updated = true;
  }

  if (updated) {
    process.env.NODE_PATH = existing.join(path.delimiter);
    Module._initPaths();
  }

  return existing;
}

/**
 * 注册 IPC handlers（只有在 store 初始化后调用）
 * - 对于依赖 service 的 handler，会先检查 servicesAvailable 或对应 service 是否存在，
 *   并返回清晰的错误提示，而不是让主进程崩溃。
 */
async function registerHandlers() {
  if (handlersRegistered) return;

  if (!store) {
    throw new Error('Store must be initialized before registering handlers');
  }

  nativeTheme.themeSource = store.get('theme', 'system');

  ipcMain.handle('preferences:get', () => ({
    theme: store.get('theme', 'system'),
  }));

  ipcMain.handle('preferences:set-theme', (_event, theme) => {
    if (!['light', 'dark', 'system'].includes(theme)) {
      throw new Error('Invalid theme value');
    }
    store.set('theme', theme);
    nativeTheme.themeSource = theme;
  });

  // catalog overview
  ipcMain.handle('catalog:overview', async () => {
    if (!servicesAvailable || !catalogService) {
      throw new Error(servicesUnavailableReason || 'Catalog service is unavailable');
    }

    try {
      const [agents, teams, workflows, expansions] = await Promise.all([
        catalogService.listAgents(),
        catalogService.listTeams(),
        catalogService.listWorkflows(),
        catalogService.listExpansions(),
      ]);

      return {
        agentCount: Array.isArray(agents) ? agents.length : 0,
        teamCount: Array.isArray(teams) ? teams.length : 0,
        workflowCount: Array.isArray(workflows) ? workflows.length : 0,
        agents,
        teams,
        workflows,
        expansions,
        sources: [
          {
            type: 'core',
            source: 'core',
            name: '核心能力',
            version: process.env.CORE_VERSION || '1.0.0'
          },
          ...(Array.isArray(expansions) ? expansions.map(pack => ({
            type: 'expansion',
            source: `expansion:${pack.id}`,
            packId: pack.id,
            name: pack.name,
            version: pack.version,
            description: pack.description,
          })) : []),
        ],
      };
    } catch (error) {
      console.error('Error in catalog:overview:', error);
      throw new Error('Failed to fetch catalog overview');
    }
  });

  ipcMain.handle('catalog:agent-detail', async (_event, agentId) => {
    if (!servicesAvailable || !catalogService) {
      throw new Error(servicesUnavailableReason || 'Catalog service is unavailable');
    }
    if (!agentId) throw new Error('Agent ID is required');
    try {
      return await catalogService.getAgent(agentId);
    } catch (error) {
      console.error(`Error fetching agent detail for ${agentId}:`, error);
      throw new Error('Failed to fetch agent details');
    }
  });

  ipcMain.handle('projects:generate-plan', async (_event, payload) => {
    if (!servicesAvailable || !projectService) {
      throw new Error(servicesUnavailableReason || 'Project service is unavailable');
    }
    if (!payload) throw new Error('Payload is required for plan generation');
    try {
      return await projectService.createProjectPlan(payload);
    } catch (error) {
      console.error('Error generating project plan:', error);
      throw new Error('Failed to generate project plan');
    }
  });

  ipcMain.handle('projects:list-workflows', async () => {
    if (!servicesAvailable || !catalogService) {
      throw new Error(servicesUnavailableReason || 'Catalog service is unavailable');
    }
    try {
      return await catalogService.listWorkflows();
    } catch (error) {
      console.error('Error listing workflows:', error);
      throw new Error('Failed to list workflows');
    }
  });

  ipcMain.handle('catalog:list-expansions', async () => {
    if (!servicesAvailable || !catalogService) {
      throw new Error(servicesUnavailableReason || 'Catalog service is unavailable');
    }
    try {
      return await catalogService.listExpansions();
    } catch (error) {
      console.error('Error listing expansions:', error);
      throw new Error('Failed to list expansions');
    }
  });

  handlersRegistered = true;
}

/**
 * 创建并显示主窗口
 */
async function createWindow() {
  if (!store) {
    throw new Error('Store must be initialized before creating the window');
  }

  const windowState = store.get('windowState', {
    width: 1260,
    height: 840
  });

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const width = Math.min(windowState.width || 1260, screenWidth);
  const height = Math.min(windowState.height || 840, screenHeight);

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 960,
    minHeight: 640,
    title: 'BMAD Research Framework — Desktop',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  // 设置位置（如果合理）
  if (typeof windowState.x === 'number' && typeof windowState.y === 'number') {
    const { x, y } = windowState;
    if (x >= 0 && x <= screenWidth && y >= 0 && y <= screenHeight) {
      try {
        const bounds = mainWindow.getBounds();
        mainWindow.setBounds({ ...bounds, x, y });
      } catch (err) {
        mainWindow.center();
      }
    } else {
      mainWindow.center();
    }
  } else {
    mainWindow.center();
  }

  // 保存窗口状态（防止频繁写入，使用简单节流）
  const saveWindowState = () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMaximized()) {
        const bounds = mainWindow.getBounds();
        store.set('windowState', bounds);
      }
    } catch (err) {
      console.warn('Failed to save window state:', err);
    }
  };

  let saveTimeout;
  mainWindow.on('resize', () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveWindowState, 500);
  });

  mainWindow.on('move', () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveWindowState, 500);
  });

  mainWindow.on('close', saveWindowState);

  // 加载页面
  await mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 在准备好后显示
  mainWindow.show();

  return mainWindow;
}

/**
 * 应用初始化流程
 */
app.whenReady().then(async () => {
  try {
    // 导入 electron-store（可能是 ESM 包）
    try {
      const storeModule = await import('electron-store');
      Store = storeModule.default || storeModule;
    } catch (err) {
      // 如果 import 失败，尝试 require（兼容性的最后手段）
      try {
        // eslint-disable-next-line global-require
        const required = require('electron-store');
        Store = required && (required.default || required);
      } catch (innerErr) {
        console.error('Failed to load electron-store via import or require:', innerErr);
        throw new Error('electron-store is required. Please install it: npm install electron-store');
      }
    }

    // 初始化 store
    store = new Store({
      defaults: {
        theme: 'system',
        windowState: {
          width: 1260,
          height: 840
        }
      }
    });

    rootDir = resolveRootDir();

    moduleSearchPaths = ensureModuleSearchPaths(computeModuleSearchPaths(rootDir));

    // 初始化服务（捕获依赖缺失）
    initializeServices();

    // 如果服务不可用，弹窗通知用户（不会阻止 app 启动）
    if (!servicesAvailable) {
      console.warn('Some services are unavailable:', servicesUnavailableReason);
      // 使用模态错误弹窗，让用户注意到问题
      dialog.showMessageBoxSync({
        type: 'warning',
        title: 'Missing dependencies',
        message: '部分服务启动失败，应用功能将受限。',
        detail: servicesUnavailableReason,
      });
    }

    // 注册 IPC handlers
    await registerHandlers();

    // 创建主窗口
    await createWindow();

    // macOS activate 事件：无窗口时重新创建
    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow();
      }
    });

  } catch (error) {
    console.error('Application initialization failed:', error);
    // 弹窗并退出：让用户看到错误（异步退出以保证日志与弹窗可见）
    try {
      dialog.showErrorBox('Application initialization failed', String(error && (error.stack || error.message || error)));
    } catch (_) {
      // ignore dialog errors
    }
    setTimeout(() => app.quit(), 200);
  }
});

// 关闭所有窗口时退出（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 优雅退出：在 before-quit 中尝试保存 state
app.on('before-quit', () => {
  if (mainWindow) {
    try {
      if (!mainWindow.isDestroyed()) {
        if (!mainWindow.isMaximized()) {
          const bounds = mainWindow.getBounds();
          store && store.set && store.set('windowState', bounds);
        }
      }
    } catch (err) {
      // ignore
    }
    try {
      mainWindow.removeAllListeners('close');
    } catch (e) {
      // ignore
    }
    mainWindow = null;
  }
});

// 捕获未处理的异常/Promise 拒绝，避免进程直接崩溃并把信息记录下来
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  try {
    dialog.showErrorBox('Uncaught Exception', String(error && (error.stack || error.message || error)));
  } catch (_) {}
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  try {
    dialog.showErrorBox('Unhandled Rejection', String(reason));
  } catch (_) {}
});
