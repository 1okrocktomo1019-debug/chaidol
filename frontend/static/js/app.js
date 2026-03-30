/**
 * Chaidol - フロントエンドロジック
 */

// ─── 状態管理 ──────────────────────────────────────
const state = {
  personImageFile: null,
  selectedItem: null,
  searchPage: 1,
  searchKeyword: "",
  isSearching: false,
  isTryingOn: false,
};

// ─── DOM要素 ───────────────────────────────────────
const personInput        = document.getElementById("person-input");
const uploadPlaceholder  = document.getElementById("upload-placeholder");
const previewImg         = document.getElementById("preview-img");
const changePhotoBtn     = document.getElementById("change-photo-btn");

const garmentInput       = document.getElementById("garment-input");
const garmentPreview     = document.getElementById("garment-preview");
const garmentPlaceholder = document.getElementById("garment-placeholder");
const garmentTryBtn      = document.getElementById("garment-try-btn");

const searchInput        = document.getElementById("search-input");
const searchBtn          = document.getElementById("search-btn");
const searchLoading      = document.getElementById("search-loading");
const itemsGrid          = document.getElementById("items-grid");
const loadMoreBtn        = document.getElementById("load-more-btn");
const generateBtn        = document.getElementById("generate-btn");
const imagePicker        = document.getElementById("image-picker");
const imagePickerGrid    = document.getElementById("image-picker-grid");

const tryBtnWrap         = document.getElementById("try-btn-wrap");
const stepResult         = document.getElementById("step-result");
const tryonLoading       = document.getElementById("tryon-loading");
const resultArea         = document.getElementById("result-area");
const resultImg          = document.getElementById("result-img");
const resultError        = document.getElementById("result-error");
const resultCardTitle    = document.getElementById("result-card-title");
const selectedItemName   = document.getElementById("selected-item-name");
const selectedItemPrice  = document.getElementById("selected-item-price");
const buyLink            = document.getElementById("buy-link");
const retryBtn           = document.getElementById("retry-btn");

// ─── スプラッシュ画面 ──────────────────────────────
document.getElementById("splash-btn").addEventListener("click", () => {
  const splash = document.getElementById("splash");
  const howto  = document.getElementById("howto");
  splash.classList.add("fade-out");
  setTimeout(() => {
    splash.remove();
    howto.classList.remove("hidden");
  }, 650);
});

// ─── 使い方ガイド ──────────────────────────────────
document.getElementById("howto-btn").addEventListener("click", () => {
  const howto = document.getElementById("howto");
  howto.classList.add("fade-out");
  setTimeout(() => howto.remove(), 650);
});

// ─── ローディングメッセージ ────────────────────────
const loadingMessages = [
  "AIが服を認識中...",
  "お子さまの体型を分析中...",
  "バーチャル試着を生成中...",
  "画像を仕上げています...",
];
let loadingMsgTimer = null;

function startLoadingMessages() {
  const el = document.getElementById("tl-msg");
  let idx = 0;
  el.textContent = loadingMessages[0];
  el.style.opacity = "1";
  loadingMsgTimer = setInterval(() => {
    el.style.opacity = "0";
    setTimeout(() => {
      idx = (idx + 1) % loadingMessages.length;
      el.textContent = loadingMessages[idx];
      el.style.opacity = "1";
    }, 350);
  }, 3800);
}

function stopLoadingMessages() {
  clearInterval(loadingMsgTimer);
  loadingMsgTimer = null;
}

// ─── コンフェッティ ────────────────────────────────
function launchConfetti() {
  const colors = ["#C2447A", "#7B4FA0", "#C4965A", "#DDB882", "#DFA0BA", "#B589C9"];
  for (let i = 0; i < 36; i++) {
    const el = document.createElement("div");
    const size = Math.random() * 8 + 4;
    el.style.cssText = `
      position: fixed;
      width: ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${Math.random() > 0.5 ? "50%" : "2px"};
      left: ${20 + Math.random() * 60}vw;
      top: 55vh;
      pointer-events: none;
      z-index: 9999;
      opacity: 1;
    `;
    document.body.appendChild(el);
    const angle = (Math.random() - 0.5) * 200;
    const dist  = Math.random() * 180 + 80;
    el.animate([
      { transform: "translateY(0) rotate(0deg)", opacity: 1 },
      { transform: `translate(${Math.sin(angle * Math.PI / 180) * dist}px, -${dist * 1.6}px) rotate(${angle * 2}deg)`, opacity: 0 }
    ], {
      duration: Math.random() * 700 + 500,
      easing: "cubic-bezier(0, 0.9, 0.57, 1)",
      fill: "forwards"
    }).onfinish = () => el.remove();
  }
}

// ─── 写真アップロード ──────────────────────────────
personInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  state.personImageFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    previewImg.src = ev.target.result;
    previewImg.onerror = () => {
      previewImg.classList.add("hidden");
      uploadPlaceholder.innerHTML = `<div class="upload-icon">✅</div><div class="upload-text">${file.name}</div><div class="upload-hint">写真を選択しました（プレビュー非対応の形式）</div>`;
      uploadPlaceholder.classList.remove("hidden");
    };
    previewImg.classList.remove("hidden");
    uploadPlaceholder.classList.add("hidden");
    changePhotoBtn.style.display = "block";
  };
  reader.readAsDataURL(file);
});

changePhotoBtn.addEventListener("click", () => {
  personInput.value = "";
  personInput.click();
});

// ─── 服の画像アップロード ──────────────────────────
garmentInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  state.garmentFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    garmentPreview.src = ev.target.result;
    garmentPreview.classList.remove("hidden");
    garmentPlaceholder.classList.add("hidden");
    garmentTryBtn.style.display = "inline-flex";
  };
  reader.readAsDataURL(file);
});

garmentTryBtn.addEventListener("click", () => {
  if (!state.personImageFile) {
    alert("まずSTEP 1で子どもの写真をアップロードしてください！");
    return;
  }
  startTryOnWithFile(state.garmentFile);
});

// ─── 楽天商品検索 ──────────────────────────────────
searchBtn.addEventListener("click", () => {
  const keyword = searchInput.value.trim();
  state.searchKeyword = keyword;
  state.searchPage = 1;
  itemsGrid.innerHTML = "";
  loadMoreBtn.style.display = "none";
  fetchItems(keyword, 1, false);
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchBtn.click();
});

loadMoreBtn.addEventListener("click", () => {
  state.searchPage += 1;
  fetchItems(state.searchKeyword, state.searchPage, true);
});

async function fetchItems(keyword, page, append) {
  if (state.isSearching) return;
  state.isSearching = true;
  searchLoading.classList.remove("hidden");
  searchBtn.disabled = true;

  try {
    const params = new URLSearchParams({ keyword: keyword || "ロンパース", page });
    const res = await fetch(`/api/search-clothes?${params}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "検索に失敗しました" }));
      throw new Error(err.detail || "検索に失敗しました");
    }
    const data = await res.json();
    renderItems(data.items, append);

    if (data.page < data.pageCount && data.items.length > 0) {
      loadMoreBtn.style.display = "block";
    } else {
      loadMoreBtn.style.display = "none";
    }

    if (data.items.length === 0 && !append) {
      itemsGrid.innerHTML = "<p style='color:#999;font-size:14px;grid-column:1/-1;'>商品が見つかりませんでした。キーワードを変えてみてください。</p>";
    }
  } catch (err) {
    showError(resultError, err.message);
  } finally {
    state.isSearching = false;
    searchLoading.classList.add("hidden");
    searchBtn.disabled = false;
  }
}

function renderItems(items, append) {
  if (!append) itemsGrid.innerHTML = "";

  items.forEach((item) => {
    if (!item.imageUrl) return;

    const card = document.createElement("div");
    card.className = "item-card";

    const img = document.createElement("img");
    img.src = item.imageUrl;
    img.alt = item.itemName;
    img.loading = "lazy";

    const body = document.createElement("div");
    body.className = "item-card-body";

    const nameEl = document.createElement("p");
    nameEl.className = "item-card-name";
    nameEl.textContent = item.itemName;

    const priceEl = document.createElement("p");
    priceEl.className = "item-card-price";
    priceEl.textContent = `¥${item.itemPrice.toLocaleString()}`;

    body.appendChild(nameEl);
    body.appendChild(priceEl);
    card.appendChild(img);
    card.appendChild(body);

    card.addEventListener("click", () => selectItem(item, card));
    itemsGrid.appendChild(card);
  });
}

function selectItem(item, cardEl) {
  document.querySelectorAll(".item-card.selected").forEach((el) => {
    el.classList.remove("selected");
  });
  cardEl.classList.add("selected");
  state.selectedItem = { ...item };

  imagePickerGrid.innerHTML = "";
  const images = item.imageUrls || (item.imageUrl ? [item.imageUrl] : []);
  if (images.length > 1) {
    images.forEach((url, i) => {
      const img = document.createElement("img");
      img.src = url;
      img.style.cssText = "width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer;border:3px solid transparent;";
      if (i === 0) img.style.borderColor = "#e91e8c";
      img.addEventListener("click", () => {
        imagePickerGrid.querySelectorAll("img").forEach(el => el.style.borderColor = "transparent");
        img.style.borderColor = "#e91e8c";
        state.selectedItem.imageUrl = url;
      });
      imagePickerGrid.appendChild(img);
    });
    imagePicker.style.display = "block";
  } else {
    imagePicker.style.display = "none";
  }

  tryBtnWrap.classList.remove("hidden");
  tryBtnWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ─── ローディング表示ヘルパー ──────────────────────
function showTryonLoading() {
  resultCardTitle.textContent = "試着中...";
  stepResult.classList.remove("hidden");
  stepResult.scrollIntoView({ behavior: "smooth", block: "start" });
  tryonLoading.classList.remove("hidden");
  resultArea.classList.add("hidden");
  resultError.classList.add("hidden");
  startLoadingMessages();
}

function hideTryonLoading() {
  tryonLoading.classList.add("hidden");
  stopLoadingMessages();
}

// ─── 服ファイルで試着 ──────────────────────────────
async function startTryOnWithFile(garmentFile) {
  if (state.isTryingOn) return;
  state.isTryingOn = true;

  showTryonLoading();

  try {
    const formData = new FormData();
    formData.append("person_image", state.personImageFile);
    formData.append("garment_image", garmentFile);

    const res = await fetch("/api/try-on-leffa", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "試着画像の生成に失敗しました" }));
      throw new Error(err.detail || "試着画像の生成に失敗しました");
    }
    const data = await res.json();

    hideTryonLoading();
    resultImg.src = data.result_url;
    selectedItemName.textContent = "";
    selectedItemPrice.textContent = "";
    buyLink.style.display = "none";
    resultCardTitle.textContent = "試着してみよう！";
    resultArea.classList.remove("hidden");
    launchConfetti();
  } catch (err) {
    hideTryonLoading();
    resultCardTitle.textContent = "試着してみよう！";
    showError(resultError, `エラーが発生しました: ${err.message}`);
  } finally {
    state.isTryingOn = false;
  }
}

// ─── FASHN.ai 試着 ─────────────────────────────────
async function startTryOn(item) {
  if (state.isTryingOn) return;
  state.isTryingOn = true;

  showTryonLoading();

  try {
    const formData = new FormData();
    formData.append("person_image", state.personImageFile);

    const params = new URLSearchParams({ garment_url: item.imageUrl });
    const res = await fetch(`/api/try-on?${params}`, { method: "POST", body: formData });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "試着画像の生成に失敗しました" }));
      throw new Error(err.detail || "試着画像の生成に失敗しました");
    }

    const data = await res.json();

    hideTryonLoading();
    resultImg.src = data.result_url;
    selectedItemName.textContent = item.itemName || "";
    selectedItemPrice.textContent = item.itemPrice ? `¥${item.itemPrice.toLocaleString()}` : "";
    buyLink.href = item.itemUrl || "#";
    buyLink.style.display = item.itemUrl && item.itemUrl !== item.imageUrl ? "block" : "none";
    resultCardTitle.textContent = "試着してみよう！";
    resultArea.classList.remove("hidden");
    launchConfetti();
  } catch (err) {
    hideTryonLoading();
    resultCardTitle.textContent = "試着してみよう！";
    showError(resultError, `エラーが発生しました: ${err.message}`);
  } finally {
    state.isTryingOn = false;
  }
}

// ─── 生成ボタン ────────────────────────────────────
generateBtn.addEventListener("click", () => {
  if (!state.personImageFile) {
    alert("まずSTEP 1で子どもの写真をアップロードしてください！");
    return;
  }
  if (!state.selectedItem) {
    alert("STEP 2で服を選んでください！");
    return;
  }
  startTryOn(state.selectedItem);
});

// ─── 別の服を選ぶ ──────────────────────────────────
retryBtn.addEventListener("click", () => {
  state.selectedItem = null;
  document.querySelectorAll(".item-card.selected").forEach((el) => el.classList.remove("selected"));
  tryBtnWrap.classList.add("hidden");
  stepResult.classList.add("hidden");
  resultArea.classList.add("hidden");
  resultError.classList.add("hidden");
  document.getElementById("step-search").scrollIntoView({ behavior: "smooth" });
});

// ─── ユーティリティ ────────────────────────────────
function showError(el, message) {
  el.textContent = message;
  el.classList.remove("hidden");
}

// ─── 初期検索 ──────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  searchInput.value = "ロンパース";
  fetchItems("ロンパース 赤ちゃん", 1, false);
});
