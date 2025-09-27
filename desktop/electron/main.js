const path = require('node:path');
const { app, BrowserWindow, ipcMain, nativeTheme, screen } = require('electron');

let Store; // will be dynamically imported (electron-store is an ESM package)
let store;

// 服务初始化
const createCatalogService = require(path.join(__dirname, '..', '..', 'services', 'saas', 'src', 'services', 'catalog-service'));
const createProjectService = require(path.join(__dirname, '..', '..', 'services', 'saas', 'src', 'services', 'project-service'));

const rootDir = path.resolve(__dirname, '..', '..');
let catalogService;
let projectService;
let mainWindow = null;
let handlersRegistered = false;

// 初始化服务
function initializeServices() {
  try {
    catalogService = createCatalogService({ rootDir });
    projectService = createProjectService({ rootDir, catalogService });
  } catch (error) {
    console.error('Failed to initialize services:', error);
    throw error;
  }
}

// 注册IPC处理程序
async function registerHandlers() {
  if (handlersRegistered) return;

  try {
    // Ensure store exists
    if (!store) {
      throw new Error('Store is not initialized');
    }

    // 主题相关处理
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

    // 目录服务相关处理
    ipcMain.handle('catalog:overview', async () => {
      try {
        const [agents, teams, workflows, expansions] = await Promise.all([
          catalogService.listAgents(),
          catalogService.listTeams(),
          catalogService.listWorkflows(),
          catalogService.listExpansions(),
        ]);

        return {
          agentCount: agents.length,
          teamCount: teams.length,
          workflowCount: workflows.length,
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
            ...expansions.map(pack => ({
              type: 'expansion',
              source: `expansion:${pack.id}`,
              packId: pack.id,
              name: pack.name,
              version: pack.version,
              description: pack.description,
            })),
          ],
        };
      } catch (error) {
        console.error('Error in catalog:overview:', error);
        throw new Error('Failed to fetch catalog overview');
      }
    });

    ipcMain.handle('catalog:agent-detail', async (_event, agentId) => {
      if (!agentId) throw new Error('Agent ID is required');
      try {
        return await catalogService.getAgent(agentId);
      } catch (error) {
        console.error(`Error fetching agent detail for ${agentId}:`, error);
        throw new Error('Failed to fetch agent details');
      }
    });

    ipcMain.handle('projects:generate-plan', async (_event, payload) => {
      if (!payload) throw new Error('Payload is required for plan generation');
      try {
        return await projectService.createProjectPlan(payload);
      } catch (error) {
        console.error('Error generating project plan:', error);
        throw new Error('Failed to generate project plan');
      }
    });

    ipcMain.handle('projects:list-workflows', async () => {
      try {
        return await catalogService.listWorkflows();
      } catch (error) {
        console.error('Error listing workflows:', error);
        throw new Error('Failed to list workflows');
      }
    });

    ipcMain.handle('catalog:list-expansions', async () => {
      try {
        return await catalogService.listExpansions();
      } catch (error) {
        console.error('Error listing expansions:', error);
        throw new Error('Failed to list expansions');
      }
    });

    handlersRegistered = true;
  } catch (error) {
    console.error('Failed to register handlers:', error);
    throw error;
  }
}

// 创建主窗口
async function createWindow() {
  try {
    // Ensure store exists
    if (!store) {
      throw new Error('Store is not initialized');
    }

    const windowState = store.get('windowState', {
      width: 1260,
      height: 840
    });

    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

    // 确保窗口尺寸不超过屏幕大小
    const width = Math.min(windowState.width || 1260, screenWidth);
    const height = Math.min(windowState.height || 840, screenHeight);

    mainWindow = new BrowserWindow({
      width,
      height,
      minWidth: 960,
      minHeight: 640,
      title: 'BMAD Research Framework — Desktop',
      autoHideMenuBar: true,
      show: false, // 初始化完成前不显示
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false, // 禁用拼写检查以提升性能
      },
    });

    // 处理窗口位置
    if (typeof windowState.x === 'number' && typeof windowState.y === 'number') {
      // 确保窗口位置在可视区域内
      const { x, y } = windowState;
      if (x >= 0 && x <= screenWidth && y >= 0 && y <= screenHeight) {
        try {
          const bounds = mainWindow.getBounds();
          mainWindow.setBounds({ ...bounds, x, y });
        } catch (err) {
          // 如果设置位置失败，忽略并居中
          mainWindow.center();
        }
      } else {
        mainWindow.center();
      }
    } else {
      mainWindow.center();
    }

    // 保存窗口状态
    const saveWindowState = () => {
      try {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMaximized()) {
          store.set('windowState', mainWindow.getBounds());
        }
      } catch (err) {
        console.warn('Failed to save window state:', err);
      }
    };

    // 节流保存窗口状态
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

    // 页面加载完成后显示窗口
    mainWindow.show();

    return mainWindow;
  } catch (error) {
    console.error('Error creating window:', error);
    throw error;
  }
}

// 应用程序生命周期管理
app.whenReady().then(async () => {
  try {
    // 动态导入 electron-store，因为它是 ESM 包，不能用 require() 在 CommonJS 中加载
    const storeModule = await import('electron-store');
    Store = storeModule.default || storeModule;
    store = new Store({
      defaults: {
        theme: 'system',
        windowState: {
          width: 1260,
          height: 840
        }
      }
    });

    initializeServices();
    await registerHandlers();
    await createWindow();

    // macOS 应用程序激活处理
    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow();
      }
    });

  } catch (error) {
    console.error('Application initialization failed:', error);
    // If initialization fails early, give a moment for logs to flush then quit
    setTimeout(() => app.quit(), 100);
  }
});

// 窗口关闭处理
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 优雅退出
app.on('before-quit', () => {
  if (mainWindow) {
    // Allow saving state before we remove listeners
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
    mainWindow.removeAllListeners('close');
    mainWindow = null;
  }
});

// 未捕获的异常处理
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
