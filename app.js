/**
 * ========================================
 * SEVA APP - House Cleaning Assignment Manager
 * ========================================
 */

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. CONFIGURATION & CONSTANTS
    // ==========================================

    const SEVA_TASKS = [
        "Main Hall, Entrance, Coat Closet", "Kitchen", "Fridges",
        "Upper Rooms and Walkway/Stairs", "Upper Washroom", "Dastva Hall and Walkway/Stairs",
        "Lower Washroom", "Private Washroom and Laundry Room", "Basement, Luggage Room and Kitchen",
        "Garbage Bin Cleaning", "Grocery", "Yard"
    ];

    const TASK_CAPACITIES = [3, 3, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1];

    const DEFAULT_ASSIGNMENTS = [
        ["Het Bhai", "Harsh Bhai", "Avi Bhai"], ["Devang Bhai", "Kintul Bhai", "Shreyansh Bhai"],
        ["Rohan Bhai"], ["Malav Bhai & Param Bhai"], ["Jayraj Bhai"], ["Vraj Bhai", "Nisarg Bhai"],
        ["Sheel Bhai"], ["Hardik Bhai"], ["Heet Bhai", "Pratik Bhai"], ["Bhumin Bhai"],
        ["Bhagirath Bhai", "Mann Bhai"], ["Volunteer"]
    ];

    const SEVA_DATA_PATH = 'seva-assignments/main';

    let appState = {
        currentAssignments: [],
        isLoggedIn: false,
        isDataLoaded: false
    };

    // ==========================================
    // 2. FIREBASE INITIALIZATION
    // ==========================================

    const { 
        db, ref, set, onValue, 
        auth, signInWithEmailAndPassword, onAuthStateChanged, signOut 
    } = window.firebase;
    
    const dbRef = ref(db, SEVA_DATA_PATH);

    // ==========================================
    // 3. FIREBASE REAL-TIME LISTENERS
    // ==========================================

    function initializeRealtimeListener() {
        updateSyncStatus('connecting', 'Connecting...');
        
        onValue(dbRef, (snapshot) => {
            const data = snapshot.val();
            
            if (data && data.assignments) {
                appState.currentAssignments = data.assignments;
                renderTable();
                updateLastUpdatedTime(data.timestamp);
                updateSyncStatus('connected', 'Synced');
                appState.isDataLoaded = true;
                ui.screenshotBtn.disabled = false;
            } else {
                console.log("Initializing defaults...");
                appState.currentAssignments = JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS));
                if (appState.isLoggedIn) {
                    updateDataInFirebase(appState.currentAssignments, true);
                }
                appState.isDataLoaded = true; 
                ui.screenshotBtn.disabled = false;
                renderTable();
            }
        }, (error) => {
            console.error("Firebase Read Failed:", error);
            updateSyncStatus('error', 'Connection Error');
            appState.isDataLoaded = false;
            ui.screenshotBtn.disabled = true;
        });
    }

    async function updateDataInFirebase(assignments) {
        if (!appState.isLoggedIn) {
            alert("You must be logged in to make changes.");
            return;
        }

        try {
            await set(dbRef, {
                assignments: assignments,
                timestamp: new Date().toISOString()
            });
            console.log("Data synced successfully.");
        } catch (error) {
            console.error("Firebase Write Failed:", error);
            alert("Update failed. Permission denied.");
        }
    }

    // ==========================================
    // 4. UI REFERENCES & HELPERS
    // ==========================================

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
    
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));

    function renderTable() {
        ui.tableBody.innerHTML = '';
        SEVA_TASKS.forEach((seva, index) => {
            const assignedPeople = appState.currentAssignments[index] || [];
            const row = ui.tableBody.insertRow();
            row.insertCell(0).textContent = seva;
            row.insertCell(1).textContent = assignedPeople.join(', ');
        });
    }
    
    function updateLastUpdatedTime(isoString) {
        if (!isoString) return;
        ui.lastUpdated.textContent = new Date(isoString).toLocaleString();
    }
    
    function updateSyncStatus(status, text) {
        const statusClass = status === 'connected' ? 'success' : 
                           status === 'error' ? 'danger' : 'warning';
        ui.syncStatus.className = `d-inline-flex align-items-center text-${statusClass}`;
        ui.syncIndicator.textContent = status === 'connected' ? '✅' : 
                                       status === 'error' ? '❌' : '🔄';
        ui.syncText.textContent = text;
    }
// ==========================================
    // 5. CORE BUSINESS LOGIC (ROTATION)
    // ==========================================

    function rotatePeople() {
        let peopleToRotate = [];
        
        // 1. Collect people who need to rotate in order
        appState.currentAssignments.forEach((assignedGroup, index) => {
            const taskName = SEVA_TASKS[index];
            // Exclude special fixed roles
            if (taskName !== "Grocery" && taskName !== "Yard") {
                peopleToRotate.push(...assignedGroup);
            } else if (taskName === "Grocery") {
                // Bhagirath Bhai is fixed, others rotate
                peopleToRotate.push(...assignedGroup.filter(p => p !== "Bhagirath Bhai"));
            }
        });
        
        // 2. ROTATION STEP (Left-to-Right Shift)
        // pop() takes the LAST person from the very end of the list.
        // unshift() adds them to the VERY FRONT of the list.
        // This pushes everyone else one spot to the right.
        if (peopleToRotate.length > 1) {
            peopleToRotate.unshift(peopleToRotate.pop());
        }
        
        // 3. Redistribute back into tasks
        let personIndex = 0;
        const newAssignments = SEVA_TASKS.map((taskName, taskIndex) => {
            const capacity = TASK_CAPACITIES[taskIndex];
            let newGroup = [];
            
            if (taskName === "Yard") {
                newGroup.push("Volunteer");
            } else if (taskName === "Grocery") {
                newGroup.push("Bhagirath Bhai"); // Fixed person stays first
                // The rotating person enters after Bhagirath Bhai
                if (personIndex < peopleToRotate.length) {
                    newGroup.push(peopleToRotate[personIndex++]);
                }
            } else {
                // Standard tasks - fill up to capacity
                for (let i = 0; i < capacity && personIndex < peopleToRotate.length; i++) {
                    newGroup.push(peopleToRotate[personIndex++]);
                }
            }
            return newGroup;
        });
        
        updateDataInFirebase(newAssignments);
    }
    function resetToDefault() {
        if (confirm('Are you sure you want to reset all assignments to default?')) {
            updateDataInFirebase(JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS)));
        }
    }
    
    // ==========================================
    // 6. SCREENSHOT & SHARE
    // ==========================================

    async function takeScreenshot() {
        if (!appState.isDataLoaded) {
            alert("Please wait for data to sync.");
            return;
        }
        
        const originalText = ui.screenshotBtn.innerHTML;
        ui.screenshotBtn.disabled = true;
        ui.screenshotBtn.innerHTML = '📸 Processing...';
        
        document.querySelector("footer")?.classList.add('d-none');
        ui.adminControls.classList.add('d-none');
        document.querySelector("main")?.classList.add('screenshot-prep');
        
        try {
            // Wait for UI changes to render
            await new Promise(resolve => setTimeout(resolve, 100));

            const canvas = await html2canvas(document.querySelector(".container"), {
                scale: 2,
                useCORS: true,
                backgroundColor: '#1c1c1e'
            });
            
            canvas.toBlob(async (blob) => {
                try {
                    const item = new ClipboardItem({ 'image/png': blob });
                    await navigator.clipboard.write([item]);
                    alert('Screenshot copied to clipboard! 📋');
                } catch (err) {
                    const link = document.createElement('a');
                    link.download = `seva-${new Date().toISOString().slice(0,10)}.png`;
                    link.href = canvas.toDataURL();
                    link.click();
                }
            });

        } catch (err) {
            console.error("Screenshot failed:", err);
            alert("Could not take screenshot.");
        } finally {
            document.querySelector("footer")?.classList.remove('d-none');
            document.querySelector("main")?.classList.remove('screenshot-prep');
            setAdminUI(appState.isLoggedIn);
            ui.screenshotBtn.disabled = false;
            ui.screenshotBtn.innerHTML = originalText;
        }
    }
    
    async function shareAssignments() {
        let text = "🏠 *HOUSE CLEANING SEVA* 🏠\n\n";
        appState.currentAssignments.forEach((group, i) => {
            text += `📍 ${SEVA_TASKS[i]}: ${group.join(', ')}\n`;
        });
        text += "\n🙏 Let's complete it before Sunday!";
        
        if (navigator.share) {
            navigator.share({ title: 'Seva Assignments', text: text })
                .catch((e) => console.log('Share dismissed', e));
        } else {
            navigator.clipboard.writeText(text)
                .then(() => alert('Assignments copied to clipboard!'))
                .catch(() => alert('Could not copy text.'));
        }
    }

    // ==========================================
    // 7. AUTHENTICATION HANDLING
    // ==========================================

    function setAdminUI(isAdmin) {
        appState.isLoggedIn = isAdmin;
        ui.adminControls.classList.toggle('d-none', !isAdmin);
        ui.loginBtn.style.display = isAdmin ? 'none' : 'block';
        ui.logoutBtn.style.display = isAdmin ? 'block' : 'none';
    }

    function initializeAuthListener() {
        onAuthStateChanged(auth, (user) => {
            setAdminUI(!!user);
            if (user) console.log("Admin logged in:", user.email);
        });
    }

    async function handleLogin() {
        const email = ui.usernameInput.value.trim();
        const password = ui.passwordInput.value.trim();
        
        if (!email || !password) {
            showLoginError("Please enter email and password.");
            return;
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
            loginModal.hide();
            ui.usernameInput.value = '';
            ui.passwordInput.value = '';
        } catch (error) {
            console.error("Login error:", error.code);
            showLoginError("❌ Login failed. Check credentials.");
        }
    }

    async function handleLogout() {
        try {
             await signOut(auth);
        } catch (error) {
             alert("Logout failed.");
        }
    }

    function showLoginError(msg) {
        ui.loginError.textContent = msg;
        ui.loginError.style.display = 'block';
        setTimeout(() => ui.loginError.style.display = 'none', 3000);
    }

    // ==========================================
    // 8. INITIALIZATION
    // ==========================================

    function setupEventListeners() {
        document.getElementById('rotateBtn').addEventListener('click', rotatePeople);
        document.getElementById('resetBtn').addEventListener('click', resetToDefault);
        document.getElementById('screenshotBtn').addEventListener('click', takeScreenshot);
        document.getElementById('shareBtn').addEventListener('click', shareAssignments);
        ui.loginBtn.addEventListener('click', () => loginModal.show());
        ui.logoutBtn.addEventListener('click', handleLogout);
        document.getElementById('submitLogin').addEventListener('click', handleLogin);
        ui.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }

    function initializeApp() {
        setupEventListeners();
        initializeAuthListener();
        initializeRealtimeListener();
        
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .catch(err => console.error('SW init failed', err));
        }
    }

    initializeApp();
});