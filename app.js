// ============================================================================
//  SEVA APP - REFACTORED (FIREBASE REAL-TIME + BOOTSTRAP)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GLOBAL VARIABLES & CONSTANTS ---
    const SEVA_TASKS = [
        "Main Hall, Entrance, Coat Closet", "Kitchen", "Fridges", 
        "Upper Rooms and Walkway/Stairs", "Upper Washroom", "Dastva Hall and Walkway/Stairs", 
        "Lower Washroom", "Private Washroom and Laundry Room", "Basement, Luggage Room and Kitchen",
        "Garbage", "Grocery", "Yard"
    ];
    const TASK_CAPACITIES = [3, 3, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1];
    const DEFAULT_ASSIGNMENTS = [
        ["Het Bhai", "Harsh Bhai", "Avi Bhai"], ["Devang Bhai", "Kintul Bhai", "Shreyansh Bhai"],
        ["Rohan Bhai"], ["Malav Bhai & Param Bhai"], ["Jayraj Bhai"], ["Vraj Bhai", "Nisarg Bhai"],
        ["Sheel Bhai"], ["Hardik Bhai"], ["Heet Bhai", "Pratik Bhai"], ["Bhumin Bhai"],
        ["Bhagirath Bhai", "Mann Bhai"], ["Volunteer"]
    ];
    const LOGIN_CREDENTIALS = { username: 'admin', password: 'seva2024' };
    const SEVA_DATA_PATH = 'seva-assignments/main';
    let appState = { currentAssignments: [], isLoggedIn: false };

    // --- 2. FIREBASE SETUP & REAL-TIME SYNC ---
    const { db, ref, set, onValue } = window.firebase;
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
            } else {
                console.log("No data in Firebase. Initializing with defaults.");
                appState.currentAssignments = JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS));
                updateDataInFirebase(appState.currentAssignments, true);
            }
        }, (error) => {
            console.error("Firebase Read Failed:", error);
            updateSyncStatus('error', 'Connection Error');
        });
    }

    async function updateDataInFirebase(assignments, isInitial = false) {
        try {
            await set(dbRef, {
                assignments: assignments,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error("Firebase Write Failed:", error);
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
        usernameInput: document.getElementById('username'),
        passwordInput: document.getElementById('password')
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
    function takeScreenshot() { html2canvas(document.querySelector(".container"), { scale: 2 }).then(canvas => { const link = document.createElement('a'); link.download = `seva-assignments.png`; link.href = canvas.toDataURL(); link.click(); }); }
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
    function checkLoginState() {
        if (sessionStorage.getItem('sevaAppLoginState') === 'true') {
            appState.isLoggedIn = true;
            ui.adminControls.classList.remove('d-none');
            ui.loginBtn.style.display = 'none';
            ui.logoutBtn.style.display = 'block';
        } else {
            appState.isLoggedIn = false;
            ui.adminControls.classList.add('d-none');
            ui.loginBtn.style.display = 'block';
            ui.logoutBtn.style.display = 'none';
        }
    }
    function handleLogin() {
        const { username, password } = LOGIN_CREDENTIALS;
        if (ui.usernameInput.value.trim() === username && ui.passwordInput.value.trim() === password) {
            sessionStorage.setItem('sevaAppLoginState', 'true');
            checkLoginState();
            loginModal.hide();
            ui.usernameInput.value = '';
            ui.passwordInput.value = '';
        } else {
            ui.loginError.style.display = 'block';
            setTimeout(() => ui.loginError.style.display = 'none', 3000);
        }
    }
    function handleLogout() {
        sessionStorage.removeItem('sevaAppLoginState');
        appState.isLoggedIn = false;
        ui.adminControls.classList.add('d-none');
        ui.loginBtn.style.display = 'block';
        ui.logoutBtn.style.display = 'none';
    }

    // --- 6. EVENT LISTENERS ---
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
        console.log("Initializing Seva App...");
        setupEventListeners();
        checkLoginState();
        initializeRealtimeListener();
    }
    initializeApp();
});