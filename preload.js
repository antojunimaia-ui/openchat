const { contextBridge, ipcRenderer } = require('electron');

// Expor APIs seguras para o renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (message) => ipcRenderer.invoke('send-message', message),
  getMessages: () => ipcRenderer.invoke('get-messages'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Chat history management
  saveChat: (chatData) => ipcRenderer.invoke('save-chat', chatData),
  loadChat: (chatId) => ipcRenderer.invoke('load-chat', chatId),
  getChatList: () => ipcRenderer.invoke('get-chat-list'),
  deleteChat: (chatId) => ipcRenderer.invoke('delete-chat', chatId),
  
  // Memory system
  saveMemory: (memoryData) => ipcRenderer.invoke('save-memory', memoryData),
  updateMemory: (memoryId, newContent) => ipcRenderer.invoke('update-memory', memoryId, newContent),
  getMemories: () => ipcRenderer.invoke('get-memories'),
  deleteMemory: (memoryId) => ipcRenderer.invoke('delete-memory', memoryId),
  
  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  
  // System prompt management
  readSystemPrompt: () => ipcRenderer.invoke('read-system-prompt'),
  saveSystemPrompt: (promptText) => ipcRenderer.invoke('save-system-prompt', promptText),
  
  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Listeners para eventos
  onMessageReceived: (callback) => {
    ipcRenderer.on('message-received', callback);
  },
  
  onStreamingUpdate: (callback) => {
    ipcRenderer.on('streaming-update', callback);
  },
  
  onStreamingComplete: (callback) => {
    ipcRenderer.on('streaming-complete', callback);
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});