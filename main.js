const SUPABASE_URL = "https://ctriaqbaxxqrsmovzoqs.supabase.co";
const SUPABASE_BUCKET = "media";

let data = [];
let reveal = false;
let learnedIndices = new Set();
let currentIndex = null;
let isTransitioning = false;

async function loadData() {
    try {
        const res = await fetch("output_deck.json");
        data = await res.json();
        showCard();
    } catch (e) {
        document.body.innerHTML = "❌ Không thể tải file JSON.";
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

function preloadImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = url;
        img.onload = resolve;
    });
}

async function showCard() {
    reveal = false;
    currentIndex = getRandomUnseenIndex();
    learnedIndices.add(currentIndex);
    const card = data[currentIndex];
    const imgUrl = supabaseMediaURL(card.image);

    // 👉 Áp dụng fade-out lên body
    document.body.classList.remove("fade-in");
    document.body.classList.add("fade-out");

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

    // 👉 Xóa fade-out, thêm fade-in
    document.body.classList.remove("fade-out");
    void document.body.offsetWidth; // reflow để reset animation
    document.body.classList.add("fade-in");
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
            if (!reveal) {
                reveal = true;
                revealCard();
            } else {
                // Fade out toàn bộ body
                document.body.style.opacity = "0";

                // Sau khi hiệu ứng fade out kết thúc (~300ms), load card mới
                setTimeout(() => {
                    showCard().then(() => {
                        // Fade in trở lại sau khi card mới đã sẵn sàng
                        document.body.style.opacity = "1";
                    });
                }, 100);
            }
        }
    });

    // Global Enter: nếu chưa focus vào ô nhập thì focus vào
    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && document.activeElement !== hintInput) {
            e.preventDefault(); // tránh scroll hoặc reload form
            hintInput.focus();
        }
    });

    loadData();
});

