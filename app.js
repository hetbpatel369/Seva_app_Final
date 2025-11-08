// Seva App - House Cleaning Assignment Manager
document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL VARIABLES & CONSTANTS ---
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

    // --- REMOVED ---
    // const LOGIN_CREDENTIALS = { username: 'admin', password: 'dasnadas' }; // This is no longer needed and insecure
    const SEVA_DATA_PATH = 'seva-assignments/main';
    let appState = { currentAssignments: [], isLoggedIn: false, isDataLoaded: false };

    // --- 2. FIREBASE SETUP & REAL-TIME SYNC ---

    // --- CHANGED ---
    // Get all the functions we passed from index.html
    const { 
        db, ref, set, onValue,
        auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
        onAuthStateChanged, signOut 
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
                console.log("No data in Firebase. Initializing with defaults.");
                appState.currentAssignments = JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS));
                // --- CHANGED ---
                // Only try to write data if we are logged in, otherwise it will fail (and log an error)
                if (appState.isLoggedIn) {
                    updateDataInFirebase(appState.currentAssignments, true);
                }
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

    async function updateDataInFirebase(assignments, isInitial = false) {
        try {
            await set(dbRef, {
                assignments: assignments,
                timestamp: new Date().toISOString()
            });
            console.log("Data successfully updated in Firebase.");
        } catch (error) {
            console.error("Firebase Write Failed:", error);
            // --- CHANGED ---
            // This error will now appear if a non-admin tries to write.
            alert("Update failed. You must be logged in as an admin to make changes.");
        }
    }

    // --- 3. UI RENDERING & MANAGEMENT ---
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
        usernameInput: document.getElementById('username'), // This is now the email
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
        const date = new Date(isoString);
        ui.lastUpdated.textContent = date.toLocaleString();
    }
    
    function updateSyncStatus(status, text) {
        ui.syncStatus.className = `d-inline-flex align-items-center text-${status === 'connected' ? 'success' : status === 'error' ? 'danger' : 'warning'}`;
        ui.syncIndicator.textContent = status === 'connected' ? '✅' : status === 'error' ? '❌' : '🔄';
        ui.syncText.textContent = text;
    }

    // --- 4. CORE APPLICATION LOGIC ---
    // (No changes needed in this section: rotatePeople, resetToDefault, takeScreenshot, shareAssignments)
    function rotatePeople() {
        let peopleToRotate = [];
        appState.currentAssignments.forEach((bhaktoGroup, i) => {
            const seva = SEVA_TASKS[i];
            if (seva !== "Grocery" && seva !== "Yard") { peopleToRotate.push(...bhaktoGroup); } 
            else if (seva === "Grocery") { peopleToRotate.push(...bhaktoGroup.filter(p => p !== "Bhagirath Bhai")); }
        });
        if (peopleToRotate.length > 1) { peopleToRotate.unshift(peopleToRotate.pop()); }
        let personIndex = 0;
        const newAssignments = SEVA_TASKS.map((seva, i) => {
            const capacity = TASK_CAPACITIES[i];
            let newGroup = [];
            if (seva === "Yard") { newGroup.push("Volunteer"); } 
            else if (seva === "Grocery") {
                newGroup.push("Bhagirath Bhai");
                if (personIndex < peopleToRotate.length) { newGroup.push(peopleToRotate[personIndex++]); }
            } else {
                for (let j = 0; j < capacity && personIndex < peopleToRotate.length; j++) { newGroup.push(peopleToRotate[personIndex++]); }
            }
            return newGroup;
        });
        updateDataInFirebase(newAssignments);
    }
    function resetToDefault() { if (confirm('Are you sure you want to reset?')) { updateDataInFirebase(JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS))); } }
    
    async function takeScreenshot() {
        if (!appState.isDataLoaded) {
            alert("Please wait for the data to load before taking a screenshot.");
            return;
        }
        const contentToCapture = document.querySelector(".container");
        const mainElement = document.querySelector("main");
        const adminControlsElement = document.getElementById('adminControls');
        const footerElement = document.querySelector("footer");
        const originalBtnText = ui.screenshotBtn.innerHTML;
        ui.screenshotBtn.disabled = true;
        ui.screenshotBtn.innerHTML = '📸 Processing...';
        if (adminControlsElement && !adminControlsElement.classList.contains('d-none')) {
            adminControlsElement.classList.add('d-none');
        }
        if (footerElement) {
            footerElement.classList.add('d-none');
        }
        if (mainElement) {
            mainElement.classList.add('screenshot-prep');
        }
        requestAnimationFrame(() => {
            setTimeout(async () => {
                let canvas;
                try {
                    canvas = await html2canvas(contentToCapture, {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#1c1c1e'
                    });
                    if (!navigator.clipboard || !navigator.clipboard.write) {
                        throw new Error("Clipboard API not supported.");
                    }
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                    const item = new ClipboardItem({ 'image/png': blob });
                    await navigator.clipboard.write([item]);
                    alert('Screenshot copied to clipboard! 📋');
                } catch (err) {
                    console.error("Screenshot or Copy failed:", err);
                    if (err.message.includes("Clipboard")) {
                        alert("Could not copy to clipboard. Image will be downloaded instead.");
                    } else {
                        alert("Screenshot failed. Image will be downloaded as a fallback.");
                    }
                    if (canvas) {
                        const link = document.createElement('a');
                        link.download = `seva-assignments-${new Date().toLocaleDateString().replace(/\//g, '-')}.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                    } else {
                        alert("Sorry, the screenshot could not be created at all.");
                    }
                } finally {
                    ui.screenshotBtn.disabled = false;
                    ui.screenshotBtn.innerHTML = originalBtnText;
                    if (footerElement) {
                        footerElement.classList.remove('d-none');
                    }
                    if (mainElement) {
                        mainElement.classList.remove('screenshot-prep');
                    }
                    // --- CHANGED ---
                    // We call the auth-aware function now
                    setAdminUI(appState.isLoggedIn); 
                }
            }, 100);
        });
    }
    
    async function shareAssignments() {
        let shareText = "🏠 HOUSE CLEANING SEVA ASSIGNMENTS 🏠\n\n";
        appState.currentAssignments.forEach((bhakto, i) => { shareText += `📍 ${SEVA_TASKS[i]}: ${bhakto.join(', ')}\n`; });
        shareText += "\n🙏 Let's complete it before Sunday!";
        try {
            if (navigator.share) { await navigator.share({ title: 'Seva Assignments', text: shareText }); } 
            else { await navigator.clipboard.writeText(shareText); alert('Assignments copied!'); }
        } catch (error) { console.error('Share failed:', error); alert('Sharing failed.'); }
    }

    // --- 5. LOGIN SYSTEM ---
    
    // --- CHANGED ---
    // This function now just updates the UI based on login status
    function setAdminUI(isLoggedIn) {
        appState.isLoggedIn = isLoggedIn; // Update global state
        if (isLoggedIn) {
            ui.adminControls.classList.remove('d-none');
            ui.loginBtn.style.display = 'none';
            ui.logoutBtn.style.display = 'block';
        } else {
            ui.adminControls.classList.add('d-none');
            ui.loginBtn.style.display = 'block';
            ui.logoutBtn.style.display = 'none';
        }
    }

    // --- CHANGED ---
    // This is the new "source of truth" for login status
    function initializeAuthListener() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // User is signed in
                console.log("Auth state changed: User is LOGGED IN", user.email);
                setAdminUI(true);
            } else {
                // User is signed out
                console.log("Auth state changed: User is LOGGED OUT");
                setAdminUI(false);
            }
        });
    }

    // --- CHANGED ---
    // This function now calls Firebase auth
    async function handleLogin() {
        const email = ui.usernameInput.value.trim(); // This field is now for email
        const password = ui.passwordInput.value.trim();
        
        if (!email || !password) {
            showLoginError("Please enter both email and password.");
            return;
        }

        try {
            // This is the Firebase function to sign in
            await signInWithEmailAndPassword(auth, email, password);
            
            // Success!
            loginModal.hide();
            ui.usernameInput.value = '';
            ui.passwordInput.value = '';
            
        } catch (error) {
            // Handle errors
            console.error("Login Failed:", error.code);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                showLoginError("❌ Invalid credentials. Please try again.");
            } else if (error.code === 'auth/invalid-email') {
                showLoginError("❌ Invalid email format.");
            } else {
                showLoginError("❌ An unknown error occurred.");
            }
        }
    }

    // --- CHANGED ---
    // This function now calls Firebase auth
    async function handleLogout() {
        try {
            await signOut(auth);
            // The onAuthStateChanged listener will automatically update the UI
        } catch (error) {
            console.error("Logout Failed:", error);
            alert("Logout failed. Please try again.");
        }
    }

    // --- NEW HELPER FUNCTION ---
    function showLoginError(message) {
        ui.loginError.textContent = message;
        ui.loginError.style.display = 'block';
        setTimeout(() => ui.loginError.style.display = 'none', 3000);
    }
    
    // --- 6. EVENT LISTENERS ---
    // (No changes needed in this function)
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

    // --- 7. APP INITIALIZATION ---
    function initializeApp() {
        setupEventListeners();
        // --- CHANGED ---
        initializeAuthListener(); // We call the new auth listener
        initializeRealtimeListener();
        ui.screenshotBtn.disabled = true;
        
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('ServiceWorker registration successful: ', registration.scope);
                    })
                    .catch(error => {
                        console.log('ServiceWorker registration failed: ', error);
                    });
            });
        }
    }
    initializeApp();
});