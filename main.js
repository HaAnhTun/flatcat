const SUPABASE_URL = "https://ctriaqbaxxqrsmovzoqs.supabase.co";
const SUPABASE_BUCKET = "media";

let data = [];
let reveal = false;
let learnedIndicesList = JSON.parse(sessionStorage.getItem("learnedIndicesList") || "[]");
let learnedIndicesSet = new Set(learnedIndicesList); // Dùng Set để kiểm tra nhanh
let currentIndex = null;
let currentPosition = -1; // Vị trí hiện tại trong danh sách learnedIndicesList

async function loadData() {
    try {
        console.log("Đang tải output_deck.json...");
        const res = await fetch("output_deck.json");
        if (!res.ok) throw new Error(`Không thể tải JSON: ${res.status}`);
        data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("Dữ liệu JSON không hợp lệ hoặc rỗng");
        }
        console.log("Dữ liệu JSON đã tải:", data.length, "từ");

        // Khởi tạo tiến trình
        document.getElementById("totalCards").innerText = data.length;

        // Nếu không có từ đã học, chọn từ ngẫu nhiên
        if (learnedIndicesList.length === 0) {
            currentIndex = getRandomUnseenIndex();
            learnedIndicesList.push(currentIndex);
            learnedIndicesSet.add(currentIndex);
            currentPosition = 0;
            sessionStorage.setItem("learnedIndicesList", JSON.stringify(learnedIndicesList));
            await showCard(false);
        } else {
            // Hiển thị từ cuối cùng trong danh sách đã học
            currentPosition = learnedIndicesList.length - 1;
            currentIndex = learnedIndicesList[currentPosition];
            if (currentIndex < 0 || currentIndex >= data.length) {
                console.warn("currentIndex không hợp lệ, reset...");
                learnedIndicesList = [];
                learnedIndicesSet.clear();
                currentIndex = getRandomUnseenIndex();
                learnedIndicesList.push(currentIndex);
                learnedIndicesSet.add(currentIndex);
                currentPosition = 0;
                sessionStorage.setItem("learnedIndicesList", JSON.stringify(learnedIndicesList));
            }
            await showCard(false);
        }
    } catch (e) {
        console.error("Lỗi tải dữ liệu:", e);
        document.body.innerHTML = "❌ Không thể tải file JSON. Vui lòng kiểm tra console.";
    }
}

function supabaseMediaURL(filename) {
    return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${filename}`;
}

function getRandomUnseenIndex() {
    if (learnedIndicesSet.size >= data.length) {
        console.log("Đã học hết từ, reset danh sách...");
        alert("🎉 Bạn đã học hết flashcards trong phiên này!");
        learnedIndicesList = [];
        learnedIndicesSet.clear();
        currentPosition = -1;
        sessionStorage.setItem("learnedIndicesList", JSON.stringify(learnedIndicesList));
    }

    let index;
    do {
        index = Math.floor(Math.random() * data.length);
    } while (learnedIndicesSet.has(index));

    console.log("Chọn từ mới với index:", index);
    return index;
}

async function preloadImage(url) {
    try {
        console.log("Đang tải hình ảnh:", url);
        const img = new Image();
        img.src = url;
        await new Promise((resolve, reject) => {
            img.onload = () => {
                console.log("Hình ảnh tải thành công");
                resolve();
            };
            img.onerror = () => reject(new Error("Không thể tải hình ảnh"));
        });
    } catch (e) {
        console.error("Lỗi tải hình ảnh:", e);
        document.getElementById("cardImage").alt = "Hình ảnh không khả dụng";
    }
}

async function showCard(addToList = true) {
    if (currentIndex < 0 || currentIndex >= data.length) {
        console.error("currentIndex không hợp lệ:", currentIndex);
        return;
    }

    reveal = false;
    const backButton = document.querySelector('button[onclick="handleBack()"]');

    // Nếu thêm vào danh sách, cập nhật learnedIndicesList và learnedIndicesSet
    if (addToList) {
        if (!learnedIndicesSet.has(currentIndex)) {
            learnedIndicesList.push(currentIndex);
            learnedIndicesSet.add(currentIndex);
            currentPosition = learnedIndicesList.length - 1;
            sessionStorage.setItem("learnedIndicesList", JSON.stringify(learnedIndicesList));
            console.log("Thêm từ mới vào lịch sử:", currentIndex, learnedIndicesList);
        }
    }

    // Cập nhật trạng thái nút Back
    if (backButton) {
        backButton.disabled = currentPosition <= 0;
    } else {
        console.warn("Không tìm thấy nút Back");
    }

    const card = data[currentIndex];
    console.log("Hiển thị từ:", card.word);

    // Fade out
    const cardElement = document.getElementById("card");
    const fullDataElement = document.getElementById("fullData");
    cardElement.style.opacity = "0";
    fullDataElement.style.opacity = "0";

    // Cập nhật nội dung
    document.getElementById("hintDisplay").innerHTML = card.spelling_hint || "";
    document.getElementById("defDisplay").innerHTML = card.definition ? card.definition.replace(/{{c1::(.*?)}}/g, "[...]") : "";
    document.getElementById("hintInput").value = "";
    document.getElementById("fullData").classList.add("hidden");

    document.getElementById("audioWordSource").src = card.audio_word ? supabaseMediaURL(card.audio_word) : "";
    document.getElementById("audioMeaningSource").src = card.audio_meaning ? supabaseMediaURL(card.audio_meaning) : "";
    document.getElementById("audioExampleSource").src = card.audio_example ? supabaseMediaURL(card.audio_example) : "";

    document.getElementById("audioWord").load();
    document.getElementById("audioMeaning").load();
    document.getElementById("audioExample").load();

    if (card.image) {
        await preloadImage(supabaseMediaURL(card.image));
        document.getElementById("cardImage").src = supabaseMediaURL(card.image);
    } else {
        document.getElementById("cardImage").src = "";
        document.getElementById("cardImage").alt = "Không có hình ảnh";
    }

    // Cập nhật tiến trình
    document.getElementById("currentCard").innerText = currentPosition + 1;

    // Fade in
    cardElement.style.opacity = "1";
    fullDataElement.style.opacity = "1";
}

function revealCard() {
    if (!data[currentIndex]) {
        console.error("Không có dữ liệu cho currentIndex:", currentIndex);
        return;
    }

    const card = data[currentIndex];
    console.log("Reveal từ:", card.word);
    document.getElementById("word").innerText = card.word || "";
    document.getElementById("phonetic").innerText = card.phonetic || "";
    document.getElementById("translation").innerHTML = card.translation || "";
    document.getElementById("fullDefinition").innerHTML = card.html_full_meaning || "";
    document.getElementById("defDisplay").innerHTML = card.definition ? card.definition.replace(/{{c1::(.*?)}}/g, "$1") : "";
    document.getElementById("fullData").classList.remove("hidden");

    document.getElementById("audioWord").play().catch((e) => console.warn("Lỗi phát audio:", e));
}

function handleReveal() {
    if (!reveal) {
        reveal = true;
        revealCard();
    }
}

function handleNext() {
    console.log("Chuyển sang từ tiếp theo...");
    // Kiểm tra nếu có từ tiếp theo trong learnedIndicesList
    if (currentPosition < learnedIndicesList.length - 1) {
        currentPosition++;
        currentIndex = learnedIndicesList[currentPosition];
        console.log("Quay lại từ trong lịch sử:", currentIndex);
    } else {
        // Chọn từ mới ngẫu nhiên
        currentIndex = getRandomUnseenIndex();
        console.log("Chọn từ mới ngẫu nhiên:", currentIndex);
    }
    document.getElementById("card").style.opacity = "0";
    setTimeout(async () => {
        await showCard(true);
        document.getElementById("card").style.opacity = "1";
    }, 300);
}

function handleBack() {
    if (currentPosition > 0) {
        console.log("Quay lại từ trước đó...");
        currentPosition--;
        currentIndex = learnedIndicesList[currentPosition];
        document.getElementById("card").style.opacity = "0";
        setTimeout(async () => {
            await showCard(false);
            document.getElementById("card").style.opacity = "1";
        }, 300);
    } else {
        console.log("Không có từ trước đó để quay lại");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const hintInput = document.getElementById("hintInput");
    const backButton = document.querySelector('button[onclick="handleBack()"]');

    if (!hintInput) {
        console.error("Không tìm thấy hintInput");
        return;
    }
    if (!backButton) {
        console.warn("Không tìm thấy nút Back");
    } else {
        backButton.disabled = true; // Ban đầu vô hiệu hóa nút Back
    }

    // Xử lý Enter trong ô nhập: Reveal / Next
    hintInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const userInput = hintInput.value.trim().toLowerCase();
            const correctWord = data[currentIndex]?.word?.toLowerCase() || "";
            if (!reveal) {
                // Cho phép reveal dù nhập đúng hay sai
                if (userInput && userInput !== correctWord) {
                    console.log("Nhập sai từ:", userInput);
                    hintInput.classList.add("error");
                    setTimeout(() => hintInput.classList.remove("error"), 500);
                } else {
                    console.log("Nhập đúng từ hoặc để trống:", userInput);
                }
                reveal = true;

                revealCard();
            } else {
                handleNext();
            }
        }
    });

    // Global Enter/Space/ArrowLeft/ArrowRight: nếu chưa focus vào ô nhập thì xử lý
document.addEventListener("keydown", (e) => {
    const isInputFocused = document.activeElement === hintInput;
    if (e.key === "Enter") {
        e.preventDefault();
        if (!isInputFocused) {
            hintInput.focus();
        }
    } else if (!isInputFocused) {
        if (e.key === "ArrowRight") {
            e.preventDefault();
            handleNext();
        } else if (e.key === " ") {
            e.preventDefault();
            handleReveal();
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            handleBack();
        }
    }
});

    console.log("Khởi động ứng dụng...");
    loadData();
});