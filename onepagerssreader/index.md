---
title: Универсальный RSS/Atom-ридер
---

<!-- Управление подписками -->
<div id="feedList">
  <h3>Мои ленты</h3>
  <div>
    <input type="text" id="newFeedUrl" placeholder="URL RSS или Atom-ленты" />
  </div>
  <div>
    <input type="text" id="newFeedName" placeholder="Название ленты" disabled />
  </div>
  <div id="status"></div>
  <div class="controls">
    <button id="addButton" disabled onclick="addFeed()">Добавить в список</button>
    <button onclick="exportOPML()">Экспорт OPML</button>
    <input type="file" id="importFile" accept=".opml" style="display:none" />
    <button onclick="document.getElementById('importFile').click()">Импорт OPML</button>

    <!-- Новые кнопки -->
    <button onclick="exportQR()">Экспорт QR</button>
    <button onclick="openImportModal()">Импорт QR/ссылки/файла</button>
  </div>

  <div id="feedsContainer"></div>
</div>

<!-- Просмотр ленты -->
<div>
  <input type="text" id="urlInput" placeholder="Введите URL RSS/Atom-ленты" />
  <button onclick="loadCustomFeed()">Загрузить</button>
</div>

<!-- Настройки прокси -->
<div class="spoiler" onclick="toggleSpoiler()">🔧 Настройки прокси</div>
<div id="spoilerContent" class="spoiler-content">
  <div id="proxySettings">
    <p><label><input type="checkbox" id="proxyEnabled" checked /> Использовать прокси</label></p>
    <p><label>Адрес прокси:<br>
      <input type="text" id="proxyInput" value="https://cors-anywhere.herokuapp.com/" style="width:100%;" />
    </label></p>
    <p><button onclick="resetProxy()">Восстановить по умолчанию</button><br><small>При использовании cors-anywhere разово разрешите доступ: <a href="https://cors-anywhere.herokuapp.com/corsdemo" target="_blank">corsdemo</a></small></p>
  </div>
</div>

<!-- Feed output -->
<ul id="rssFeed"></ul>

<!-- QR Export Modal -->
<div id="qrModal" class="modal">
  <div class="box">
    <div id="qr"></div>
    <div id="qrNote" style="font-size:13px"></div>
    <div style="margin-top:8px;text-align:right"><button onclick="closeQR()">Закрыть</button></div>
    <div style="margin-top:8px;text-align:right"><button id="copyQR" onclick="copyQR()">Копировать ссылку со всеми подписками</button></div>
  </div>
</div>

<!-- Import Modal (camera / file / link) -->
<div id="importModal" class="modal">
  <div class="box">
    <div style="margin-bottom:8px;font-weight:700">Импорт подписок — камера / файл / ссылка</div>

    <!-- Кнопки-переключатели -->
    <div style="display:flex;gap:6px;margin-bottom:8px;">
      <button id="tabCamera">Камера</button>
      <button id="tabFile">Файл (картинка)</button>
      <button id="tabLink">Вставить ссылку</button>
    </div>

    <!-- Камера -->
    <div id="paneCamera" style="display:none">
      <video id="video" autoplay playsinline></video>
      <div style="margin-top:6px">Камера будет искать QR-код. Если сканирование прошло — импорт начнётся автоматически.</div>
      <div style="margin-top:6px;text-align:right"><button onclick="stopCameraAndClose()">Закрыть</button></div>
    </div>

    <!-- Загрузка изображения -->
    <div id="paneFile" style="display:none">
      <input type="file" id="qrImageFile" accept="image/*" />
      <div style="margin-top:8px;text-align:right"><button onclick="closeImportModal()">Закрыть</button></div>
    </div>

    <!-- Ввод ссылки -->
    <div id="paneLink" style="display:none">
      <input type="text" id="importLink" placeholder="Вставьте ссылку (или полный URL из QR)" style="width:100%" />
      <div style="margin-top:8px;text-align:right">
        <button onclick="processImportFromLink()">Импортировать</button>
        <button onclick="closeImportModal()">Закрыть</button>
      </div>
    </div>

    <!-- Скрытый canvas для разбора -->
    <canvas id="scanCanvas" style="display:none"></canvas>
  </div>
</div>

<script>
/* ====== Сохранённый функционал (localStorage, render, validate, add, OPML import/export, load feed) ====== */

let feeds = JSON.parse(localStorage.getItem('rssFeeds') || '[]');
let currentValidUrl = null;

function saveFeeds(){ localStorage.setItem('rssFeeds', JSON.stringify(feeds)); }

function renderFeeds(){
  const container = document.getElementById('feedsContainer');
  container.innerHTML = '';
  feeds.forEach((feed,i)=>{
    const div = document.createElement('div');
    div.className = 'feed-item';
    div.innerHTML = `<span><strong>${escapeHtml(feed.name)}</strong>: ${escapeHtml(feed.url)}</span>
      <button onclick="loadFeed(${i})">Загрузить</button>
      <button onclick="removeFeed(${i})">Удалить</button>`;
    container.appendChild(div);
  });
}

function removeFeed(index){
  feeds.splice(index,1);
  saveFeeds(); renderFeeds();
}

function loadFeed(index){
  document.getElementById('urlInput').value = feeds[index].url;
  loadCustomFeed();
}

/* элементы формы */
const urlInput = document.getElementById('newFeedUrl');
const nameInput = document.getElementById('newFeedName');
const status = document.getElementById('status');
const addButton = document.getElementById('addButton');

/* состояние формы */
function resetState(){
  nameInput.value=''; nameInput.disabled=true; status.innerHTML=''; status.className=''; addButton.disabled=true; currentValidUrl=null;
}
function setValid(title){ nameInput.value=title; nameInput.disabled=false; status.innerHTML=`<span class="success">Лента найдена: "${escapeHtml(title)}"</span>`; addButton.disabled=false; }
function setError(msg){ status.innerHTML=`<span class="error">Ошибка: ${escapeHtml(msg)}</span>`; addButton.disabled=true; nameInput.disabled=true; }

/* проверка URL ленты (использует тот же прокси) */
async function validateFeedUrl(url){
  status.innerHTML = '<span class="loading">Проверка ленты...</span>';
  addButton.disabled = true;
  const useProxy = document.getElementById('proxyEnabled').checked;
  const proxy = document.getElementById('proxyInput').value.trim();
  let finalUrl = url;
  if(useProxy && proxy){
    if(proxy === 'https://allorigins.win/raw?url=') finalUrl = proxy + encodeURIComponent(url);
    else finalUrl = proxy + url;
  }
  try{
    const resp = await fetch(finalUrl);
    if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    const parserError = xml.querySelector('parsererror');
    if(parserError) throw new Error('Недопустимый XML: возможно, это не RSS/Atom');
    const isAtom = xml.querySelector('feed') !== null;
    const isRss = xml.querySelector('rss') !== null || xml.querySelector('channel') !== null;
    if(!isAtom && !isRss) throw new Error('Не найдено RSS или Atom: проверьте URL');
    let titleNode = isAtom ? xml.querySelector('feed > title') : (xml.querySelector('channel > title') || xml.querySelector('rss > channel > title'));
    const title = titleNode ? titleNode.textContent.trim() : 'Без названия';
    setValid(title);
    currentValidUrl = url;
  }catch(err){
    console.error('Ошибка проверки ленты:', err);
    setError(err.message || err);
    currentValidUrl = null;
  }
}

/* авто-проверки */
urlInput.addEventListener('blur', ()=>{ const u = urlInput.value.trim(); if(!u){ resetState(); return; } validateFeedUrl(u); });
urlInput.addEventListener('paste', ()=>{ setTimeout(()=>{ const u=urlInput.value.trim(); if(u) validateFeedUrl(u); }, 10); });

/* добавить ленту */
function addFeed(){
  const url = currentValidUrl;
  const name = nameInput.value.trim();
  if(!url || !name) return;
  if(feeds.some(f=>f.url===url)){ setError('Эта лента уже добавлена'); return; }
  feeds.push({ name, url });
  saveFeeds(); renderFeeds();
  urlInput.value=''; resetState();
}

/* загрузка и парсинг ленты (без изменений) */
async function loadFeedContent(url){
  const feedList = document.getElementById('rssFeed');
  feedList.innerHTML = '<li>Загрузка...</li>';
  const useProxy = document.getElementById('proxyEnabled').checked;
  const proxy = document.getElementById('proxyInput').value.trim();
  let finalUrl = url;
  if(useProxy && proxy){
    if(proxy === 'https://allorigins.win/raw?url=') finalUrl = proxy + encodeURIComponent(url);
    else finalUrl = proxy + url;
  }
  try{
    const r = await fetch(finalUrl);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const xmlText = await r.text();
    const xmlDoc = new DOMParser().parseFromString(xmlText, 'text/xml');
    if(xmlDoc.querySelector('parsererror')) throw new Error('Ошибка парсинга XML');
    const isAtom = xmlDoc.querySelector('feed') !== null;
    const isRss = xmlDoc.querySelector('rss') !== null || xmlDoc.querySelector('channel') !== null;
    let items = [], titleNode = null;
    if(isAtom){ items = xmlDoc.querySelectorAll('entry'); titleNode = xmlDoc.querySelector('feed > title'); }
    else if(isRss){ items = xmlDoc.querySelectorAll('item'); titleNode = xmlDoc.querySelector('channel > title') || xmlDoc.querySelector('rss > channel > title'); }
    else throw new Error('Неизвестный формат: ожидается RSS или Atom');
    const feedTitle = titleNode ? titleNode.textContent : 'Без названия';
    feedList.innerHTML = `<li><strong>Лента: ${escapeHtml(feedTitle)}</strong></li>`;
    if(items.length === 0){ feedList.innerHTML += '<li>Нет записей.</li>'; return; }
    items.forEach(item=>{
      let title = 'Без заголовка', link = '#';
      if(isAtom){
        const titleEl = item.querySelector('title'); title = titleEl ? titleEl.textContent : 'Без заголовка';
        const linkEl = item.querySelector('link[rel="alternate"]'); link = linkEl ? linkEl.getAttribute('href') : '#';
      } else {
        const titleEl = item.querySelector('title'); title = titleEl ? titleEl.textContent : 'Без заголовка';
        const linkEl = item.querySelector('link'); link = linkEl ? linkEl.textContent : '#';
      }
      const li = document.createElement('li');
      li.innerHTML = `<a href="${escapeHtml(link)}" target="_blank">${escapeHtml(title)}</a>`;
      feedList.appendChild(li);
    });
  }catch(err){
    feedList.innerHTML = `<li class="error">Ошибка: ${escapeHtml(err.message || err)}</li>`;
    console.error('Ошибка загрузки ленты:', err);
  }
}

function loadCustomFeed(){ const url = document.getElementById('urlInput').value.trim(); if(!url) return alert('Введите URL ленты'); loadFeedContent(url); }

/* OPML export/import (с сохранением поведения) */
function exportOPML(){
  const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
<head><title>Мои RSS-подписки</title></head>
<body>
${feeds.map(f => `<outline text="${escapeXmlAttr(f.name)}" type="rss" xmlUrl="${escapeXmlAttr(f.url)}"/>`).join('\n    ')}
</body>
</opml>`;
  const blob = new Blob([opml], { type: 'text/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'rss-feeds.opml'; a.click();
}

document.getElementById('importFile').addEventListener('change', async function(e){
  const file = e.target.files[0]; if(!file) return;
  const txt = await file.text();
  const xmlDoc = new DOMParser().parseFromString(txt, 'text/xml');
  const outlines = xmlDoc.querySelectorAll('outline[type="rss"], outline[xmlUrl]');
  if(outlines.length === 0){ alert('В файле не найдено ни одной RSS-ленты. Проверьте формат OPML.'); return; }
  let imported=0, already=0, invalid=0;
  const invalidUrls=[];
  const statusEl = document.getElementById('status');
  statusEl.innerHTML = `<span class="loading">Проверка и импорт ${outlines.length} лент...</span>`;
  addButton.disabled = true;
  async function isValidFeed(url){
    try{
      const useProxy = document.getElementById('proxyEnabled').checked;
      const proxy = document.getElementById('proxyInput').value.trim();
      let finalUrl = url;
      if(useProxy && proxy){ if(proxy === 'https://allorigins.win/raw?url=') finalUrl = proxy + encodeURIComponent(url); else finalUrl = proxy + url; }
      const r = await fetch(finalUrl);
      if(!r.ok) return false;
      const t = await r.text(); const x = new DOMParser().parseFromString(t,'text/xml');
      if(x.querySelector('parsererror')) return false;
      const isAtom = x.querySelector('feed') !== null;
      const isRss = x.querySelector('rss') !== null || x.querySelector('channel') !== null;
      return isAtom || isRss;
    }catch(e){ return false; }
  }
  for(let i=0;i<outlines.length;i++){
    const outline = outlines[i];
    const name = outline.getAttribute('text') || outline.getAttribute('title') || 'Без названия';
    const url = outline.getAttribute('xmlUrl') || outline.getAttribute('url') || '';
    if(!name || !url){ invalid++; invalidUrls.push(url || '(no url)'); continue; }
    if(feeds.some(f=>f.url === url)){ already++; continue; }
    const ok = await isValidFeed(url);
    if(!ok){ invalid++; invalidUrls.push(url); continue; }
    feeds.push({ name, url }); imported++;
  }
  saveFeeds(); renderFeeds();
  document.getElementById('newFeedUrl').value=''; resetState();
  let report = `✅ Импортировано: ${imported}\n🔁 Уже были: ${already}\n❌ Не валидны: ${invalid}`;
  if(invalid>0){ report += '\n\nСписок невалидных URL:\n' + invalidUrls.slice(0,10).join('\n'); if(invalidUrls.length>10) report += `\n... и ещё ${invalidUrls.length-10}`; }
  alert(report);
});

/* spoiler toggle and proxy reset */
function toggleSpoiler(){ const content = document.getElementById('spoilerContent'); content.style.display = content.style.display === 'block' ? 'none' : 'block'; }
function resetProxy(){ document.getElementById('proxyInput').value = 'https://cors-anywhere.herokuapp.com/'; }

/* util escape helpers */
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"]/g, c=> ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function escapeXmlAttr(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* Инициализация */
renderFeeds(); resetState();

/* ====== QR Export / Import (camera, file, link) ====== */

const MAX_FEEDS_FOR_QR = 100;           // ограничение по кол-ву подписок для QR
const MAX_QR_PAYLOAD = 1000;           // грубая проверка длины закодированных данных

function exportQR(){
  if(feeds.length === 0) return alert('Нет лент для экспорта');
  if(feeds.length > MAX_FEEDS_FOR_QR) return alert(`Слишком много лент для QR (максимум ${MAX_FEEDS_FOR_QR})`);
  // кодируем в base64 безопасно
  const json = JSON.stringify(feeds);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  if(base64.length > MAX_QR_PAYLOAD) return alert('Данные слишком длинные для QR. Сократите число подписок или имена.');
  const syncUrl = location.origin + location.pathname + '?sync=' + encodeURIComponent(base64);
  const copyQRButton = document.getElementById("copyQR").setAttribute("onClick", "setClipboard('"+syncUrl+"')" );
  const box = document.getElementById('qr');
  box.innerHTML = '';
  try{
    new QRCode(box, { text: syncUrl, width: 320, height: 320 });
    document.getElementById('qrNote').textContent = 'Отсканируйте QR на другом устройстве или откройте ссылку вручную.';
    document.getElementById('qrModal').style.display = 'flex';
  }catch(e){
    alert('Ошибка генерации QR: ' + (e.message || e));
  }
}
function closeQR(){ document.getElementById('qrModal').style.display = 'none'; document.getElementById('qr').innerHTML = ''; document.getElementById('qrNote').textContent=''; }

async function setClipboard(text) {
  const type = "text/plain";
  const clipboardItemData = {
    [type]: text,
  };
  const clipboardItem = new ClipboardItem(clipboardItemData);
  await navigator.clipboard.write([clipboardItem]);
}

/* Импорт: UI/логика */
const importModal = document.getElementById('importModal');
const paneCamera = document.getElementById('paneCamera');
const paneFile = document.getElementById('paneFile');
const paneLink = document.getElementById('paneLink');
const video = document.getElementById('video');
const canvas = document.getElementById('scanCanvas');
const ctx = canvas.getContext && canvas.getContext('2d');
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
let scanAnimationId = null;
let cameraStream = null;

if (isMobile) {
document.getElementById('tabCamera').addEventListener('click', ()=>{ ('camera'); });
} else document.getElementById('tabCamera').remove();
document.getElementById('tabFile').addEventListener('click', ()=>{ showPane('file'); });
document.getElementById('tabLink').addEventListener('click', ()=>{ showPane('link'); });

function openImportModal(){
  importModal.style.display = 'flex';
  // по умолчанию показываем камеру (если доступна), иначе файл
  if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && isMobile){
    showPane('camera');
  } else {
    showPane('file');
  }
}

function showPane(name){
  paneCamera.style.display = paneFile.style.display = paneLink.style.display = 'none';
  stopCameraLoop(); // при переключении останавливаем скан
  if(name === 'camera'){
    paneCamera.style.display = 'block';
    startCamera();
  } else if(name === 'file'){
    paneFile.style.display = 'block';
  } else {
    paneLink.style.display = 'block';
  }
}

/* camera scanning */
async function startCamera(){
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Камера недоступна в этом браузере');
    return;
  }
  try{
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = cameraStream;
    video.setAttribute('playsinline', true);
    await video.play();
    // устанавливаем canvas размер равный видеопотоку
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    scanLoop();
  }catch(err){
    console.error('camera error', err);
    alert('Не удалось получить доступ к камере: ' + (err.message || err));
    showPane('file');
  }
}

function scanLoop(){
  if(video.readyState !== video.HAVE_ENOUGH_DATA){
    scanAnimationId = requestAnimationFrame(scanLoop);
    return;
  }
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
  try{
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if(code && code.data){
      // найден QR — обрабатываем и закрываем
      processImportString(code.data);
      stopCameraAndClose();
      return;
    }
  }catch(e){
    // jsQR может бросать — игнорируем
    console.error('jsQR err', e);
  }
  scanAnimationId = requestAnimationFrame(scanLoop);
}

function stopCameraLoop(){
  if(scanAnimationId){ cancelAnimationFrame(scanAnimationId); scanAnimationId = null; }
}

function stopCameraAndClose(){
  stopCameraLoop();
  if(cameraStream){
    cameraStream.getTracks().forEach(t=>t.stop());
    cameraStream = null;
  }
  video.pause(); video.srcObject = null;
  importModal.style.display = 'none';
}

/* закрыть импорт (если открыто) */
function closeImportModal(){
  stopCameraAndClose();
  importModal.style.display = 'none';
}

/* обработка выбора файла изображения с QR — исправлено */
document.getElementById('qrImageFile').addEventListener('change', async function(e){
  const file = e.target.files[0];
  if(!file) return;

  const img = new Image();
  img.crossOrigin = 'anonymous';

  img.onload = async () => {
    try {
      // иногда браузер не задаёт naturalWidth сразу — ждём decode()
      if (img.decode) { try { await img.decode(); } catch {} }

      const max = 1024;
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if(!w || !h) throw new Error('Неверное изображение');

      if (w > max || h > max) {
        const scale = Math.min(max / w, max / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && code.data) {
        processImportString(code.data);
        closeImportModal();
      } else {
        alert('QR-код не найден на изображении');
      }
    } catch (err) {
      console.error('Ошибка распознавания', err);
      alert('Ошибка распознавания изображения: ' + (err.message || err));
    }
  };

  img.onerror = () => alert('Не удалось загрузить изображение');

  const reader = new FileReader();
  reader.onload = () => { img.src = reader.result; };
  reader.readAsDataURL(file);
});


/* обработка вставленной ссылки из tabLink */
function processImportFromLink(){
  const val = document.getElementById('importLink').value.trim();
  if(!val) return alert('Вставьте ссылку с параметром sync или ссылку, содержащую QR-данные');
  processImportString(val);
  closeImportModal();
}

/* общий парсер входной строки:
   - если это полный URL с param sync -> извлекаем
   - если это просто base64 -> пытаемся декодировать
   - если это ссылка без sync -> пробуем распознать как OPML или ошибку
*/
function processImportString(input){
  try{
    let base64 = null;
    // если это URL - ищем параметр sync
    try{
      const u = new URL(input);
      base64 = u.searchParams.get('sync') || null;
    }catch(e){ /* не URL */ }

    // если не URL и выглядит как прямой base64 (возможно кодирован) - пробуем
    if(!base64){
      // часто QR содержит прямо URL; если input похоже на base64 -> берем его
      const maybe = input.trim();
      if(/^[A-Za-z0-9\-_]+=*$/.test(maybe) && maybe.length > 10) base64 = maybe;
    }

    if(!base64){
      // возможно это опция: QR содержит прямую ссылку на OPML (редко), или содержит OPML текст
      // пробуем распарсить как XML OPML
      if(maybeLooksLikeXML(input)){
        importOpmlText(input);
        return;
      }
      return alert('Не найден параметр sync или корректные данные в QR/ссылке');
    }

    // декодируем base64 -> json feeds
    let json;
    try{
      json = decodeURIComponent(escape(atob(decodeURIComponent(base64))));
    }catch(e){
      // иногда base64 передаётся как encodeURIComponent(base64)
      try{ json = decodeURIComponent(escape(atob(base64))); }catch(e2){ throw new Error('Не удалось декодировать данные'); }
    }
    const arr = JSON.parse(json);
    if(!Array.isArray(arr)) throw new Error('Неверный формат данных');
    let added = 0;
    for(const f of arr){
      if(!f || !f.url) continue;
      if(!feeds.some(x=>x.url === f.url)) { feeds.push({ name: f.name || f.url, url: f.url }); added++; }
    }
    saveFeeds(); renderFeeds();
    alert(`Импортировано ${added} новых лент`);
  }catch(err){
    console.error('import error', err);
    alert('Ошибка импорта: ' + (err.message || err));
  }
}

/* helper to check XML content quickly */
function maybeLooksLikeXML(s){
  return /<\?xml|<opml|<rss|<feed/i.test(s);
}

/* OPML import if we got opml text directly */
function importOpmlText(opmlText){
  try{
    const xmlDoc = new DOMParser().parseFromString(opmlText, 'text/xml');
    const outlines = xmlDoc.querySelectorAll('outline[type="rss"], outline[xmlUrl]');
    if(outlines.length === 0){ alert('OPML не содержит подписок'); return; }
    let added = 0;
    for(const o of outlines){
      const url = o.getAttribute('xmlUrl') || o.getAttribute('url');
      const name = o.getAttribute('text') || o.getAttribute('title') || url;
      if(!url) continue;
      if(!feeds.some(f=>f.url === url)){ feeds.push({ name, url }); added++; }
    }
    saveFeeds(); renderFeeds();
    alert(`Импортировано ${added} лент из OPML`);
  }catch(e){ alert('Ошибка разбора OPML'); }
}

/* Показать импорт-модал и управление вкладками реализованы выше */

/* Автоимпорт если ?sync=... в URL при загрузке страницы */
(function(){
  const params = new URLSearchParams(location.search);
  if(params.has('sync')){
    const raw = params.get('sync');
    if(raw){
      try{
        const dec = decodeURIComponent(raw);
        // try both variants
        let json = null;
        try{ json = decodeURIComponent(escape(atob(dec))); }catch(e){ try{ json = decodeURIComponent(escape(atob(raw))); }catch(e){} }
        if(json){
          const arr = JSON.parse(json);
          if(Array.isArray(arr)){
            let added = 0;
            for(const f of arr){
              if(!f || !f.url) continue;
              if(!feeds.some(x=>x.url === f.url)){ feeds.push({ name: f.name || f.url, url: f.url }); added++; }
            }
            saveFeeds(); renderFeeds();
            alert(`Импортировано ${added} лент из ссылки`);
          }
        }
      }catch(e){ /* ignore */ }
    }
    history.replaceState(null, '', location.pathname);
  }
})();

</script>
