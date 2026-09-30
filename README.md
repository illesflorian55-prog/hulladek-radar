# 🗺️ HulladékRadar

Közösségi hulladékbejelentő Progressive Web App (PWA), amely lehetővé teszi a felhasználóknak, hogy GPS-koordinátával és fotóval jelentsék az illegális hulladéklerakatokat.

## ✨ Főbb funkciók

- 📍 **GPS alapú helymeghatározás** – Pontos koordináták automatikus rögzítése
- 📸 **Fotó csatolás & képtömörítés** – Kliens oldali Canvas-alapú optimalizálás (max. 1280px, JPEG 80%), azonnali feltöltés és sávszélesség-takarékosság
- 🗺️ **Interaktív térkép** – Leaflet.js térképmegjelenítés, normál és műholdas rétegválasztással, egyedi színkódolt markerekkel és interaktív jelmagyarázattal
- 🔐 **Felhasználó-kezelés** – Biztonságos email/jelszó alapú regisztráció és bejelentkezés (Firebase Auth)
- 👨‍💼 **Adminisztrátori funkciók** – Bejelentések megoldottra állítása megoldási ("Utána") fotóval, bejelentés törlése, valamint közvetlen térképes marker-áthelyezés (Drag & Drop) valós idejű Firestore szinkronizációval
- 📴 **Offline támogatás** – Hálózati kimaradás esetén a bejelentések és képek lokális mentése (IndexedDB / Dexie.js), automatikus háttérszinkronizáció internetkapcsolat helyreállásakor
- 📱 **PWA élmény** – Letölthető, mobilra optimalizált applikáció, safe-area kezeléssel és app-shell elrendezéssel

---

## 🛠️ Tech Stack

| Terület | Technológia | Leírás |
|---|---|---|
| **Frontend UI** | HTML5, TailwindCSS, Custom CSS | Modern, reszponzív, kártyás mobil UI |
| **Térkép** | Leaflet.js | OpenStreetMap és Esri World Imagery rétegek |
| **Adatbázis & Auth** | Firebase Auth & Cloud Firestore | Valós idejű felhőadatbázis és hitelesítés |
| **Képtárolás** | ImgBB API | Képtárhely és optimalizált kézbesítés |
| **Offline Cache** | Dexie.js (IndexedDB) & Service Worker | Helyi gyorsítótárazás és offline űrlapkezelés |

---

## 🚀 Telepítés és futtatás helyben

1. **Klónozd a tárolót:**
   ```bash
   git clone https://github.com/illesflorian55-prog/hulladek-radar.git
   cd hulladek-radar
   ```

2. **Firebase beállítás:**
   - Hozz létre egy új projektet a [Firebase Console](https://console.firebase.google.com/)-ban.
   - Engedélyezd a **Firebase Authentication** szolgáltatást (Email/Jelszó szolgáltató).
   - Hozz létre egy **Cloud Firestore** adatbázist.
   - Másold be a kapott webes konfigurációs objektumot az `app.js` elejére (`firebaseConfig`).

3. **ImgBB API kulcs (opcionális/saját):**
   - Regisztrálj az [ImgBB](https://api.imgbb.com/) oldalon ingyenes API kulcsért, és írd be az `app.js`-ben található `IMGBB_API_KEY` változóba.

4. **Telepítés és közzététel (Firebase Hosting):**
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting
   firebase deploy --only hosting
   ```

---

## 📖 Használat

1. Nyisd meg az alkalmazást böngészőben vagy mentsd a kezdőképernyőre (PWA).
2. Jelentkezz be vagy hozz létre egy új fiókot a regisztrációs űrlapon.
3. Rögzítsd a pozíciót a **GPS Koordináta Lekérése** gombbal.
4. Készíts fotót vagy tölts fel egy meglévőt a kameragomb segítségével.
5. Válaszd ki a hulladék kategóriáját, írj opcionális megjegyzést, majd nyomj a **BEKÜLDÉS** gombra.
6. A **Térkép** fülön azonnal megtekintheted az összes beküldött esetet:
   - 🔵 **Kék:** Feldolgozás alatt lévő esetek
   - 🟡 **Arany:** Saját bejelentéseid
   - 🟢 **Zöld:** Sikeresen megoldott bejelentések

---

## 👤 Szerző

Fejlesztette: **Illés Flórián**

---

## 📄 Licenc

Ez a projekt az MIT Licenc alatt áll.
