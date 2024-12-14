// DOM Elements - Existing
topicInput = document.getElementById('topic'); // Declare topicInput in the global scope and assign the DOM element
const gradeInput = document.getElementById('grade');
const questionContainer = document.getElementById('question-container');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const explanationContainer = document.getElementById('explanation-container');
const explanationText = document.getElementById('explanation-text');
const linksContainer = document.getElementById('links-container');
const nextButtonContainer = document.getElementById('next-button-container');
const nextButton = document.getElementById('next-question');
let learnButton; // Declare learnButton in the global scope
// Progress Elements - Existing plus new ones
const topicsMasteredElement = document.getElementById('topics-mastered');
const insightsGainedElement = document.getElementById('insights-gained');
const learningStreakElement = document.getElementById('learning-streak');
const progressGreeting = document.getElementById('progress-greeting');
const currentTopicElement = document.getElementById('current-topic');
const currentLevelElement = document.getElementById('current-level');
const uniqueQuestionsElement = document.getElementById('insights-gained'); // Use insightsGainedElement for unique questions
const recentTopicsElement = document.getElementById('recent-topics'); // Add recentTopicsElement
const settingsButton = document.getElementById('settings-button');
const generatingMessage = document.getElementById('generating-message'); // Add the new message element
const refreshButton = document.getElementById('refresh-question'); // Add the new refresh button

// Application State
let currentQuestion = null;
let isGenerating = false;
let currentTopic = '';
let currentLevel = '';
let userName = '';

// Initialize the application
async function initializeApp() {
    try {
        // Load user settings
        const settings = await window.electronAPI.getSettings();
        if (settings && settings.name) {
            userName = settings.name;
            updateGreeting();
        }

        const progress = await window.electronAPI.getProgress();
        updateProgressDisplay(progress);
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    learnButton = document.getElementById('lets-learn'); // Assign learnButton here
    const nextButton = document.getElementById('next-question');
    const refreshButton = document.getElementById('refresh-question');

    // Button handlers
    learnButton.addEventListener('click', generateQuestion);
    nextButton.addEventListener('click', handleNextQuestion);
    refreshButton.addEventListener('click', handleRefreshQuestion);

    // Settings button
    settingsButton.addEventListener('click', handleSettingsClick);

    // Enter key handlers
    topicInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (gradeInput.value) generateQuestion();
            else gradeInput.focus();
        }
    });

    gradeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            generateQuestion();
        }
    });

    // IPC Event listeners
    window.electronAPI.onQuestionGenerated(handleQuestionGenerated);
    window.electronAPI.onQuestionError(handleQuestionError);
    window.electronAPI.onProgressUpdated(updateProgressDisplay);
}

function handleSettingsClick() {
   window.location.href = 'setup.html';
}

// Update greeting with user's name and time of day
function updateGreeting() {
    const hour = new Date().getHours();
    let greeting = '';
    
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 18) greeting = 'Good afternoon';
    else greeting = 'Good evening';

    if (userName) {
        progressGreeting.textContent = `${greeting}, ${userName}!`;
    } else {
        progressGreeting.textContent = `${greeting}!`;
    }
}

// Update progress display
function updateProgressDisplay(progress) {
    if (topicsMasteredElement) {
        topicsMasteredElement.textContent = progress.topicsMastered;
    }
    if (insightsGainedElement) {
        insightsGainedElement.textContent = progress.uniqueQuestions;
    }
    if (learningStreakElement) {
        learningStreakElement.textContent = progress.learningStreak;
    }

    // Update current topic if available
    if (currentTopic && currentLevel) {
        currentTopicElement.textContent = `Current Topic: ${currentTopic}`;
    }

    // Update recent topics
    if (progress && progress.recentTopics && progress.recentTopics.length > 0 && recentTopicsElement) {
        const recentTopicsList = progress.recentTopics.slice(-5).map(topic => `<span>${topic}</span>`).join('');
        recentTopicsElement.innerHTML = `Recent Topics: ${recentTopicsList}`;
    }
}

// Generate question
function generateQuestion() {
    if (isGenerating) {
        return;
    }

    const topic = topicInput.value.trim();
    const level = gradeInput.value.trim();

    if (!topic || !level) {
        alert('Please enter both topic and grade level');
        return;
    }

    currentTopic = topic;
    currentLevel = level;

    isGenerating = true;
    showLoadingState();
    nextButtonContainer.classList.add('hidden');
    resetUI();
    window.electronAPI.generateQuestion(topic, level);
}

// Handle next question
function handleNextQuestion() {
    resetUI();
    generateQuestion();
}

// Handle refresh question
function handleRefreshQuestion() {
    resetUI();
    generateQuestion();
}

// Handle received question
function handleQuestionGenerated(data) {
    isGenerating = false;
    hideLoadingState();

    if (!data || !data.question) {
        handleQuestionError('Invalid question data received');
        return;
    }

    currentQuestion = data;
    displayQuestion(data);
    
    if (data.progress) {
        updateProgressDisplay(data.progress);
    }

    // Update current topic display
    currentLevelElement.textContent = `${currentLevel} level`;
}

// Display question in UI
function displayQuestion(questionData) {
    questionText.textContent = questionData.question;
    optionsContainer.innerHTML = '';
    nextButtonContainer.classList.add('hidden');
    refreshButton.classList.remove('hidden');

    questionData.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'answer-option';
        button.textContent = option;
        button.onclick = () => handleAnswer(option);
        optionsContainer.appendChild(button);
    });
}

// Handle answer selection
function handleAnswer(selectedOption) {
    if (!currentQuestion || isGenerating) return;

    const isCorrect = selectedOption === currentQuestion.answer;
    
    // Update UI
    const options = optionsContainer.querySelectorAll('.answer-option');
    options.forEach(button => {
        button.disabled = true;
        if (button.textContent === selectedOption) {
            button.classList.add(isCorrect ? 'correct' : 'incorrect');
        } else if (button.textContent === currentQuestion.answer && !isCorrect) {
            button.classList.add('correct');
        }
    });

    // Show explanation
    displayExplanation(currentQuestion.explanation, currentQuestion.links, currentQuestion.noLinksMessage, currentQuestion.searchEngines);
    
    // Show next question button
    nextButtonContainer.classList.remove('hidden');
    refreshButton.classList.add('hidden');

    // Submit answer for progress update
    window.electronAPI.submitAnswer(isCorrect, currentQuestion.topic, currentQuestion.level, selectedOption);
}

// Display explanation and resources
function displayExplanation(explanation, links, noLinksMessage, searchEngines) {
    explanationContainer.classList.remove('hidden');
    explanationText.textContent = explanation;
    
    linksContainer.innerHTML = '';
    if (links && links.length > 0) {
        links.forEach(link => {
            const button = document.createElement('button');
            button.className = 'learn-more-link';
            button.textContent = link;
            button.onclick = () => window.open(link, '_blank');
            linksContainer.appendChild(button);
        });
    } else if (noLinksMessage && searchEngines) {
        const message = document.createElement('p');
        message.textContent = noLinksMessage;
        linksContainer.appendChild(message);

        const searchList = document.createElement('ul');
        searchEngines.forEach(engine => {
            const listItem = document.createElement('li');
            const link = document.createElement('a');
            link.href = `${engine}${currentTopic}`;
            link.textContent = engine.split('/')[2];
            link.target = '_blank';
            listItem.appendChild(link);
        });
        linksContainer.appendChild(searchList);
    }
}

// Handle errors
function handleQuestionError(error) {
    isGenerating = false;
    hideLoadingState();
    generatingMessage.classList.add('hidden'); // Hide the generating message
    questionText.textContent =  `An error occurred. ${error}`;
    optionsContainer.innerHTML = '';
    explanationContainer.classList.add('hidden');
    nextButtonContainer.classList.add('hidden');
    refreshButton.classList.add('hidden');
}

// UI State Management
function showLoadingState() {
    learnButton.disabled = true;
    questionText.textContent = '';
    questionContainer.classList.remove('loading');
    generatingMessage.classList.remove('hidden'); // Show the generating message
    refreshButton.classList.add('hidden');
}

function hideLoadingState() {
    learnButton.disabled = false;
    questionContainer.classList.remove('loading');
    generatingMessage.classList.add('hidden'); // Hide the generating message
}

// Function to reset UI state
function resetUI() {
     questionText.textContent = '';
    optionsContainer.innerHTML = '';
    explanationContainer.classList.add('hidden');
    explanationText.textContent = '';
    linksContainer.innerHTML = '';
    
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});