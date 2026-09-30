# HulladékRadar

Közösségi hulladékbejelentő Progressive Web App (PWA), amely lehetővé teszi illegális hulladéklerakatok bejelentését GPS-koordinátával és fotóval.

## Funkciók

- **GPS-alapú helymeghatározás:** Koordináták rögzítése a készülék beépített helyadatai alapján.
- **Fotómelléklet és képtömörítés:** Kliens oldali Canvas-alapú tömörítés (maximum 1280px, JPEG 80%) a gyors feltöltés és sávszélesség-takarékosság érdekében.
- **Interaktív térkép:** Leaflet.js térképmegjelenítés normál és műholdas rétegekkel, egyedi színkódolt markerekkel és interaktív jelmagyarázattal.
- **Felhasználókezelés:** Email és jelszó alapú regisztráció és bejelentkezés Firebase Authentication segítségével.
- **Adminisztrációs funkciók:** Bejelentések státuszának módosítása megoldási ("Utána") fotó csatolásával, bejegyzések törlése, valamint koordináták pontosítása a térképi markerek elhúzásával (Drag and Drop).
- **Offline működés:** Hálózati kimaradás esetén a bejelentések helyi tárolása IndexedDB adatbázisban (Dexie.js), automatikus háttérszinkronizációval a kapcsolat helyreállásakor.
- **Progressive Web App (PWA):** Kezdőképernyőre telepíthető webes felület Service Worker alapú gyorsítótárazással és mobilra méretezett felülettel.

## Technológiai háttér

| Terület | Technológia | Leírás |
|---|---|---|
| Felhasználói felület | HTML5, TailwindCSS, Custom CSS | Reszponzív, kártyás mobil elrendezés |
| Térképmegjelenítés | Leaflet.js | OpenStreetMap és Esri World Imagery rétegek |
| Adatbázis és hitelesítés | Firebase Auth, Cloud Firestore | Valós idejű felhőadatbázis és felhasználókezelés |
| Képfeltöltés | ImgBB API | Képtárhely és elérés |
| Helyi adatkezelés | Dexie.js (IndexedDB), Service Worker | Helyi gyorsítótár és offline űrlapmentés |

## Telepítés és futtatás helyben

1. **Tároló klónozása:**
   ```bash
   git clone https://github.com/illesflorian55-prog/hulladek-radar.git
   cd hulladek-radar
   ```

2. **Firebase konfiguráció:**
   - Hozz létre egy új projektet a Firebase Console felületén.
   - Engedélyezd az Authentication (Email/Jelszó) és a Cloud Firestore szolgáltatásokat.
   - Másold be a kapott konfigurációs objektumot az `app.js` elején található `firebaseConfig` változóba.

3. **ImgBB API kulcs megadása:**
   - Igényelj egy ingyenes kulcsot az ImgBB weboldalán, és állítsd be az `app.js` fájl `IMGBB_API_KEY` változójában.

4. **Közzététel (Firebase Hosting):**
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting
   firebase deploy --only hosting
   ```

## Használat

1. Nyisd meg az alkalmazást böngészőben vagy mentsd a kezdőképernyőre.
2. Jelentkezz be meglévő fiókkal, vagy hozz létre egy újat.
3. Rögzítsd a helyzetet a GPS gombbal.
4. Készíts egy fotót a hulladékról a kamera gomb segítségével.
5. Válaszd ki a hulladék kategóriáját, adj meg opcionális megjegyzést, majd kattints a Beküldés gombra.
6. A Térkép fülön megtekinthető az összes bejelentés:
   - Kék: Feldolgozás alatt lévő eset
   - Sárga/Arany: Saját bejelentés
   - Zöld: Megoldott eset

## Szerző

Fejlesztette: Illés Flórián

## Licenc

Ez a projekt az MIT Licenc alatt áll.
