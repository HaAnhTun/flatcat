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
let reveal = false;
let learnedIndicesList = JSON.parse(sessionStorage.getItem("learnedIndicesList") || "[]");
let learnedIndicesSet = new Set(learnedIndicesList);
let availableIndices = [];
let currentIndex = null;
let currentPosition = -1;
let saveSessionTimeout = null;

async function loadData() {
    try {
        const cacheKey = "flashcards_data";
        const cacheVersionKey = "flashcards_data_version";
        const currentVersion = "1.0";
        const cachedData = localStorage.getItem(cacheKey);
        const cachedVersion = localStorage.getItem(cacheVersionKey);

        if (cachedData && cachedVersion === currentVersion) {
            data = JSON.parse(cachedData);
        } else {
            const res = await fetch("output_deck.json");
            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
            data = await res.json();
            localStorage.setItem(cacheKey, JSON.stringify(data));
            localStorage.setItem(cacheVersionKey, currentVersion);
        }

        availableIndices = Array.from({ length: data.length }, (_, i) => i).filter(i => !learnedIndicesSet.has(i));
        DOM.totalCards.innerText = data.length;

        if (learnedIndicesList.length === 0) {
            currentIndex = getRandomUnseenIndex();
            learnedIndicesList.push(currentIndex);
            learnedIndicesSet.add(currentIndex);
            currentPosition = 0;
            debounceSaveSession();
            await showCard(false);
        } else {
            currentPosition = learnedIndicesList.length - 1;
            currentIndex = learnedIndicesList[currentPosition];
            await showCard(false);
        }
    } catch (e) {
        document.body.innerHTML = "❌ Cannot load JSON. Check console.";
    }
}

function supabaseMediaURL(filename) {
    return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${filename}`;
}

function getRandomUnseenIndex() {
    if (availableIndices.length === 0) {
        alert("🎉 All flashcards reviewed!");
        learnedIndicesList = [];
        learnedIndicesSet.clear();
        availableIndices = Array.from({ length: data.length }, (_, i) => i);
        currentPosition = -1;
        debounceSaveSession();
    }
    const randomIdx = Math.floor(Math.random() * availableIndices.length);
    const index = availableIndices[randomIdx];
    availableIndices.splice(randomIdx, 1);
    return index;
}

async function preloadImage(url) {
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

function debounceSaveSession() {
    clearTimeout(saveSessionTimeout);
    saveSessionTimeout = setTimeout(() => {
        sessionStorage.setItem("learnedIndicesList", JSON.stringify(learnedIndicesList));
    }, 100);
}

async function showCard(addToList = true) {
    if (currentIndex < 0 || currentIndex >= data.length) return;

    reveal = false;
    if (addToList && !learnedIndicesSet.has(currentIndex)) {
        learnedIndicesList.push(currentIndex);
        learnedIndicesSet.add(currentIndex);
        const idx = availableIndices.indexOf(currentIndex);
        if (idx !== -1) availableIndices.splice(idx, 1);
        currentPosition = learnedIndicesList.length - 1;
        debounceSaveSession();
    }
    if (DOM.backButton) DOM.backButton.disabled = currentPosition <= 0;

    const card = data[currentIndex];

    const shimmerTimeout = new Promise(resolve => setTimeout(resolve, 200));
    let imageLoaded = false;
    if (card.image) {
        imageLoaded = await Promise.all([
            preloadImage(supabaseMediaURL(card.image)),
            shimmerTimeout
        ]).then(([loaded]) => loaded);
    } else {
        await shimmerTimeout;
    }

    DOM.card.classList.remove("shimmer");
    DOM.cardImage.classList.remove("hidden");
    DOM.hintInput.classList.remove("hidden");
    DOM.hintDisplay.classList.remove("shimmer");
    DOM.defDisplay.classList.remove("shimmer");

    DOM.hintDisplay.innerHTML = card.spelling_hint || "";
    DOM.defDisplay.innerHTML = card.definition ? card.definition.replace(/{{c1::(.*?)}}/g, "[...]") : "";
    DOM.hintInput.value = "";
    DOM.fullData.classList.add("hidden");

    DOM.cardImage.src = imageLoaded && card.image ? supabaseMediaURL(card.image) : "";
    DOM.cardImage.alt = imageLoaded && card.image ? card.word : "";

    DOM.audioWordSource.src = "";
    DOM.audioMeaningSource.src = "";
    DOM.audioExampleSource.src = "";

    DOM.currentCard.innerText = currentPosition + 1;
}

function revealCard() {
    const card = data[currentIndex];
    DOM.word.innerText = card.word || "";
    DOM.phonetic.innerText = card.phonetic || "";
    DOM.translation.innerHTML = card.translation || "";
    DOM.fullDefinition.innerHTML = card.html_full_meaning || "";
    DOM.defDisplay.innerHTML = card.definition ? card.definition.replace(/{{c1::(.*?)}}/g, "$1") : "";
    DOM.fullData.classList.remove("hidden");

    DOM.audioWordSource.src = card.audio_word ? supabaseMediaURL(card.audio_word) : "";
    DOM.audioMeaningSource.src = card.audio_meaning ? supabaseMediaURL(card.audio_meaning) : "";
    DOM.audioExampleSource.src = card.audio_example ? supabaseMediaURL(card.audio_example) : "";
    DOM.audioWord.load();
    DOM.audioMeaning.load();
    DOM.audioExample.load();
    DOM.audioWord.play().catch(e => console.warn("Audio error:", e));
}

function handleReveal() {
    if (!reveal) {
        reveal = true;
        revealCard();
    }
}

function handleNext() {
    if (currentPosition < learnedIndicesList.length - 1) {
        currentPosition++;
        currentIndex = learnedIndicesList[currentPosition];
    } else {
        currentIndex = getRandomUnseenIndex();
    }

    DOM.card.classList.add("shimmer");
    DOM.cardImage.classList.add("hidden");
    DOM.hintInput.classList.add("hidden");
    DOM.hintDisplay.classList.add("shimmer");
    DOM.defDisplay.classList.add("shimmer");
    setTimeout(() => showCard(true), 150);
}

function handleBack() {
    if (currentPosition > 0) {
        currentPosition--;
        currentIndex = learnedIndicesList[currentPosition];
        DOM.card.classList.add("shimmer");
        DOM.cardImage.classList.add("hidden");
        DOM.hintInput.classList.add("hidden");
        DOM.hintDisplay.classList.add("shimmer");
        DOM.defDisplay.classList.add("shimmer");
        setTimeout(() => showCard(false), 150);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (!DOM.hintInput) return;
    if (DOM.backButton) DOM.backButton.disabled = true;

    DOM.hintInput.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            const userInput = DOM.hintInput.value.trim().toLowerCase();
            const correctWord = data[currentIndex]?.word?.toLowerCase() || "";
            if (!reveal) {
                if (userInput && userInput !== correctWord) {
                    DOM.hintInput.classList.add("error");
                    setTimeout(() => DOM.hintInput.classList.remove("error"), 500);
                }
                reveal = true;
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
                if (!/Mobi|Android/i.test(navigator.userAgent)) {
                    DOM.hintInput.focus();
                }
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
