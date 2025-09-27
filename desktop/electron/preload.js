const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bmadDesktop', {
  loadOverview: () => ipcRenderer.invoke('catalog:overview'),
  listWorkflows: () => ipcRenderer.invoke('projects:list-workflows'),
  listExpansions: () => ipcRenderer.invoke('catalog:list-expansions'),
  getAgentDetail: (agentId) => ipcRenderer.invoke('catalog:agent-detail', agentId),
  generatePlan: (payload) => ipcRenderer.invoke('projects:generate-plan', payload),
  getPreferences: () => ipcRenderer.invoke('preferences:get'),
  setTheme: (theme) => ipcRenderer.invoke('preferences:set-theme', theme),
});
