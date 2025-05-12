const SUPABASE_URL = "https://ctriaqbaxxqrsmovzoqs.supabase.co";
const SUPABASE_BUCKET = "media";

let data = [];
let reveal = false;
let learnedIndices = new Set();
let currentIndex = null;

async function loadData() {
    try {
        const res = await fetch("output_deck.json");
        data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("Dữ liệu JSON không hợp lệ hoặc rỗng");
        }
        showCard();
    } catch (e) {
        console.error(e);
        document.body.innerHTML = "❌ Không thể tải file JSON. Vui lòng kiểm tra dữ liệu.";
    }
}

function supabaseMediaURL(filename) {
    return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${filename}`;
}

function getRandomUnseenIndex() {
    if (learnedIndices.size >= data.length) {
        alert("🎉 Bạn đã học hết flashcards trong phiên này!");
        learnedIndices.clear();
    }

    let index;
    do {
        index = Math.floor(Math.random() * data.length);
    } while (learnedIndices.has(index));

    return index;
}

async function preloadImage(url) {
    try {
        const img = new Image();
        img.src = url;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error("Không thể tải hình ảnh"));
        });
    } catch (e) {
        console.error(e);
        document.getElementById("cardImage").alt = "Hình ảnh không khả dụng";
    }
}

async function showCard() {
    reveal = false;
    currentIndex = getRandomUnseenIndex();
    learnedIndices.add(currentIndex);
    const card = data[currentIndex];
    const imgUrl = supabaseMediaURL(card.image);

    // Fade out
    const cardElement = document.getElementById("card");
    const fullDataElement = document.getElementById("fullData");
    cardElement.style.opacity = "0";
    fullDataElement.style.opacity = "0";

    // Cập nhật nội dung
    document.getElementById("hintDisplay").innerHTML = card.spelling_hint;
    document.getElementById("defDisplay").innerHTML = card.definition.replace(/{{c1::(.*?)}}/g, "[...]");
    document.getElementById("hintInput").value = "";
    document.getElementById("fullData").classList.add("hidden");

    document.getElementById("audioWordSource").src = supabaseMediaURL(card.audio_word);
    document.getElementById("audioMeaningSource").src = supabaseMediaURL(card.audio_meaning);
    document.getElementById("audioExampleSource").src = supabaseMediaURL(card.audio_example);

    document.getElementById("audioWord").load();
    document.getElementById("audioMeaning").load();
    document.getElementById("audioExample").load();

    await preloadImage(imgUrl);
    document.getElementById("cardImage").src = imgUrl;

    // Fade in
    cardElement.style.opacity = "1";
    fullDataElement.style.opacity = "1";
}

function revealCard() {
    const card = data[currentIndex];
    document.getElementById("word").innerText = card.word;
    document.getElementById("phonetic").innerText = card.phonetic;
    document.getElementById("translation").innerHTML = card.translation;
    document.getElementById("fullDefinition").innerHTML = card.html_full_meaning;
    document.getElementById("defDisplay").innerHTML = card.definition.replace(/{{c1::(.*?)}}/g, "$1");
    document.getElementById("fullData").classList.remove("hidden");

    document.getElementById("audioWord").play().catch(console.warn);
}

document.addEventListener("DOMContentLoaded", () => {
    const hintInput = document.getElementById("hintInput");

    // Xử lý Enter trong ô nhập: Reveal / Next
    hintInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const userInput = hintInput.value.trim().toLowerCase();
            const correctWord = data[currentIndex].word.toLowerCase();
            if (!reveal) {
                if (userInput === correctWord) {
                    reveal = true;
                    revealCard();
                } else {
                    hintInput.classList.add("error");
                    setTimeout(() => hintInput.classList.remove("error"), 500);
                }
            } else {
                // Chuyển card
                document.getElementById("card").style.opacity = "0";
                setTimeout(() => {
                    showCard().then(() => {
                        document.getElementById("card").style.opacity = "1";
                    });
                }, 300);
            }
        }
    });

    // Global Enter/Space: nếu chưa focus vào ô nhập thì xử lý
    document.addEventListener("keydown", (e) => {
        if (document.activeElement !== hintInput) {
            if (e.key === "Enter") {
                e.preventDefault();
                if (reveal) {
                    // Chuyển card
                    document.getElementById("card").style.opacity = "0";
                    setTimeout(() => {
                        showCard().then(() => {
                            document.getElementById("card").style.opacity = "1";
                        });
                    }, 300);
                }
                // Chỉ focus trên desktop, tránh trên mobile
                if (!/Mobi|Android/i.test(navigator.userAgent)) {
                    hintInput.focus();
                }
            } else if (e.key === " ") {
                e.preventDefault();
                if (!reveal) {
                    reveal = true;
                    revealCard();
                }
            }
        }
    });

    loadData();
});