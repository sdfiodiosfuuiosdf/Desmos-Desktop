// Import required modules
import { ipcRenderer } from 'electron';
import fs from 'fs';

let StateData = {
    filePath: '',
    lastState: null,
};

// Helper function: show an alert with CSS animation
function showAlert(msg) {
    const container = document.getElementById('container');
    const alertDiv = document.createElement('div');
    alertDiv.className = 'floating';
    alertDiv.id = 'message';
    alertDiv.textContent = msg;

    container.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.style.opacity = 0;
        alertDiv.addEventListener('transitionend', () => alertDiv.remove());
    }, 2000);
}

// Helper function: set calculator state
function setCalculatorState(desFileData) {
    try {
        const state = JSON.parse(desFileData);
        calculator.setState(state);
    } catch {
        calculator.setBlank();
    }
}

// Helper function: save text to a file
async function saveText(text, filePath) {
    try {
        await fs.promises.writeFile(filePath, text);
        showAlert('Saved successfully. 😉');
    } catch (err) {
        showAlert(`Error saving file: ${err.message}`);
    }
}

// Update the window title based on the current state
function setTitle() {
    const title = StateData.filePath
        ? `Desmos - ${StateData.filePath}`
        : 'Desmos - * Untitled';
    document.title = title;
    ipcRenderer.send('renderer-request', { msg: 'TitleChanged', data: StateData.filePath });
}

// Check if the state is null
function isStateNull() {
    return (
        StateData.lastState == null &&
        calculator.getState().expressions.list[0]?.latex === undefined
    );
}

// Check if the current state is saved
function isSaved() {
    if (isStateNull()) return true;
    if (!StateData.filePath || !StateData.lastState) return false;

    const currentState = JSON.stringify(calculator.getState().extensions);
    const lastState = JSON.stringify(StateData.lastState.extensions);
    return currentState === lastState;
}

// Prompt the user to save if needed
async function askSaveIfNeed() {
    if (isSaved()) return true;

    const { response } = await ipcRenderer.invoke('showMessageBox', {
        message: 'Do you want to save the current document?',
        type: 'question',
        buttons: ['Yes', 'No', 'Cancel'],
    });

    if (response === 0) await saveFile(); // Yes
    return response !== 2; // Not Cancel
}

// Create a new file
async function newFile() {
    const canceled = !(await askSaveIfNeed());
    if (canceled) return;

    calculator.setBlank();
    StateData.filePath = '';
    setTitle();
}

// Open an existing file
async function openFile(filePath = null, init = false) {
    if (!init) {
        const canceled = !(await askSaveIfNeed());
        if (canceled) return;
    }

    if (!filePath) {
        const { filePaths } = await ipcRenderer.invoke('showOpenDialog', {
            filters: [{ name: 'Desmos Files', extensions: ['des'] }],
        });
        if (!filePaths || filePaths.length === 0) return;
        filePath = filePaths[0];
    }

    try {
        const data = await fs.promises.readFile(filePath, 'utf-8');
        setCalculatorState(data);
        StateData.filePath = filePath;
        StateData.lastState = data;
        setTitle();
    } catch (err) {
        showAlert(`Error opening file: ${err.message}`);
        calculator.setBlank();
    }
}

// Save the current state to a file
async function saveFile() {
    if (!StateData.filePath) {
        const { filePath } = await ipcRenderer.invoke('showSaveDialog', {
            filters: [{ name: 'Desmos Files', extensions: ['des'] }],
        });
        if (!filePath) return;
        StateData.filePath = filePath;
    }

    const stateContent = JSON.stringify(calculator.getState(), null, 4);
    StateData.lastState = calculator.getState();
    await saveText(stateContent, StateData.filePath);
    setTitle();
}

// Save as a new file
async function saveAsFile() {
    const { filePath } = await ipcRenderer.invoke('showSaveDialog', {
        filters: [{ name: 'Desmos Files', extensions: ['des'] }],
    });
    if (!filePath) return;

    StateData.filePath = filePath;
    const stateContent = JSON.stringify(calculator.getState(), null, 4);
    StateData.lastState = calculator.getState();
    await saveText(stateContent, StateData.filePath);
    setTitle();
}

// Export the current graph as an image
async function exportImage() {
    const image = calculator.screenshot({
        width: window.innerWidth,
        height: window.innerHeight,
        targetPixelRatio: 2,
    });

    const imageData = image.replace(/^data:image\/png;base64,/, '');

    const { filePath } = await ipcRenderer.invoke('showSaveDialog', {
        filters: [{ name: 'Images', extensions: ['png'] }],
    });
    if (!filePath) return;

    try {
        await fs.promises.writeFile(filePath, imageData, 'base64');
        showAlert('Successfully exported. 😉');
    } catch (err) {
        showAlert(`Error exporting image: ${err.message}`);
    }
}

// Exit the application
async function exitApp() {
    const shouldExit = await askSaveIfNeed();
    if (shouldExit) {
        showAlert('Exiting...', 0.02);
        setTimeout(() => ipcRenderer.send('app-quit'), 600);
    }
}

// Handle IPC messages from the main process
ipcRenderer.on('mainprocess-request', (event, arg) => {
    switch (arg.msg) {
        case 'NewFile':
            newFile();
            break;
        case 'Init':
            openFile(arg.data, true);
            break;
        case 'OpenFile':
            openFile();
            break;
        case 'SaveFile':
            saveFile();
            break;
        case 'SaveAsFile':
            saveAsFile();
            break;
        case 'ExportImage':
            exportImage();
            break;
        case 'Undo':
            calculator.undo();
            break;
        case 'Redo':
            calculator.redo();
            break;
        case 'Clear':
            calculator.setBlank();
            break;
        case 'Exitting':
            exitApp();
            break;
        default:
            break;
    }
});

// Handle the Escape key for exiting fullscreen or closing the window
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        const currentWindow = require('@electron/remote').getCurrentWindow();
        if (currentWindow.isFullScreen()) {
            currentWindow.setFullScreen(false);
        } else {
            currentWindow.close();
        }
    }
});

// Notify the main process for initialization
ipcRenderer.send('renderer-request', { msg: 'ToInit' });
