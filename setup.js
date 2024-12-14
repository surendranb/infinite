// DOM Elements
const setupForm = document.getElementById('setup-form');
const nameInput = document.getElementById('name');
const apiKeyInput = document.getElementById('api-key');
const startButton = document.getElementById('start-learning');


// Debug logging
function log(section, ...args) {
    console.log(`[${section}]`, ...args);
}

async function handleSetupSubmit(e) {
    e.preventDefault();
    log('Setup', 'Handling setup submission');

    const name = nameInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!name || !apiKey) {
        alert('Please fill in all fields');
        return;
    }

    try {
        startButton.disabled = true;
        startButton.textContent = 'Saving settings...';

        log('Setup', 'Saving settings...');
        await window.electronAPI.saveSettings({ name, apiKey });
        
        log('Setup', 'Settings saved, redirecting...');
        window.location.href = 'index.html';
    } catch (error) {
        log('Error', 'Setup failed:', error);
        alert('Error saving settings. Please try again.');
        startButton.disabled = false;
        startButton.textContent = 'Save Settings';
    }
}

// Event Listeners
setupForm.addEventListener('submit', handleSetupSubmit);

// Input validation
function validateInputs() {
    const isValid = nameInput.value.trim() && apiKeyInput.value.trim();
    startButton.disabled = !isValid;
}

// Load existing settings and set input values
async function loadSettings() {
    try {
        const settings = await window.electronAPI.getSettings();
       if (settings) {
            nameInput.value = settings.name;
            apiKeyInput.value = settings.apiKey;
            startButton.textContent = 'Save Settings';
            validateInputs();
        } else {
             startButton.textContent = 'Start Learning';
             validateInputs();
        }

    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

nameInput.addEventListener('input', validateInputs);
apiKeyInput.addEventListener('input', validateInputs);

// Initialize - load settings and validate inputs
loadSettings();
validateInputs();
log('Setup', 'Setup page initialized');