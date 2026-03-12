// ===== GLOBAL STATE =====
let canvasState = {
    cards: [],
    connections: [],
    notes: [],
    fences: [],
    magnets: []
};

let interactionHistory = [];
let appConfig = {
    apiKey: ''
};

// User authentication
let currentUser = null;

// Current history record tracking
let currentHistoryRecordId = null;

// Chat state
let chatMessages = [];
let currentChatFile = null;

// Image generator state
let currentGeneratedImage = null;
let currentImagePrompt = '';
let currentImageFilename = '';
//let currentImageFilename = '';

// Image analyzer state
let currentAnalyzeImage = null;
let currentAnalysisResult = null;
let uploadMethod = 'file';

// Text analyzer state
let currentTextFile = null;
let currentTextAnalysisResult = null;

// Drag state
let draggedElement = null;
let dragOffset = { x: 0, y: 0 };

// Resize state
let resizingCard = null;
let resizeStartSize = { width: 0, height: 0 };
let resizeStartPos = { x: 0, y: 0 };

// Linking state
let linkingMode = false;
let linkSourceCard = null;

// Note editing
let currentNoteCardId = null;

// Sticky note state
let selectedNoteColor = '#fff59d';

// Fence drawing state
let isDrawingFence = false;
let fenceStartPoint = null;
let fencePreviewElement = null;
let selectedFenceColor = '#4a7c2c';
let tempFenceCoords = null;

// Fence editing state
let editingFenceId = null;
// Zoom state
let zoomLevel = 1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

// Undo/redo state
const MAX_UNDO_STACK = 50;
let undoStack = [];
let redoStack = [];
let isUndoingRedoing = false;
let dragStartState = null;
let resizeStartState = null;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async function() {
    const authenticated = await checkAuth();
    if (!authenticated) {
        window.location.href = 'login.html';
        return;
    }
    
    await loadConfig();
    await loadCanvasState();
    await loadHistory();
    await loadUndoState();
    initializeCanvas();
    updateUndoRedoButtons();
});

// ===== AUTHENTICATION =====
async function checkAuth() {
    try {
        const response = await fetch('../../auth.php?action=check', { cache: 'no-store' });
        const data = await response.json();
        
        if (data.authenticated) {
            currentUser = data.user;
            displayUserInfo(data.user);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Auth error:', error);
        return false;
    }
}

function displayUserInfo(user) {
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userPicture').src = user.picture;
    document.getElementById('userInfo').style.display = 'flex';
}

function logout() {
    openModal('logoutConfirmModal');
}

function confirmLogout() {
    closeModal('logoutConfirmModal');
    window.location.href = 'logout.php';
}

// ===== CONFIG MANAGEMENT =====
async function loadConfig() {
    try {
        const response = await fetch('../../api.php?action=user_data?type=config', { cache: 'no-store' });
        const data = await response.json();
        if (data.success) {
            appConfig = data.data;
        }
    } catch (error) {
        console.error('Config load error:', error);
    }
}

async function saveConfig() {
    try {
        await fetch('../../api.php?action=user_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'config', data: appConfig }),
            cache: 'no-store'
        });
    } catch (error) {
        console.error('Config save error:', error);
    }
}

function checkApiKey() {
    if (!appConfig.apiKey || appConfig.apiKey.trim() === '') {
        showToast('error', 'API Key Missing', 'Configure your OpenAI API Key in Settings.');
        openSettings();
        return false;
    }
    return true;
}

// ===== CANVAS STATE MANAGEMENT =====
async function loadCanvasState() {
    try {
        const response = await fetch('../../api.php?action=user_data?type=canvas', { cache: 'no-store' });
        const data = await response.json();
        if (data.success) {
            canvasState = data.data;
            if (!canvasState.connections) canvasState.connections = [];
            if (!canvasState.notes) canvasState.notes = [];
            if (!canvasState.fences) canvasState.fences = [];
            if (!canvasState.magnets) canvasState.magnets = [];
            renderCanvas();
        }
    } catch (error) {
        console.error('Canvas load error:', error);
    }
}

async function saveCanvasState() {
    try {
        await fetch('../../api.php?action=user_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'canvas', data: canvasState }),
            cache: 'no-store'
        });
    } catch (error) {
        console.error('Canvas save error:', error);
    }
}

// ===== UNDO/REDO MANAGEMENT =====
async function loadUndoState() {
    try {
        const response = await fetch('../../api.php?action=user_data?type=undo', { cache: 'no-store' });
        const data = await response.json();
        if (data.success) {
            undoStack = Array.isArray(data.data?.undoStack) ? data.data.undoStack : [];
            redoStack = Array.isArray(data.data?.redoStack) ? data.data.redoStack : [];
        }
    } catch (error) {
        console.error('Undo load error:', error);
    }
}

async function saveUndoState() {
    try {
        await fetch('../../api.php?action=user_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'undo', data: { undoStack, redoStack } }),
            cache: 'no-store'
        });
    } catch (error) {
        console.error('Undo save error:', error);
    }
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function pushUndoStack(command) {
    if (isUndoingRedoing || !command) return;
    undoStack.push(command);
    if (undoStack.length > MAX_UNDO_STACK) {
        undoStack.shift();
    }
    redoStack = [];
    saveUndoState();
    updateUndoRedoButtons();
}

function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
}

function ensureElementCollection(type) {
    if (type === 'note' && !canvasState.notes) canvasState.notes = [];
    if (type === 'fence' && !canvasState.fences) canvasState.fences = [];
    if (type === 'magnet' && !canvasState.magnets) canvasState.magnets = [];
    if (type === 'card' && !canvasState.cards) canvasState.cards = [];
    return getElementCollection(type);
}

function getElementCollection(type) {
    if (type === 'card') return canvasState.cards;
    if (type === 'note') return canvasState.notes;
    if (type === 'fence') return canvasState.fences;
    if (type === 'magnet') return canvasState.magnets;
    return null;
}

function getElementPosition(type, id) {
    const collection = getElementCollection(type) || [];
    const element = collection.find(item => item.id === id);
    if (!element) return null;
    return { x: element.x, y: element.y };
}

function setElementPosition(type, id, position) {
    const collection = getElementCollection(type) || [];
    const element = collection.find(item => item.id === id);
    if (!element || !position) return;
    element.x = position.x;
    element.y = position.y;
}

function setCardSize(id, size) {
    const card = canvasState.cards.find(c => c.id === id);
    if (!card || !size) return;
    card.width = size.width;
    card.height = size.height;
}

function updateElementFields(type, id, values) {
    const collection = getElementCollection(type) || [];
    const element = collection.find(item => item.id === id);
    if (!element || !values) return;
    Object.keys(values).forEach(key => {
        element[key] = values[key];
    });
}

function addElementToState(type, data) {
    const collection = ensureElementCollection(type) || [];
    const existingIndex = collection.findIndex(item => item.id === data.id);
    if (existingIndex !== -1) {
        collection.splice(existingIndex, 1);
    }
    collection.push(cloneData(data));
}

function removeElementFromState(type, id) {
    const collection = ensureElementCollection(type) || [];
    const index = collection.findIndex(item => item.id === id);
    if (index === -1) return null;
    const removed = collection.splice(index, 1)[0];
    return removed ? cloneData(removed) : null;
}

function addConnectionToState(connection) {
    if (!canvasState.connections) canvasState.connections = [];
    const exists = canvasState.connections.find(conn => conn.id === connection.id ||
        ((conn.source === connection.source && conn.target === connection.target) ||
        (conn.source === connection.target && conn.target === connection.source)));
    if (!exists) {
        canvasState.connections.push(cloneData(connection));
    }
}

function removeConnectionById(connectionId) {
    if (!canvasState.connections) canvasState.connections = [];
    canvasState.connections = canvasState.connections.filter(conn => conn.id !== connectionId);
}

function removeConnectionsForElement(elementId) {
    if (!canvasState.connections) canvasState.connections = [];
    const removed = canvasState.connections.filter(conn => conn.source === elementId || conn.target === elementId);
    canvasState.connections = canvasState.connections.filter(conn => conn.source !== elementId && conn.target !== elementId);
    return removed.map(conn => cloneData(conn));
}

function applyCommand(command, direction) {
    const isUndo = direction === 'undo';
    if (!command) return;

    switch (command.type) {
        case 'move': {
            const position = isUndo ? command.before : command.after;
            setElementPosition(command.elementType, command.id, position);
            break;
        }
        case 'resize': {
            const size = isUndo ? command.before : command.after;
            setCardSize(command.id, size);
            break;
        }
        case 'update': {
            const values = isUndo ? command.before : command.after;
            updateElementFields(command.elementType, command.id, values);
            break;
        }
        case 'add': {
            if (isUndo) {
                removeElementFromState(command.elementType, command.data.id);
                if (command.connections) {
                    command.connections.forEach(conn => removeConnectionById(conn.id));
                }
            } else {
                addElementToState(command.elementType, command.data);
                if (command.connections) {
                    command.connections.forEach(conn => addConnectionToState(conn));
                }
            }
            break;
        }
        case 'delete': {
            if (isUndo) {
                addElementToState(command.elementType, command.data);
                if (command.connections) {
                    command.connections.forEach(conn => addConnectionToState(conn));
                }
            } else {
                removeElementFromState(command.elementType, command.data.id);
                if (command.connections) {
                    command.connections.forEach(conn => removeConnectionById(conn.id));
                }
            }
            break;
        }
        case 'connection': {
            if (isUndo) {
                removeConnectionById(command.data.id);
            } else {
                addConnectionToState(command.data);
            }
            break;
        }
        case 'fence-move': {
            const fencePosition = isUndo ? command.before : command.after;
            setElementPosition('fence', command.fenceId, fencePosition);
            command.elements.forEach(item => {
                const position = isUndo ? item.before : item.after;
                setElementPosition(item.elementType, item.id, position);
            });
            break;
        }
        default:
            break;
    }
}

function undo() {
    if (undoStack.length === 0) {
        showToast('info', 'Undo', 'Nothing to undo.');
        return;
    }

    const command = undoStack.pop();
    isUndoingRedoing = true;
    applyCommand(command, 'undo');
    isUndoingRedoing = false;
    redoStack.push(command);

    saveCanvasState();
    renderCanvas();
    saveUndoState();
    updateUndoRedoButtons();
    showToast('info', 'Undo', 'Action reverted.');
}

function redo() {
    if (redoStack.length === 0) {
        showToast('info', 'Redo', 'Nothing to redo.');
        return;
    }

    const command = redoStack.pop();
    isUndoingRedoing = true;
    applyCommand(command, 'redo');
    isUndoingRedoing = false;
    undoStack.push(command);

    saveCanvasState();
    renderCanvas();
    saveUndoState();
    updateUndoRedoButtons();
    showToast('info', 'Redo', 'Action restored.');
}

// ===== HISTORY MANAGEMENT =====
async function loadHistory() {
    try {
        const response = await fetch('../../api.php?action=user_data?type=history', { cache: 'no-store' });
        const data = await response.json();
        if (data.success) {
            interactionHistory = Array.isArray(data.data) ? data.data : [];
            renderHistory();
        }
    } catch (error) {
        console.error('History load error:', error);
    }
}

async function saveHistory() {
    try {
        await fetch('../../api.php?action=user_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'history', data: interactionHistory }),
            cache: 'no-store'
        });
    } catch (error) {
        console.error('History save error:', error);
    }
}

function addToHistory(tool, request, response, metadata = {}) {
    const historyItem = {
        id: Date.now(),
        tool: tool,
        request: request,
        response: response,
        metadata: metadata,
        timestamp: new Date().toISOString()
    };
    
    interactionHistory.unshift(historyItem);
    saveHistory();
    renderHistory();
    return historyItem;
}

function renderHistory() {
    const historyList = document.getElementById('historyList');
    
    if (interactionHistory.length === 0) {
        historyList.innerHTML = '<p class="empty-message">No interactions yet</p>';
        return;
    }
    
    historyList.innerHTML = interactionHistory.map(item => {
        const date = new Date(item.timestamp);
        const timeString = date.toLocaleString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="history-card" onclick="openHistoryItem(${item.id})">
                <button class="history-card-delete" onclick="event.stopPropagation(); deleteHistoryItem(${item.id})">×</button>
                <div class="history-card-header">
                    <span class="history-card-tool">${getToolName(item.tool)}</span>
                    <span class="history-card-time">${timeString}</span>
                </div>
                <div class="history-card-request">${escapeHtml(item.request)}</div>
            </div>
        `;
    }).join('');
}

function openHistoryItem(id) {
    const item = interactionHistory.find(h => h.id === id);
    if (!item) return;
    
    if (item.tool === 'chatbot') {
        reopenChatbot(item);
    } else if (item.tool === 'imageGen') {
        reopenImageGen(item);
    } else if (item.tool === 'imageAnalyzer') {
        reopenImageAnalyzer(item);
    } else if (item.tool === 'textAnalyzer') {
        reopenTextAnalyzer(item);
    }
}

function deleteHistoryItem(id) {
    if (!confirm('Delete this interaction?')) return;
    interactionHistory = interactionHistory.filter(h => h.id !== id);
    saveHistory();
    renderHistory();
    showToast('success', 'Deleted', 'Interaction removed from history.');
}

function clearHistory() {
    if (!confirm('Delete all interaction history?')) return;
    interactionHistory = [];
    saveHistory();
    renderHistory();
    showToast('success', 'History Cleared', 'All interactions deleted.');
}

// ===== CANVAS INITIALIZATION =====
function initializeCanvas() {
    const canvas = document.getElementById('canvas');
    canvas.style.width = '3000px';
    canvas.style.height = '2000px';
    
    const canvasContainer = canvas.parentElement;
    canvasContainer.addEventListener('scroll', () => {
        if (typeof drawConnections === 'function') drawConnections();
    });
    
    // Initialize zoom functionality
    initializeZoom();
}

function initializeZoom() {
    const canvasContainer = document.querySelector('.canvas-container');
    const canvas = document.getElementById('canvas');
    const zoomIndicator = document.getElementById('zoomIndicator');
    
    // Update zoom indicator on load
    if (zoomIndicator) {
        zoomIndicator.textContent = Math.round(zoomLevel * 100) + '%';
    }
    
    canvasContainer.addEventListener('wheel', (e) => {
        // Only zoom when holding Ctrl key (standard for zoom)
        if (e.ctrlKey) {
            e.preventDefault();
            
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomLevel + delta));
            
            if (newZoom !== zoomLevel) {
                zoomLevel = newZoom;
                canvas.style.transform = `scale(${zoomLevel})`;
                canvas.style.transformOrigin = '0 0';
                
                // Update zoom indicator
                if (zoomIndicator) {
                    zoomIndicator.textContent = Math.round(zoomLevel * 100) + '%';
                }
                
                // Update connections after zoom
                if (typeof drawConnections === 'function') {
                    setTimeout(drawConnections, 10);
                }
            }
        }
    }, { passive: false });
}

// ===== CANVAS RENDERING =====
function renderCanvas() {
    const canvas = document.getElementById('canvas');
    
    // Remove all existing elements
    canvas.querySelectorAll('.fence').forEach(el => el.remove());
    canvas.querySelectorAll('.sticky-note').forEach(el => el.remove());
    canvas.querySelectorAll('.magnet-card').forEach(el => el.remove());
    canvas.querySelectorAll('.canvas-card').forEach(el => el.remove());
    
    // Render in order: fences → notes → magnets → cards
    if (canvasState.fences) {
        canvasState.fences.forEach(fenceData => createFenceElement(fenceData));
    }
    
    if (canvasState.notes) {
        canvasState.notes.forEach(noteData => createStickyNoteElement(noteData));
    }
    
    if (canvasState.magnets) {
        canvasState.magnets.forEach(magnetData => createMagnetElement(magnetData));
    }
    
    canvasState.cards.forEach(cardData => createCanvasCard(cardData));
    
    setTimeout(() => drawConnections(), 100);
}

// ===== CREATE CANVAS CARD =====
function createCanvasCard(cardData) {
    const canvas = document.getElementById('canvas');
    const card = document.createElement('div');
    card.className = 'canvas-card';
    card.dataset.id = cardData.id;
    card.style.left = cardData.x + 'px';
    card.style.top = cardData.y + 'px';
    
    if (cardData.width) card.style.width = cardData.width + 'px';
    if (cardData.height) card.style.height = cardData.height + 'px';
    if (cardData.note) card.classList.add('has-note');
    
    let contentHtml = '';
    
    if (cardData.imageUrl) {
        contentHtml = `
            <div class="canvas-card-request">${escapeHtml(cardData.request)}</div>
            <div style="text-align: center; margin-top: 12px;">
                <img src="${cardData.imageUrl}" style="max-width: 100%; border-radius: 8px;" alt="Generated image">
            </div>
        `;
    } else {
        let processedResponse = cardData.response;
        if (cardData.tool === 'chatbot') {
            processedResponse = extractCodeBlocks(cardData.response, cardData.id);
        }
        
        contentHtml = `
            <div class="canvas-card-request">${escapeHtml(cardData.request)}</div>
            <div class="canvas-card-response">${processedResponse}</div>
        `;
    }
    
    if (cardData.note) {
        contentHtml += `<div class="card-note-content">${escapeHtml(cardData.note)}</div>`;
    }
    
    card.innerHTML = `
        <div class="canvas-card-header">
            <span class="canvas-card-tool">${getToolName(cardData.tool)}</span>
            <div class="canvas-card-actions">
                <button class="canvas-card-btn btn-note ${cardData.note ? 'has-note' : ''}" 
                        onclick="event.stopPropagation(); openCardNote(${cardData.id})" 
                        title="Add note">📝</button>
                <button class="canvas-card-btn btn-link" 
                        onclick="event.stopPropagation(); toggleLinkMode(${cardData.id})" 
                        title="Link card">🔗</button>
                <button class="canvas-card-btn btn-export" 
                        onclick="event.stopPropagation(); exportSingleCard(${cardData.id})" 
                        title="Export">💾</button>
                <button class="canvas-card-close" 
                        onclick="event.stopPropagation(); removeCanvasCard(${cardData.id})">×</button>
            </div>
        </div>
        ${contentHtml}
        <div class="card-resize-handle"></div>
    `;
    
    card.addEventListener('mousedown', startDrag);
    
    const resizeHandle = card.querySelector('.card-resize-handle');
    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        startResize(e, cardData.id);
    });
    
    canvas.appendChild(card);
    return card;
}

function getElementTypeFromElement(element) {
    if (element.classList.contains('canvas-card')) return 'card';
    if (element.classList.contains('sticky-note')) return 'note';
    if (element.classList.contains('fence')) return 'fence';
    if (element.classList.contains('magnet-card')) return 'magnet';
    return null;
}

// ===== DRAG & DROP =====
function startDrag(e) {
    // Don't drag if clicking on buttons or resize handle
    if (e.target.classList.contains('canvas-card-btn') ||
        e.target.classList.contains('canvas-card-close') ||
        e.target.classList.contains('card-resize-handle') ||
        e.target.classList.contains('sticky-note-close') ||
        e.target.classList.contains('fence-close') ||
        e.target.classList.contains('magnet-btn') ||
        e.target.classList.contains('btn-link') ||
        e.target.classList.contains('magnet-close')) {
        return;
    }
    
    cancelAllModes();
    
    draggedElement = e.currentTarget;
    draggedElement.classList.add('dragging');
    
    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();
    const scrollLeft = canvas.parentElement.scrollLeft;
    const scrollTop = canvas.parentElement.scrollTop;
    const currentZoom = zoomLevel || 1;
    
    const mouseLogicalX = (e.clientX - canvasRect.left) / currentZoom + scrollLeft;
    const mouseLogicalY = (e.clientY - canvasRect.top) / currentZoom + scrollTop;
    
    const elLogicalX = parseInt(draggedElement.style.left) || 0;
    const elLogicalY = parseInt(draggedElement.style.top) || 0;
    
    dragOffset.x = mouseLogicalX - elLogicalX;
    dragOffset.y = mouseLogicalY - elLogicalY;
    
    const elementType = getElementTypeFromElement(draggedElement);
    if (elementType) {
        const elementId = parseInt(draggedElement.dataset.id);
        const beforePosition = getElementPosition(elementType, elementId);
        dragStartState = beforePosition ? {
            elementType,
            id: elementId,
            before: { ...beforePosition }
        } : null;
        if (elementType === 'fence') {
            const fence = canvasState.fences.find(f => f.id === elementId);
            if (fence && dragStartState) {
                dragStartState.affectedElements = getElementsInsideFence(fence);
            }
        }
    }
    
    // Store original position for fence content movement
    if (draggedElement.classList.contains('fence')) {
        const elementId = parseInt(draggedElement.dataset.id);
        const fence = canvasState.fences.find(f => f.id === elementId);
        if (fence) {
            draggedElement.dataset.originalX = fence.x;
            draggedElement.dataset.originalY = fence.y;
        }
    }
    
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
    
    e.preventDefault();
}

function doDrag(e) {
    if (!draggedElement) return;
    
    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();
    const scrollLeft = canvas.parentElement.scrollLeft;
    const scrollTop = canvas.parentElement.scrollTop;
    const currentZoom = zoomLevel || 1;
    
    const mouseLogicalX = (e.clientX - canvasRect.left) / currentZoom + scrollLeft;
    const mouseLogicalY = (e.clientY - canvasRect.top) / currentZoom + scrollTop;
    
    let newX = mouseLogicalX - dragOffset.x;
    let newY = mouseLogicalY - dragOffset.y;
    
    newX = Math.max(0, Math.min(newX, 3000 - draggedElement.offsetWidth));
    newY = Math.max(0, Math.min(newY, 2000 - draggedElement.offsetHeight));
    
    draggedElement.style.left = newX + 'px';
    draggedElement.style.top = newY + 'px';
    
    drawConnections();
}

function buildDragCommand() {
    if (!dragStartState) return null;

    const { elementType, id, before, affectedElements } = dragStartState;
    const after = getElementPosition(elementType, id);
    if (!before || !after) return null;

    const moved = before.x !== after.x || before.y !== after.y;
    if (!moved) return null;

    if (elementType === 'fence') {
        const elements = (affectedElements || []).map(item => {
            const afterPosition = getElementPosition(item.elementType, item.id) || item.before;
            return {
                elementType: item.elementType,
                id: item.id,
                before: { ...item.before },
                after: { ...afterPosition }
            };
        });
        return {
            type: 'fence-move',
            fenceId: id,
            before: { ...before },
            after: { ...after },
            elements
        };
    }

    return {
        type: 'move',
        elementType,
        id,
        before: { ...before },
        after: { ...after }
    };
}

function stopDrag(e) {
    if (!draggedElement) return;
    
    draggedElement.classList.remove('dragging');
    const elementId = parseInt(draggedElement.dataset.id);
    
    // Update position in state based on element type
    if (draggedElement.classList.contains('canvas-card')) {
        const card = canvasState.cards.find(c => c.id === elementId);
        if (card) {
            card.x = parseInt(draggedElement.style.left);
            card.y = parseInt(draggedElement.style.top);
        }
    } else if (draggedElement.classList.contains('sticky-note')) {
        const note = canvasState.notes.find(n => n.id === elementId);
        if (note) {
            note.x = parseInt(draggedElement.style.left);
            note.y = parseInt(draggedElement.style.top);
        }
    } else if (draggedElement.classList.contains('magnet-card')) {
        const magnet = canvasState.magnets.find(m => m.id === elementId);
        if (magnet) {
            magnet.x = parseInt(draggedElement.style.left);
            magnet.y = parseInt(draggedElement.style.top);
        }
    } else if (draggedElement.classList.contains('fence')) {
        const fence = canvasState.fences.find(f => f.id === elementId);
        if (fence) {
            const oldX = parseInt(draggedElement.dataset.originalX);
            const oldY = parseInt(draggedElement.dataset.originalY);
            const newX = parseInt(draggedElement.style.left);
            const newY = parseInt(draggedElement.style.top);
            
            const deltaX = newX - oldX;
            const deltaY = newY - oldY;
            
            // Move elements inside fence BEFORE updating fence position
            moveElementsInsideFence(fence, deltaX, deltaY);
            
            fence.x = newX;
            fence.y = newY;
        }
    }
    
    const moveCommand = buildDragCommand();
    if (moveCommand) {
        pushUndoStack(moveCommand);
    }
    dragStartState = null;
    
    saveCanvasState();
    renderCanvas();
    
    document.removeEventListener('mousemove', doDrag);
    document.removeEventListener('mouseup', stopDrag);
    draggedElement = null;
}

// ===== CARD RESIZE =====
function startResize(e, cardId) {
    e.stopPropagation();
    e.preventDefault();
    
    const card = document.querySelector(`[data-id="${cardId}"]`);
    if (!card) return;
    
    resizingCard = card;
    resizeStartSize.width = card.offsetWidth;
    resizeStartSize.height = card.offsetHeight;
    resizeStartPos.x = e.clientX;
    resizeStartPos.y = e.clientY;
    resizeStartState = {
        id: cardId,
        before: { width: resizeStartSize.width, height: resizeStartSize.height }
    };
    
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
}

function doResize(e) {
    if (!resizingCard) return;
    
    const deltaX = e.clientX - resizeStartPos.x;
    const deltaY = e.clientY - resizeStartPos.y;
    
    let newWidth = resizeStartSize.width + deltaX;
    let newHeight = resizeStartSize.height + deltaY;
    
    newWidth = Math.max(280, Math.min(650, newWidth));
    newHeight = Math.max(200, Math.min(550, newHeight));
    
    resizingCard.style.width = newWidth + 'px';
    resizingCard.style.height = newHeight + 'px';
    
    drawConnections();
}

function stopResize(e) {
    if (!resizingCard) return;
    
    const cardId = parseInt(resizingCard.dataset.id);
    const card = canvasState.cards.find(c => c.id === cardId);
    
    if (card) {
        const afterSize = { width: resizingCard.offsetWidth, height: resizingCard.offsetHeight };
        const beforeSize = resizeStartState ? resizeStartState.before : {
            width: card.width || afterSize.width,
            height: card.height || afterSize.height
        };
        card.width = afterSize.width;
        card.height = afterSize.height;

        if (!isUndoingRedoing && resizeStartState &&
            (beforeSize.width !== afterSize.width || beforeSize.height !== afterSize.height)) {
            pushUndoStack({
                type: 'resize',
                id: cardId,
                before: { ...beforeSize },
                after: { ...afterSize }
            });
        }
        saveCanvasState();
    }
    resizeStartState = null;
    
    document.removeEventListener('mousemove', doResize);
    document.removeEventListener('mouseup', stopResize);
    resizingCard = null;
}

// ===== ADD CARD TO CANVAS =====
function addCardToCanvas(tool, request, response, imageUrl = null) {
    const canvasContainer = document.querySelector('.canvas-container');
    const rect = canvasContainer.getBoundingClientRect();
    const scrollLeft = document.getElementById('canvas').parentElement.scrollLeft;
    const scrollTop = document.getElementById('canvas').parentElement.scrollTop;
    
    const cardData = {
        id: Date.now(),
        tool: tool,
        request: request,
        response: response,
        imageUrl: imageUrl,
        x: scrollLeft + (rect.width / 2) - 200,
        y: scrollTop + (rect.height / 2) - 150
    };
    
    canvasState.cards.push(cardData);
    saveCanvasState();
    createCanvasCard(cardData);
    pushUndoStack({
        type: 'add',
        elementType: 'card',
        data: cloneData(cardData)
    });
}

function removeCanvasCard(id) {
    if (!confirm('Remove this card?')) return;
    const card = canvasState.cards.find(c => c.id === id);
    if (!card) return;

    const removedConnections = removeConnectionsForElement(id);
    canvasState.cards = canvasState.cards.filter(c => c.id !== id);
    pushUndoStack({
        type: 'delete',
        elementType: 'card',
        data: cloneData(card),
        connections: removedConnections
    });
    saveCanvasState();
    renderCanvas();
    showToast('success', 'Card Removed', 'Card deleted from canvas.');
}

// ===== CARD NOTES =====
function openCardNote(cardId) {
    currentNoteCardId = cardId;
    const card = canvasState.cards.find(c => c.id === cardId);
    
    if (card) {
        document.getElementById('cardNoteInput').value = card.note || '';
    }
    
    openModal('cardNoteModal');
}

function saveCardNote() {
    if (currentNoteCardId === null) return;
    
    const note = document.getElementById('cardNoteInput').value.trim();
    const card = canvasState.cards.find(c => c.id === currentNoteCardId);
    
    if (card) {
        const beforeNote = card.note || '';
        card.note = note;
        if (!isUndoingRedoing && beforeNote !== note) {
            pushUndoStack({
                type: 'update',
                elementType: 'card',
                id: card.id,
                before: { note: beforeNote },
                after: { note: note }
            });
        }
        saveCanvasState();
        renderCanvas();
        showToast('success', note ? 'Note Saved' : 'Note Removed', 'Card note updated.');
    }
    
    closeModal('cardNoteModal');
    currentNoteCardId = null;
}

// ===== CARD LINKING =====
function toggleLinkMode(cardId) {
    if (!linkingMode) {
        linkingMode = true;
        linkSourceCard = cardId;
        
        const btn = document.querySelector(`[data-id="${cardId}"] .btn-link`);
        if (btn) btn.classList.add('active');
        
        showToast('info', 'Link Mode', 'Click another card to connect.');
    } else {
        if (linkSourceCard === cardId) {
            cancelLinking();
        } else {
            createConnection(linkSourceCard, cardId);
            cancelLinking();
        }
    }
}

function cancelLinking() {
    if (linkSourceCard) {
        const btn = document.querySelector(`[data-id="${linkSourceCard}"] .btn-link`);
        if (btn) btn.classList.remove('active');
    }
    linkingMode = false;
    linkSourceCard = null;
}

function createConnection(sourceId, targetId) {
    const exists = canvasState.connections.find(
        conn => (conn.source === sourceId && conn.target === targetId) ||
                (conn.source === targetId && conn.target === sourceId)
    );
    
    if (exists) {
        showToast('info', 'Already Connected', 'These cards are already linked.');
        return;
    }
    
    const connectionData = {
        id: Date.now(),
        source: sourceId,
        target: targetId
    };
    canvasState.connections.push(connectionData);
    
    saveCanvasState();
    drawConnections();
    pushUndoStack({
        type: 'connection',
        data: cloneData(connectionData)
    });
    showToast('success', 'Cards Connected', 'Cards linked successfully.');
}

function drawConnections() {
    const svg = document.getElementById('connectionCanvas');
    const canvas = document.getElementById('canvas');
    
    if (!svg || !canvas) return;
    if (!canvasState.connections) canvasState.connections = [];
    
    svg.setAttribute('width', canvas.offsetWidth);
    svg.setAttribute('height', canvas.offsetHeight);
    svg.innerHTML = '';
    
    // Remove connected class from all elements
    canvas.querySelectorAll('.canvas-card').forEach(el => el.classList.remove('connected'));
    canvas.querySelectorAll('.magnet-card').forEach(el => el.classList.remove('connected'));
    
    canvasState.connections.forEach(conn => {
        const sourceEl = document.querySelector(`[data-id="${conn.source}"]`);
        const targetEl = document.querySelector(`[data-id="${conn.target}"]`);
        
        if (!sourceEl || !targetEl) return;
        
        // Get positions directly from style (relative to canvas, unaffected by scroll)
        const x1 = parseInt(sourceEl.style.left) + sourceEl.offsetWidth / 2;
        const y1 = parseInt(sourceEl.style.top) + sourceEl.offsetHeight / 2;
        const x2 = parseInt(targetEl.style.left) + targetEl.offsetWidth / 2;
        const y2 = parseInt(targetEl.style.top) + targetEl.offsetHeight / 2;
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', '#4a7c2c');
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-dasharray', '5,5');
        
        svg.appendChild(line);
        
        sourceEl.classList.add('connected');
        targetEl.classList.add('connected');
    });
}

// ===== CODE EXTRACTION =====
function extractCodeBlocks(text, cardId) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let result = text;
    let match;
    let blockIndex = 0;
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
        const language = match[1] || 'text';
        const code = match[2];
        const blockId = `${cardId}_${blockIndex}`;
        
        const codeBlockHtml = `
            <div class="code-block-container">
                <div class="code-block-header">
                    <span class="code-block-language">${language}</span>
                    <button class="code-block-download" onclick="event.stopPropagation(); downloadCode('${blockId}', '${language}')">
                        💾 Download
                    </button>
                </div>
                <div class="code-block-content">
                    <pre id="code_${blockId}">${escapeHtml(code.trim())}</pre>
                </div>
            </div>
        `;
        
        result = result.replace(match[0], codeBlockHtml);
        blockIndex++;
    }
    
    return result;
}

function downloadCode(blockId, language) {
    const codeElement = document.getElementById(`code_${blockId}`);
    if (!codeElement) return;
    
    const code = codeElement.textContent;
    const extensions = {
        javascript: 'js', js: 'js', python: 'py', php: 'php',
        html: 'html', css: 'css', json: 'json', text: 'txt'
    };
    
    const ext = extensions[language.toLowerCase()] || 'txt';
    const filename = `code_${Date.now()}.${ext}`;
    
    downloadFile(filename, code, 'text/plain');
    showToast('success', 'Code Downloaded', `File ${filename} saved!`);
}

// ===== EXPORT FUNCTIONS =====
function exportSingleCard(cardId) {
    const card = canvasState.cards.find(c => c.id === cardId);
    if (!card) return;
    
    const exportData = { ...card, exportedAt: new Date().toISOString() };
    const filename = `card_${cardId}_${Date.now()}.json`;
    
    downloadFile(filename, JSON.stringify(exportData, null, 2), 'application/json');
    showToast('success', 'Card Exported', `File ${filename} saved!`);
}

function exportAllCards() {
    const totalElements = (canvasState.cards?.length || 0) + 
                         (canvasState.notes?.length || 0) + 
                         (canvasState.fences?.length || 0) +
                         (canvasState.magnets?.length || 0);
    
    if (totalElements === 0) {
        showToast('error', 'Empty Canvas', 'No elements to export.');
        return;
    }
    
    const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        cards: canvasState.cards || [],
        notes: canvasState.notes || [],
        fences: canvasState.fences || [],
        magnets: canvasState.magnets || [],
        connections: canvasState.connections || [],
        stats: {
            totalCards: canvasState.cards?.length || 0,
            totalNotes: canvasState.notes?.length || 0,
            totalFences: canvasState.fences?.length || 0,
            totalMagnets: canvasState.magnets?.length || 0,
            totalConnections: canvasState.connections?.length || 0
        }
    };
    
    const filename = `canvas_export_${Date.now()}.json`;
    downloadFile(filename, JSON.stringify(exportData, null, 2), 'application/json');
    showToast('success', 'Canvas Exported', `${totalElements} elements exported!`);
}

// ===== CANVAS MANAGEMENT =====
function newCanvas() {
    const totalElements = (canvasState.cards?.length || 0) + 
                         (canvasState.notes?.length || 0) + 
                         (canvasState.fences?.length || 0);
    
    if (totalElements === 0) {
        showToast('info', 'Empty Canvas', 'Canvas is already empty.');
        return;
    }
    
    const msg = `Create new canvas?\n\nThis will delete:\n- ${canvasState.cards?.length || 0} cards\n- ${canvasState.notes?.length || 0} sticky notes\n- ${canvasState.magnets?.length || 0} magnets\n- ${canvasState.fences?.length || 0} fences\n- ${canvasState.connections?.length || 0} connections\n\nHistory will be preserved.\n\nTip: Export current canvas first!`;
    
    if (!confirm(msg)) return;
    
    canvasState = { cards: [], notes: [], fences: [], magnets: [], connections: [] };
    saveCanvasState();
    renderCanvas();
    showToast('success', 'New Canvas', 'Canvas cleared. Start a new project!');
}

function importCanvas() {
    document.getElementById('importCanvasInput').click();
}

function handleCanvasImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.json')) {
        showToast('error', 'Invalid Format', 'File must be JSON.');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            if (!importedData || typeof importedData !== 'object') {
                throw new Error('Invalid JSON format');
            }
            
            const totalElements = (importedData.cards?.length || 0) + 
                                 (importedData.notes?.length || 0) + 
                                 (importedData.fences?.length || 0) +
                                 (importedData.magnets?.length || 0);
            
            if (totalElements === 0) {
                showToast('error', 'Empty Canvas', 'Imported file contains no elements.');
                event.target.value = '';
                return;
            }
            
            const msg = `Import canvas with:\n- ${importedData.cards?.length || 0} cards\n- ${importedData.notes?.length || 0} sticky notes\n- ${importedData.magnets?.length || 0} magnets\n- ${importedData.fences?.length || 0} fences\n- ${importedData.connections?.length || 0} connections\n\nCurrent canvas will be replaced.`;
            
            if (!confirm(msg)) {
                event.target.value = '';
                return;
            }
            
            canvasState = {
                cards: importedData.cards || [],
                notes: importedData.notes || [],
                fences: importedData.fences || [],
                magnets: importedData.magnets || [],
                connections: importedData.connections || []
            };
            
            saveCanvasState();
            renderCanvas();
            showToast('success', 'Canvas Imported', `${totalElements} elements loaded!`);
            
        } catch (error) {
            console.error('Import error:', error);
            showToast('error', 'Import Failed', 'Invalid or corrupted JSON file.');
        }
        
        event.target.value = '';
    };
    
    reader.onerror = function() {
        showToast('error', 'Read Error', 'Cannot read file.');
        event.target.value = '';
    };
    
    reader.readAsText(file);
}

// ===== MODAL MANAGEMENT =====
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
        cancelAllModes();
    }
});

// ===== TOOL SELECTION =====
function openAddModal() {
    cancelAllModes();
    openModal('toolSelectModal');
}

function openToolFromButton(tool) {
    cancelAllModes();
    selectTool(tool);
}

function selectTool(tool) {
    closeModal('toolSelectModal');
    
    if (tool === 'chatbot') openChatbot();
    else if (tool === 'imageGen') openImageGen();
    else if (tool === 'imageAnalyzer') openImageAnalyzer();
    else if (tool === 'textAnalyzer') openTextAnalyzer();
}

// ===== SETTINGS =====
function openSettings() {
    cancelAllModes();
    document.getElementById('apiKeyInput').value = appConfig.apiKey || '';
    openModal('settingsModal');
}

function saveSettings() {
    appConfig.apiKey = document.getElementById('apiKeyInput').value.trim();
    saveConfig();
    closeModal('settingsModal');
    showToast('success', 'Settings Saved', 'API Key configured.');
}

// ===== TOAST NOTIFICATIONS =====
function showToast(type, title, message, duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

function showModalMessage(modalId, type, message) {
    const modal = document.getElementById(modalId);
    const body = modal.querySelector('.modal-body');
    
    body.querySelectorAll('.modal-message').forEach(msg => msg.remove());
    
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const messageDiv = document.createElement('div');
    messageDiv.className = `modal-message modal-message-${type}`;
    messageDiv.innerHTML = `
        <span class="modal-message-icon">${icons[type] || 'ℹ️'}</span>
        <div>${message}</div>
    `;
    
    body.insertBefore(messageDiv, body.firstChild);
    setTimeout(() => messageDiv.remove(), 5000);
}

function clearModalMessages(modalId) {
    const modal = document.getElementById(modalId);
    const messages = modal.querySelectorAll('.modal-message');
    messages.forEach(msg => msg.remove());
}

// ===== UTILITY FUNCTIONS =====
function getToolName(tool) {
    const names = {
        chatbot: 'Chatbot',
        imageGen: 'Image Generator',
        imageAnalyzer: 'Image Analyzer',
        textAnalyzer: 'Text Analyzer'
    };
    return names[tool] || tool;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ===== CANCEL ALL MODES =====
function cancelAllModes() {
    // Cancel linking mode
    cancelLinking();
    
    // Cancel fence drawing
    if (isDrawingFence) {
        // If we were drawing a fence, clean up the listener
        const canvas = document.getElementById('canvas');
        canvas.removeEventListener('mousemove', updateFencePreview);
        canvas.removeEventListener('click', handleFenceClick);
        if (fencePreviewElement) {
            fencePreviewElement.remove();
            fencePreviewElement = null;
        }
        canvas.classList.remove('drawing-mode');
        canvas.removeEventListener('click', handleFenceClick);
        canvas.removeEventListener('mousemove', updateFencePreview);
        
        if (fencePreviewElement) {
            fencePreviewElement.remove();
            fencePreviewElement = null;
        }
        
        isDrawingFence = false;
        fenceStartPoint = null;
        tempFenceCoords = null;
    }
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => modal.classList.remove('active'));
        cancelAllModes();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openAddModal();
    }
});

console.log('Vivacity AI Canvas - Initialized');


// ===== CHATBOT FUNCTIONS =====
function openChatbot() {
    if (!checkApiKey()) return;
    cancelAllModes();
    chatMessages = [];
    currentChatFile = null;
    currentHistoryRecordId = null;
    renderChatMessages();
    document.getElementById('chatFilePreview').style.display = 'none';
    document.getElementById('chatInput').value = '';
    clearModalMessages('chatbotModal');
    openModal('chatbotModal');
}

function closeChatbot() {
    closeModal('chatbotModal');
}

function reopenChatbot(historyItem) {
    if (!checkApiKey()) return;
    cancelAllModes();
    
    if (historyItem.metadata && historyItem.metadata.messages) {
        chatMessages = historyItem.metadata.messages;
    } else {
        chatMessages = [
            { role: 'user', content: historyItem.request, hasFile: false },
            { role: 'assistant', content: historyItem.response, hasFile: false }
        ];
    }
    
    currentHistoryRecordId = historyItem.id;
    currentChatFile = null;
    renderChatMessages();
    document.getElementById('chatFilePreview').style.display = 'none';
    document.getElementById('chatInput').value = '';
    clearModalMessages('chatbotModal');
    openModal('chatbotModal');
    showToast('info', 'Conversation Restored', 'Continue from where you left off.');
}

function renderChatMessages() {
    const container = document.getElementById('chatMessages');
    
    if (chatMessages.length === 0) {
        container.innerHTML = `
            <div class="chat-welcome">
                <p>👋 Hi! I'm your AI assistant.</p>
                <p>Ask questions, generate code, or analyze text files.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = chatMessages.map(msg => {
        const isUser = msg.role === 'user';
        const avatar = isUser ? 'U' : 'AI';
        const fileIndicator = msg.hasFile ? '<div class="chat-file-indicator">📎 File attached</div>' : '';
        
        return `
            <div class="chat-message chat-message-${isUser ? 'user' : 'assistant'}">
                <div class="chat-message-avatar">${avatar}</div>
                <div class="chat-message-content">
                    ${escapeHtml(msg.content)}
                    ${fileIndicator}
                </div>
            </div>
        `;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
}

function handleChatFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentChatFile = { name: file.name, content: e.target.result };
        document.getElementById('chatFileName').textContent = '📎 ' + file.name;
        document.getElementById('chatFilePreview').style.display = 'block';
    };
    reader.readAsText(file);
}

function removeChatFile() {
    currentChatFile = null;
    document.getElementById('chatFilePreview').style.display = 'none';
    document.getElementById('chatFileInput').value = '';
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    if (!checkApiKey()) return;
    
    chatMessages.push({ role: 'user', content: message, hasFile: currentChatFile !== null });
    input.value = '';
    
    const sendBtn = document.querySelector('.chat-send-btn');
    sendBtn.disabled = true;
    renderChatMessages();
    
    try {
        const response = await fetch('../../api.php?action=chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: appConfig.apiKey,
                messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
                file: currentChatFile
            }),
            cache: 'no-store'
        });
        
        const data = await response.json();
        
        if (data.success) {
            chatMessages.push({ role: 'assistant', content: data.response, hasFile: false });
            
            if (currentHistoryRecordId !== null) {
                const recordIndex = interactionHistory.findIndex(h => h.id === currentHistoryRecordId);
                if (recordIndex !== -1) {
                    interactionHistory[recordIndex].request = message;
                    interactionHistory[recordIndex].response = data.response;
                    interactionHistory[recordIndex].metadata = { messages: [...chatMessages] };
                    interactionHistory[recordIndex].timestamp = new Date().toISOString();
                    saveHistory();
                    renderHistory();
                }
            } else {
                const newRecord = addToHistory('chatbot', message, data.response, { messages: [...chatMessages] });
                currentHistoryRecordId = newRecord.id;
            }
        } else {
            showModalMessage('chatbotModal', 'error', data.error || 'Unknown error');
        }
    } catch (error) {
        console.error('API error:', error);
        showModalMessage('chatbotModal', 'error', 'Connection error. Check ../../api.php?action=chat');
    }
    
    currentChatFile = null;
    document.getElementById('chatFilePreview').style.display = 'none';
    document.getElementById('chatFileInput').value = '';
    sendBtn.disabled = false;
    renderChatMessages();
}

function clearChatHistory() {
    if (!confirm('Clear entire conversation?')) return;
    chatMessages = [];
    renderChatMessages();
    showToast('success', 'Conversation Cleared', 'Chat history cleared.');
}

function exportChatConversation() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const content = chatMessages.map(m => `[${m.role.toUpperCase()}]\n${m.content}\n`).join('\n');
    downloadFile(`chat_${timestamp}.txt`, content, 'text/plain');
}

function pinChatToCanvas() {
    if (chatMessages.length === 0) {
        showToast('error', 'No Messages', 'No messages to save.');
        return;
    }
    
    const lastUserMsg = [...chatMessages].reverse().find(m => m.role === 'user');
    const lastAssistantMsg = [...chatMessages].reverse().find(m => m.role === 'assistant');
    
    if (lastUserMsg && lastAssistantMsg) {
        addCardToCanvas('chatbot', lastUserMsg.content, lastAssistantMsg.content);
        showToast('success', 'Added to Canvas', 'Conversation saved as draggable card.');
    }
}

// ===== IMAGE GENERATOR FUNCTIONS =====
function openImageGen() {
    if (!checkApiKey()) return;
    cancelAllModes();
    document.getElementById('imagePrompt').value = '';
    document.getElementById('imageGenResult').style.display = 'none';
    document.getElementById('generateImageBtn').style.display = 'inline-block';
    document.getElementById('exportImageBtn').style.display = 'none';
    document.getElementById('pinImageBtn').style.display = 'none';
    currentGeneratedImage = null;
    currentImagePrompt = '';
    clearModalMessages('imageGenModal');
    openModal('imageGenModal');
}

function closeImageGen() {
    closeModal('imageGenModal');
}

function reopenImageGen(historyItem) {
    if (!checkApiKey()) return;
    cancelAllModes();
    
    document.getElementById('imagePrompt').value = historyItem.request;
    
    if (historyItem.metadata && historyItem.metadata.imageUrl) {
        currentGeneratedImage = historyItem.metadata.imageUrl;
        currentImagePrompt = historyItem.request;
        document.getElementById('generatedImage').src = historyItem.metadata.imageUrl;
        document.getElementById('imageGenResult').style.display = 'block';
        document.getElementById('generateImageBtn').style.display = 'inline-block';
        document.getElementById('exportImageBtn').style.display = 'inline-block';
        document.getElementById('pinImageBtn').style.display = 'inline-block';
    } else {
        document.getElementById('imageGenResult').style.display = 'none';
        currentGeneratedImage = null;
    }
    
    clearModalMessages('imageGenModal');
    openModal('imageGenModal');
    showToast('info', 'Image Restored', 'Regenerate or modify prompt.');
}

async function generateImage() {
    const prompt = document.getElementById('imagePrompt').value.trim();
    
    if (!prompt) {
        showModalMessage('imageGenModal', 'error', 'Enter image description!');
        return;
    }
    
    if (!checkApiKey()) return;
    clearModalMessages('imageGenModal');
    
    currentImagePrompt = prompt;
    document.getElementById('generateImageBtn').disabled = true;
    document.getElementById('imageGenLoading').style.display = 'block';
    document.getElementById('imageGenResult').style.display = 'none';
    
    try {
        const response = await fetch('../../api.php?action=image_gen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: appConfig.apiKey,
                prompt: prompt,
                size: '1024x1024'
            }),
            cache: 'no-store'
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentGeneratedImage = data.imageUrl;
            currentImageFilename = data.filename;
            
            // Display image using ../../api.php?action=get_image for security
            const imageDisplayUrl = '../../api.php?action=get_image?path=' + encodeURIComponent(data.imageUrl);
            document.getElementById('generatedImage').src = imageDisplayUrl;
            document.getElementById('imageGenResult').style.display = 'block';
            document.getElementById('downloadImageBtn').style.display = 'inline-block';
            document.getElementById('createMagnetBtn').style.display = 'inline-block';
            document.getElementById('exportImageBtn').style.display = 'inline-block';
            document.getElementById('pinImageBtn').style.display = 'inline-block';
            
            addToHistory('imageGen', prompt, 'Image generated: ' + data.filename, { 
                imageUrl: data.imageUrl,
                filename: data.filename 
            });
            showToast('success', 'Image Generated', 'Image saved locally!');
        } else {
            showModalMessage('imageGenModal', 'error', data.error || 'Unknown error');
        }
    } catch (error) {
        console.error('API error:', error);
        showModalMessage('imageGenModal', 'error', 'Connection error. Check ../../api.php?action=image_gen');
    }
    
    document.getElementById('imageGenLoading').style.display = 'none';
    document.getElementById('generateImageBtn').disabled = false;
}

function exportImageResponse() {
    if (!currentGeneratedImage) return;
    
    const data = {
        prompt: currentImagePrompt,
        imageUrl: currentGeneratedImage,
        timestamp: new Date().toISOString()
    };
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadFile(`image_gen_${timestamp}.json`, JSON.stringify(data, null, 2), 'application/json');
}

function pinImageToCanvas() {
    if (!currentGeneratedImage) return;
    addCardToCanvas('imageGen', currentImagePrompt, '', currentGeneratedImage);
    showToast('success', 'Added to Canvas', 'Image saved as draggable card.');
}

// ===== IMAGE ANALYZER FUNCTIONS =====
function openImageAnalyzer() {
    if (!checkApiKey()) return;
    cancelAllModes();
    uploadMethod = 'file';
    document.getElementById('analyzeImageFile').value = '';
    document.getElementById('analyzeImageUrl').value = '';
    document.getElementById('analyzePrompt').value = '';
    document.getElementById('analyzeImagePreview').style.display = 'none';
    document.getElementById('analyzeResult').style.display = 'none';
    document.getElementById('exportAnalysisBtn').style.display = 'none';
    document.getElementById('pinAnalysisBtn').style.display = 'none';
    currentAnalyzeImage = null;
    currentAnalysisResult = null;
    switchUploadMethod('file');
    clearModalMessages('imageAnalyzerModal');
    openModal('imageAnalyzerModal');
}

function closeImageAnalyzer() {
    closeModal('imageAnalyzerModal');
}

function reopenImageAnalyzer(historyItem) {
    if (!checkApiKey()) return;
    cancelAllModes();
    
    uploadMethod = 'file';
    document.getElementById('analyzeImageFile').value = '';
    document.getElementById('analyzeImageUrl').value = '';
    document.getElementById('analyzePrompt').value = historyItem.request;
    
    if (historyItem.metadata && historyItem.metadata.imageData) {
        currentAnalyzeImage = historyItem.metadata.imageData;
        document.getElementById('previewImage').src = historyItem.metadata.imageData;
        document.getElementById('analyzeImagePreview').style.display = 'block';
    } else {
        document.getElementById('analyzeImagePreview').style.display = 'none';
        currentAnalyzeImage = null;
    }
    
    if (historyItem.response) {
        currentAnalysisResult = historyItem.response;
        document.getElementById('analysisResponse').textContent = historyItem.response;
        document.getElementById('analyzeResult').style.display = 'block';
        document.getElementById('exportAnalysisBtn').style.display = 'inline-block';
        document.getElementById('pinAnalysisBtn').style.display = 'inline-block';
    } else {
        document.getElementById('analyzeResult').style.display = 'none';
        currentAnalysisResult = null;
    }
    
    switchUploadMethod('file');
    clearModalMessages('imageAnalyzerModal');
    openModal('imageAnalyzerModal');
    showToast('info', 'Analysis Restored', 'Reanalyze or modify request.');
}

function switchUploadMethod(method) {
    uploadMethod = method;
    
    const tabs = document.querySelectorAll('.upload-tab');
    tabs.forEach((tab, index) => {
        tab.classList.remove('active');
        if ((method === 'file' && index === 0) || (method === 'url' && index === 1)) {
            tab.classList.add('active');
        }
    });
    
    if (method === 'file') {
        document.getElementById('fileUploadSection').style.display = 'block';
        document.getElementById('urlUploadSection').style.display = 'none';
    } else {
        document.getElementById('fileUploadSection').style.display = 'none';
        document.getElementById('urlUploadSection').style.display = 'block';
    }
    
    document.getElementById('analyzeImagePreview').style.display = 'none';
    currentAnalyzeImage = null;
}

function handleAnalyzeImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentAnalyzeImage = e.target.result;
        document.getElementById('previewImage').src = e.target.result;
        document.getElementById('analyzeImagePreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

async function analyzeImage() {
    const prompt = document.getElementById('analyzePrompt').value.trim();
    
    if (!prompt) {
        showModalMessage('imageAnalyzerModal', 'error', 'Enter a question about the image!');
        return;
    }
    
    let imageData = null;
    
    if (uploadMethod === 'file') {
        if (!currentAnalyzeImage) {
            showModalMessage('imageAnalyzerModal', 'error', 'Upload an image!');
            return;
        }
        imageData = currentAnalyzeImage;
    } else {
        const url = document.getElementById('analyzeImageUrl').value.trim();
        if (!url) {
            showModalMessage('imageAnalyzerModal', 'error', 'Enter image URL!');
            return;
        }
        imageData = url;
        document.getElementById('previewImage').src = url;
        document.getElementById('analyzeImagePreview').style.display = 'block';
    }
    
    if (!checkApiKey()) return;
    clearModalMessages('imageAnalyzerModal');
    
    document.getElementById('analyzeImageBtn').disabled = true;
    document.getElementById('analyzeLoading').style.display = 'block';
    document.getElementById('analyzeResult').style.display = 'none';
    
    try {
        const response = await fetch('../../api.php?action=image_analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: appConfig.apiKey,
                imageData: imageData,
                prompt: prompt
            }),
            cache: 'no-store'
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentAnalysisResult = data.analysis;
            document.getElementById('analysisResponse').textContent = data.analysis;
            document.getElementById('analyzeResult').style.display = 'block';
            document.getElementById('exportAnalysisBtn').style.display = 'inline-block';
            document.getElementById('pinAnalysisBtn').style.display = 'inline-block';
            
            addToHistory('imageAnalyzer', prompt, data.analysis, { imageData: imageData });
            showToast('success', 'Analysis Complete', 'Image analyzed successfully!');
        } else {
            showModalMessage('imageAnalyzerModal', 'error', data.error || 'Unknown error');
        }
    } catch (error) {
        console.error('API error:', error);
        showModalMessage('imageAnalyzerModal', 'error', 'Connection error. Check ../../api.php?action=image_analyze');
    }
    
    document.getElementById('analyzeLoading').style.display = 'none';
    document.getElementById('analyzeImageBtn').disabled = false;
}

function exportAnalysisResponse() {
    if (!currentAnalysisResult) return;
    
    const data = {
        prompt: document.getElementById('analyzePrompt').value,
        analysis: currentAnalysisResult,
        timestamp: new Date().toISOString()
    };
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadFile(`image_analysis_${timestamp}.json`, JSON.stringify(data, null, 2), 'application/json');
}

function pinAnalysisToCanvas() {
    if (!currentAnalysisResult) return;
    const prompt = document.getElementById('analyzePrompt').value;
    addCardToCanvas('imageAnalyzer', prompt, currentAnalysisResult);
    showToast('success', 'Added to Canvas', 'Analysis saved as draggable card.');
}

// ===== TEXT ANALYZER FUNCTIONS =====
function openTextAnalyzer() {
    if (!checkApiKey()) return;
    cancelAllModes();
    document.getElementById('textAnalyzerFile').value = '';
    document.getElementById('textAnalyzePrompt').value = '';
    document.getElementById('textFileInfo').style.display = 'none';
    document.getElementById('textAnalyzeResult').style.display = 'none';
    document.getElementById('exportTextAnalysisBtn').style.display = 'none';
    document.getElementById('pinTextAnalysisBtn').style.display = 'none';
    currentTextFile = null;
    currentTextAnalysisResult = null;
    clearModalMessages('textAnalyzerModal');
    openModal('textAnalyzerModal');
}

function closeTextAnalyzer() {
    closeModal('textAnalyzerModal');
}

function reopenTextAnalyzer(historyItem) {
    if (!checkApiKey()) return;
    cancelAllModes();
    
    document.getElementById('textAnalyzerFile').value = '';
    document.getElementById('textAnalyzePrompt').value = historyItem.request;
    
    if (historyItem.metadata && historyItem.metadata.fileData) {
        currentTextFile = historyItem.metadata.fileData;
        displayTextFileInfo(currentTextFile);
    } else {
        document.getElementById('textFileInfo').style.display = 'none';
        currentTextFile = null;
    }
    
    if (historyItem.response) {
        currentTextAnalysisResult = historyItem.response;
        document.getElementById('textAnalysisResponse').textContent = historyItem.response;
        document.getElementById('textAnalyzeResult').style.display = 'block';
        document.getElementById('exportTextAnalysisBtn').style.display = 'inline-block';
        document.getElementById('pinTextAnalysisBtn').style.display = 'inline-block';
    } else {
        document.getElementById('textAnalyzeResult').style.display = 'none';
        currentTextAnalysisResult = null;
    }
    
    clearModalMessages('textAnalyzerModal');
    openModal('textAnalyzerModal');
    showToast('info', 'Analysis Restored', 'Reanalyze or modify request.');
}

function handleTextFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 1024 * 1024) {
        showModalMessage('textAnalyzerModal', 'error', 'File too large! Max 1MB.');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentTextFile = {
            name: file.name,
            size: file.size,
            content: e.target.result
        };
        displayTextFileInfo(currentTextFile);
    };
    reader.readAsText(file);
}

function displayTextFileInfo(fileData) {
    document.getElementById('textFileName').textContent = fileData.name;
    document.getElementById('textFileSize').textContent = formatFileSize(fileData.size);
    
    const preview = fileData.content.length > 2000 
        ? fileData.content.substring(0, 2000) + '\n\n... (truncated)'
        : fileData.content;
    
    document.getElementById('textFilePreview').textContent = preview;
    document.getElementById('textFileInfo').style.display = 'block';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function analyzeText() {
    const prompt = document.getElementById('textAnalyzePrompt').value.trim();
    
    if (!prompt) {
        showModalMessage('textAnalyzerModal', 'error', 'Enter analysis request!');
        return;
    }
    
    if (!currentTextFile) {
        showModalMessage('textAnalyzerModal', 'error', 'Upload a text file!');
        return;
    }
    
    if (!checkApiKey()) return;
    clearModalMessages('textAnalyzerModal');
    
    document.getElementById('analyzeTextBtn').disabled = true;
    document.getElementById('textAnalyzeLoading').style.display = 'block';
    document.getElementById('textAnalyzeResult').style.display = 'none';
    
    try {
        const response = await fetch('../../api.php?action=text_analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: appConfig.apiKey,
                fileContent: currentTextFile.content,
                fileName: currentTextFile.name,
                prompt: prompt
            }),
            cache: 'no-store'
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentTextAnalysisResult = data.analysis;
            document.getElementById('textAnalysisResponse').textContent = data.analysis;
            document.getElementById('textAnalyzeResult').style.display = 'block';
            document.getElementById('exportTextAnalysisBtn').style.display = 'inline-block';
            document.getElementById('pinTextAnalysisBtn').style.display = 'inline-block';
            
            addToHistory('textAnalyzer', prompt, data.analysis, { fileData: currentTextFile });
            showToast('success', 'Analysis Complete', 'File analyzed successfully!');
        } else {
            showModalMessage('textAnalyzerModal', 'error', data.error || 'Unknown error');
        }
    } catch (error) {
        console.error('API error:', error);
        showModalMessage('textAnalyzerModal', 'error', 'Connection error. Check ../../api.php?action=text_analyze');
    }
    
    document.getElementById('textAnalyzeLoading').style.display = 'none';
    document.getElementById('analyzeTextBtn').disabled = false;
}

function exportTextAnalysisResponse() {
    if (!currentTextAnalysisResult) return;
    
    const data = {
        fileName: currentTextFile ? currentTextFile.name : 'unknown',
        prompt: document.getElementById('textAnalyzePrompt').value,
        analysis: currentTextAnalysisResult,
        timestamp: new Date().toISOString()
    };
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadFile(`text_analysis_${timestamp}.json`, JSON.stringify(data, null, 2), 'application/json');
}

function pinTextAnalysisToCanvas() {
    if (!currentTextAnalysisResult) return;
    const prompt = document.getElementById('textAnalyzePrompt').value;
    const fileName = currentTextFile ? currentTextFile.name : 'Text file';
    const displayRequest = `[${fileName}]\n${prompt}`;
    addCardToCanvas('textAnalyzer', displayRequest, currentTextAnalysisResult);
    showToast('success', 'Added to Canvas', 'Analysis saved as draggable card.');
}


// ===== STICKY NOTES =====
function openAddNoteModal() {
    cancelAllModes();
    document.getElementById('stickyNoteText').value = '';
    selectedNoteColor = '#fff59d';
    
    document.querySelectorAll('#stickyNoteModal .color-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelector('#stickyNoteModal .color-option[data-color="#fff59d"]').classList.add('selected');
    
    openModal('stickyNoteModal');
}

function selectNoteColor(color) {
    selectedNoteColor = color;
    
    document.querySelectorAll('#stickyNoteModal .color-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    document.querySelector(`#stickyNoteModal .color-option[data-color="${color}"]`).classList.add('selected');
}

function createStickyNote() {
    const text = document.getElementById('stickyNoteText').value.trim();
    
    if (!text) {
        showToast('error', 'Empty Note', 'Please write something.');
        return;
    }
    
    const canvasContainer = document.querySelector('.canvas-container');
    const rect = canvasContainer.getBoundingClientRect();
    const scrollLeft = document.getElementById('canvas').parentElement.scrollLeft;
    const scrollTop = document.getElementById('canvas').parentElement.scrollTop;
    
    const noteData = {
        id: Date.now(),
        text: text,
        color: selectedNoteColor,
        x: scrollLeft + (rect.width / 2) - 100,
        y: scrollTop + (rect.height / 2) - 75,
        timestamp: new Date().toISOString()
    };
    
    if (!canvasState.notes) canvasState.notes = [];
    canvasState.notes.push(noteData);
    saveCanvasState();
    createStickyNoteElement(noteData);
    pushUndoStack({
        type: 'add',
        elementType: 'note',
        data: cloneData(noteData)
    });
    
    closeModal('stickyNoteModal');
    showToast('success', 'Note Created', 'Sticky note added to canvas!');
}

function createStickyNoteElement(noteData) {
    const canvas = document.getElementById('canvas');
    const note = document.createElement('div');
    note.className = 'sticky-note';
    note.dataset.id = noteData.id;
    note.style.left = noteData.x + 'px';
    note.style.top = noteData.y + 'px';
    note.style.background = noteData.color;
    
    const date = new Date(noteData.timestamp);
    const timeString = date.toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    note.innerHTML = `
        <div class="sticky-note-header">
            <span class="sticky-note-timestamp">${timeString}</span>
            <button class="sticky-note-close" onclick="event.stopPropagation(); removeStickyNote(${noteData.id})">×</button>
        </div>
        <div class="sticky-note-text">${escapeHtml(noteData.text)}</div>
    `;
    
    note.addEventListener('mousedown', startDrag);
    note.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        editStickyNote(noteData.id);
    });
    
    canvas.appendChild(note);
    return note;
}

function editStickyNote(id) {
    const note = canvasState.notes.find(n => n.id === id);
    if (!note) return;
    
    const newText = prompt('Edit note:', note.text);
    if (newText !== null && newText.trim() !== '') {
        const beforeData = { text: note.text, timestamp: note.timestamp };
        const updatedText = newText.trim();
        const updatedTimestamp = new Date().toISOString();
        note.text = updatedText;
        note.timestamp = updatedTimestamp;
        if (!isUndoingRedoing && (beforeData.text !== updatedText || beforeData.timestamp !== updatedTimestamp)) {
            pushUndoStack({
                type: 'update',
                elementType: 'note',
                id: note.id,
                before: beforeData,
                after: { text: updatedText, timestamp: updatedTimestamp }
            });
        }
        saveCanvasState();
        renderCanvas();
        showToast('success', 'Note Updated', 'Note updated successfully.');
    }
}

function removeStickyNote(id) {
    if (!confirm('Remove this sticky note?')) return;
    const note = canvasState.notes.find(n => n.id === id);
    if (!note) return;
    canvasState.notes = canvasState.notes.filter(n => n.id !== id);
    pushUndoStack({
        type: 'delete',
        elementType: 'note',
        data: cloneData(note)
    });
    saveCanvasState();
    renderCanvas();
    showToast('success', 'Note Removed', 'Sticky note deleted.');
}

// ===== FENCE (VISUAL GROUPS) =====
function startDrawingFence() {
    cancelAllModes();
    
    // Reset any previous editing state
    editingFenceId = null;
    document.querySelector('#fenceModal .modal-header h3').textContent = '🖼️ Create Fence';
    
    isDrawingFence = true;
    fenceStartPoint = null;
    tempFenceCoords = null;
    
    const canvas = document.getElementById('canvas');
    canvas.classList.add('drawing-mode');
    
    showToast('info', 'Draw Fence', 'Click two points to create a fence rectangle.');
    
    canvas.addEventListener('click', handleFenceClick);
}

/*function handleFenceClick(e) {
    if (!isDrawingFence) return;
    
    // Ignore clicks on existing elements
    if (e.target.classList.contains('canvas-card') ||
        e.target.classList.contains('sticky-note') ||
        e.target.classList.contains('fence') ||
        e.target.classList.contains('magnet-card') ||
        e.target.closest('.canvas-card') ||
        e.target.closest('.sticky-note') ||
        e.target.closest('.fence') ||
        e.target.closest('.magnet-card')) {
        return;
    }
    
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const scrollLeft = canvas.parentElement.scrollLeft;
    const scrollTop = canvas.parentElement.scrollTop;
    
    const currentZoom = zoomLevel || 1;
    const x = (e.clientX - rect.left) / currentZoom + scrollLeft;
    const y = (e.clientY - rect.top) / currentZoom + scrollTop;
    
    if (!fenceStartPoint) {
        fenceStartPoint = { x, y };
        
        fencePreviewElement = document.createElement('div');
        fencePreviewElement.className = 'fence-preview';
        fencePreviewElement.style.left = x + 'px';
        fencePreviewElement.style.top = y + 'px';
        fencePreviewElement.style.width = '0px';
        fencePreviewElement.style.height = '0px';
        canvas.appendChild(fencePreviewElement);
        
        canvas.addEventListener('mousemove', updateFencePreview);
    } else {
        const width = Math.abs(x - fenceStartPoint.x);
        const height = Math.abs(y - fenceStartPoint.y);
        const left = Math.min(x, fenceStartPoint.x);
        const top = Math.min(y, fenceStartPoint.y);
        
        tempFenceCoords = { x: left, y: top, width, height };
        
        canvas.removeEventListener('mousemove', updateFencePreview);
        canvas.removeEventListener('click', handleFenceClick);
        
        if (fencePreviewElement) {
            fencePreviewElement.remove();
            fencePreviewElement = null;
        }
        
        canvas.classList.remove('drawing-mode');
        isDrawingFence = false;
        
        selectedFenceColor = '#4a7c2c';
        document.getElementById('fenceLabel').value = '';
        document.querySelectorAll('#fenceModal .color-option').forEach(opt => opt.classList.remove('selected'));
        document.querySelector('#fenceModal .color-option[data-color="#4a7c2c"]').classList.add('selected');
        openModal('fenceModal');
    }
}*/

function handleFenceClick(e) {
    if (!isDrawingFence) return;
    
    // Ignore clicks on existing elements
    if (e.target.classList.contains('canvas-card') ||
        e.target.classList.contains('sticky-note') ||
        e.target.classList.contains('fence') ||
        e.target.classList.contains('magnet-card') ||
        e.target.closest('.canvas-card') ||
        e.target.closest('.sticky-note') ||
        e.target.closest('.fence') ||
        e.target.closest('.magnet-card')) {
        return;
    }
    
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const scrollLeft = canvas.parentElement.scrollLeft;
    const scrollTop = canvas.parentElement.scrollTop;
    const currentZoom = zoomLevel || 1;
    
    // Zoom-aware coordinates - CRITICAL FIX
    const x = (e.clientX - rect.left) / currentZoom + scrollLeft;
    const y = (e.clientY - rect.top) / currentZoom + scrollTop;
    
    if (!fenceStartPoint) {
        // First click - start point
        fenceStartPoint = { x, y };
        
        fencePreviewElement = document.createElement('div');
        fencePreviewElement.className = 'fence-preview';
        fencePreviewElement.style.left = x + 'px';
        fencePreviewElement.style.top = y + 'px';
        fencePreviewElement.style.width = '0px';
        fencePreviewElement.style.height = '0px';
        canvas.appendChild(fencePreviewElement);
        
        canvas.addEventListener('mousemove', updateFencePreview);
    } else {
        // Second click - end point
        const width = Math.abs(x - fenceStartPoint.x);
        const height = Math.abs(y - fenceStartPoint.y);
        const left = Math.min(x, fenceStartPoint.x);
        const top = Math.min(y, fenceStartPoint.y);
        
        tempFenceCoords = { x: left, y: top, width, height };
        
        canvas.removeEventListener('mousemove', updateFencePreview);
        canvas.removeEventListener('click', handleFenceClick);
        
        if (fencePreviewElement) {
            fencePreviewElement.remove();
            fencePreviewElement = null;
        }
        
        canvas.classList.remove('drawing-mode');
        isDrawingFence = false;
        
        // Reset modal and open it
        selectedFenceColor = '#4a7c2c';
        document.getElementById('fenceLabel').value = '';
        document.querySelectorAll('#fenceModal .color-option').forEach(opt => opt.classList.remove('selected'));
        document.querySelector('#fenceModal .color-option[data-color="#4a7c2c"]').classList.add('selected');
        openModal('fenceModal');
    }
}

/*function updateFencePreview(e) {
    if (!fencePreviewElement || !fenceStartPoint) return;
    
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const scrollLeft = canvas.parentElement.scrollLeft;
    const scrollTop = canvas.parentElement.scrollTop;
    const currentZoom = zoomLevel || 1;
    
    const x = (e.clientX - rect.left) / currentZoom + scrollLeft;
    const y = (e.clientY - rect.top) / currentZoom + scrollTop;
    
    const width = Math.abs(x - fenceStartPoint.x);
    const height = Math.abs(y - fenceStartPoint.y);
    const left = Math.min(x, fenceStartPoint.x);
    const top = Math.min(y, fenceStartPoint.y);
    
    fencePreviewElement.style.left = left + 'px';
    fencePreviewElement.style.top = top + 'px';
    fencePreviewElement.style.width = width + 'px';
    fencePreviewElement.style.height = height + 'px';
}*/

function updateFencePreview(e) {
    if (!fencePreviewElement || !fenceStartPoint) return;
    
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const scrollLeft = canvas.parentElement.scrollLeft;
    const scrollTop = canvas.parentElement.scrollTop;
    const currentZoom = zoomLevel || 1;
    
    // Zoom-aware coordinates - CRITICAL FIX
    const x = (e.clientX - rect.left) / currentZoom + scrollLeft;
    const y = (e.clientY - rect.top) / currentZoom + scrollTop;
    
    const width = Math.abs(x - fenceStartPoint.x);
    const height = Math.abs(y - fenceStartPoint.y);
    const left = Math.min(x, fenceStartPoint.x);
    const top = Math.min(y, fenceStartPoint.y);
    
    fencePreviewElement.style.left = left + 'px';
    fencePreviewElement.style.top = top + 'px';
    fencePreviewElement.style.width = width + 'px';
    fencePreviewElement.style.height = height + 'px';
}

function selectFenceColor(color) {
    selectedFenceColor = color;
    
    document.querySelectorAll('#fenceModal .color-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    document.querySelector(`#fenceModal .color-option[data-color="${color}"]`).classList.add('selected');
}

function confirmFence() {
    const label = document.getElementById('fenceLabel').value.trim();
    
    if (editingFenceId !== null) {
        // EDIT MODE: Update existing fence
        const fence = canvasState.fences.find(f => f.id === editingFenceId);
        if (fence) {
            const beforeData = { label: fence.label, color: fence.color };
            fence.label = label;
            fence.color = selectedFenceColor;
            if (!isUndoingRedoing) {
                pushUndoStack({
                    type: 'update',
                    elementType: 'fence',
                    id: fence.id,
                    before: beforeData,
                    after: { label: label, color: selectedFenceColor }
                });
            }
            saveCanvasState();
            renderCanvas();
            showToast('success', 'Fence Updated', 'Fence modified successfully.');
        }
        editingFenceId = null;
    } else {
        // CREATE MODE: Create new fence
        if (!tempFenceCoords) return;
        
        const fenceData = {
            id: Date.now(),
            x: tempFenceCoords.x,
            y: tempFenceCoords.y,
            width: tempFenceCoords.width,
            height: tempFenceCoords.height,
            color: selectedFenceColor,
            label: label
        };
        
        if (!canvasState.fences) canvasState.fences = [];
        canvasState.fences.push(fenceData);
        saveCanvasState();
        createFenceElement(fenceData);
        pushUndoStack({
            type: 'add',
            elementType: 'fence',
            data: cloneData(fenceData)
        });
        
        showToast('success', 'Fence Created', 'Visual group added!');
        tempFenceCoords = null;
    }
    
    // Reset modal title
    document.querySelector('#fenceModal .modal-header h3').textContent = '🖼️ Create Fence';
    closeModal('fenceModal');
}

function cancelFence() {
    editingFenceId = null;
    tempFenceCoords = null;
    // Reset modal title
    document.querySelector('#fenceModal .modal-header h3').textContent = '🖼️ Create Fence';
    closeModal('fenceModal');
}

function createFenceElement(fenceData) {
    const canvas = document.getElementById('canvas');
    const fence = document.createElement('div');
    fence.className = 'fence';
    fence.dataset.id = fenceData.id;
    fence.style.left = fenceData.x + 'px';
    fence.style.top = fenceData.y + 'px';
    fence.style.width = fenceData.width + 'px';
    fence.style.height = fenceData.height + 'px';
    fence.style.borderColor = fenceData.color;
    fence.style.color = fenceData.color;
    
    // Create label container (always present, even if empty)
    const label = document.createElement('div');
    label.className = 'fence-label';
    label.textContent = fenceData.label || '';
    label.style.pointerEvents = 'auto';
    label.style.cursor = 'text';
    
    // Make label editable on click
    /*    
    label.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent drag start
        if (!label.isContentEditable) {
            label.contentEditable = 'true';
            label.focus();
            // Select all text
            const range = document.createRange();
            range.selectNodeContents(label);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    });
    
    // Save on blur (click outside)
    label.addEventListener('blur', () => {
        if (label.isContentEditable) {
            label.contentEditable = 'false';
            const newLabel = label.textContent.trim();
            
            // Update fence data
            const fence = canvasState.fences.find(f => f.id === fenceData.id);
            if (fence) {
                fence.label = newLabel;
                saveCanvasState();
                showToast('success', 'Label Updated', 'Fence label saved.');
            }
        }
    });
    
    // Save on Enter key
    label.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            label.blur(); // Triggers save via blur event
        }
        if (e.key === 'Escape') {
            // Cancel edit and restore original
            label.textContent = fenceData.label || '';
            label.contentEditable = 'false';
        }
    });
    */
    fence.appendChild(label);
    
    /* Add double-click on fence for color editing
    fence.addEventListener('dblclick', (e) => {
        // Don't trigger if clicking label (already editable) or close button
        if (e.target.classList.contains('fence-label') || 
            e.target.classList.contains('fence-close')) {
            return;
        }
        
        // Open fence modal for color editing
        editFence(fenceData.id);
    }); */

    const closeBtn = document.createElement('button');
    closeBtn.className = 'fence-close';
    closeBtn.textContent = '×';
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        removeFence(fenceData.id);
    };
    fence.appendChild(closeBtn);
    
    fence.addEventListener('mousedown', startDrag);
    canvas.appendChild(fence);
    return fence;
}

function removeFence(id) {
    if (!confirm('Remove this fence?')) return;
    const fence = canvasState.fences.find(f => f.id === id);
    if (!fence) return;
    canvasState.fences = canvasState.fences.filter(f => f.id !== id);
    pushUndoStack({
        type: 'delete',
        elementType: 'fence',
        data: cloneData(fence)
    });
    saveCanvasState();
    renderCanvas();
    showToast('success', 'Fence Removed', 'Visual group deleted.');
}

function editFence(id) {
    cancelAllModes();

    const fence = canvasState.fences.find(f => f.id === id);
    if (!fence) return;
    
    // Set editing mode
    editingFenceId = id;
    
    // Populate modal with current values
    document.getElementById('fenceLabel').value = fence.label || '';
    
    // Select current color
    selectedFenceColor = fence.color || '#4a7c2c';
    document.querySelectorAll('#fenceModal .color-option').forEach(opt => {
        opt.classList.remove('selected');
        if (opt.dataset.color === selectedFenceColor) {
            opt.classList.add('selected');
        }
    });
    
    // Update modal title
    document.querySelector('#fenceModal .modal-header h3').textContent = '🖼️ Edit Fence';
    
    // Show modal
    openModal('fenceModal');
}

function getElementsInsideFence(fence) {
    const elements = [];
    const fenceLeft = fence.x;
    const fenceTop = fence.y;
    const fenceRight = fence.x + fence.width;
    const fenceBottom = fence.y + fence.height;

    canvasState.cards.forEach(card => {
        const cardCenterX = card.x + (card.width || 320) / 2;
        const cardCenterY = card.y + (card.height || 250) / 2;

        if (cardCenterX >= fenceLeft && cardCenterX <= fenceRight &&
            cardCenterY >= fenceTop && cardCenterY <= fenceBottom) {
            elements.push({
                elementType: 'card',
                id: card.id,
                before: { x: card.x, y: card.y }
            });
        }
    });

    if (canvasState.notes) {
        canvasState.notes.forEach(note => {
            const noteCenterX = note.x + 100;
            const noteCenterY = note.y + 75;

            if (noteCenterX >= fenceLeft && noteCenterX <= fenceRight &&
                noteCenterY >= fenceTop && noteCenterY <= fenceBottom) {
                elements.push({
                    elementType: 'note',
                    id: note.id,
                    before: { x: note.x, y: note.y }
                });
            }
        });
    }

    if (canvasState.magnets) {
        canvasState.magnets.forEach(magnet => {
            const magnetCenterX = magnet.x + 75;
            const magnetCenterY = magnet.y + 75;

            if (magnetCenterX >= fenceLeft && magnetCenterX <= fenceRight &&
                magnetCenterY >= fenceTop && magnetCenterY <= fenceBottom) {
                elements.push({
                    elementType: 'magnet',
                    id: magnet.id,
                    before: { x: magnet.x, y: magnet.y }
                });
            }
        });
    }

    return elements;
}

function moveElementsInsideFence(fence, deltaX, deltaY) {
    const fenceLeft = fence.x;
    const fenceTop = fence.y;
    const fenceRight = fence.x + fence.width;
    const fenceBottom = fence.y + fence.height;
    
    canvasState.cards.forEach(card => {
        const cardCenterX = card.x + (card.width || 320) / 2;
        const cardCenterY = card.y + (card.height || 250) / 2;
        
        if (cardCenterX >= fenceLeft && cardCenterX <= fenceRight &&
            cardCenterY >= fenceTop && cardCenterY <= fenceBottom) {
            card.x += deltaX;
            card.y += deltaY;
        }
    });
    
    if (canvasState.notes) {
        canvasState.notes.forEach(note => {
            const noteCenterX = note.x + 100;
            const noteCenterY = note.y + 75;
            
            if (noteCenterX >= fenceLeft && noteCenterX <= fenceRight &&
                noteCenterY >= fenceTop && noteCenterY <= fenceBottom) {
                note.x += deltaX;
                note.y += deltaY;
            }
        });
    }
    
    if (canvasState.magnets) {
        canvasState.magnets.forEach(magnet => {
            const magnetCenterX = magnet.x + 75; // 150px / 2
            const magnetCenterY = magnet.y + 75; // 150px / 2
            
            if (magnetCenterX >= fenceLeft && magnetCenterX <= fenceRight &&
                magnetCenterY >= fenceTop && magnetCenterY <= fenceBottom) {
                magnet.x += deltaX;
                magnet.y += deltaY;
            }
        });
    }
}


// ===== MAGNET FUNCTIONS =====
function downloadGeneratedImage() {
    if (!currentGeneratedImage || !currentImageFilename) return;
    
    // Download via ../../api.php?action=get_image
    const downloadUrl = '../../api.php?action=get_image?path=' + encodeURIComponent(currentGeneratedImage);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = currentImageFilename;
    a.click();
    
    showToast('success', 'Image Downloaded', 'Image saved to your computer!');
}

function createMagnet() {
    if (!currentGeneratedImage) return;
    
    const canvasContainer = document.querySelector('.canvas-container');
    const rect = canvasContainer.getBoundingClientRect();
    const scrollLeft = document.getElementById('canvas').parentElement.scrollLeft;
    const scrollTop = document.getElementById('canvas').parentElement.scrollTop;
    
    const magnetData = {
        id: Date.now(),
        imageUrl: currentGeneratedImage,
        filename: currentImageFilename,
        prompt: currentImagePrompt,
        x: scrollLeft + (rect.width / 2) - 75,
        y: scrollTop + (rect.height / 2) - 75,
        timestamp: new Date().toISOString()
    };
    
    if (!canvasState.magnets) canvasState.magnets = [];
    canvasState.magnets.push(magnetData);
    saveCanvasState();
    createMagnetElement(magnetData);
    pushUndoStack({
        type: 'add',
        elementType: 'magnet',
        data: cloneData(magnetData)
    });
    
    showToast('success', 'Magnet Created', 'Mini image card added to canvas!');
}

function createMagnetElement(magnetData) {
    const canvas = document.getElementById('canvas');
    const magnet = document.createElement('div');
    magnet.className = 'magnet-card';
    magnet.dataset.id = magnetData.id;
    magnet.dataset.type = 'magnet'; // Identifier for linking
    magnet.style.left = magnetData.x + 'px';
    magnet.style.top = magnetData.y + 'px';
    magnet.title = magnetData.prompt; // Tooltip with original prompt
    
    const imageDisplayUrl = '../../api.php?action=get_image?path=' + encodeURIComponent(magnetData.imageUrl);
    
    magnet.innerHTML = `
        <div class="magnet-header">
            <span class="magnet-icon">🧲</span>
            <div class="magnet-actions">
                <button class="magnet-btn btn-link" 
                        title="Link">🔗</button>
                <button class="magnet-close" 
                        onclick="event.stopPropagation(); removeMagnet(${magnetData.id})">×</button>
            </div>
        </div>
        <div class="magnet-image">
            <img src="${imageDisplayUrl}" alt="Generated image">
        </div>
    `;
    
    // Add link button event listener
    const linkBtn = magnet.querySelector('.btn-link');
    linkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleMagnetLink(magnetData.id);
    });
    
    magnet.addEventListener('mousedown', startDrag);
    canvas.appendChild(magnet);
    return magnet;
}

function toggleMagnetLink(magnetId) {
    // Use same linking system as cards
    if (!linkingMode) {
        linkingMode = true;
        linkSourceCard = magnetId;
        
        const btn = document.querySelector(`[data-id="${magnetId}"] .btn-link`);
        if (btn) btn.classList.add('active');
        
        showToast('info', 'Link Mode', 'Click a card or magnet to connect.');
    } else {
        if (linkSourceCard === magnetId) {
            cancelLinking();
        } else {
            createConnection(linkSourceCard, magnetId);
            cancelLinking();
        }
    }
}

function removeMagnet(id) {
    if (!confirm('Remove this magnet?')) return;
    const magnet = canvasState.magnets.find(m => m.id === id);
    if (!magnet) return;

    const removedConnections = removeConnectionsForElement(id);
    canvasState.magnets = canvasState.magnets.filter(m => m.id !== id);
    pushUndoStack({
        type: 'delete',
        elementType: 'magnet',
        data: cloneData(magnet),
        connections: removedConnections
    });
    
    saveCanvasState();
    renderCanvas();
    showToast('success', 'Magnet Removed', 'Image magnet deleted.');
}
