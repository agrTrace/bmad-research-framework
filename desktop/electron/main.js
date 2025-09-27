const path = require('node:path');
const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');

// You must require or define your "store" utility here
// Replace with your actual persistent store implementation
const Store = require('electron-store');
const store = new Store();

const createCatalogService = require(path.join(__dirname, '..', '..', 'services', 'saas', 'src', 'services', 'catalog-service'));
const createProjectService = require(path.join(__dirname, '..', '..', 'services', 'saas', 'src', 'services', 'project-service'));

const rootDir = path.resolve(__dirname, '..', '..');
const catalogService = createCatalogService({ rootDir });
const projectService = createProjectService({ rootDir, catalogService });
let handlersRegistered = false;

async function registerHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  nativeTheme.themeSource = store.get('theme', 'system');

  ipcMain.handle('preferences:get', () => {
    return {
      theme: store.get('theme', 'system'),
    };
  });

  ipcMain.handle('preferences:set-theme', (_event, theme) => {
    if (!['light', 'dark', 'system'].includes(theme)) return;
    store.set('theme', theme);
    nativeTheme.themeSource = theme;
  });

  ipcMain.handle('catalog:overview', async () => {
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
        { type: 'core', source: 'core', name: '核心能力', version: null },
        ...expansions.map((pack) => ({
          type: 'expansion',
          source: `expansion:${pack.id}`,
          packId: pack.id,
          name: pack.name,
          version: pack.version,
          description: pack.description,
        })),
      ],
    };
  });

  ipcMain.handle('catalog:agent-detail', async (_event, agentId) => {
    return catalogService.getAgent(agentId);
  });

  ipcMain.handle('projects:generate-plan', async (_event, payload) => {
    return projectService.createProjectPlan(payload);
  });

  ipcMain.handle('projects:list-workflows', async () => {
    return catalogService.listWorkflows();
  });

  ipcMain.handle('catalog:list-expansions', async () => {
    return catalogService.listExpansions();
  });
}

async function createWindow() {
  const windowState = store.get('windowState', { width: 1260, height: 840 });

  const win = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    minWidth: 960,
    minHeight: 640,
    title: 'BMAD Research Framework — Desktop',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (windowState.x !== undefined && windowState.y !== undefined) {
    win.setBounds({ ...win.getBounds(), x: windowState.x, y: windowState.y });
  }

  win.on('close', () => {
    const bounds = win.getBounds();
    store.set('windowState', bounds);
  });

  await win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  return win;
}

app.whenReady().then(async () => {
  await registerHandlers();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
