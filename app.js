// Seva App - House Cleaning Assignment Manager
// Author: [Your Name/GitHub Username]

document.addEventListener('DOMContentLoaded', () => {
    // =========================================
    // 1. GLOBAL CONFIGURATION & CONSTANTS
    // =========================================
    const SEVA_TASKS = [
        "Main Hall, Entrance, Coat Closet", "Kitchen", "Fridges",
        "Upper Rooms and Walkway/Stairs", "Upper Washroom", "Dastva Hall and Walkway/Stairs",
        "Lower Washroom", "Private Washroom and Laundry Room", "Basement, Luggage Room and Kitchen",
        "Garbage Bin Cleaning", "Grocery", "Yard"
    ];

    // Define task capacities. Most tasks just need standard rotation.
    const TASK_CAPACITIES = [3, 3, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1];

    // Define special roles that don't rotate normally.
    // This makes the rotation logic generic and easier to change later.
    const SPECIAL_ROLES = {
        "Grocery": { fixedMembers: ["Bhagirath Bhai"], rotateSlots: 1 },
        "Yard": { fixedMembers: ["Volunteer"], rotateSlots: 0 }
    };

    const DEFAULT_ASSIGNMENTS = [
        ["Het Bhai", "Harsh Bhai", "Avi Bhai"], ["Devang Bhai", "Kintul Bhai", "Shreyansh Bhai"],
        ["Rohan Bhai"], ["Malav Bhai & Param Bhai"], ["Jayraj Bhai"], ["Vraj Bhai", "Nisarg Bhai"],
        ["Sheel Bhai"], ["Hardik Bhai"], ["Heet Bhai", "Pratik Bhai"], ["Bhumin Bhai"],
        ["Bhagirath Bhai", "Mann Bhai"], ["Volunteer"]
    ];

    const SEVA_DATA_PATH = 'seva-assignments/main';
    let appState = { currentAssignments: [], isLoggedIn: false, isDataLoaded: false };

    // =========================================
    // 2. FIREBASE & AUTHENTICATION
    // =========================================
    // Destructure functions exposed from index.html
    const { 
        db, ref, set, onValue,
        auth, signInWithEmailAndPassword, onAuthStateChanged, signOut 
    } = window.firebase;
    
    const dbRef = ref(db, SEVA_DATA_PATH);

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
                console.info("No data in Firebase. Initializing defaults.");
                appState.currentAssignments = JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS));
                // Only attempt write if an admin is already logged in to avoid permission errors
                if (appState.isLoggedIn) {
                    updateDataInFirebase(appState.currentAssignments);
                }
                renderTable();
                appState.isDataLoaded = true; 
                ui.screenshotBtn.disabled = false;
            }
        }, (error) => {
            console.error("Firebase Read Failed:", error);
            updateSyncStatus('error', 'Connection Error');
            appState.isDataLoaded = false;
            ui.screenshotBtn.disabled = true;
        });
    }

    function initializeAuthListener() {
        onAuthStateChanged(auth, (user) => {
            setAdminUI(!!user); // !!user converts the user object to a true/false boolean
            if (user) {
                console.log("Admin logged in:", user.email);
            }
        });
    }

    async function handleLogin() {
        const email = ui.usernameInput.value.trim();
        const password = ui.passwordInput.value.trim();
        
        if (!email || !password) {
            showLoginError("Please enter both email and password.");
            return;
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
            loginModal.hide();
            ui.usernameInput.value = '';
            ui.passwordInput.value = '';
        } catch (error) {
            console.error("Login error:", error.code);
            const errorMap = {
                'auth/invalid-credential': "❌ Invalid credentials.",
                'auth/user-not-found': "❌ User not found.",
                'auth/wrong-password': "❌ Invalid password.",
                'auth/invalid-email': "❌ Invalid email format."
            };
            showLoginError(errorMap[error.code] || "❌ Login failed. Please try again.");
        }
    }

    async function handleLogout() {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout Failed:", error);
            alert("Logout failed. Please try again.");
        }
    }

    async function updateDataInFirebase(assignments) {
        if (!appState.isLoggedIn) {
             alert("Action blocked: You must be an admin to update assignments.");
             return;
        }
        try {
            await set(dbRef, {
                assignments: assignments,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error("Firebase Write Failed:", error);
            alert("Update failed. Please check your connection or permissions.");
        }
    }

    // =========================================
    // 3. UI RENDERING & INTERACTION
    // =========================================
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
        SEVA_TASKS.forEach((seva, i) => {
            const bhakto = appState.currentAssignments[i] || [];
            const row = ui.tableBody.insertRow();
            row.insertCell(0).textContent = seva;
            row.insertCell(1).textContent = bhakto.join(', ');
        });
    }
    
    function updateLastUpdatedTime(isoString) {
        if (!isoString) return;
        const date = new Date(isoString);
        ui.lastUpdated.textContent = date.toLocaleString([], { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
    }
    
    function updateSyncStatus(status, text) {
        const statusColors = { connected: 'success', error: 'danger', connecting: 'warning' };
        const statusIcons = { connected: '✅', error: '❌', connecting: '🔄' };
        
        ui.syncStatus.className = `d-inline-flex align-items-center text-${statusColors[status] || 'secondary'}`;
        ui.syncIndicator.textContent = statusIcons[status] || '❓';
        ui.syncText.textContent = text;
    }

    function setAdminUI(isAdmin) {
        appState.isLoggedIn = isAdmin;
        ui.adminControls.classList.toggle('d-none', !isAdmin);
        ui.loginBtn.style.display = isAdmin ? 'none' : 'block';
        ui.logoutBtn.style.display = isAdmin ? 'block' : 'none';
    }

    function showLoginError(message) {
        ui.loginError.textContent = message;
        ui.loginError.style.display = 'block';
        setTimeout(() => ui.loginError.style.display = 'none', 3000);
    }

    // =========================================
    // 4. BUSINESS LOGIC (ROTATION)
    // =========================================
    function rotatePeople() {
        // 1. Gather everyone who is currently in a rotatable role
        let peopleToRotate = [];
        appState.currentAssignments.forEach((bhaktoGroup, i) => {
            const sevaName = SEVA_TASKS[i];
            const specialRole = SPECIAL_ROLES[sevaName];

            if (!specialRole) {
                // Standard role: everyone rotates
                peopleToRotate.push(...bhaktoGroup);
            } else {
                // Special role: only rotate people who are NOT fixed members
                const rotatableInThisGroup = bhaktoGroup.filter(person => !specialRole.fixedMembers.includes(person));
                peopleToRotate.push(...rotatableInThisGroup);
            }
        });

        // 2. Perform the rotation (move first person to last)
        if (peopleToRotate.length > 1) {
             peopleToRotate.push(peopleToRotate.shift()); // More standard rotation direction
             // Note: Your original code did unshift(pop()), which rotates backwards. 
             // If you prefer backwards, keep your original line:
             // peopleToRotate.unshift(peopleToRotate.pop());
        }

        // 3. Redistribute people into tasks
        let personIndex = 0;
        const newAssignments = SEVA_TASKS.map((sevaName, i) => {
            const specialRole = SPECIAL_ROLES[sevaName];
            let newGroup = [];

            if (specialRole) {
                // Add fixed members first
                newGroup.push(...specialRole.fixedMembers);
                // Then add rotatable members for this special role
                for (let j = 0; j < specialRole.rotateSlots && personIndex < peopleToRotate.length; j++) {
                    newGroup.push(peopleToRotate[personIndex++]);
                }
            } else {
                // Standard role: fill up to capacity
                const capacity = TASK_CAPACITIES[i];
                for (let j = 0; j < capacity && personIndex < peopleToRotate.length; j++) {
                    newGroup.push(peopleToRotate[personIndex++]);
                }
            }
            return newGroup;
        });

        updateDataInFirebase(newAssignments);
    }

    function resetToDefault() {
        if (confirm('Are you sure you want to reset assignments to the default list?')) {
            updateDataInFirebase(JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS)));
        }
    }

    // =========================================
    // 5. SCREENSHOT & SHARE UTILS
    // =========================================
    async function takeScreenshot() {
        if (!appState.isDataLoaded) return;

        const originalText = ui.screenshotBtn.innerHTML;
        ui.screenshotBtn.disabled = true;
        ui.screenshotBtn.innerHTML = '📸 Processing...';

        // Hide elements we don't want in the screenshot
        document.querySelector('footer')?.classList.add('d-none');
        ui.adminControls.classList.add('d-none');
        document.querySelector('main')?.classList.add('screenshot-prep');

        try {
            // Wait for DOM updates to finish before capturing
            await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 100)));
            
            const canvas = await html2canvas(document.querySelector(".container"), {
                scale: 2, // Higher resolution
                useCORS: true,
                backgroundColor: '#1c1c1e', // Match your theme background
                ignoreElements: (element) => element.id === 'adminControls' || element.tagName === 'FOOTER'
            });

            canvas.toBlob(async (blob) => {
                try {
                     // Try sharing via generic native share first (works well on mobile)
                    const file = new File([blob], "seva-assignments.png", { type: "image/png" });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'Seva Assignments',
                            text: 'Here are this week\'s assignments.'
                        });
                    } else {
                        // Fallback to clipboard API
                        const item = new ClipboardItem({ 'image/png': blob });
                        await navigator.clipboard.write([item]);
                        alert('Screenshot copied to clipboard! 📋');
                    }
                } catch (clipboardError) {
                    // Final fallback: download the image
                    console.warn("Clipboard/Share failed, downloading instead.", clipboardError);
                    const link = document.createElement('a');
                    link.download = `seva-${new Date().toISOString().split('T')[0]}.png`;
                    link.href = canvas.toDataURL();
                    link.click();
                }
            });

        } catch (err) {
            console.error("Screenshot failed:", err);
            alert("Sorry, could not take screenshot.");
        } finally {
             // Restore UI
            document.querySelector('footer')?.classList.remove('d-none');
            document.querySelector('main')?.classList.remove('screenshot-prep');
            setAdminUI(appState.isLoggedIn); // Re-establish correct admin UI state
            ui.screenshotBtn.disabled = false;
            ui.screenshotBtn.innerHTML = originalText;
        }
    }
    
    async function shareAssignments() {
        let shareText = "🏠 *HOUSE CLEANING SEVA* 🏠\n\n";
        appState.currentAssignments.forEach((bhakto, i) => { 
            shareText += `📍 ${SEVA_TASKS[i]}: ${bhakto.join(', ')}\n`; 
        });
        shareText += "\n🙏 Let's complete it before Sunday!";

        if (navigator.share) {
            navigator.share({ title: 'Seva Assignments', text: shareText })
                .catch(err => console.log('Share dismissed', err));
        } else {
            navigator.clipboard.writeText(shareText)
                .then(() => alert('Assignments copied to clipboard!'))
                .catch(() => alert('Could not copy text.'));
        }
    }

    // =========================================
    // 6. INITIALIZATION
    // =========================================
    function setupEventListeners() {
        document.getElementById('rotateBtn').addEventListener('click', rotatePeople);
        document.getElementById('resetBtn').addEventListener('click', resetToDefault);
        document.getElementById('screenshotBtn').addEventListener('click', takeScreenshot);
        document.getElementById('shareBtn').addEventListener('click', shareAssignments);
        ui.loginBtn.addEventListener('click', () => loginModal.show());
        ui.logoutBtn.addEventListener('click', handleLogout);
        document.getElementById('submitLogin').addEventListener('click', handleLogin);
        ui.passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
    }

    function initializeApp() {
        setupEventListeners();
        initializeAuthListener();
        initializeRealtimeListener();
        
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('SW registered:', reg.scope))
                .catch(err => console.error('SW registration failed:', err));
        }
    }

    initializeApp();
});