/**
 * チャイドル - フロントエンドロジック
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
const personInput       = document.getElementById("person-input");
const uploadPlaceholder = document.getElementById("upload-placeholder");
const previewImg        = document.getElementById("preview-img");
const changePhotoBtn    = document.getElementById("change-photo-btn");

const garmentInput      = document.getElementById("garment-input");
const garmentPreview    = document.getElementById("garment-preview");
const garmentPlaceholder = document.getElementById("garment-placeholder");
const garmentTryBtn     = document.getElementById("garment-try-btn");

const searchInput       = document.getElementById("search-input");
const searchBtn         = document.getElementById("search-btn");
const searchLoading     = document.getElementById("search-loading");
const itemsGrid         = document.getElementById("items-grid");
const loadMoreBtn       = document.getElementById("load-more-btn");
const generateBtn       = document.getElementById("generate-btn");
const imagePicker       = document.getElementById("image-picker");
const imagePickerGrid   = document.getElementById("image-picker-grid");

const stepResult        = document.getElementById("step-result");
const tryonLoading      = document.getElementById("tryon-loading");
const resultArea        = document.getElementById("result-area");
const resultImg         = document.getElementById("result-img");
const resultError       = document.getElementById("result-error");
const selectedItemName  = document.getElementById("selected-item-name");
const selectedItemPrice = document.getElementById("selected-item-price");
const buyLink           = document.getElementById("buy-link");
const retryBtn          = document.getElementById("retry-btn");

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
    garmentTryBtn.style.display = "block";
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

  generateBtn.style.display = "block";
  generateBtn.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ─── 服ファイルで試着 ──────────────────────────────
async function startTryOnWithFile(garmentFile) {
  if (state.isTryingOn) return;
  state.isTryingOn = true;

  stepResult.classList.remove("hidden");
  stepResult.scrollIntoView({ behavior: "smooth", block: "start" });
  tryonLoading.classList.remove("hidden");
  resultArea.classList.add("hidden");
  resultError.classList.add("hidden");

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
    resultImg.src = data.result_url;
    selectedItemName.textContent = "";
    selectedItemPrice.textContent = "";
    buyLink.style.display = "none";
    tryonLoading.classList.add("hidden");
    resultArea.classList.remove("hidden");
  } catch (err) {
    tryonLoading.classList.add("hidden");
    showError(resultError, `エラーが発生しました: ${err.message}`);
  } finally {
    state.isTryingOn = false;
  }
}

// ─── FASHN.ai 試着 ─────────────────────────────────
async function startTryOn(item) {
  if (state.isTryingOn) return;
  state.isTryingOn = true;

  stepResult.classList.remove("hidden");
  stepResult.scrollIntoView({ behavior: "smooth", block: "start" });
  tryonLoading.classList.remove("hidden");
  resultArea.classList.add("hidden");
  resultError.classList.add("hidden");

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
    resultImg.src = data.result_url;
    selectedItemName.textContent = item.itemName || "";
    selectedItemPrice.textContent = item.itemPrice ? `¥${item.itemPrice.toLocaleString()}` : "";
    buyLink.href = item.itemUrl || "#";
    buyLink.style.display = item.itemUrl && item.itemUrl !== item.imageUrl ? "block" : "none";

    tryonLoading.classList.add("hidden");
    resultArea.classList.remove("hidden");
  } catch (err) {
    tryonLoading.classList.add("hidden");
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
