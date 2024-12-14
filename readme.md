# InfiniteLearning - Your AI-powered guide to endless learning.

InfiniteLearning is an Electron-based desktop application that helps you learn about any topic through interactive multiple-choice questions and explanations powered by Google's Gemini API.

## Features

*   **Interactive Learning:** Generates multiple-choice questions on demand for any topic you choose.
*   **Detailed Explanations:** Provides comprehensive explanations for each question, helping you understand the core concepts.
*   **Learning Resources:** Offers links to relevant articles, websites and other learning resources.
*   **Progress Tracking:** Monitors your learning streak, topics mastered, and insights gained, all stored locally.
*   **Customizable Levels:** Choose the difficulty level for questions (Discover, Explore, Apply, Deepen).
*   **Settings:** Save your settings, including your Gemini API Key and your name.
*   **Refresh Questions:** Refresh the current question if you find it unsuitable.

## Setup Instructions

1.  **Prerequisites:**
    *   **Node.js and npm:** Ensure you have Node.js and npm (Node Package Manager) installed on your system. You can download them from [https://nodejs.org](https://nodejs.org).
    *   **Electron:** The app is built on Electron, it is required to run the application. This will be downloaded when you run `npm install`.
    *   **Gemini API Key:** You need a Gemini API key from Google AI Studio. You can obtain one from [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey).
    *   **Git (Optional):** If you want to clone this project from GitHub.

2.  **Clone the Repository:** (Skip this step if downloading directly)

    ```bash
    git clone git@github.com:your-username/InfiniteLearning.git
    cd InfiniteLearning
    ```

3.  **Install Dependencies:**

    ```bash
    npm install
    ```

4.  **Run the Application:**

    ```bash
    npx electron .
    ```

5.  **Initial Setup:**
    *   When the application starts for the first time, it will open a setup window.
    *   Enter your name and your Gemini API key into the respective fields.
    *   Click `Start Learning` to proceed.
    *   If you need to change your name or API key, click on the settings button at the top right of the main app.

6.  **Start Learning:**
    *   Enter a topic you want to learn about in the "What would you like to learn about?" field.
    *   Select your desired level from the dropdown (Discover, Explore, Apply, or Deepen).
    *   Click the `Let's Learn!` button to generate your first question.

7.  **Answer Questions:**
    *   Read the multiple-choice question, and select the correct answer.
    *   The selected option will be marked as "correct" or "incorrect" and an explanation is displayed.

8.  **Navigate through questions**
    * Click on "Next Question" to go to a new question.
    * Click on "Refresh" to get a new question.

## Contributing

Contributions are always welcome! If you have ideas or bug fixes, feel free to create a pull request.

## License

This project is licensed under the MIT License.