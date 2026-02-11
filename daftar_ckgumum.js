// ==UserScript==
// @name         DAFTAR CKG UMUM
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Pendaftaran dan konfirmasi hadir
// @author       2026 © Adih Puskesmas Kosambi
// @match        https://sehatindonesiaku.kemkes.go.id/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// ==/UserScript==

(function() {
    'use strict';

    if (typeof window.lastActivity === 'undefined') {
        window.lastActivity = Date.now();
    }

    function reportProgress() {
        window.lastActivity = Date.now();
        console.log("Aktivitas Pendaftaran Tercatat: " + new Date(window.lastActivity).toLocaleTimeString());
    }

    const BASE_URL_DAFTAR = "https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu";
    const BASE_URL_LAYANAN = "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan";

     // ============================================================
    // 0. STORAGE ENGINE
    // ============================================================
    function setStorage(key, value) {
        try { localStorage.setItem(key, value); } catch(e){}
        try { GM_setValue(key, value); } catch(e){}
    }

    function getStorage(key) {
        let val = GM_getValue(key);
        if (!val) val = localStorage.getItem(key);
        return val;
    }

    function delStorage(key) {
        try { localStorage.removeItem(key); } catch(e){}
        try { GM_deleteValue(key); } catch(e){}
    }

    // ============================================================
    // 1. UI PANEL
    // ============================================================
    const style = document.createElement('style');
    style.innerHTML = `
        #asikPanel {
            position: fixed; top: 50px; right: 50px; width: 350px;
            background: #fff; border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 999999;
            font-family: 'Segoe UI', sans-serif; overflow: hidden;
            border: 1px solid #ccc; font-size: 12px;
        }
        #asikHeader {
            background: linear-gradient(90deg, #047857, #10b981);
            padding: 10px 15px; cursor: move; color: white;
            display: flex; justify-content: space-between; align-items: center;
        }
        #asikTitle { font-weight: bold; font-size: 13px; user-select: none; }
        .asik-btn-head {
            background: none; border: none; color: white; font-weight: bold;
            cursor: pointer; font-size: 16px; margin-left: 10px;
        }
        #asikBody { padding: 10px; background: #f8fafc; }
        .collapsed #asikBody { display: none; }

        .stats-container { display: flex; gap: 5px; margin-bottom: 10px; border-bottom:1px solid #e2e8f0; padding-bottom:10px; }
        .stat-box { flex: 1; text-align: center; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 5px; }
        .stat-val { font-size: 16px; font-weight: bold; display: block; }
        .stat-lbl { font-size: 9px; color: #64748b; text-transform: uppercase; }

        .file-upload-wrapper {
            position: relative; width: 100%; height: 70px;
            border: 2px dashed #334155; border-radius: 6px;
            display: flex; justify-content: center; align-items: center;
            background: #fff; color: #334155; cursor: pointer;
            transition: 0.2s; margin-bottom: 10px;
        }
        .file-upload-wrapper:hover { background: #e2e8f0; }
        .file-upload-text { font-weight: bold; text-align: center; pointer-events: none; }
        #importFile { position: absolute; width: 100%; height: 100%; top: 0; left: 0; opacity: 0; cursor: pointer; }

        .btn-group { display: flex; gap: 5px; margin-bottom: 10px; }
        button.action-btn {
            flex: 1; padding: 8px; border: none; border-radius: 4px;
            cursor: pointer; font-weight: bold; font-size: 12px; color: white;
            transition: 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        #btnClear { background: #ef4444; }
        #btnPause { background: #f59e0b; color: white; }
        #btnNext { background: #16a34a; width: 100%; font-size: 13px; padding: 10px; }
        #btnNext:disabled { background: #9ca3af; cursor: not-allowed; }

        #statusLog { font-size: 11px; color: #444; margin-top: 8px; border-top: 1px solid #e5e7eb; padding-top: 5px; font-family: monospace; }
        #logContainer {
            margin-top: 10px; border: 1px solid #cbd5e1; background: #fff;
            border-radius: 4px; max-height: 120px; overflow-y: auto;
            padding: 5px; font-size: 10px; font-family: monospace;
        }
        .log-item { border-bottom: 1px solid #eee; padding: 2px 0; display: flex; justify-content: space-between; }
        .log-success { color: #16a34a; font-weight: bold; }
        .log-fail { color: #dc2626; font-weight: bold; }
        .log-warn { color: #f97316; font-weight: bold; }
        .log-dup { color: #8b5cf6; font-weight: bold; }
        .log-time { color: #888; font-size: 9px; }
        #btnResetLog { float: right; font-size: 9px; color: #dc2626; background: none; border: none; cursor: pointer; text-decoration: underline; }
        .badge { background: #fff; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; color: #1e40af; border: 1px solid #1e40af; }
        #loopIndicator { font-size:10px; color: green; font-weight:bold; display:none; }
        #memoryStatus { font-size: 9px; color: blue; text-align: right; margin-bottom: 5px; display:none; }
    `;
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'asikPanel';
    panel.innerHTML = `
        <div id="asikHeader">
            <span id="asikTitle">🤖 Input CKG Umum</span>
            <div>
                <button class="asik-btn-head" id="btnMin">_</button>
                <button class="asik-btn-head" id="btnClose">X</button>
            </div>
        </div>
        <div id="asikBody">
            <div class="stats-container">
                <div class="stat-box">
                    <span id="cntSuccess" class="stat-val" style="color:#16a34a">0</span>
                    <span class="stat-lbl">Sukses</span>
                </div>
                <div class="stat-box">
                    <span id="cntFail" class="stat-val" style="color:#dc2626">0</span>
                    <span class="stat-lbl">Gagal</span>
                </div>
                <div class="stat-box">
                    <span id="cntQueue" class="stat-val" style="color:#2563eb">0</span>
                    <span class="stat-lbl">Antrian (Total)</span>
                </div>
            </div>

            <div id="memoryStatus">💾 Memori Tersimpan!</div>

            <div id="inputSection">
                <div class="file-upload-wrapper" id="dropZone">
                    <div class="file-upload-text" id="uploadText">📂 Klik / Tarik File Excel<br><span style="font-size:10px; font-weight:normal;">(.xlsx, .xls, .csv)</span></div>
                    <input type="file" id="importFile" accept=".xlsx, .xls, .csv">
                </div>
                <div class="btn-group">
                    <button id="btnClear" class="action-btn">🗑️ Reset</button>
                </div>
            </div>

            <div id="queueSection" style="display:none;">
                <div style="margin-bottom:5px; font-size:12px; display:flex; justify-content:space-between; align-items:center;">
                    <span>Sisa: <span id="queueCount" class="badge">0</span></span>
                    <button id="btnStopLoop" style="border:none; background:none; color:#dc2626; cursor:pointer; font-size:11px; text-decoration:underline;">Stop</button>
                </div>
                <div class="btn-group">
                    <button id="btnPause" class="action-btn">⏸️ Jeda (Pause)</button>
                </div>
                <div id="loopIndicator">♻️ AUTO RUNNING...</div>
                <button id="btnNext" class="action-btn">▶️ MULAI PROSES</button>
            </div>

            <div style="margin-top:10px;">
                <div style="display:flex; justify-content:space-between;">
                    <strong>📋 Riwayat Proses:</strong>
                    <button id="btnResetLog">Hapus Log</button>
                </div>
                <div id="logContainer">Belum ada data.</div>
            </div>

            <div id="statusLog">Siap... Silakan upload file.</div>
        </div>
    `;
    document.body.appendChild(panel);

    // --- UI LOGIC ---
    let isDragging = false, startX, startY, initialLeft, initialTop;
    const header = document.getElementById('asikHeader');
    header.addEventListener('mousedown', (e) => {
        isDragging = true; startX = e.clientX; startY = e.clientY;
        initialLeft = panel.offsetLeft; initialTop = panel.offsetTop;
        document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panel.style.left = `${initialLeft + (e.clientX - startX)}px`;
        panel.style.top = `${initialTop + (e.clientY - startY)}px`;
    });
    document.addEventListener('mouseup', () => { isDragging = false; document.body.style.userSelect = ''; });

    document.getElementById('btnMin').onclick = () => panel.classList.toggle('collapsed');
    document.getElementById('btnClose').onclick = () => { panel.style.display = 'none'; createReopenBtn(); };
    document.getElementById('btnResetLog').onclick = () => { delStorage('asik_logs'); renderLogs(); };

    function createReopenBtn() {
        if(document.getElementById('reopenBtn')) return;
        const btn = document.createElement('button');
        btn.id = 'reopenBtn';
        btn.innerText = '🤖';
        btn.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:999999; background:#047857; color:white; padding:15px; border:none; border-radius:50%; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.3); font-size:20px;';
        btn.onclick = () => { panel.style.display = 'block'; btn.remove(); };
        document.body.appendChild(btn);
    }

    // ============================================================
    // 2. EXCEL FILE HANDLER & VALIDATOR
    // ============================================================
    let dataQueue = [];
    let currentIndex = 0;
    let countSuccess = 0;
    let countFail = 0;

    document.getElementById('importFile').addEventListener('change', handleFileSelect, false);
    document.getElementById('btnClear').onclick = resetData;
    document.getElementById('btnStopLoop').onclick = resetData;

    // --- FIX RESUME BUTTON ---
    document.getElementById('btnPause').onclick = () => {
        const isAuto = getStorage('asik_autorun') === 'true';
        if (isAuto) {
            // PAUSE ACTION
            setStorage('asik_autorun', 'false');
            document.getElementById('btnPause').innerText = "▶️ Lanjut (Resume)";
            document.getElementById('btnPause').style.background = "#16a34a"; // Green
            document.getElementById('loopIndicator').innerText = "⏸️ PAUSED (Klik Resume)";
            document.getElementById('loopIndicator').style.color = "orange";
        } else {
            // RESUME ACTION
            setStorage('asik_autorun', 'true');
            document.getElementById('btnPause').innerText = "⏸️ Jeda (Pause)";
            document.getElementById('btnPause').style.background = "#f59e0b"; // Orange
            document.getElementById('loopIndicator').innerText = "♻️ AUTO RUNNING...";
            document.getElementById('loopIndicator').style.color = "green";
            forceResume();
        }
    };

    function forceResume() {
        if (window.location.href.includes('pendaftaran-individu')) {
            const btn = document.getElementById('btnNext');
            if (btn && !btn.disabled) { btn.click(); }
            else { window.location.reload(); }
        } else {
            //window.location.href = BASE_URL_DAFTAR;
        }
    }

    function handleFileSelect(evt) {
        const file = evt.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1, raw: false});

                if(jsonData.length > 0) jsonData.shift();
                let cleanData = jsonData.filter(row => row.length > 0 && (row[0] || row[1]));

                if(cleanData.length === 0) {
                    alert("File kosong!");
                    return;
                }

                // === STRICT VALIDATION LOOP ===
                const validData = [];
                const seenNIK = new Set();
                let skippedCount = 0;

                cleanData.forEach(row => {
                    let nik = (row[0] || '').toString().replace(/\D/g, '');
                    let nama = row[1] ? row[1].trim() : 'Tanpa Nama';

                    // 1. Validasi NIK (16 Digit)
                    if (nik.length !== 16) {
                        addLog('SKIP', nama, `NIK Salah (${nik.length}). Wajib 16.`);
                        skippedCount++;
                        return;
                    }

                    // 2. Validasi Nama (Hanya Huruf)
                    if (/[0-9]/.test(nama) || /[^a-zA-Z\s\.\,\'\-]/.test(nama)) {
                        addLog('SKIP', nama, `Nama Invalid (Isi Angka/Simbol).`);
                        skippedCount++;
                        return;
                    }

                    // 3. Cek Duplikat
                    if (seenNIK.has(nik)) {
                        addLog('DUP', nama, `NIK ${nik} Duplikat.`);
                        skippedCount++;
                        return;
                    }

                    seenNIK.add(nik);
                    validData.push(row.join('\t'));
                });

                dataQueue = validData;
                currentIndex = 0;
                countSuccess = 0;
                countFail = 0;
                saveState();

                document.getElementById('inputSection').style.display = 'none';
                document.getElementById('queueSection').style.display = 'block';
                updateQueueUI();

                log(`✅ Load OK: ${dataQueue.length} Data Valid.`);
                addLog('INFO', 'System', `Total Valid: ${dataQueue.length} | Dibuang: ${skippedCount}`);

            } catch(err) {
                console.error(err);
                alert("Gagal membaca file Excel!");
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function resetData() {
        if(confirm("Hapus semua antrian dan reset?")) {
            dataQueue = []; currentIndex = 0; countSuccess = 0; countFail = 0;
            delStorage('asik_queue');
            delStorage('asik_index');
            delStorage('asik_autorun');
            delStorage('asik_search_target');
            delStorage('asik_stats');

            document.getElementById('inputSection').style.display = 'block';
            document.getElementById('queueSection').style.display = 'none';
            document.getElementById('importFile').value = '';
            document.getElementById('memoryStatus').style.display = 'none';
            document.getElementById('uploadText').innerHTML = '📂 Klik / Tarik File Excel<br><span style="font-size:10px; font-weight:normal;">(.xlsx, .xls, .csv)</span>';
            updateStatsUI();
        }
    }

    // ============================================================
    // 3. LOGGING & STATE MANAGEMENT
    // ============================================================
    function addLog(status, name, details) {
        let logs = [];
        try { logs = JSON.parse(getStorage('asik_logs') || '[]'); } catch(e){}
        const time = new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
        logs.unshift({ status, name, details, time });
        if(logs.length > 50) logs.pop();
        setStorage('asik_logs', JSON.stringify(logs));
        renderLogs();
    }

    function renderLogs() {
        let logs = [];
        try { logs = JSON.parse(getStorage('asik_logs') || '[]'); } catch(e){}
        const container = document.getElementById('logContainer');
        if(logs.length === 0) {
            container.innerHTML = '<div style="color:#999; padding:5px;">Belum ada riwayat.</div>';
            return;
        }
        container.innerHTML = logs.map(log => {
            let statusClass = '';
            let icon = '';

            if (log.status === 'OK') { statusClass = 'log-success'; icon = '✅'; }
            else if (log.status === 'WARN') { statusClass = 'log-warn'; icon = '⚠️'; }
            else if (log.status === 'SKIP') { statusClass = 'log-warn'; icon = '⛔'; }
            else if (log.status === 'DUP') { statusClass = 'log-dup'; icon = '👯'; }
            else { statusClass = 'log-fail'; icon = '❌'; }

            return `
            <div class="log-item">
                <div>
                    <span class="${statusClass}">
                        ${icon} ${log.name}
                    </span>
                    <br><span style="color:#666; font-size:9px;">${log.details}</span>
                </div>
                <span class="log-time">${log.time}</span>
            </div>
            `;
        }).join('');
    }

    const log = (msg) => { document.getElementById('statusLog').innerText = msg; console.log(`[ASIK] ${msg}`); };
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    function saveState() {
        setStorage('asik_queue', JSON.stringify(dataQueue));
        setStorage('asik_index', currentIndex);
        setStorage('asik_stats', JSON.stringify({ ok: countSuccess, fail: countFail }));
        updateStatsUI();
    }

    function updateStatsUI() {
        document.getElementById('cntSuccess').innerText = countSuccess;
        document.getElementById('cntFail').innerText = countFail;
        // CHANGE: Menampilkan TOTAL DATA di kotak Antrian (bukan sisa)
        document.getElementById('cntQueue').innerText = dataQueue.length;
    }

    function loadState() {
        renderLogs();
        const storedQueue = getStorage('asik_queue');
        const storedIndex = getStorage('asik_index');
        const autoRun = getStorage('asik_autorun');
        const searchTarget = getStorage('asik_search_target');
        const stats = JSON.parse(getStorage('asik_stats') || '{"ok":0, "fail":0}');

        countSuccess = stats.ok;
        countFail = stats.fail;

        if (autoRun === 'false') {
            document.getElementById('btnPause').innerText = "▶️ Lanjut (Resume)";
            document.getElementById('btnPause').style.background = "#16a34a";
            document.getElementById('loopIndicator').innerText = "⏸️ PAUSED";
            document.getElementById('loopIndicator').style.color = "orange";
        }

        if (storedQueue) {
            try {
                dataQueue = JSON.parse(storedQueue);
                currentIndex = parseInt(storedIndex || '0');

                if (dataQueue.length > 0) {
                    document.getElementById('inputSection').style.display = 'none';
                    document.getElementById('queueSection').style.display = 'block';
                    document.getElementById('memoryStatus').style.display = 'block';
                    document.getElementById('memoryStatus').innerText = `💾 Memori: ${dataQueue.length - currentIndex} data tersisa`;

                    updateQueueUI();
                    log("♻️ Data antrian dipulihkan (V69.8).");

                    if (searchTarget && window.location.href.includes('ckg-pelayanan')) {
                        if (autoRun === 'false') return;
                        const searchData = JSON.parse(searchTarget);
                        delStorage('asik_search_target');
                        log(`🔎 Lanjut Cari di Layanan: ${searchData.name}`);
                        runServiceSearch(searchData);
                        return;
                    }

                    if (autoRun === 'true' && currentIndex < dataQueue.length) {
                        log("🚀 AUTO LOOP: Lanjut data berikutnya dalam 5 detik...");
                        document.getElementById('loopIndicator').style.display = 'block';

                        setTimeout(() => {
                            if (getStorage('asik_autorun') !== 'true') return;

                            if(window.location.href.includes('pendaftaran-individu')) {
                                document.getElementById('btnNext').click();
                            }
                            else if(window.location.href.includes('detail-pemeriksaan')) {
                                if (getStorage('asik_allow_exam')) {
                                    log("✅ Finalisasi Pemeriksaan...");
                                    delStorage('asik_allow_exam');
                                    clickMulaiPemeriksaan();
                                } else {
                                }
                            }
                            else if(window.location.href.includes('ckg-pelayanan')) {
                            }
                        }, 1000);
                    } else if (currentIndex >= dataQueue.length) {
                        log("✅ SEMUA DATA SELESAI.");
                        delStorage('asik_autorun');
                    }
                }
            } catch (e) {
                console.error("Error loading state", e);
            }
        }
        // CHANGE: Update Stats dipanggil setelah dataQueue diload agar angka Antrian Total muncul
        updateStatsUI();
    }

    loadState();

    function updateQueueUI() {
        const remaining = dataQueue.length - currentIndex;
        // CHANGE: Menampilkan hanya angka SISA di badge (contoh: 999)
        document.getElementById('queueCount').innerText = `${remaining}`;

        const btnNext = document.getElementById('btnNext');
        if(remaining > 0) {
            btnNext.disabled = false;
            const rowData = dataQueue[currentIndex].split('\t');
            const nextDataName = rowData[1] || "Data";
            btnNext.innerText = `▶️ PROSES: ${nextDataName} (${currentIndex + 1})`;
            btnNext.style.background = '#16a34a';
        } else {
            btnNext.disabled = true;
            btnNext.innerText = `✅ SELESAI SEMUA`;
            btnNext.style.background = '#9ca3af';
        }
    }

    document.getElementById('btnNext').onclick = async () => {
        setStorage('asik_autorun', 'true');
        document.getElementById('loopIndicator').innerText = "♻️ AUTO RUNNING...";
        document.getElementById('loopIndicator').style.color = "green";
        document.getElementById('btnPause').innerText = "⏸️ Jeda (Pause)";
        document.getElementById('btnPause').style.background = "#f59e0b";
        document.getElementById('loopIndicator').style.display = 'block';

        if (window.location.href.includes('detail-pemeriksaan')) {
            await clickMulaiPemeriksaan();
            return;
        }

        if(currentIndex >= dataQueue.length) return;
        const cols = dataQueue[currentIndex].split('\t');
        const rawNIK = cols[0] || '';
        const cleanNIK = rawNIK.replace(/\D/g, '');

        const data = {
            nik: cleanNIK,
            nama: cols[1]?.trim() || '',
            tglLahir: cols[2]?.trim() || '',
            gender: cols[3]?.trim().toLowerCase() || '',
            wa: cols[4]?.replace(/\D/g, '').replace(/^62|^0/, '') || '',
            pekerjaan: cols[5]?.trim() || '',
            alamat: cols[6]?.trim() || '',
            detail: cols[7]?.trim() || '',
            ticket: cols[8]?.trim() || ''
        };

        log(`⏳ Memproses: ${data.nama} (NIK: ${data.nik})...`);
        try {
            await fillForm(data);
        } catch (e) {
            console.error(e);
            log(`❌ Error: ${e.message}`);
            addLog('FAIL', data.nama, `Error: ${e.message}`);
            countFail++;
            saveState();
        }
    };

    // ============================================================
    // 4. FILL ENGINE
    // ============================================================
    async function forceDropdownNIK() {
        log("⚙️ Set Dropdown -> NIK...");
        const searchInput = document.querySelector('input[type="search"]') || document.querySelector('input.ant-input');
        if (!searchInput) return;

        const row = searchInput.closest('.ant-row') || document.body;
        const dropdownTrigger = row.querySelector('.ant-select-selector');

        if (dropdownTrigger) {
            if (!dropdownTrigger.innerText.includes("NIK")) {
                dropdownTrigger.click();
                await sleep(500);
                const items = document.querySelectorAll('.ant-select-item-option-content');
                for (let item of items) {
                    if (item.innerText.trim() === "NIK") {
                        item.click();
                        await sleep(500);
                        break;
                    }
                }
            }
        }
    }

    // --- NEW HELPER: FORCE DROPDOWN TO NAME ---
    async function forceDropdownName() {
        log("⚙️ Set Dropdown -> Nama...");
        const searchInput = document.querySelector('input[type="search"]') || document.querySelector('input.ant-input');
        if (!searchInput) return;

        const row = searchInput.closest('.ant-row') || document.body;
        const dropdownTrigger = row.querySelector('.ant-select-selector');

        if (dropdownTrigger) {
            // Jika bukan nama, klik
            if (!dropdownTrigger.innerText.toLowerCase().includes("nama")) {
                dropdownTrigger.click();
                await sleep(500);
                const items = document.querySelectorAll('.ant-select-item-option-content');
                for (let item of items) {
                    // Cari opsi yang mengandung "Nama"
                    if (item.innerText.toLowerCase().includes("nama")) {
                        item.click();
                        await sleep(500);
                        break;
                    }
                }
            }
        }
    }

    async function fillForm(data) {
        log("➕ Mengklik '+ Daftar Baru'...");
        const btnDaftarBaru = getElementByXpath("//button[contains(., 'Daftar Baru')]") ||
                              getElementByXpath("//span[contains(text(), 'Daftar Baru')]");

        if (btnDaftarBaru) {
            (btnDaftarBaru.closest('button') || btnDaftarBaru).click();
            await sleep(1500);
        }

        await forceDropdownNIK(); // Di Pendaftaran Pakai NIK

        log("📝 Mengisi Formulir...");
        const inputs = Array.from(document.querySelectorAll('input'));
        const getInp = (s) => inputs.find(i => i.placeholder && i.placeholder.toLowerCase().includes(s));

        const inpNIK = document.querySelector('input[placeholder*="NIK"]') || inputs[0];
        if(inpNIK) {
            inpNIK.value = data.nik;
            inpNIK.dispatchEvent(new Event('input', {bubbles:true}));
            inpNIK.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, charCode: 13, bubbles: true }));
        }

        const inpNama = getInp('nama lengkap');
        if(inpNama) {
            inpNama.value = data.nama;
            inpNama.dispatchEvent(new Event('input', {bubbles:true}));
        }

        const inpWA = getInp('whatsapp');
        if(inpWA) {
            inpWA.value = data.wa;
            inpWA.dispatchEvent(new Event('input', {bubbles:true}));
        }

        if(data.tglLahir) {
            const parts = data.tglLahir.split('/');
            if(parts.length === 3) {
                await runCalendarRobot(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
        }
        await sleep(800);

        log("🚻 Gender...");
        let genderDropdown = null;
        const labels = Array.from(document.querySelectorAll('label, div'));
        const labelJK = labels.find(el => el.innerText && el.innerText.trim() === "Jenis Kelamin");
        if (labelJK) {
            const parentRow = labelJK.closest('.ant-row') || labelJK.parentElement.parentElement;
            if (parentRow) genderDropdown = parentRow.querySelector('.ant-select-selector');
        }
        if (!genderDropdown) genderDropdown = getElementByXpath("//span[contains(text(), 'Pilih jenis kelamin')]")?.parentElement;
        if (genderDropdown) {
            genderDropdown.click(); await sleep(1000);
            const targetText = data.gender.includes('laki') ? 'Laki-laki' : 'Perempuan';
            const allDivs = document.querySelectorAll('.ant-select-item-option-content, div, li, span');
            for(let el of allDivs) {
                if (el.innerText && el.innerText.trim() === targetText && el.offsetParent) {
                    el.click(); log(`✅ Gender: ${targetText}`); break;
                }
            }
        }

        if(data.pekerjaan) {
            log("💼 Pekerjaan...");
            const jobPlaceholder = getElementByXpath("//div[contains(text(), 'Pilih pekerjaan')]") ||
                                   getElementByXpath("//span[contains(text(), 'Pilih pekerjaan')]");
            if (jobPlaceholder) {
                jobPlaceholder.click();
                if(jobPlaceholder.parentElement) jobPlaceholder.parentElement.click();
                await sleep(1500);
                await searchModal('Cari pekerjaan', data.pekerjaan);
            }
        }

        if(data.alamat) {
            log("🏠 Alamat...");
            const parts = data.alamat.split(',').map(s=>s.trim());
            const addrTrigger = getElementByXpath("//div[contains(text(), 'Pilih alamat domisili')]") ||
                                getElementByXpath("//span[contains(text(), 'Pilih alamat domisili')]");
            if(addrTrigger) {
                addrTrigger.click();
                if(addrTrigger.parentElement) addrTrigger.parentElement.click();
                await sleep(1500);
                await searchModal('Cari Provinsi', parts[0]);
                await searchModal('Cari Kabupaten', parts[1]);
                await searchModal('Cari Kecamatan', parts[2]);
                await searchModal('Cari Kelurahan', parts[3]);
            }
        }
        await sleep(800);

        if(data.detail) {
            log("📝 Detail...");
            const detailArea = document.getElementById('detail-domisili');
            if(detailArea) {
                const proto = window.HTMLTextAreaElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
                setter.call(detailArea, data.detail);
                detailArea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        try {
            const today = new Date().getDate();
            const tglPeriksaLabel = getElementByXpath("//div[contains(text(), 'Tanggal Pemeriksaan')]");
            if (tglPeriksaLabel) {
                const dateBtn = getElementByXpath(`//div[contains(text(), 'Tanggal Pemeriksaan')]/following::button[.//span[text()='${today}']]`) ||
                                getElementByXpath(`//div[contains(text(), 'Tanggal Pemeriksaan')]/following::button[contains(., '${today}')]`);
                if (dateBtn) { dateBtn.click(); log(`✅ Tgl: ${today}`); }
            }
        } catch (err) { console.log(err); }
        await sleep(500);

        log("🔘 Klik Selanjutnya...");
        const nextBtn = getElementByXpath("//button[contains(., 'Selanjutnya')]") ||
                        document.querySelector('button[type="submit"]');
        if (nextBtn) {
            nextBtn.click();
            await sleep(3500);
        } else {
            log("⚠️ Tombol 'Selanjutnya' hilang/macet. Melakukan Reload...");
            addLog('WARN', data.nama, 'Next Button Missing -> Auto Retry');
            window.location.reload();
            return;
        }

        log("👇 Klik 'Pilih'...");
        const pilihBtn = getElementByXpath("//button[.//div[contains(text(), 'Pilih')]]") ||
                         getElementByXpath("//button[contains(text(), 'Pilih')]");
        if (pilihBtn) { pilihBtn.click(); await sleep(1500); }

        log("📝 Klik 'Daftarkan'...");
        const daftarBtn = getElementByXpath("//button[.//div[contains(text(), 'Daftarkan dengan NIK')]]") ||
                          getElementByXpath("//button[contains(text(), 'Daftarkan dengan NIK')]");
        if (daftarBtn) { daftarBtn.click(); await sleep(2500); }

        const checkWaliDiv = document.querySelector('div.check#noWali') || document.getElementById('noWali');
        if (checkWaliDiv) {
            checkWaliDiv.click();
            await sleep(800);
            const daftarWaliBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Daftar');
            if (daftarWaliBtn) { daftarWaliBtn.click(); await sleep(2500); }
        }

        const errorOkBtn = getElementByXpath("//button[contains(@class, 'btn-fill-warning')]//div[contains(text(), 'Ok')]") ||
                           getElementByXpath("//button[contains(@class, 'btn-fill-warning') and contains(., 'Ok')]");
        if (errorOkBtn) {
            log("❌ ERROR DUKCAPIL! Skipping & Reload...");
            const clickTarget = errorOkBtn.closest('button') || errorOkBtn;
            clickTarget.click();
            addLog('FAIL', data.nama, 'Error Dukcapil/Server');
            countFail++;
            saveState();
            await sleep(1000);
            currentIndex++;
            saveState();
            window.location.reload();
            return;
        }

        log("❌ Klik 'Tutup'...");
        const tutupBtn = getElementByXpath("//button[.//div[contains(text(), 'Tutup')]]") ||
                         getElementByXpath("//button[contains(text(), 'Tutup')]");
        if (tutupBtn) { tutupBtn.click(); await sleep(1500); }

        const searchInput = document.querySelector('input[placeholder*="Masukkan"]') || document.querySelector('input.ant-input');
        if (searchInput) {
            await forceDropdownNIK();
            const keyword = data.nik;
            const proto = window.HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
            setter.call(searchInput, keyword);
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, charCode: 13, bubbles: true }));

            const searchIcon = document.querySelector('.anticon-search');
            if(searchIcon) searchIcon.click();
            await sleep(1000);
        }

        const statusHadir = getElementByXpath("//span[contains(@class, 'ant-tag') and contains(text(), 'Hadir')]") ||
                            getElementByXpath("//div[contains(text(), 'Sudah Hadir')]");

        if (statusHadir) {
            log("⏩ Status sudah 'Hadir'. Melakukan Scraping & Handover...");
            await scrapeAndRedirect(data);
            return;
        }

        const konfirmasiBtn = getElementByXpath("//button[.//div[contains(text(), 'Konfirmasi Hadir')]]") ||
                              getElementByXpath("//div[contains(text(), 'Konfirmasi Hadir')]");
        if (konfirmasiBtn && konfirmasiBtn.offsetParent !== null) {
            (konfirmasiBtn.closest('button') || konfirmasiBtn).click();
            await sleep(1000);
        }

        const checkDiv = document.querySelector('div.check#verify') || document.getElementById('verify');
        if(checkDiv) {
            checkDiv.click();
            const hiddenInput = document.querySelector('input[type="checkbox"]#verify');
            if(hiddenInput && !hiddenInput.checked) hiddenInput.click();
        }
        await sleep(1000);

        let attempts = 0;
        let hadirSuccess = false;
        while (attempts < 5) {
            const btns = Array.from(document.querySelectorAll('button'));
            const hadirBtn = btns.find(b => b.innerText && b.innerText.trim() === 'Hadir' && b.offsetParent !== null);
            if (hadirBtn) {
                const isActive = !hadirBtn.disabled && !hadirBtn.classList.contains('disabled') && hadirBtn.classList.contains('btn-fill-primary');
                if (isActive) {
                    hadirBtn.click();
                    hadirSuccess = true;
                    break;
                }
            }
            await sleep(1000);
            attempts++;
        }

        if(hadirSuccess) {
            await sleep(1000);
            await scrapeAndRedirect(data);
        } else {
            const searchData = { name: data.nama, ticket: data.ticket };
            setStorage('asik_search_target', JSON.stringify(searchData));
            window.location.href = BASE_URL_LAYANAN;
            return;
        }
    }

    async function scrapeAndRedirect(data) {
        let scrapedQueue = "Unknown";
        try {
            const queueEl = document.querySelector('.ant-typography h1') ||
                            getElementByXpath("//div[contains(@class, 'ant-card')]//span[contains(text(), '-')]");
            if (queueEl) scrapedQueue = queueEl.innerText;
        } catch(e) {}

        log(`📦 Scraping Selesai. Antrian: ${scrapedQueue}. Menyimpan Data.`);

        const searchPayload = {
            mode: 'NAME', // Set mode to NAME for next page
            value: data.nik,
            name: data.nama,
            queue: scrapedQueue
        };
        setStorage('asik_search_target', JSON.stringify(searchPayload));

        window.location.href = BASE_URL_LAYANAN;
    }

    // ============================================================
    // 5. HELPER FUNCTIONS
    // ============================================================
    function getElementByXpath(path) {
        return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }

    async function runCalendarRobot(day, monthIdx, year) {
        reportProgress();

        const container = document.getElementById('Tanggal Lahir');
        if(!container) return;
        const wrapper = container.querySelector('.mx-input-wrapper') || container;
        wrapper.click();
        await sleep(1000);
        const headerBtn = document.querySelector('.mx-btn-current-year') || document.querySelector('.mx-calendar-header-label button');
        if(headerBtn) { headerBtn.click(); await sleep(500); }
        else {
            const headers = document.querySelectorAll('.mx-calendar-header-label');
            if(headers.length>0) headers[0].click();
            await sleep(500);
        }
        if(!document.querySelector('.mx-table-year')) {
             const headers = document.querySelectorAll('.mx-calendar-header-label');
             if(headers.length>0) headers[0].click();
             await sleep(500);
        }
        for(let i=0; i<30; i++) {
            const yearCells = Array.from(document.querySelectorAll('.mx-table-year td'));
            const targetCell = yearCells.find(td => td.innerText.trim() == year);
            if(targetCell) { targetCell.click(); break; }
            const prevBtn = document.querySelector('.mx-icon-double-left');
            if(prevBtn) { prevBtn.click(); await sleep(400); } else break;
        }
        await sleep(800);
        const monthCells = document.querySelectorAll('.mx-table-month td');
        if(monthCells[monthIdx]) monthCells[monthIdx].click();
        await sleep(800);
        const dateCells = Array.from(document.querySelectorAll('.mx-table-date td'));
        const validCells = dateCells.filter(td => !td.classList.contains('not-current-month') && !td.classList.contains('disabled'));
        const targetDate = validCells.find(td => td.innerText.trim() == day);
        if(targetDate) targetDate.click();
    }

    async function searchModal(ph, kw) {
        reportProgress();
        const inputs = Array.from(document.querySelectorAll('input'));
        const inp = inputs.find(i => i.placeholder && i.placeholder.toLowerCase().includes(ph.toLowerCase()) && i.offsetParent);
        if(!inp) return;
        const proto = window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
        setter.call(inp, kw);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(1000);
        let target = getElementByXpath(`//div[normalize-space(text())='${kw}']`);
        if(!target) target = getElementByXpath(`//span[normalize-space(text())='${kw}']`);
        if (target && target.offsetParent) {
            target.click(); await sleep(1000); return;
        }
        const items = document.querySelectorAll('.ant-select-item-option-content, div, span, li');
        for(let item of items) {
            if(item.tagName !== 'INPUT' && item.offsetParent !== null && item.innerText) {
                if(item.innerText.trim() === kw) {
                    item.click(); await sleep(1000); return;
                }
            }
        }
    }

    async function runServiceSearch(searchData) {
        reportProgress();
        const keyword = searchData.name;

        log(`🔎 Search Layanan (Auto Nama): ${keyword}...`);
        await sleep(3000);

        // --- CHANGE: FORCE DROPDOWN NAME IN SERVICE ---
        await forceDropdownName();

        const searchInput = document.querySelector('input[type="search"]') ||
                            document.querySelector('.ant-input-search input') ||
                            document.querySelector('input');
        if(searchInput) {
            const proto = window.HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
            setter.call(searchInput, keyword);
            searchInput.dispatchEvent(new Event('input', {bubbles:true}));
            searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
            await sleep(3000);
        }

        const btns = Array.from(document.querySelectorAll('button'));
        const mulaiBtn = btns.find(b => b.innerText && b.innerText.includes('Mulai'));

        if(mulaiBtn) {
             log("🚀 Tombol Mulai ditemukan. Klik...");
             setStorage('asik_allow_exam', 'true');
             setStorage('asik_autorun', 'true');
             mulaiBtn.click();
             await sleep(1000);
             await clickMulaiPemeriksaan();
             return;
        }

        log("❌ Gagal menemukan tombol Mulai. Skip.");
        addLog('FAIL', keyword, 'Tidak ketemu di Layanan');
        countFail++;
        saveState();
        currentIndex++;
        saveState();
        window.location.href = BASE_URL_DAFTAR;
    }

    async function clickMulaiPemeriksaan() {
        log("🩺 Cek status pemeriksaan...");
        let attempts = 0;
        let success = false;
        const currentName = dataQueue[currentIndex]?.split('\t')[1] || "Pasien";

        while(attempts < 10) {
            let startBtn = document.querySelector('button.btn-fill-primary.h-11');
            if (!startBtn) {
                startBtn = getElementByXpath("//button[.//div[contains(text(), 'Mulai Pemeriksaan')]]") ||
                           getElementByXpath("//button[contains(text(), 'Mulai Pemeriksaan')]");
            }
            const ongoingBadge = getElementByXpath("//span[contains(text(), 'Sedang Pemeriksaan')]") ||
                                 getElementByXpath("//div[contains(text(), 'Jumlah Pemeriksaan')]");

            if (startBtn && !startBtn.disabled) {
                startBtn.click();
                success = true;
                await sleep(1000);
                break;
            }
            if (ongoingBadge) {
                success = true;
                break;
            }
            await sleep(1000);
            attempts++;
        }

        if (success) {
            addLog('OK', currentName, 'Skrining');
            countSuccess++;
        } else {
            addLog('OK', currentName, 'Timeout (Asumsi Sukses)');
            countSuccess++;
        }

        currentIndex++;
        saveState();
        log(`♻️ RELOAD KE DATA KE-${currentIndex + 1}...`);

        if (getStorage('asik_autorun') === 'true') {
           // await sleep(1500);  <-- DIMATIKAN
           // window.location.href = BASE_URL_DAFTAR; <-- DIMATIKAN
           log("✅ Menunggu Script Skrining bekerja... (Tidak auto kembali)");
       } else {
           log("⏸️ PAUSED. Klik Resume untuk lanjut.");
       }
    }

})();