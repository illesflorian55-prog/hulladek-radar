/**
 * HulladékRadar – Közösségi hulladékbejelentő PWA
 * 
 * Technológiák: Firebase (Auth, Firestore), Leaflet.js, Dexie.js, TailwindCSS
 * Funkciók: Bejelentés (GPS + fotó), térkép nézet, admin kezelés, offline mód
 */

// Firebase Configuration (v8 compat style)
const firebaseConfig = {
  apiKey: "AIzaSyD9NEVnncSqV_MSmlkiHGF7STLkgTOepNY",
  authDomain: "hulladek-szemlev3.firebaseapp.com",
  projectId: "hulladek-szemlev3",
  storageBucket: "hulladek-szemlev3.firebasestorage.app",
  messagingSenderId: "650759945198",
  appId: "1:650759945198:web:2ea6662fa2b70f07476cff",
  measurementId: "G-7CMG4RJWKC"
};

// 1. Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence for Firestore
db.enablePersistence().catch(err => {
    console.error("Firestore offline mode failed:", err);
});

// 2. Setup IndexedDB for offline image queue
const localDb = new Dexie("TrashSpottingDB");
localDb.version(1).stores({
    offlineReports: '++id, timestamp'
});

// 3. Global state
let currentLat = null;
let currentLng = null;
let currentImages = []; // Array of { file, base64 }

// 4. DOM Elements
const btnLocation = document.getElementById('btn-location');
const locationStatus = document.getElementById('location-status');
const btnCamera = document.getElementById('btn-camera');
const cameraInput = document.getElementById('camera-input');
const imageGallery = document.getElementById('image-gallery');
const categorySelect = document.getElementById('category');
const notesInput = document.getElementById('notes');
const btnSubmit = document.getElementById('btn-submit');
const loaderOverlay = document.getElementById('loader-overlay');
const offlineBanner = document.getElementById('offline-banner');

const authContainer = document.getElementById('auth-container');
const reportFormContainer = document.getElementById('report-form-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const toggleToRegister = document.getElementById('toggle-to-register');
const toggleToLogin = document.getElementById('toggle-to-login');
const btnLogout = document.getElementById('btn-logout');

const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const btnLogin = document.getElementById('btn-login');

const regLastname = document.getElementById('reg-lastname');
const regFirstname = document.getElementById('reg-firstname');
const regUsername = document.getElementById('reg-username');
const regEmail = document.getElementById('reg-email');
const regPassword = document.getElementById('reg-password');
const btnRegister = document.getElementById('btn-register');

// 5. Auth Logic
auth.onAuthStateChanged((user) => {
    if (user) {
        authContainer.classList.add('hidden');
        reportFormContainer.classList.remove('hidden');
        btnLogout.classList.remove('hidden');
    } else {
        authContainer.classList.remove('hidden');
        reportFormContainer.classList.add('hidden');
        btnLogout.classList.add('hidden');
    }
});

toggleToRegister.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
});

toggleToLogin.addEventListener('click', () => {
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

btnLogin.addEventListener('click', async () => {
    const email = loginEmail.value.trim();
    const pass = loginPassword.value;
    if (!email || !pass) return alert("Kérlek add meg az emailt és jelszót!");
    
    loaderOverlay.classList.remove('hidden');
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (error) {
        alert("Hiba a bejelentkezés során: " + error.message);
    }
    loaderOverlay.classList.add('hidden');
});

btnRegister.addEventListener('click', async () => {
    const fn = regFirstname.value.trim();
    const ln = regLastname.value.trim();
    const un = regUsername.value.trim();
    const email = regEmail.value.trim();
    const pass = regPassword.value;
    
    if (!fn || !ln || !un || !email || !pass) return alert("Minden mező kitöltése kötelező!");
    if (pass.length < 6) return alert("A jelszónak legalább 6 karakternek kell lennie!");
    
    loaderOverlay.classList.remove('hidden');
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        const user = userCredential.user;
        
        await db.collection('users').doc(user.uid).set({
            firstName: fn,
            lastName: ln,
            username: un,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        alert("Hiba a regisztráció során: " + error.message);
    }
    loaderOverlay.classList.add('hidden');
});

btnLogout.addEventListener('click', () => {
    auth.signOut();
});

// 6. Network status listeners
window.addEventListener('online', handleNetworkChange);
window.addEventListener('offline', handleNetworkChange);

function handleNetworkChange() {
    if (navigator.onLine) {
        offlineBanner.classList.add('hidden');
        syncOfflineReports();
    } else {
        offlineBanner.classList.remove('hidden');
    }
}
handleNetworkChange(); // Check on load

// 7. Geolocation
let watchId = null;
let gpsTimeout = null;

btnLocation.addEventListener('click', () => {
    if (!navigator.geolocation) {
        alert("A böngésződ nem támogatja a helymeghatározást!");
        return;
    }
    
    btnLocation.innerHTML = '<svg class="animate-spin w-8 h-8 mr-3 shrink-0" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Helyzet finomítása...';
    btnLocation.disabled = true;

    let bestPosition = null;

    // Ha a böngésző elalszik és felébred, újraindítjuk a GPS lekérést, hogy ne ragadjon be
    const visibilityHandler = () => {
        if (document.visibilityState === 'visible' && watchId !== null) {
            console.log("Fül felébredt, GPS keresés újraindítása...");
            navigator.geolocation.clearWatch(watchId);
            watchId = navigator.geolocation.watchPosition(handleSuccess, (error) => {
                console.warn("GPS hiba (ideiglenes?):", error.message);
            }, { enableHighAccuracy: true, maximumAge: 0 });
        }
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    const stopWatching = () => {
        document.removeEventListener('visibilitychange', visibilityHandler);
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        if (gpsTimeout !== null) {
            clearTimeout(gpsTimeout);
            gpsTimeout = null;
        }
    };

    const finalizeLocation = (position) => {
        if (!position) {
            btnLocation.disabled = false;
            alert("Nem sikerült meghatározni a helyzeted. Próbáld újra!");
            btnLocation.innerHTML = '<svg class="w-8 h-8 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> Újrapróbálás';
            return;
        }
        
        currentLat = position.coords.latitude;
        currentLng = position.coords.longitude;
        const accuracy = Math.round(position.coords.accuracy);
        
        btnLocation.innerHTML = '<svg class="w-8 h-8 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Helyzet Rögzítve';
        btnLocation.classList.replace('bg-blue-500', 'bg-emerald-500');
        btnLocation.classList.replace('hover:bg-blue-600', 'hover:bg-emerald-600');
        btnLocation.disabled = false;
        
        locationStatus.textContent = `Mentve: ${currentLat.toFixed(5)}, ${currentLng.toFixed(5)} (Pontosság: ${accuracy}m)`;
        locationStatus.classList.add('text-emerald-600');
        locationStatus.classList.remove('text-gray-500');
        checkFormValid();
    };

    const handleSuccess = (position) => {
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
            bestPosition = position;
            locationStatus.textContent = `Pontosság mérése: ${Math.round(position.coords.accuracy)}m (Várakozás 20m alá...)`;
            locationStatus.classList.remove('text-gray-500');
            locationStatus.classList.add('text-blue-600');
        }
        
        if (position.coords.accuracy <= 20) {
            stopWatching();
            finalizeLocation(position);
        }
    };

    watchId = navigator.geolocation.watchPosition(handleSuccess, (error) => {
        console.warn("GPS hiba (ideiglenes?):", error.message);
    }, { enableHighAccuracy: true, maximumAge: 0 });

    gpsTimeout = setTimeout(() => {
        stopWatching();
        if (bestPosition && bestPosition.coords.accuracy > 20) {
            const acc = Math.round(bestPosition.coords.accuracy);
            if (confirm(`Nem sikerült 20 méter alá vinni a pontosságot (legjobb: ${acc}m). Elfogadod ezt a pontosságot? Menj nyíltabb térre a pontosabb GPS jelért.`)) {
                finalizeLocation(bestPosition);
            } else {
                finalizeLocation(null); // Cancel and reset
            }
        } else if (!bestPosition) {
            finalizeLocation(null);
        }
    }, 25000);
});

// 8. Camera / Photo Upload
btnCamera.addEventListener('click', () => {
    cameraInput.click();
});

cameraInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        
        // --- Biztonsági validáció kezdete ---
        // 1. Fájltípus ellenőrzése (csak képek)
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert("Kérlek csak JPG, PNG vagy WEBP formátumú képet tölts fel!");
            cameraInput.value = "";
            return;
        }
        
        // 2. Fájlméret ellenőrzése (max 10 MB)
        const maxSizeInBytes = 10 * 1024 * 1024; // 10 MB
        if (file.size > maxSizeInBytes) {
            alert("A kép mérete túl nagy! Kérlek válassz egy 10MB-nál kisebb képet.");
            cameraInput.value = "";
            return;
        }
        // --- Biztonsági validáció vége ---
        
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 1280;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const base64 = canvas.toDataURL('image/jpeg', 0.8);
                
                currentImages.push({ file: null, base64: base64 });
                renderImageGallery();
                checkFormValid();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
    cameraInput.value = "";
});

function renderImageGallery() {
    if (currentImages.length === 0) {
        imageGallery.classList.add('hidden');
        imageGallery.innerHTML = '';
        btnCamera.querySelector('span').textContent = "Fényképezőgép Megnyitása";
        return;
    }

    imageGallery.classList.remove('hidden');
    imageGallery.innerHTML = '';
    btnCamera.querySelector('span').textContent = "További kép hozzáadása";

    currentImages.forEach((imgObj, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = "relative shrink-0 w-32 h-32 rounded-xl overflow-hidden border-2 border-gray-200 snap-center";
        
        const img = document.createElement('img');
        img.src = imgObj.base64;
        img.className = "w-full h-full object-cover";
        
        const removeBtn = document.createElement('button');
        removeBtn.className = "absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full shadow-lg hover:bg-red-700";
        removeBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>';
        removeBtn.onclick = () => {
            currentImages.splice(index, 1);
            renderImageGallery();
            checkFormValid();
        };

        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        imageGallery.appendChild(wrapper);
    });
}

// 9. Form Validation
function checkFormValid() {
    if (currentLat && currentLng && categorySelect.value) {
        btnSubmit.disabled = false;
    } else {
        btnSubmit.disabled = true;
    }
}

categorySelect.addEventListener('change', checkFormValid);

// 10. Submit
btnSubmit.addEventListener('click', async () => {
    if (!currentLat || !currentLng || !categorySelect.value) return;

    loaderOverlay.classList.remove('hidden');

    const reportData = {
        category: categorySelect.value,
        notes: notesInput.value,
        lat: currentLat,
        lng: currentLng,
        timestamp: new Date().toISOString(),
        userId: auth.currentUser ? auth.currentUser.uid : null
    };

    if (navigator.onLine) {
        try {
            await uploadAndSave(reportData, currentImages);
            alert("Sikeresen beküldve! Köszönjük!");
            resetForm();
        } catch (error) {
            console.error("Upload error:", error);
            alert("Hiba történt a feltöltés során.");
        }
    } else {
        try {
            await localDb.offlineReports.add({
                ...reportData,
                imagesBase64: currentImages.map(img => img.base64)
            });
            alert("Offline mód: Az adatokat elmentettük a telefonodra. Amint lesz interneted, automatikusan feltöltjük!");
            resetForm();
        } catch (error) {
            console.error("Offline save error:", error);
            alert("Nem sikerült elmenteni az offline adatokat.");
        }
    }
    
    loaderOverlay.classList.add('hidden');
});

// Global Config
const ADMIN_EMAIL = 'illesflorian12@gmail.com';
let currentDocIdToResolve = null;

// Password Toggle Logic
window.togglePassword = function(inputId, buttonElement) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        buttonElement.innerHTML = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>`;
    } else {
        input.type = 'password';
        buttonElement.innerHTML = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>`;
    }
};

const IMGBB_API_KEY = "baa27bfad091c75da850752dee44364f";

async function uploadAndSave(data, imagesArray) {
    let imageUrls = [];
    
    for (const imgObj of imagesArray) {
        const formData = new FormData();
        
        if (imgObj.file) {
            formData.append("image", imgObj.file);
        } else if (typeof imgObj === 'string' && imgObj.startsWith('data:image')) {
            const base64Data = imgObj.split(',')[1];
            formData.append("image", base64Data);
        } else if (imgObj.base64) {
            const base64Data = imgObj.base64.split(',')[1];
            formData.append("image", base64Data);
        }
        
        try {
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: "POST",
                body: formData
            });
            const result = await response.json();
            
            if (result.success) {
                imageUrls.push(result.data.url);
            } else {
                console.error("ImgBB upload failed: " + result.status_code);
            }
        } catch (error) {
            console.error("ImgBB hiba egy képnél:", error);
        }
    }

    await db.collection("reports").add({
        ...data,
        kep_url_lista: imageUrls,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

function resetForm() {
    currentLat = null;
    currentLng = null;
    
    btnLocation.innerHTML = '<svg class="w-8 h-8 shrink-0 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> GPS Koordináta Lekérése';
    btnLocation.className = "w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-bold py-5 px-4 rounded-2xl text-xl shadow-lg transition-transform transform active:scale-95 flex items-center justify-center gap-3";
    
    locationStatus.textContent = "Még nincs megadva helyzet";
    locationStatus.className = "mt-3 text-center text-sm font-medium text-gray-500";
    
    currentImages = [];
    renderImageGallery();
    
    categorySelect.value = "";
    notesInput.value = "";
    btnSubmit.disabled = true;
}

// 11. Background Sync for offline data
async function syncOfflineReports() {
    try {
        const reports = await localDb.offlineReports.toArray();
        if (reports.length === 0) return;

        console.log(`Found ${reports.length} offline reports. Syncing...`);
        
        for (const report of reports) {
            try {
                const { id, imagesBase64, ...reportData } = report;
                
                await uploadAndSave(reportData, imagesBase64 || []);
                await localDb.offlineReports.delete(id);
                console.log(`Synced report ${id}`);
            } catch (error) {
                console.error(`Failed to sync report ${report.id}`, error);
            }
        }
    } catch (err) {
        console.error("Dexie sync error:", err);
    }
}

// 12. Map View & Nav Logic
const navReport = document.getElementById('nav-report');
const navMap = document.getElementById('nav-map');

const reportView = document.getElementById('report-view');
const mapView = document.getElementById('map-view');

let mapInstance = null;
let markersLayer = null;

function setActiveTab(tabName) {
    [reportView, mapView].forEach(v => v.classList.add('hidden'));
    
    [navReport, navMap].forEach(btn => {
        btn.classList.remove('text-emerald-700', 'font-extrabold', 'bg-emerald-50');
        btn.classList.add('text-gray-400', 'font-medium', 'hover:text-emerald-600');
    });

    if (tabName === 'report') {
        reportView.classList.remove('hidden');
        navReport.classList.add('text-emerald-700', 'font-extrabold', 'bg-emerald-50');
        navReport.classList.remove('text-gray-400', 'font-medium', 'hover:text-emerald-600');
    } else if (tabName === 'map') {
        mapView.classList.remove('hidden');
        navMap.classList.add('text-emerald-700', 'font-extrabold', 'bg-emerald-50');
        navMap.classList.remove('text-gray-400', 'font-medium', 'hover:text-emerald-600');
        
        if (!mapInstance) initMap();
        else mapInstance.invalidateSize();
        loadMapMarkers();
    }
}

navReport.addEventListener('click', () => setActiveTab('report'));
navMap.addEventListener('click', () => setActiveTab('map'));


function initMap() {
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });
    
    const esriLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri & GIS Community'
    });

    mapInstance = L.map('map', {
        layers: [osmLayer]
    }).setView([47.58577, 22.04499], 13);
    
    const baseMaps = {
        "Sima térkép": osmLayer,
        "Műholdas nézet": esriLayer
    };
    
    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(mapInstance);
    
    markersLayer = L.layerGroup().addTo(mapInstance);
    
    L.Icon.Default.imagePath = 'https://unpkg.com/leaflet@1.9.4/dist/images/';

    const legend = L.control({position: 'bottomleft'});
    legend.onAdd = function (map) {
        const container = L.DomUtil.create('div', 'bg-white/90 p-2 rounded-lg shadow-sm border border-gray-200 text-[10px] text-gray-700 font-sans backdrop-blur-sm');
        container.innerHTML = `
            <div id="legend-content" class="block">
                <div class="flex justify-between items-center font-bold mb-1 border-b pb-1 text-xs">
                    <span>Jelmagyarázat</span>
                    <button id="btn-close-legend" class="text-gray-400 hover:text-gray-700 p-1 ml-3 bg-gray-100 rounded-full h-5 w-5 flex items-center justify-center transition-colors" style="touch-action: manipulation;">✕</button>
                </div>
                <div class="flex items-center gap-2 mb-1"><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png" class="w-3 h-5 object-contain"> Saját bejelentés</div>
                <div class="flex items-center gap-2 mb-1"><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png" class="w-3 h-5 object-contain"> Feldolgozás alatt</div>
                <div class="flex items-center gap-2"><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png" class="w-3 h-5 object-contain"> Megoldva</div>
            </div>
            <button id="btn-open-legend" class="hidden text-emerald-600 hover:text-emerald-800 flex items-center justify-center p-1 transition-colors" title="Jelmagyarázat" style="touch-action: manipulation;">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </button>
        `;
        
        L.DomEvent.disableClickPropagation(container);
        
        const btnClose = container.querySelector('#btn-close-legend');
        const btnOpen = container.querySelector('#btn-open-legend');
        const content = container.querySelector('#legend-content');
        
        btnClose.addEventListener('click', (e) => {
            e.preventDefault();
            content.classList.replace('block', 'hidden');
            btnOpen.classList.replace('hidden', 'block');
        });
        btnOpen.addEventListener('click', (e) => {
            e.preventDefault();
            btnOpen.classList.replace('block', 'hidden');
            content.classList.replace('hidden', 'block');
        });
        
        return container;
    };
    legend.addTo(mapInstance);

    // Live User Location Tracking
    let userLocationMarker = null;
    let userLocationAccuracy = null;

    mapInstance.on('locationfound', function(e) {
        if (!userLocationMarker) {
            userLocationMarker = L.circleMarker(e.latlng, {
                color: '#ffffff',
                fillColor: '#3b82f6',
                fillOpacity: 1,
                radius: 8,
                weight: 2,
                opacity: 1
            }).addTo(mapInstance);
            
            userLocationAccuracy = L.circle(e.latlng, {
                radius: e.accuracy,
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.15,
                weight: 1
            }).addTo(mapInstance);
        } else {
            userLocationMarker.setLatLng(e.latlng);
            userLocationAccuracy.setLatLng(e.latlng);
            userLocationAccuracy.setRadius(e.accuracy);
        }
    });

    mapInstance.on('locationerror', function(e) {
        console.log("GPS hiba a térképen:", e.message);
    });

    // Indítjuk a folyamatos követést
    mapInstance.locate({ watch: true, enableHighAccuracy: true });
}

const categoryNames = {
    'kommunalis': 'Kommunális (háztartási)',
    'epitesi': 'Építési / Törmelék',
    'zoldhulladek': 'Zöldhulladék',
    'autoalkatresz_gumi': 'Autóalkatrész / Gumi',
    'egyeb': 'Egyéb'
};

async function loadMapMarkers() {
    if (!mapInstance || !markersLayer) return;
    
    markersLayer.clearLayers();
    
    try {
        const snapshot = await db.collection("reports").get();
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.lat && data.lng) {
                const jitterLat = data.lat + (Math.random() - 0.5) * 0.00005;
                const jitterLng = data.lng + (Math.random() - 0.5) * 0.00005;
                
                const isResolved = data.status === 'resolved';
                
                const currentUser = auth.currentUser;
                const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;
                const isOwner = currentUser && currentUser.uid === data.userId;
                
                let iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png';
                
                if (isResolved) {
                    iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png';
                } else if (isOwner) {
                    iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png';
                }
                
                const markerIcon = new L.Icon({
                    iconUrl: iconUrl,
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                });

                const isDraggable = isAdmin && !isResolved;
                const marker = L.marker([jitterLat, jitterLng], { icon: markerIcon, draggable: isDraggable });
                
                const catName = categoryNames[data.category] || data.category;
                let popupContent = `<div class="font-sans max-h-72 overflow-y-auto pr-1 pb-1">`;
                
                if (isResolved) {
                    popupContent += `<div class="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded mb-2 inline-block">MEGOLDVA ✅</div><br>`;
                }
                
                popupContent += `<b class="text-emerald-700">Kategória:</b> ${catName}`;
                
                if (data.notes) {
                    popupContent += `<br><b class="text-gray-700 mt-1 block">Megjegyzés:</b> ${data.notes}`;
                }
                
                let images = data.kep_url_lista || (data.imageUrl ? [data.imageUrl] : []);
                
                // Ha megoldott, és van utána kép, azt tegyük előre
                if (isResolved && data.resolved_image_url) {
                    images = [data.resolved_image_url, ...images];
                }
                
                if (images.length > 0) {
                    const encodedImages = encodeURIComponent(JSON.stringify(images)).replace(/'/g, "%27");
                    popupContent += `<div class="mt-3 space-y-3">`;
                    images.forEach((url, index) => {
                        let label = "";
                        if (isResolved && data.resolved_image_url) {
                            if (index === 0) label = '<span class="text-xs font-bold text-green-700 block mb-1">Utána (Megoldva):</span>';
                            if (index === 1) label = '<span class="text-xs font-bold text-gray-500 block mt-2 mb-1">Előtte:</span>';
                        }
                        popupContent += `${label}<img src="${url}" onclick="window.openLightbox('${encodedImages}', ${index})" class="cursor-pointer hover:opacity-80 transition-opacity" style="width: 100%; border-radius: 8px;" alt="Szemét">`;
                    });
                    popupContent += `</div>`;
                }
                
                // "Megoldottra állítás" gomb beszúrása
                if (!isResolved) {
                    if (isAdmin || isOwner) {
                        popupContent += `<button onclick="window.startResolveReport('${doc.id}')" class="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl shadow transition-colors active:scale-95">Megoldottra állítás (Fotóval)</button>`;
                    }
                }
                
                // Törlés gomb adminoknak
                if (isAdmin) {
                    popupContent += `<button onclick="window.deleteReport('${doc.id}')" class="mt-2 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-xl shadow transition-colors active:scale-95">Bejelentés Törlése</button>`;
                }
                
                popupContent += `</div>`;
                marker.bindPopup(popupContent, { maxWidth: 280, minWidth: 200 });

                // Admin dragging logic
                if (isDraggable) {
                    marker.on('dragend', async function(event) {
                        const newPos = event.target.getLatLng();
                        try {
                            await db.collection("reports").doc(doc.id).update({
                                lat: newPos.lat,
                                lng: newPos.lng
                            });
                            console.log("Marker pozíció frissítve:", doc.id);
                        } catch (err) {
                            console.error("Hiba a marker mozgatásakor:", err);
                            alert("Nem sikerült elmenteni az új pozíciót!");
                            // Revert marker position
                            marker.setLatLng([jitterLat, jitterLng]);
                        }
                    });
                }

                markersLayer.addLayer(marker);
            }
        });
    } catch (error) {
        console.error("Hiba a markerek betöltésekor:", error);
    }
}

// 13. Lightbox Logic
const lightboxOverlay = document.getElementById('lightbox-overlay');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');
const lightboxCounter = document.getElementById('lightbox-counter');

let currentLightboxImages = [];
let currentLightboxIndex = 0;

window.openLightbox = function(imagesJson, index) {
    try {
        currentLightboxImages = JSON.parse(decodeURIComponent(imagesJson));
        currentLightboxIndex = parseInt(index) || 0;
        updateLightboxView();
        lightboxOverlay.classList.remove('hidden');
    } catch (e) {
        console.error("Error opening lightbox:", e);
    }
};

function closeLightbox() {
    lightboxOverlay.classList.add('hidden');
    currentLightboxImages = [];
}

function updateLightboxView() {
    if (currentLightboxImages.length === 0) return;
    
    lightboxImage.src = currentLightboxImages[currentLightboxIndex];
    
    if (currentLightboxImages.length > 1) {
        lightboxPrev.classList.remove('hidden');
        lightboxNext.classList.remove('hidden');
        lightboxCounter.classList.remove('hidden');
        lightboxCounter.textContent = `${currentLightboxIndex + 1} / ${currentLightboxImages.length}`;
    } else {
        lightboxPrev.classList.add('hidden');
        lightboxNext.classList.add('hidden');
        lightboxCounter.classList.add('hidden');
    }
}

lightboxNext.addEventListener('click', (e) => {
    e.stopPropagation();
    currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxImages.length;
    updateLightboxView();
});

lightboxPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length;
    updateLightboxView();
});

lightboxClose.addEventListener('click', closeLightbox);

lightboxOverlay.addEventListener('click', (e) => {
    if (e.target === lightboxOverlay) {
        closeLightbox();
    }
});

// 14. Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log("Service worker registered:", reg.scope);
        }).catch(err => {
            console.error("Service worker registration failed:", err);
        });
    });
}
// 15. Resolve Report Logic
window.startResolveReport = function(docId) {
    const resolveInput = document.getElementById('resolve-camera-input');
    if(resolveInput) {
        currentDocIdToResolve = docId;
        resolveInput.click();
    }
};

window.deleteReport = async function(docId) {
    if (confirm("Biztosan törölni szeretnéd ezt a bejelentést? Ez a művelet nem vonható vissza!")) {
        try {
            await db.collection("reports").doc(docId).delete();
            alert("Bejelentés sikeresen törölve.");
            mapInstance.closePopup();
            loadMapMarkers();
        } catch (error) {
            console.error("Hiba a bejelentés törlésekor:", error);
            alert("Nem sikerült törölni a bejelentést.");
        }
    }
};

const resolveCameraInput = document.getElementById('resolve-camera-input');
if(resolveCameraInput) {
    resolveCameraInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            
            // Biztonsági validáció
            const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                alert("Kérlek csak JPG, PNG vagy WEBP formátumú képet tölts fel!");
                resolveCameraInput.value = "";
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                alert("A kép mérete túl nagy! Kérlek válassz egy 10MB-nál kisebb képet.");
                resolveCameraInput.value = "";
                return;
            }

            loaderOverlay.querySelector('#loader-text').textContent = "Megoldás feltöltése...";
            loaderOverlay.classList.remove('hidden');

            const compressAndUpload = () => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const img = new Image();
                        img.onload = function() {
                            const canvas = document.createElement('canvas');
                            let width = img.width;
                            let height = img.height;
                            const MAX_SIZE = 1280;

                            if (width > height) {
                                if (width > MAX_SIZE) {
                                    height *= MAX_SIZE / width;
                                    width = MAX_SIZE;
                                }
                            } else {
                                if (height > MAX_SIZE) {
                                    width *= MAX_SIZE / height;
                                    height = MAX_SIZE;
                                }
                            }
                            
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            
                            const base64 = canvas.toDataURL('image/jpeg', 0.8);
                            const base64Data = base64.split(',')[1];
                            
                            const formData = new FormData();
                            formData.append('image', base64Data);
                            
                            fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                                method: 'POST',
                                body: formData
                            })
                            .then(res => res.json())
                            .then(resolve)
                            .catch(reject);
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                });
            };

            try {
                // Kép feltöltése az ImgBB-re (tömörítve)
                const result = await compressAndUpload();
                
                if (result.success) {
                    const imageUrl = result.data.url;
                    
                    // Adatbázis frissítése
                    await db.collection("reports").doc(currentDocIdToResolve).update({
                        status: 'resolved',
                        resolved_image_url: imageUrl,
                        resolved_at: new Date().toISOString(),
                        resolved_by: auth.currentUser ? auth.currentUser.uid : 'admin'
                    });
                    
                    alert("Sikeresen megoldottra állítva!");
                    mapInstance.closePopup();
                    loadMapMarkers(); // Térkép újratöltése a zöld markerrel
                } else {
                    throw new Error("ImgBB feltöltési hiba");
                }
            } catch (error) {
                console.error(error);
                alert("Hiba történt a feltöltés során!");
            } finally {
                loaderOverlay.classList.add('hidden');
                loaderOverlay.querySelector('#loader-text').textContent = "Feltöltés folyamatban..."; // reset
                resolveCameraInput.value = "";
                currentDocIdToResolve = null;
            }
        }
    });
}
