const { contextBridge, ipcRenderer } = require('electron');

// List of valid channels for security
const validChannels = [
    'generate-question',
    'question-generated',
    'question-error',
    'submit-answer',
    'progress-updated',
    'progress-error',
    'save-settings',
    'get-settings'  // Added new channel
];

// Validate channel for security
function isValidChannel(channel) {
    return validChannels.includes(channel);
}

// Debug logging wrapper
function logIPC(direction, channel, ...args) {
    const safeArgs = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg
    );
    console.log(`[IPC ${direction}] ${channel}:`, ...safeArgs);
}

// Expose protected APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // Get progress
    getProgress: async () => {
        logIPC('Send', 'get-progress');
        try {
            const progress = await ipcRenderer.invoke('get-progress');
            logIPC('Receive', 'get-progress response:', progress);
            return progress;
        } catch (error) {
            console.error('[Preload] Error getting progress:', error);
            return {
                topicsMastered: 0,
                insightsGained: 0,
                learningStreak: 0
            };
        }
    },

    // Settings operations
    saveSettings: async (settings) => {
        logIPC('Send', 'save-settings', { name: settings.name, apiKey: '***' });
        try {
            return await ipcRenderer.invoke('save-settings', settings);
        } catch (error) {
            console.error('[Preload] Error saving settings:', error);
            throw error;
        }
    },

    getSettings: async () => {
        logIPC('Send', 'get-settings');
        try {
            const settings = await ipcRenderer.invoke('get-settings');
            logIPC('Receive', 'get-settings response:', { name: settings?.name, apiKey: '***' });
            return settings;
        } catch (error) {
            console.error('[Preload] Error getting settings:', error);
            return null;
        }
    },

    // Generate question (existing)
    generateQuestion: (topic, level) => {
        if (typeof topic === 'string' && typeof level === 'string') {
            logIPC('Send', 'generate-question', { topic, level });
            ipcRenderer.send('generate-question', topic, level);
        } else {
            console.error('[Preload] Invalid parameters for generateQuestion:', { topic, level });
        }
    },

    // Submit answer (existing)
    submitAnswer: (isCorrect, topic, level, userAnswer) => {
        if (typeof isCorrect === 'boolean' && typeof topic === 'string' && typeof level === 'string' && typeof userAnswer === 'string') {
            logIPC('Send', 'submit-answer', { isCorrect, topic, level, userAnswer });
            ipcRenderer.send('submit-answer', isCorrect, topic, level, userAnswer);
        } else {
            console.error('[Preload] Invalid parameter for submitAnswer:', { isCorrect, topic, level, userAnswer });
        }
    },

    // Event listeners with cleanup (existing)
    onQuestionGenerated: (callback) => {
        const wrappedCallback = (event, data) => {
            logIPC('Receive', 'question-generated', data);
            callback(data);
        };
        ipcRenderer.on('question-generated', wrappedCallback);
        return () => {
            ipcRenderer.removeListener('question-generated', wrappedCallback);
        };
    },

    onQuestionError: (callback) => {
        const wrappedCallback = (event, error) => {
            logIPC('Receive', 'question-error', error);
            callback(error);
        };
        ipcRenderer.on('question-error', wrappedCallback);
        return () => {
            ipcRenderer.removeListener('question-error', wrappedCallback);
        };
    },

    onProgressUpdated: (callback) => {
        const wrappedCallback = (event, progress) => {
            logIPC('Receive', 'progress-updated', progress);
            callback(progress);
        };
        ipcRenderer.on('progress-updated', wrappedCallback);
        return () => {
            ipcRenderer.removeListener('progress-updated', wrappedCallback);
        };
    }
});