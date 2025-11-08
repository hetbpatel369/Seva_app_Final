# Weekly Seva App 🏠

A Progressive Web App (PWA) designed to manage and rotate weekly house cleaning assignments for shared living spaces. Built with vanilla JavaScript and Firebase for real-time synchronization across all residents' devices.

[**View Live Demo**](https://sevaapp-87cf1.web.app/)
*(Note: Admin features require login)*

## ✨ Key Features

* **Real-time Synchronization:** Assignments update instantly on all devices using Firebase Realtime Database.
* **Automated Rotation:** Complex logic to rotate assignments weekly while keeping certain specialized roles (e.g., Yard work) fixed or on different rotation schedules.
* **Progressive Web App (PWA):** Installs on mobile devices and works offline thanks to Service Worker caching.
* **Admin Authentication:** Secure login for house managers to perform rotations or resets.
* **Screenshot Sharing:** Generates a clean image of current assignments for easy sharing via WhatsApp/Messenger using `html2canvas`.
* **Dark Mode UI:** Modern, iOS-inspired dark theme built with Bootstrap 5 and custom CSS.

## 🛠️ Technologies Used

* **Frontend:** HTML5, CSS3, JavaScript (ES6+)
* **UI Framework:** Bootstrap 5
* **Backend as a Service:** Firebase (Realtime Database, Authentication, Hosting)
* **Libraries:** `html2canvas` (for generating screenshots)

## ⚙️ How it Works

The app uses a "smart rotation" algorithm. While most residents rotate through standard cleaning tasks, specific roles like "Grocery" or "Yard" have custom rules defined in the configuration. This ensures fairness while accommodating specialized tasks.

## 🔒 Security

Database write operations are secured using Firebase Security Rules, ensuring only authenticated administrators can modify the weekly schedule, while read access remains open for all residents.