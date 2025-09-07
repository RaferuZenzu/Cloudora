/* ===================================================
   Cloudora — script.js (IndexedDB version)
   - Multi-file upload
   - Preview text/image/audio/video/pdf
   - Download
   - Delete single / selected files
   - IndexedDB, no server
   =================================================== */

/* ============================
   IndexedDB helper
   ============================ */
const DB_NAME = "cloudora_db";
const DB_STORE = "files";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        const store = db.createObjectStore(DB_STORE, { keyPath: "id" });
        store.createIndex("title", "title", { unique: false });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function idbAdd(item) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    const req = store.add(item);
    req.onsuccess = () => resolve(true);
    req.onerror = e => reject(e.target.error);
  }));
}

function idbGetAll() {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => reject(e.target.error);
  }));
}

function idbGet(id) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => reject(e.target.error);
  }));
}

function idbDelete(id) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = e => reject(e.target.error);
  }));
}

function idbClearAll() {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    const req = store.clear();
    req.onsuccess = () => resolve(true);
    req.onerror = e => reject(e.target.error);
  }));
}

/* ============================
   DOM references
   ============================ */
const fileInput = document.getElementById("fileInput");
const inputJudul = document.getElementById("inputJudul");
const saveBtn = document.getElementById("saveBtn");
const fileLabel = document.getElementById("fileLabel");

const daftarKisi = document.getElementById("daftarKisi");
const searchInput = document.getElementById("searchInput");
const countInfo = document.getElementById("countInfo");
const storageInfo = document.getElementById("storageInfo");

const listToolbar = document.getElementById("listToolbar");
const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");
const cancelSelectBtn = document.getElementById("cancelSelectBtn");

const detailKisi = document.getElementById("detailKisi");
const backBtn = document.getElementById("backBtn");
const downloadBtn = document.getElementById("downloadBtn");
const deleteBtn = document.getElementById("deleteBtn");
const detailJudul = document.getElementById("detailJudul");
const detailMeta = document.getElementById("detailMeta");
const detailContent = document.getElementById("detailContent");

/* ============================
   State
   ============================ */
let selectedIds = new Set(); // file yang dicentang
let lastRender = []; 
let activeViewerId = null;

/* ============================
   Utilities
   ============================ */
function uid() { return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,9); }
function formatSize(bytes){
  if(typeof bytes!=="number") return "-";
  if(bytes<1024) return bytes+" B";
  if(bytes<1024*1024) return (bytes/1024).toFixed(0)+" KB";
  return (bytes/(1024*1024)).toFixed(2)+" MB";
}
function escapeHtml(s){ return s? s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])):""; }

/* ============================
   Storage info
   ============================ */
async function computeStoredBytes(){
  const all = await idbGetAll();
  return all.reduce((sum,it)=>sum+(it.size||0),0);
}
async function updateStorageInfo(){
  const bytes = await computeStoredBytes();
  storageInfo.textContent = `Storage: ${formatSize(bytes)} (est.)`;
}

/* ============================
   Render list
   ============================ */
async function renderList(filter=""){
  daftarKisi.innerHTML="";
  selectedIds.clear();

  let all = await idbGetAll();
  all.sort((a,b)=>(b.time||0)-(a.time||0));
  lastRender = all.slice();

  const q = (filter||"").toLowerCase();
  const filtered = all.filter(item=>(item.title||item.name||"").toLowerCase().includes(q));
  countInfo.textContent=`${filtered.length} file`;

  if(filtered.length===0){
    daftarKisi.innerHTML=`<li class="muted">Belum ada file yang sesuai.</li>`;
    await updateStorageInfo();
    listToolbar.classList.add("hidden");
    return;
  }

  filtered.forEach(item=>{
    const li=document.createElement("li");
    li.className="file-item";

    const chk=document.createElement("input");
    chk.type="checkbox";
    chk.className="file-checkbox";
    chk.dataset.id=item.id;
    chk.checked=selectedIds.has(item.id);
    chk.addEventListener("change",e=>{
      if(e.target.checked) selectedIds.add(item.id);
      else selectedIds.delete(item.id);
      updateToolbarState();
    });

    const meta=document.createElement("div");
    meta.className="meta";
    meta.innerHTML=`<b>${escapeHtml(item.title||item.name)}</b><div class="file-name-small">${escapeHtml(item.name)} • ${formatSize(item.size)}</div>`;

    const actions=document.createElement("div");
    actions.className="actions";
    const openBtn=document.createElement("button");
    openBtn.className="btn";
    openBtn.textContent="Buka";
    openBtn.addEventListener("click",()=>openViewer(item.id));
    const dlBtn=document.createElement("button");
    dlBtn.className="btn";
    dlBtn.textContent="Download";
    dlBtn.addEventListener("click",()=>downloadFromRecord(item));
    actions.appendChild(openBtn); actions.appendChild(dlBtn);

    li.appendChild(chk);
    li.appendChild(meta);
    li.appendChild(actions);
    daftarKisi.appendChild(li);
  });

  updateToolbarState();
  await updateStorageInfo();
}

/* ============================
   Toolbar state
   ============================ */
function updateToolbarState(){
  if(selectedIds.size>0) listToolbar.classList.remove("hidden");
  else listToolbar.classList.add("hidden");
}

/* ============================
   Save files
   ============================ */
saveBtn.addEventListener("click", async ()=>{
  const files=Array.from(fileInput.files||[]);
  if(!files.length) return alert("Pilih file terlebih dahulu.");
  const titleInput=inputJudul.value.trim();

  for(let file of files){
    const id=uid();
    const record={id,title:titleInput||file.name,name:file.name,type:file.type||"application/octet-stream",size:file.size,time:Date.now(),blob:file};
    try{await idbAdd(record);}
    catch(err){
      const arr=await file.arrayBuffer();
      record.blob=new Blob([arr],{type:file.type});
      await idbAdd(record);
    }
  }

  inputJudul.value=""; fileInput.value="";
  await renderList(searchInput.value||"");
});

/* ============================
   Open viewer
   ============================ */
async function openViewer(id){
  const rec=await idbGet(id);
  if(!rec) return alert("File tidak ditemukan.");

  activeViewerId=id;
  detailKisi.classList.remove("hidden");
  document.querySelector(".list-card").classList.add("hidden");
  document.querySelector(".upload-card").classList.add("hidden");
  document.querySelector(".controls").classList.add("hidden");

  detailJudul.textContent=rec.title||rec.name;
  detailMeta.textContent=`${rec.name} • ${formatSize(rec.size)} • ${new Date(rec.time).toLocaleString()}`;
  detailContent.innerHTML="";

  const blob=rec.blob instanceof Blob? rec.blob: null;
  if(blob){
    const url=URL.createObjectURL(blob);
    if(rec.type.startsWith("image/")){
      const img=document.createElement("img"); img.src=url; img.alt=rec.name; detailContent.appendChild(img);
    } else if(rec.type.startsWith("audio/")){
      const audio=document.createElement("audio"); audio.controls=true; audio.src=url; detailContent.appendChild(audio);
    } else if(rec.type.startsWith("video/")){
      const video=document.createElement("video"); video.controls=true; video.src=url; video.style.maxHeight="420px"; detailContent.appendChild(video);
    } else if(rec.type.startsWith("text/")){
      const text=await blob.text(); const pre=document.createElement("pre"); pre.textContent=text; detailContent.appendChild(pre);
    } else if(rec.name.toLowerCase().endsWith(".pdf")){
      const iframe=document.createElement("iframe"); iframe.src=url; iframe.style.width="100%"; iframe.style.minHeight="480px"; detailContent.appendChild(iframe);
    } else{
      const info=document.createElement("div"); info.className="muted"; info.innerHTML=`Preview tidak tersedia.<br><br>`;
      const a=document.createElement("a"); a.href=url; a.download=rec.name; a.textContent=`📥 Download ${rec.name}`; info.appendChild(a); detailContent.appendChild(info);
    }
    detailContent.dataset._objectUrl=url;
  }

  downloadBtn.onclick=()=>downloadRecord(rec);
  deleteBtn.onclick=async()=>{
    if(!confirm("Hapus file ini?")) return;
    await idbDelete(rec.id);
    backFromViewer();
    await renderList(searchInput.value||"");
  };
}

/* ============================
   Download
   ============================ */
async function downloadFromRecord(rec){const stored=await idbGet(rec.id);if(!stored)return alert("File tidak ditemukan."); await downloadRecord(stored);}
async function downloadRecord(rec){
  try{
    const blob=rec.blob instanceof Blob? rec.blob:null;
    if(!blob){ if(rec.content){ const a=document.createElement("a"); a.href=rec.content; a.download=rec.name; a.click(); return;} else return alert("Tidak ada data untuk di-download."); }
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=rec.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000);
  }catch(err){console.error("Download error",err); alert("Gagal menyiapkan download.");}
}

/* ============================
   Back from viewer
   ============================ */
function backFromViewer(){
  const url=detailContent.dataset._objectUrl;
  if(url){ try{URL.revokeObjectURL(url);}catch(e){} delete detailContent.dataset._objectUrl;}
  detailContent.innerHTML=""; detailKisi.classList.add("hidden");
  document.querySelector(".list-card").classList.remove("hidden");
  document.querySelector(".upload-card").classList.remove("hidden");
  document.querySelector(".controls").classList.remove("hidden");
  activeViewerId=null;
}
backBtn.addEventListener("click",backFromViewer);

/* ============================
   Bulk delete selected
   ============================ */
deleteSelectedBtn.addEventListener("click", async ()=>{
  if(selectedIds.size===0) return alert("Belum ada file dipilih.");
  if(!confirm(`Hapus ${selectedIds.size} file terpilih?`)) return;
  for(let id of Array.from(selectedIds)) await idbDelete(id);
  selectedIds.clear();
  await renderList(searchInput.value||"");
});

/* ============================
   Cancel selection
   ============================ */
cancelSelectBtn.addEventListener("click",()=>{selectedIds.clear(); renderList(searchInput.value||"");});

/* ============================
   Search
   ============================ */
searchInput.addEventListener("input",e=>renderList(e.target.value));

/* ============================
   Init
   ============================ */
(async function init(){
  try{await openDb(); await renderList(); await updateStorageInfo();}
  catch(err){console.error("Init error",err); alert("IndexedDB tidak tersedia atau error. Cek console.");}

  fileInput.addEventListener("change",()=>{
    if(fileInput.files.length>0){ fileLabel.classList.add("selected"); fileLabel.textContent=`${fileInput.files.length} file dipilih`; }
    else{ fileLabel.classList.remove("selected"); fileLabel.textContent="Pilih File (multi)";}
  });
})();
