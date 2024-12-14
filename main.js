const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { generateQuestion } = require('./gemini');
const { generateChatResponse } = require('./gemini');
const chatSessions = new Map();

let db;
let mainWindow;

// Promisify database methods
function setupDatabaseHelpers(database) {
    database.runAsync = function(sql, params) {
        return new Promise((resolve, reject) => {
            this.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    };

    database.getAsync = function(sql, params) {
        return new Promise((resolve, reject) => {
            this.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    };

    database.allAsync = function(sql, params) {
        return new Promise((resolve, reject) => {
            this.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };

    return database;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true,
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:"],
                    connectSrc: ["'self'"],
                    fontSrc: ["'self'"],
                },
            },
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.webContents.openDevTools(); // Enable for debugging
}

async function initDatabase() {
    return new Promise((resolve, reject) => {
        const database = new sqlite3.Database('quiz.db', async (err) => {
            if (err) {
                console.error('[Database] Connection error:', err.message);
                reject(err);
                return;
            }

            // Setup async helpers first
            db = setupDatabaseHelpers(database);

            try {
                // User Settings table
                await db.runAsync(`
                    CREATE TABLE IF NOT EXISTS user_settings (
                        id INTEGER PRIMARY KEY CHECK (id = 1),
                        name TEXT NOT NULL,
                        api_key TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Questions table
                await db.runAsync(`
                    CREATE TABLE IF NOT EXISTS questions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        topic TEXT NOT NULL,
                        level TEXT NOT NULL,
                        question TEXT NOT NULL,
                        options TEXT NOT NULL,
                        answer TEXT NOT NULL,
                        explanation TEXT NOT NULL,
                        links TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Progress table
                await db.runAsync(`
                    CREATE TABLE IF NOT EXISTS user_progress (
                        id INTEGER PRIMARY KEY CHECK (id = 1),
                        topics_mastered INTEGER DEFAULT 0,
                        insights_gained INTEGER DEFAULT 0,
                        learning_streak INTEGER DEFAULT 0,
                        last_session_date DATE
                    )
                `);

                // Initialize user_progress if empty
                await db.runAsync(`
                    INSERT OR IGNORE INTO user_progress (
                        id, 
                        topics_mastered, 
                        insights_gained, 
                        learning_streak, 
                        last_session_date
                    ) VALUES (1, 0, 0, 0, NULL)
                `);

                // Check if setup is needed
                const settings = await db.getAsync('SELECT * FROM user_settings WHERE id = 1');
                const needsSetup = !settings;

                resolve(needsSetup);
            } catch (error) {
                console.error('[Database] Initialization error:', error);
                reject(error);
            }
        });
    });
}

async function updateProgress(topic, isCorrect) {
    const today = new Date().toISOString().split('T')[0];

    try {
        const currentProgress = await db.getAsync(
            'SELECT * FROM user_progress WHERE id = 1'
        );

        let streakUpdate = 'learning_streak = learning_streak';
        if (currentProgress.last_session_date !== today) {
            if (isCorrect) {
                streakUpdate = 'learning_streak = learning_streak + 1';
            } else {
                streakUpdate = 'learning_streak = 0';
            }
        }

        const topicCount = await db.getAsync(
            'SELECT COUNT(*) as count FROM questions WHERE topic = ?',
            [topic]
        );

        let topicsMasteredUpdate = 'topics_mastered = topics_mastered';
        if (isCorrect && topicCount.count === 0) {
            topicsMasteredUpdate = 'topics_mastered = topics_mastered + 1';
        }

        await db.runAsync(`
            UPDATE user_progress 
            SET 
                ${topicsMasteredUpdate},
                insights_gained = insights_gained + ?,
                ${streakUpdate},
                last_session_date = ?
            WHERE id = 1
        `, [isCorrect ? 1 : 0, today]);

    } catch (error) {
        console.error('[Progress] Error updating progress:', error);
        throw error;
    }
}

async function getProgress() {
    try {
        const progress = await db.getAsync(`
            SELECT 
                topics_mastered,
                insights_gained,
                learning_streak,
                last_session_date
            FROM user_progress 
            WHERE id = 1
        `);

        const uniqueTopics = await db.allAsync(
            `SELECT DISTINCT topic FROM questions`
        );

        const uniqueQuestions = await db.allAsync(
            `SELECT DISTINCT question FROM questions`
        );
        
        return {
            topicsMastered: uniqueTopics.length,
            insightsGained: progress?.insights_gained || 0,
            learningStreak: progress?.learning_streak || 0,
            lastSessionDate: progress?.last_session_date,
            recentTopics: uniqueTopics.map(row => row.topic),
            uniqueQuestions: uniqueQuestions.length
        };
    } catch (error) {
        console.error('[Progress] Error fetching progress:', error);
        return {
            topicsMastered: 0,
            insightsGained: 0,
            learningStreak: 0,
            lastSessionDate: null,
            recentTopics: [],
            uniqueQuestions: 0
        };
    }
}

async function loadUserSettings() {
    try {
        const settings = await db.getAsync('SELECT * FROM user_settings WHERE id = 1');
        if (settings) {
            process.env.GEMINI_API_KEY = settings.api_key;
            console.log('[Settings] Loaded user settings for:', settings.name);
        }
        return settings;
    } catch (error) {
        console.error('[Settings] Error loading settings:', error);
        return null;
    }
}

async function getChatSession(topic, level) {
    const key = `${topic}-${level}`;
    if(!chatSessions.has(key)){
         chatSessions.set(key, { messages: [] });
    }
    return chatSessions.get(key);
 }

// App initialization
app.whenReady().then(async () => {
    try {
        const needsSetup = await initDatabase();
        if (needsSetup) {
            mainWindow = new BrowserWindow({
                width: 800,
                height: 600,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, 'preload.js')
                }
            });
            mainWindow.loadFile('setup.html');
        } else {
            await loadUserSettings();
            createWindow();
        }
    } catch (error) {
        console.error('[Main] Initialization error:', error);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (db) {
            db.close((err) => {
                if (err) {
                    console.error('[Database] Error closing database:', err);
                }
            });
        }
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC Handlers
ipcMain.handle('get-progress', async () => {
    try {
        return await getProgress();
    } catch (error) {
        console.error('[IPC] Error getting progress:', error);
        return {
            topicsMastered: 0,
            insightsGained: 0,
            learningStreak: 0,
            recentTopics: [],
            uniqueQuestions: 0
        };
    }
});

ipcMain.handle('save-settings', async (event, settings) => {
    try {
        await db.runAsync(`
            INSERT OR REPLACE INTO user_settings (id, name, api_key)
            VALUES (1, ?, ?)
        `, [settings.name, settings.apiKey]);
        
        process.env.GEMINI_API_KEY = settings.apiKey;
        return true;
    } catch (error) {
        console.error('[Settings] Error saving settings:', error);
        throw error;
    }
});

ipcMain.handle('get-settings', async () => {
    try {
        return await db.getAsync('SELECT name, api_key FROM user_settings WHERE id = 1');
    } catch (error) {
        console.error('[Settings] Error getting settings:', error);
        throw error;
    }
});

ipcMain.on('generate-question', async (event, topic, level) => {
    try {
        // Load user settings before generating the question
        const settings = await db.getAsync('SELECT api_key FROM user_settings WHERE id = 1');
        if (settings && settings.api_key) {
          const {messages} = await getChatSession(topic, level);

          const chatResponse = await generateChatResponse(settings.api_key, topic, level, messages);

           await db.runAsync(
               'INSERT INTO questions (topic, level, question, options, answer, explanation, links) VALUES (?, ?, ?, ?, ?, ?, ?)',
               [
                   topic,
                   level,
                   chatResponse.question,
                   JSON.stringify(chatResponse.options),
                   chatResponse.answer,
                   chatResponse.explanation,
                   JSON.stringify(chatResponse.links)
               ]
           );
   
            const progress = await getProgress();

             const session = await getChatSession(topic, level);
             session.messages = chatResponse.messages;
            
            event.reply('question-generated', {
                ...chatResponse,
                progress
            });

        } else {
             event.reply('question-error', 'API key not found. Please set up the app.');
        }
    } catch (error) {
          event.reply('question-error', `Failed to generate question. ${error.message || 'Please check your API Key and try again'}`);
    }
});

ipcMain.on('submit-answer', async (event, isCorrect, topic, level, userAnswer) => {
    try {
        console.log("[Main] submit-answer received:", { isCorrect, topic, level, userAnswer });

        if (!topic || topic.trim() === "") {
            console.error("[Main] Error: topic is missing or empty");
            event.reply('progress-error', 'Topic is missing or empty');
            return;
        }

        if (!level || level.trim() === "") {
            console.error("[Main] Error: level is missing or empty");
            event.reply('progress-error', 'Level is missing or empty');
            return;
        }

        await updateProgress(topic, isCorrect);
          const settings = await db.getAsync('SELECT api_key FROM user_settings WHERE id = 1');
            if (settings && settings.api_key) {
                 const session = await getChatSession(topic, level);
                const chatResponse = await generateChatResponse(settings.api_key, topic, level, session.messages, isCorrect, userAnswer);

                try {
                    await db.runAsync(
                        'INSERT INTO questions (topic, level, question, options, answer, explanation, links) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [
                            topic,
                            level,
                            chatResponse.question,
                            JSON.stringify(chatResponse.options),
                            chatResponse.answer,
                            chatResponse.explanation,
                            JSON.stringify(chatResponse.links)
                        ]
                    );
                } catch (dbError) {
                    console.error("[Main] Database insert error:", dbError);
                    event.reply('progress-error', 'Failed to save question to database');
                    return;
                }

                 session.messages = chatResponse.messages;
                const progress = await getProgress();
               event.reply('question-generated', {
                    ...chatResponse,
                    progress
                });

            }
            else {
                 event.reply('question-error', 'API key not found. Please set up the app.');
            }
      } catch (error) {
        console.error('[IPC] Error submitting answer:', error);
        event.reply('progress-error', 'Failed to update progress');
    }
});