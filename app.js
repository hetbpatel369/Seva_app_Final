/**
 * ========================================
 * SEVA APP - House Cleaning Assignment Manager
 * ========================================
 * 
 * A Progressive Web App for managing weekly house cleaning assignments
 * with real-time synchronization across all devices.
 * 
 * @author Your Name
 * @version 2.0.0
 * @license MIT
 * 
 * Features:
 * - Real-time synchronization via Firebase Realtime Database
 * - Secure authentication with Firebase Auth
 * - Smart rotation algorithm for fair task distribution
 * - Screenshot generation and sharing capabilities
 * - Progressive Web App with offline support
 * - Responsive iOS-inspired UI
 * 
 * Architecture:
 * - Modular design with separated concerns
 * - Event-driven updates with Firebase listeners
 * - State management through appState object
 * - Secure role-based access control
 */

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // CONFIGURATION & CONSTANTS
    // ==========================================

    /**
     * List of all cleaning tasks (sevas) in the house
     * Order matters for rotation algorithm
     */
    const SEVA_TASKS = [
        "Main Hall, Entrance, Coat Closet",
        "Kitchen",
        "Fridges",
        "Upper Rooms and Walkway/Stairs",
        "Upper Washroom",
        "Dastva Hall and Walkway/Stairs",
        "Lower Washroom",
        "Private Washroom and Laundry Room",
        "Basement, Luggage Room and Kitchen",
        "Garbage Bin Cleaning",
        "Grocery",
        "Yard"
    ];

    /**
     * Number of people assigned to each task
     * Corresponds 1:1 with SEVA_TASKS array
     */
    const TASK_CAPACITIES = [3, 3, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1];

    /**
     * Default assignment configuration
     * Used for initial setup and reset functionality
     */
    const DEFAULT_ASSIGNMENTS = [
        ["Het Bhai", "Harsh Bhai", "Avi Bhai"],
        ["Devang Bhai", "Kintul Bhai", "Shreyansh Bhai"],
        ["Rohan Bhai"],
        ["Malav Bhai & Param Bhai"],
        ["Jayraj Bhai"],
        ["Vraj Bhai", "Nisarg Bhai"],
        ["Sheel Bhai"],
        ["Hardik Bhai"],
        ["Heet Bhai", "Pratik Bhai"],
        ["Bhumin Bhai"],
        ["Bhagirath Bhai", "Mann Bhai"],
        ["Volunteer"]
    ];

    /**
     * Firebase Realtime Database path for storing assignments
     */
    const SEVA_DATA_PATH = 'seva-assignments/main';

    /**
     * Application state object
     * Single source of truth for app data
     */
    let appState = {
        currentAssignments: [],    // Current task assignments
        isLoggedIn: false,          // Authentication status
        isDataLoaded: false         // Data fetch status
    };

    // ==========================================
    // FIREBASE INITIALIZATION
    // ==========================================

    /**
     * Extract Firebase services from global window object
     * These were initialized in index.html via ES6 modules
     */
    const { 
        db,                             // Realtime Database instance
        ref,                            // Create database reference
        set,                            // Write data to database
        onValue,                        // Listen for data changes
        auth,                           // Authentication instance
        signInWithEmailAndPassword,     // Email/password sign-in
        onAuthStateChanged,             // Auth state listener
        signOut                         // Sign out function
    } = window.firebase;
    
    /**
     * Database reference pointing to our assignments data
     */
    const dbRef = ref(db, SEVA_DATA_PATH);

    // ==========================================
    // FIREBASE REAL-TIME SYNCHRONIZATION
    // ==========================================

    /**
     * Initialize real-time listener for database changes
     * Automatically syncs data across all connected clients
     * 
     * Flow:
     * 1. Attach listener to database path
     * 2. On data change, update local state
     * 3. Re-render UI with new data
     * 4. Update sync status indicators
     */
    function initializeRealtimeListener() {
        updateSyncStatus('connecting', 'Connecting...');
        
        onValue(dbRef, (snapshot) => {
            const data = snapshot.val();
            
            if (data && data.assignments) {
                // Data exists in database - sync it locally
                appState.currentAssignments = data.assignments;
                renderTable();
                updateLastUpdatedTime(data.timestamp);
                updateSyncStatus('connected', 'Synced');
                appState.isDataLoaded = true;
                ui.screenshotBtn.disabled = false;
            } else {
                // No data exists - initialize with defaults
                console.log("No data in Firebase. Initializing with defaults.");
                appState.currentAssignments = JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS));
                
                // Only write if user is authenticated (prevents permission errors)
                if (appState.isLoggedIn) {
                    updateDataInFirebase(appState.currentAssignments, true);
                }
                
                appState.isDataLoaded = true; 
                ui.screenshotBtn.disabled = false;
            }
        }, (error) => {
            // Handle connection errors gracefully
            console.error("Firebase Read Failed:", error);
            updateSyncStatus('error', 'Connection Error');
            appState.isDataLoaded = false;
            ui.screenshotBtn.disabled = true;
        });
    }

    /**
     * Write assignment data to Firebase
     * 
     * @param {Array<Array<string>>} assignments - 2D array of assignments
     * @param {boolean} isInitial - Whether this is initial data setup
     * 
     * Security: Only authenticated users can write
     * Error handling: Alerts user on permission errors
     */
    async function updateDataInFirebase(assignments, isInitial = false) {
        try {
            await set(dbRef, {
                assignments: assignments,
                timestamp: new Date().toISOString()
            });
            console.log("Data successfully updated in Firebase.");
        } catch (error) {
            console.error("Firebase Write Failed:", error);
            alert("Update failed. You must be logged in as an admin to make changes.");
        }
    }

    // ==========================================
    // UI ELEMENT REFERENCES
    // ==========================================

    /**
     * Cached DOM element references for performance
     * Prevents repeated querySelector calls
     */
    const ui = {
        tableBody: document.getElementById('sevaTableBody'),
        lastUpdated: document.getElementById('lastUpdated'),
        syncStatus: document.getElementById('syncStatus'),
        syncIndicator: document.getElementById('syncIndicator'),
        syncText: document.getElementById('syncText'),
        adminControls: document.getElementById('adminControls'),
        loginBtn: document.getElementById('loginBtn'),
        logoutBtn: document.getElementById('logoutBtn'),
        loginError: document.getElementById('loginError'),
        usernameInput: document.getElementById('username'),
        passwordInput: document.getElementById('password'),
        screenshotBtn: document.getElementById('screenshotBtn')
    };
    
    /**
     * Bootstrap Modal instance for login dialog
     */
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));

    // ==========================================
    // UI RENDERING FUNCTIONS
    // ==========================================

    /**
     * Render the assignments table
     * Pure function - no side effects, only DOM updates
     * 
     * Performance: Uses DocumentFragment internally via innerHTML
     * for efficient batch DOM updates
     */
    function renderTable() {
        ui.tableBody.innerHTML = '';
        
        SEVA_TASKS.forEach((seva, index) => {
            const assignedPeople = appState.currentAssignments[index] || [];
            const row = ui.tableBody.insertRow();
            
            // Task name cell
            row.insertCell(0).textContent = seva;
            
            // Assigned people cell (comma-separated)
            row.insertCell(1).textContent = assignedPeople.join(', ');
        });
    }
    
    /**
     * Display last update timestamp in user's local timezone
     * 
     * @param {string} isoString - ISO 8601 timestamp from database
     */
    function updateLastUpdatedTime(isoString) {
        const date = new Date(isoString);
        ui.lastUpdated.textContent = date.toLocaleString();
    }
    
    /**
     * Update sync status indicator with visual feedback
     * 
     * @param {string} status - 'connected' | 'error' | 'connecting'
     * @param {string} text - Status message to display
     */
    function updateSyncStatus(status, text) {
        const statusClass = status === 'connected' ? 'success' : 
                           status === 'error' ? 'danger' : 'warning';
        
        ui.syncStatus.className = `d-inline-flex align-items-center text-${statusClass}`;
        ui.syncIndicator.textContent = status === 'connected' ? '✅' : 
                                       status === 'error' ? '❌' : '🔄';
        ui.syncText.textContent = text;
    }

    // ==========================================
    // CORE BUSINESS LOGIC
    // ==========================================

    /**
     * Rotate people through assignments using fair distribution algorithm
     * 
     * Algorithm:
     * 1. Collect all rotatable people (excludes fixed assignments)
     * 2. Rotate array by one position (last person moves to first)
     * 3. Redistribute people based on task capacities
     * 4. Maintain special constraints (Grocery, Yard tasks)
     * 
     * Complexity: O(n) where n is total number of people
     */
    function rotatePeople() {
        let peopleToRotate = [];
        
        // Phase 1: Collect rotatable people
        appState.currentAssignments.forEach((assignedGroup, index) => {
            const taskName = SEVA_TASKS[index];
            
            if (taskName !== "Grocery" && taskName !== "Yard") {
                // Regular tasks - all people rotate
                peopleToRotate.push(...assignedGroup);
            } else if (taskName === "Grocery") {
                // Grocery - Bhagirath Bhai stays fixed, others rotate
                peopleToRotate.push(...assignedGroup.filter(person => person !== "Bhagirath Bhai"));
            }
            // Yard task is always "Volunteer" - never rotates
        });
        
        // Phase 2: Rotate the array
        if (peopleToRotate.length > 1) {
            peopleToRotate.unshift(peopleToRotate.pop());
        }
        
        // Phase 3: Redistribute people into tasks
        let personIndex = 0;
        const newAssignments = SEVA_TASKS.map((taskName, taskIndex) => {
            const capacity = TASK_CAPACITIES[taskIndex];
            let newGroup = [];
            
            if (taskName === "Yard") {
                // Yard always has volunteer
                newGroup.push("Volunteer");
            } else if (taskName === "Grocery") {
                // Grocery: Fixed person + one rotating person
                newGroup.push("Bhagirath Bhai");
                if (personIndex < peopleToRotate.length) {
                    newGroup.push(peopleToRotate[personIndex++]);
                }
            } else {
                // Regular tasks: Fill up to capacity
                for (let i = 0; i < capacity && personIndex < peopleToRotate.length; i++) {
                    newGroup.push(peopleToRotate[personIndex++]);
                }
            }
            
            return newGroup;
        });
        
        // Save new assignments to database
        updateDataInFirebase(newAssignments);
    }

    /**
     * Reset all assignments to default configuration
     * Includes confirmation dialog to prevent accidental resets
     */
    function resetToDefault() {
        if (confirm('Are you sure you want to reset all assignments to default?')) {
            // Deep clone to prevent reference issues
            const defaultCopy = JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS));
            updateDataInFirebase(defaultCopy);
        }
    }
    
    /**
     * Generate screenshot of assignments table
     * 
     * Process:
     * 1. Prepare UI (hide admin controls, remove animations)
     * 2. Capture DOM to canvas using html2canvas
     * 3. Try to copy to clipboard
     * 4. Fallback to download if clipboard fails
     * 5. Restore UI to normal state
     * 
     * Browser Support:
     * - Primary: Clipboard API (Chrome, Edge, Safari 13.1+)
     * - Fallback: File download (all browsers)
     */
    async function takeScreenshot() {
        // Validation: Ensure data is loaded
        if (!appState.isDataLoaded) {
            alert("Please wait for the data to load before taking a screenshot.");
            return;
        }
        
        // DOM references
        const contentToCapture = document.querySelector(".container");
        const mainElement = document.querySelector("main");
        const adminControlsElement = document.getElementById('adminControls');
        const footerElement = document.querySelector("footer");
        
        // Store original button text
        const originalBtnText = ui.screenshotBtn.innerHTML;
        
        // Phase 1: Disable button and show loading state
        ui.screenshotBtn.disabled = true;
        ui.screenshotBtn.innerHTML = '📸 Processing...';
        
        // Phase 2: Prepare UI for screenshot
        if (adminControlsElement && !adminControlsElement.classList.contains('d-none')) {
            adminControlsElement.classList.add('d-none');
        }
        if (footerElement) {
            footerElement.classList.add('d-none');
        }
        if (mainElement) {
            mainElement.classList.add('screenshot-prep');
        }
        
        // Phase 3: Capture after next paint (ensures CSS changes apply)
        requestAnimationFrame(() => {
            setTimeout(async () => {
                let canvas;
                
                try {
                    // Generate canvas from DOM
                    canvas = await html2canvas(contentToCapture, {
                        scale: 2,              // Higher resolution
                        useCORS: true,         // Allow cross-origin images
                        backgroundColor: '#1c1c1e'  // Match app theme
                    });
                    
                    // Check clipboard API support
                    if (!navigator.clipboard || !navigator.clipboard.write) {
                        throw new Error("Clipboard API not supported.");
                    }
                    
                    // Convert canvas to blob and copy to clipboard
                    const blob = await new Promise(resolve => 
                        canvas.toBlob(resolve, 'image/png')
                    );
                    const item = new ClipboardItem({ 'image/png': blob });
                    await navigator.clipboard.write([item]);
                    
                    alert('Screenshot copied to clipboard! 📋');
                    
                } catch (err) {
                    console.error("Screenshot or Copy failed:", err);
                    
                    // Fallback to download
                    if (err.message.includes("Clipboard")) {
                        alert("Could not copy to clipboard. Image will be downloaded instead.");
                    } else {
                        alert("Screenshot failed. Image will be downloaded as a fallback.");
                    }
                    
                    if (canvas) {
                        const link = document.createElement('a');
                        const dateStr = new Date().toLocaleDateString().replace(/\//g, '-');
                        link.download = `seva-assignments-${dateStr}.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                    } else {
                        alert("Sorry, the screenshot could not be created at all.");
                    }
                    
                } finally {
                    // Phase 4: Restore UI to normal state
                    ui.screenshotBtn.disabled = false;
                    ui.screenshotBtn.innerHTML = originalBtnText;
                    
                    if (footerElement) {
                        footerElement.classList.remove('d-none');
                    }
                    if (mainElement) {
                        mainElement.classList.remove('screenshot-prep');
                    }
                    
                    // Restore admin controls if user is logged in
                    setAdminUI(appState.isLoggedIn); 
                }
            }, 100); // Small delay ensures CSS transitions complete
        });
    }
    
    /**
     * Share assignments via native share or clipboard
     * 
     * Behavior:
     * - Mobile: Uses native share sheet (if available)
     * - Desktop: Copies to clipboard and shows alert
     * 
     * Format: Plain text with emojis for visual appeal
     */
    async function shareAssignments() {
        // Build formatted text
        let shareText = "🏠 HOUSE CLEANING SEVA ASSIGNMENTS 🏠\n\n";
        
        appState.currentAssignments.forEach((assignedPeople, index) => {
            shareText += `📍 ${SEVA_TASKS[index]}: ${assignedPeople.join(', ')}\n`;
        });
        
        shareText += "\n🙏 Let's complete it before Sunday!";
        
        try {
            // Try native share API first
            if (navigator.share) {
                await navigator.share({
                    title: 'Seva Assignments',
                    text: shareText
                });
            } else {
                // Fallback to clipboard
                await navigator.clipboard.writeText(shareText);
                alert('Assignments copied to clipboard! 📋');
            }
        } catch (error) {
            console.error('Share failed:', error);
            alert('Sharing failed. Please try again.');
        }
    }

    // ==========================================
    // AUTHENTICATION SYSTEM
    // ==========================================

    /**
     * Update UI based on authentication state
     * Shows/hides admin controls and login/logout buttons
     * 
     * @param {boolean} isLoggedIn - Current authentication status
     */
    function setAdminUI(isLoggedIn) {
        appState.isLoggedIn = isLoggedIn;
        
        if (isLoggedIn) {
            // Show admin controls
            ui.adminControls.classList.remove('d-none');
            ui.loginBtn.style.display = 'none';
            ui.logoutBtn.style.display = 'block';
        } else {
            // Hide admin controls
            ui.adminControls.classList.add('d-none');
            ui.loginBtn.style.display = 'block';
            ui.logoutBtn.style.display = 'none';
        }
    }

    /**
     * Initialize Firebase Auth state listener
     * Single source of truth for authentication status
     * Automatically called on page load and auth state changes
     */
    function initializeAuthListener() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // User is authenticated
                console.log("Auth state changed: User is LOGGED IN", user.email);
                setAdminUI(true);
            } else {
                // User is not authenticated
                console.log("Auth state changed: User is LOGGED OUT");
                setAdminUI(false);
            }
        });
    }

    /**
     * Handle login form submission
     * Validates input and authenticates with Firebase
     * 
     * Security: All validation happens server-side via Firebase
     * Error handling: User-friendly messages for common errors
     */
    async function handleLogin() {
        const email = ui.usernameInput.value.trim();
        const password = ui.passwordInput.value.trim();
        
        // Client-side validation
        if (!email || !password) {
            showLoginError("Please enter both email and password.");
            return;
        }

        try {
            // Authenticate with Firebase
            await signInWithEmailAndPassword(auth, email, password);
            
            // Success - close modal and clear form
            loginModal.hide();
            ui.usernameInput.value = '';
            ui.passwordInput.value = '';
            
        } catch (error) {
            // Handle Firebase auth errors
            console.error("Login Failed:", error.code);
            
            if (error.code === 'auth/invalid-credential' || 
                error.code === 'auth/wrong-password') {
                showLoginError("❌ Invalid credentials. Please try again.");
            } else if (error.code === 'auth/invalid-email') {
                showLoginError("❌ Invalid email format.");
            } else {
                showLoginError("❌ An unknown error occurred.");
            }
        }
    }

    /**
     * Handle logout action
     * Signs out from Firebase Auth
     */
    async function handleLogout() {
        try {
            await signOut(auth);
            // UI will automatically update via onAuthStateChanged listener
        } catch (error) {
            console.error("Logout Failed:", error);
            alert("Logout failed. Please try again.");
        }
    }

    /**
     * Display login error message with auto-dismiss
     * 
     * @param {string} message - Error message to display
     */
    function showLoginError(message) {
        ui.loginError.textContent = message;
        ui.loginError.style.display = 'block';
        
        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            ui.loginError.style.display = 'none';
        }, 3000);
    }
    
    // ==========================================
    // EVENT LISTENER SETUP
    // ==========================================

    /**
     * Attach all event listeners to DOM elements
     * Centralized setup prevents duplicate listeners
     */
    function setupEventListeners() {
        // Admin action buttons
        document.getElementById('rotateBtn').addEventListener('click', rotatePeople);
        document.getElementById('resetBtn').addEventListener('click', resetToDefault);
        document.getElementById('screenshotBtn').addEventListener('click', takeScreenshot);
        document.getElementById('shareBtn').addEventListener('click', shareAssignments);
        
        // Authentication buttons
        ui.loginBtn.addEventListener('click', () => loginModal.show());
        ui.logoutBtn.addEventListener('click', handleLogout);
        document.getElementById('submitLogin').addEventListener('click', handleLogin);
        
        // Login form keyboard support
        ui.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }

    // ==========================================
    // SERVICE WORKER REGISTRATION
    // ==========================================

    /**
     * Register Service Worker for PWA functionality
     * Enables:
     * - Offline capability
     * - Install prompts
     * - Background sync (future feature)
     */
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('ServiceWorker registered successfully:', registration.scope);
                    })
                    .catch(error => {
                        console.log('ServiceWorker registration failed:', error);
                    });
            });
        }
    }

    // ==========================================
    // APPLICATION INITIALIZATION
    // ==========================================

    /**
     * Initialize the application
     * Called automatically when DOM is ready
     * 
     * Initialization order matters:
     * 1. Event listeners (always safe to attach)
     * 2. Auth listener (determines UI visibility)
     * 3. Database listener (loads data)
     * 4. Service Worker (enhances experience)
     */
    function initializeApp() {
        setupEventListeners();
        initializeAuthListener();
        initializeRealtimeListener();
        registerServiceWorker();
        
        // Disable screenshot button until data loads
        ui.screenshotBtn.disabled = true;
    }

    // Start the application
    initializeApp();
});