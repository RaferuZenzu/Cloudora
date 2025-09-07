/* Cloudora script.js
   - simpan file ke localStorage (base64 untuk binary)
   - preview untuk text/image/audio/video/pdf
   - daftar, cari, delete (single & multi)
*/

const fileInput = document.getElementById("fileInput");
const fileLabel = document.getElementById("fileLabel");
const inputJudul = document.getElementById("inputJudul");
const saveBtn = document.getElementById("saveBtn");
const clearAllBtn = document.getElementById("clearAllBtn");

const daftarKisi = document.getElementById("daftarKisi");
const searchInput = document.getElementById("searchInput");
const countInfo = document.getElementById("countInfo");
const storageInfo = document.getElementById("storageInfo");

const detailKisi = document.getElementById("detailKisi");
const backBtn = document.getElementById("backBtn");
const deleteBtn = document.getElementById("deleteBtn");
const downloadBtn = document.getElementById("downloadBtn");
const detailJudul = document.getElementById("detailJudul");
const detailContent = document.getElementById("detailContent");
const detailMeta = document.getElementById("detailMeta");

const listToolbar = document.getElementById("listToolbar");
const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");
const cancelSelectBtn = document.getElementById("cancelSelectBtn");
const clearAll = document.getElementById("clearAllBtn");

let isSelecting = false;
let selectedIndexes = new Set();

// Helper: get data
function getData() {
  return JSON.parse(localStorage.getItem("cloudora_files") || "[]");
}
function setData(data) {
  localStorage.setItem("cloudora_files", JSON.stringify(data));
  updateStorageInfo();
}

// Update storage usage (approx)
function updateStorageInfo() {
  try {
    const all = localStorage.getItem("cloudora_files") || "";
    const bytes = new Blob([all]).size;
    const kb = Math.round(bytes / 1024);
    storageInfo.textContent = `Storage: ${kb} KB`;
  } catch (e) {
    storageInfo.textContent = "Storage: —";
  }
}

// Label behavior
fileInput.addEventListener("click", () => fileLabel.classList.add("active"));
fileInput.addEventListener("change", () => {
  fileLabel.classList.remove("active");
  if (fileInput.files.length > 0) {
    fileLabel.classList.add("selected");
    fileLabel.textContent = "File Dipilih: " + fileInput.files[0].name;
  } else {
    fileLabel.classList.remove("selected");
    fileLabel.textContent = "Choose File";
  }
});

// Save file
saveBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  const titleRaw = inputJudul.value.trim();
  const title = titleRaw || (file ? file.name : `File ${new Date().toLocaleString()}`);

  if (!file) { alert("Pilih file dulu!"); return; }

  // size check: warn if > 3MB
  if (file.size > 3 * 1024 * 1024) {
    const ok = confirm("File besar (lebih dari 3MB). Menyimpan mungkin gagal di localStorage. Lanjutkan?");
    if (!ok) return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result; // text or dataURL
    const data = getData();
    data.push({
      id: Date.now(),
      title: title,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      content: content,
      time: new Date().toISOString()
    });

    try {
      setData(data);
      renderList();
      // reset inputs
      inputJudul.value = "";
      fileInput.value = "";
      fileLabel.textContent = "Choose File";
      fileLabel.classList.remove("selected");
    } catch (err) {
      alert("Gagal menyimpan: kemungkinan melebihi batas LocalStorage.");
      console.error(err);
    }
  };

  if (file.type.startsWith("text/")) {
    reader.readAsText(file);
  } else {
    reader.readAsDataURL(file); // base64 for binary
  }
});

// Render list
function renderList(filter = "") {
  const data = getData();
  daftarKisi.innerHTML = "";

  const filtered = data.filter(item => item.title.toLowerCase().includes(filter.toLowerCase()));
  countInfo.textContent = `${filtered.length} file`;

  if (filtered.length === 0) {
    daftarKisi.innerHTML = `<li class="muted">Belum ada file yang sesuai.</li>`;
    return;
  }

  filtered.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "file-item";

    // Checkbox for multi-select
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.className = "file-checkbox";
    chk.title = "Pilih untuk hapus";
    chk.checked = selectedIndexes.has(item.id);
    chk.addEventListener("change", (ev) => {
      if (ev.target.checked) selectedIndexes.add(item.id);
      else selectedIndexes.delete(item.id);
      updateSelectMode();
    });

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<b>${escapeHtml(item.title)}</b><div class="file-name-small">${escapeHtml(item.name)} • ${formatSize(item.size)}</div>`;

    const actions = document.createElement("div");
    actions.className = "actions";

    const openBtn = document.createElement("button");
    openBtn.className = "btn";
    openBtn.textContent = "Buka";
    openBtn.onclick = () => openDetailById(item.id);

    const dlBtn = document.createElement("button");
    dlBtn.className = "btn";
    dlBtn.textContent = "Download";
    dlBtn.onclick = () => downloadDataUrl(item.content, item.name);

    actions.appendChild(openBtn);
    actions.appendChild(dlBtn);

    li.appendChild(chk);
    li.appendChild(meta);
    li.appendChild(actions);

    daftarKisi.appendChild(li);
  });

  updateStorageInfo();
}

// Utilities
function escapeHtml(s){ if(!s) return ""; return s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function formatSize(bytes){
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024*1024) return Math.round(bytes/1024) + " KB";
  return (bytes/(1024*1024)).toFixed(2) + " MB";
}

function downloadDataUrl(dataUrl, filename){
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Open detail by id
function openDetailById(id){
  const data = getData();
  const item = data.find(d => d.id === id);
  if (!item) return alert("File tidak ditemukan.");

  // show viewer
  detailKisi.classList.remove("hidden");
  document.querySelector("main").scrollTo({ top: 0, behavior: "smooth" });
  // fill data
  detailJudul.textContent = item.title;
  detailMeta.textContent = `${item.name} • ${formatSize(item.size)} • ${new Date(item.time).toLocaleString()}`;

  detailContent.innerHTML = ""; // reset
  deleteBtn.onclick = () => deleteById(id);
  downloadBtn.onclick = () => downloadDataUrl(item.content, item.name);

  // Choose rendering method
  if (item.type && item.type.startsWith("text/")) {
    const pre = document.createElement("pre");
    pre.textContent = item.content;
    detailContent.appendChild(pre);
  } else if (item.type && item.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = item.content;
    img.alt = item.name;
    detailContent.appendChild(img);
  } else if (item.type && item.type.startsWith("audio/")) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = item.content;
    detailContent.appendChild(audio);
  } else if (item.type && item.type.startsWith("video/")) {
    const video = document.createElement("video");
    video.controls = true;
    video.src = item.content;
    video.style.maxHeight = "420px";
    detailContent.appendChild(video);
  } else if (item.name.endsWith(".pdf") && item.content.startsWith("data:application/pdf")) {
    // embed pdf
    const iframe = document.createElement("iframe");
    iframe.src = item.content;
    iframe.style.width = "100%";
    iframe.style.minHeight = "480px";
    detailContent.appendChild(iframe);
  } else {
    // fallback: show download link and metadata
    const info = document.createElement("div");
    info.className = "muted";
    info.innerHTML = `Preview tidak tersedia. <br><br>`;
    const a = document.createElement("a");
    a.href = item.content;
    a.download = item.name;
    a.textContent = `📥 Download ${item.name}`;
    info.appendChild(a);
    detailContent.appendChild(info);
  }

  // hide list view
  document.querySelector(".list-card").scrollIntoView({ behavior: "smooth" });
  document.querySelector(".list-card").classList.add("hidden");
  document.querySelector(".upload-card").classList.add("hidden");
  document.querySelector(".controls").classList.add("hidden");
}

// Back button
backBtn.addEventListener("click", () => {
  detailKisi.classList.add("hidden");
  document.querySelector(".list-card").classList.remove("hidden");
  document.querySelector(".upload-card").classList.remove("hidden");
  document.querySelector(".controls").classList.remove("hidden");
  renderList(searchInput.value || "");
});

// Delete single by id
function deleteById(id){
  if (!confirm("Yakin ingin menghapus file ini?")) return;
  let data = getData();
  data = data.filter(d => d.id !== id);
  setData(data);
  backBtn.click();
  renderList();
}

// Search
searchInput.addEventListener("input", (e) => renderList(e.target.value));

// Multi-select mode
function updateSelectMode(){
  if (selectedIndexes.size > 0) {
    listToolbar.classList.remove("hidden");
    document.querySelectorAll(".file-checkbox").forEach(ch => ch.parentElement.classList.add("selected-item"));
  } else {
    listToolbar.classList.add("hidden");
    document.querySelectorAll(".file-checkbox").forEach(ch => ch.parentElement.classList.remove("selected-item"));
  }
}

deleteSelectedBtn.addEventListener("click", () => {
  if (!confirm(`Hapus ${selectedIndexes.size} file terpilih?`)) return;
  let data = getData();
  data = data.filter(d => !selectedIndexes.has(d.id));
  setData(data);
  selectedIndexes.clear();
  renderList();
});

cancelSelectBtn.addEventListener("click", () => {
  selectedIndexes.clear();
  renderList();
});

// Clear all
clearAll.addEventListener("click", () => {
  if (!confirm("Hapus semua file dari Cloudora?")) return;
  localStorage.removeItem("cloudora_files");
  renderList();
  updateStorageInfo();
});

// Initial render
function init(){
  renderList();
  updateStorageInfo();
}
init();
