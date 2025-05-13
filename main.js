const SUPABASE_URL = "https://ctriaqbaxxqrsmovzoqs.supabase.co";
const SUPABASE_BUCKET = "media";

// Cache DOM elements
const DOM = {
    card: document.getElementById("card"),
    fullData: document.getElementById("fullData"),
    hintInput: document.getElementById("hintInput"),
    hintDisplay: document.getElementById("hintDisplay"),
    defDisplay: document.getElementById("defDisplay"),
    word: document.getElementById("word"),
    phonetic: document.getElementById("phonetic"),
    translation: document.getElementById("translation"),
    fullDefinition: document.getElementById("fullDefinition"),
    cardImage: document.getElementById("cardImage"),
    audioWord: document.getElementById("audioWord"),
    audioMeaning: document.getElementById("audioMeaning"),
    audioExample: document.getElementById("audioExample"),
    audioWordSource: document.getElementById("audioWordSource"),
    audioMeaningSource: document.getElementById("audioMeaningSource"),
    audioExampleSource: document.getElementById("audioExampleSource"),
    currentCard: document.getElementById("currentCard"),
    totalCards: document.getElementById("totalCards"),
    backButton: document.querySelector('button[onclick="handleBack()"]')
};

let data = [];
let isRevealed = false;
let learnedIndices = [];
let learnedSet = new Set();
let availableIndices = [];
let currentIndex = null;
let currentPosition = -1;
let saveSessionTimeout = null;

// IndexedDB setup
const DB_NAME = "FlashcardsDB";
const DB_VERSION = 1;
const STORE_NAME = "flashcards";

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(new Error("Failed to open IndexedDB"));
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            db.createObjectStore(STORE_NAME, { keyPath: "key" });
        };
    });
}

async function saveToIndexedDB(key, value) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put({ key, value });
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(new Error("Failed to save to IndexedDB"));
        });
    } catch (error) {
        console.error("IndexedDB save error:", error);
        throw error;
    }
}

async function loadFromIndexedDB(key) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(key);
        return await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(new Error("Failed to load from IndexedDB"));
        });
    } catch (error) {
        console.error("IndexedDB load error:", error);
        return null;
    }
}

async function loadData() {
    try {
        const cacheKey = "flashcards_data";
        const cacheVersion = "1.0";

        // Try to load from memory first
        if (data.length > 0) {
            setupIndices();
            return;
        }

        // Try to load from IndexedDB
        let cachedData = await loadFromIndexedDB(cacheKey);
        if (cachedData && (await loadFromIndexedDB(cacheVersion + "_version")) === cacheVersion) {
            data = cachedData;
        } else {
            // Fetch from server if not cached
            const response = await fetch(supabaseMediaURL("data.json"));
            if (!response.ok) throw new Error(`Failed to fetch JSON: ${response.status}`);
            data = await response.json();
            // Save to IndexedDB
            await saveToIndexedDB(cacheKey, data);
            await saveToIndexedDB(cacheVersion + "_version", cacheVersion);
        }

        setupIndices();
        DOM.totalCards.innerText = data.length;

        // Load session state
        learnedIndices = JSON.parse(sessionStorage.getItem("learnedIndices") || "[]");
        learnedSet = new Set(learnedIndices);

        if (learnedIndices.length === 0) {
            currentIndex = getRandomIndex();
            learnedIndices.push(currentIndex);
            learnedSet.add(currentIndex);
            currentPosition = 0;
            saveSession();
            await displayCard(false);
        } else {
            currentPosition = learnedIndices.length - 1;
            currentIndex = learnedIndices[currentPosition];
            await displayCard(false);
        }
    } catch (error) {
        document.body.innerHTML = "<p class='text-red-500 text-center'>Error loading flashcards. Please try again.</p>";
        console.error("Load error:", error);
    }
}

function setupIndices() {
    availableIndices = Array.from({ length: data.length }, (_, i) => i).filter(i => !learnedSet.has(i));
}

function supabaseMediaURL(filename) {
    return filename ? `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${filename}` : "";
}

function getRandomIndex() {
    if (availableIndices.length === 0) {
        alert("All flashcards reviewed! Starting over.");
        learnedIndices = [];
        learnedSet.clear();
        availableIndices = Array.from({ length: data.length }, (_, i) => i);
        currentPosition = -1;
        saveSession();
    }
    const idx = Math.floor(Math.random() * availableIndices.length);
    const index = availableIndices[idx];
    availableIndices.splice(idx, 1);
    return index;
}

async function preloadImage(url) {
    if (!url) return false;
    try {
        const img = new Image();
        img.src = url;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
        return true;
    } catch {
        return false;
    }
}

function saveSession() {
    clearTimeout(saveSessionTimeout);
    saveSessionTimeout = setTimeout(() => {
        try {
            sessionStorage.setItem("learnedIndices", JSON.stringify(learnedIndices));
        } catch (error) {
            console.error("Session storage error:", error);
            alert("Session storage limit reached. Progress may not be saved.");
        }
    }, 100);
}

async function displayCard(addToList = true) {
    if (currentIndex < 0 || currentIndex >= data.length) return;

    isRevealed = false;
    if (addToList && !learnedSet.has(currentIndex)) {
        learnedIndices.push(currentIndex);
        learnedSet.add(currentIndex);
        const idx = availableIndices.indexOf(currentIndex);
        if (idx !== -1) availableIndices.splice(idx, 1);
        currentPosition = learnedIndices.length - 1;
        saveSession();
    }

    DOM.backButton.disabled = currentPosition <= 0;
    const card = data[currentIndex];

    // Apply shimmer effect during load
    DOM.card.classList.add("shimmer");
    [...DOM.card.children].forEach(el => el.classList.add("hidden"));
    DOM.fullData.classList.add("hidden");
    const shimmerTimeout = new Promise(resolve => setTimeout(resolve, 200));
    const imageLoaded = await Promise.all([
        preloadImage(supabaseMediaURL(card["IMG"])),
        shimmerTimeout
    ]).then(([loaded]) => loaded);

    // Update DOM
    DOM.card.classList.remove("shimmer");
    Array.from(DOM.card.children).forEach(el => el.classList.remove("hidden"));

    DOM.hintDisplay.innerHTML = card["Suggestion"] || "";
    DOM.defDisplay.innerHTML = card["Explanation"] ? card["Explanation"].replace(/{{c1::(.*?)}}/g, "[...]") : "";
    DOM.hintInput.value = "";

    DOM.cardImage.src = imageLoaded ? supabaseMediaURL(card["IMG"]) : "";
    DOM.cardImage.alt = card["Keyword"] || "Flashcard image";

    DOM.audioWordSource.src = "";
    DOM.audioMeaningSource.src = "";
    DOM.audioExampleSource.src = "";

    DOM.currentCard.innerText = currentPosition + 1;
}

function revealCard() {
    const card = data[currentIndex];
    console.log("Full Vietnamese content:", card["Full Vietnamese"]);

    DOM.word.innerText = card["Keyword"] || "";
    DOM.phonetic.innerText = card["Transcription"] || "";
    DOM.translation.innerHTML = card["Short Vietnamese"] || "";
    DOM.fullDefinition.innerHTML = card["Full Vietnamese"] || "No full definition available.";
    DOM.defDisplay.innerHTML = card["Explanation"] ? card["Explanation"].replace(/{{c1::(.*?)}}/g, "$1") : "";
    DOM.fullData.classList.remove("hidden");

    DOM.audioWordSource.src = supabaseMediaURL(card["Sound_audio"]);
    DOM.audioMeaningSource.src = supabaseMediaURL(card["Meaning_audio"]);
    DOM.audioExampleSource.src = supabaseMediaURL(card["Example_audio"]);
    DOM.audioWord.load();
    DOM.audioMeaning.load();
    DOM.audioExample.load();
    DOM.audioWord.play().catch(e => console.warn("Audio play error:", e));
}

function handleReveal() {
    if (!isRevealed) {
        isRevealed = true;
        revealCard();
    }
}

function handleNext() {
    if (currentPosition < learnedIndices.length - 1) {
        currentPosition++;
        currentIndex = learnedIndices[currentPosition];
    } else {
        currentIndex = getRandomIndex();
    }
    displayCard(true);
}

function handleBack() {
    if (currentPosition > 0) {
        currentPosition--;
        currentIndex = learnedIndices[currentPosition];
        displayCard(false);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (!DOM.hintInput) {
        console.error("Hint input not found");
        return;
    }

    DOM.backButton.disabled = true;

    DOM.hintInput.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            const input = DOM.hintInput.value.trim().toLowerCase();
            const correct = data[currentIndex]["Keyword"]?.toLowerCase() || "";
            if (!isRevealed) {
                if (input && input !== correct) {
                    DOM.hintInput.classList.add("error");
                    setTimeout(() => DOM.hintInput.classList.remove("error"), 500);
                }
                isRevealed = true;
                revealCard();
            } else {
                handleNext();
            }
        }
    });

    document.addEventListener("keydown", e => {
        if (document.activeElement !== DOM.hintInput) {
            if (e.key === "Enter" || e.key === "ArrowRight") {
                e.preventDefault();
                handleNext();
                if (!/Mobi|Android/i.test(navigator.userAgent)) DOM.hintInput.focus();
            } else if (e.key === " ") {
                e.preventDefault();
                handleReveal();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                handleBack();
            }
        }
    });

    loadData();
});