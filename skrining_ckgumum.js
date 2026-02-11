// ==UserScript==
// @name         SKRINING CKG UMUM
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Pemeriksan mandiri dan pelayanan nakes + Auto Force Skip
// @author       2026 © Adih Puskesmas Kosambi
// @match        https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan*
// @match        https://form.kemkes.go.id/*
// @match        https://raw.githubusercontent.com/adihpkm/ckgumum.app/refs/heads/main/daftar_ckgumum.js
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // =================================================================
    // 1. KONFIGURASI
    // =================================================================

    const DELAY_NEXT = 1000; // SUPER CEPAT (1 Detik)

    const CONFIG_MEDIS = {
        sewaktu:  { min: 100, max: 139 },
        puasa:    { min: 75, max: 99 },
        bmi:      { min: 18.5, max: 24.5 },
        systole:  { min: 110, max: 129 },
        diastole: { min: 70, max: 84 },
        jedaInput: 300
    };

    const CACHE = {
        nama: GM_getValue('saved_nama', 'Pasien'),
        umur: GM_getValue('saved_umur', null),
        gender: GM_getValue('saved_gender', null),
        statusTarget: 'Menikah'
    };

    let generatedData = {
        isGenerated: false,
        tinggi: 0, berat: 0, perut: 0,
        tensiSys: 0, tensiDia: 0,
        valGulaSewaktu: 0,
        valGulaPuasa: 0,
        modeGula: null
    };

    let isProcessingSkip = false;
    let raporClicked = false;
    let finalKirimClicked = false;

    // STATE: Ambil dari memori (Tanpa tombol reset manual, bergantung pada auto-reset)
    let raporDone = GM_getValue('status_rapor_done', false);

    if (typeof window.lastActivity === 'undefined') window.lastActivity = Date.now();
    function reportProgress() { window.lastActivity = Date.now(); }

    // =================================================================
    // 2. DATABASE
    // =================================================================

    const SKIP_LIST = [
        "sppb", "mini", "kadar co", "x-ray tb", "pemeriksaan tuberkulosis", "fibrosis",
        "sirosis hati", "pemeriksaan hepatitis", "pemeriksaan hiv",
        "pemeriksaan sifilis", "kanker payudara", "hpv-dna", "poct",
        "inspekulo", "iva", "calon pengantin", "fungsi ginjal", "kerusakan ginjal",
        "jantung", "kanker usus", "pemeriksaan ppok", "sikilas mobilisasi", "penurunan kognitif"
  ];

   const TARGETS = [
// 1. Demografi Dewasa
  { q: "Status Perkawinan", type: "dynamic" },
  { q: "Apabila belum menikah/ status cerai, apakah ada rencana menikah dalam kurun waktu 1 tahun ke depan?", a: "Tidak" },
  { q: "Apakah Anda penyandang disabilitas?", a: "Non disabilitas" },
  { q: "Apakah Anda sedang hamil?", a: "Tidak" },
// 2. Faktor Risiko Kanker Usus
  { q: "Apakah ada anggota keluarga Anda, yang pernah dinyatakan menderita kanker kolorektal atau kanker usus?", a: "Tidak" },
  { q: "Apakah Anda merokok?", a: "Tidak" },
// 3. Faktor Risiko TB - Dewasa & Lansia
  { q: "Apakah Anda pernah atau sedang mengalami batuk yang tidak sembuh-sembuh?", a: "Tidak batuk" },
// 4. Hati
  { q: "Apakah Anda pernah menjalani tes untuk Hepatitis B dan mendapatkan hasil positif?", a: "Tidak" },
  { q: "Apakah Anda memiliki ibu kandung/saudara sekandung yang menderita Hepatitis B?", a: "Tidak" },
  { q: "Apakah anda pernah berhubungan seksual berisiko/tanpa pengaman dengan bukan pasangan suami/istri?", a: "Tidak" },
  { q: "pakah Anda pernah menerima transfusi darah sebelumnya?", a: "Tidak" },
  { q: "Apakah Anda pernah menjalani cuci darah atau hemodialisis?", a: "Tidak" },
  { q: "Apakah Anda pernah menggunakan narkoba, obat terlarang, atau bahan adiktif lainnya dengan cara disuntik?", a: "Tidak" },
  { q: "Apakah Anda adalah orang dengan HIV (ODHIV)?", a: "Tidak" },
  { q: "Apakah Anda pernah mendapatkan pengobatan Hepatitis C dan tidak sembuh?", a: "Tidak" },
  { q: "Apakah Anda pernah didiagnosa atau mendapatkan hasil pemeriksaan kolesterol (lemak darah) tinggi?", a: "Tidak" },
// 5. Kesehatan Jiwa
  { q: "Dalam 2 minggu terakhir, seberapa sering anda kurang/ tidak bersemangat dalam melakukan kegiatan sehari-hari?", a: "Tidak sama sekali" },
  { q: "Dalam 2 minggu terakhir, seberapa sering anda merasa murung, tertekan, atau putus asa?", a: "Tidak sama sekali" },
  { q: "Dalam 2 minggu terakhir,  seberapa sering anda merasa gugup, cemas, atau gelisah?", a: "Tidak sama sekali" },
  { q: "Dalam 2 minggu terakhir,  seberapa sering anda tidak mampu mengendalikan rasa khawatir?", a: "Tidak sama sekali" },
// 6. Penapisan Risiko Kanker Paru
  { q: "Apakah Anda merokok dalam setahun terakhir ini?", a: "Tidak" },
  { q: "Apakah Anda pernah memiliki riwayat merokok dalam 15 tahun terakhir?", a: "Tidak" },
  { q: "Apakah Anda terpapar atau menghirup asap rokok dari orang lain di rumah, lingkungan atau tempat kerja dalam 1 bulan terakhir?", a: "Tidak" },
  { q: "Apakah memiliki riwayat kanker paru pada keluarga (ayah/ibu/saudara kandung)?", a: "Tidak" },
  { q: "Apakah Anda sedang mengalami salah satu atau lebih gejala berikut dan telah diobati tetapi tidak sembuh-sembuh : batuk dalam jangka waktu yang lama / batuk berdarah/ sesak napas/ nyeri dada/ leher bengkak/ terdapat benjolan pada leher?", a: "Tidak" },
  { q: "Apakah Anda pernah memiliki riwayat penyakit TBC atau PPOK?", a: "Tidak" },
// 7. Perilaku Merokok
  { q: "Apakah Anda merokok dalam setahun terakhir ini?", a: "Tidak" },
  { q: "Apakah Anda pernah merokok sebelumnya?", a: "Tidak" },
  { q: "Apakah Anda terpapar asap rokok atau menghirup asap rokok dari orang lain dalam sebulan terakhir?", a: "Tidak" },
// 8. Tingkat Aktivitas Fisik (sedang dan berat)
  { q: "Apakah Anda melakukan aktivitas fisik sedang pada kegiatan rumah tangga/domestik seperti membersihkan rumah/lingkungan (menyapu, menata perabotan), mencuci baju manual, memasak, mengasuh anak, atau mengangkat beban dengan berat < 20 kg?", a: "Ya" },
  { q: "Berapa hari dalam satu minggu Anda melakukan aktivitas tersebut?", a: "7", type: "input" },
  { q: "Dalam satu hari berapa menit waktu yang digunakan untuk melakukan aktivitas tersebut?", a: "30", type: "input" },
  { q: "Apakah Anda melakukan aktivitas fisik sedang pada tempat kerja seperti pekerjaan dengan mengangkat beban, memberi makan ternak, berkebun dan membersihkan kendaraan (motor/mobil/perahu)?", a: "Tidak" },
  { q: "Apakah Anda melakukan aktivitas fisik sedang dalam perjalanan seperti berjalan kaki atau bersepeda ke ladang, sawah, pasar dan tempat kerja?", a: "Tidak" },
  { q: "Apakah Anda melakukan olahraga intensitas sedang seperti latihan beban < 20 kg, senam aerobic, yoga, bermain bola, bersepeda dan berenang (santai)?", a: "Tidak" },
  { q: "Apakah Anda melakukan aktivitas fisik intensitas berat di tempat kerja seperti mengangkat/memikul beban berat ≥20 kg, mencangkul, menggali, memanen, memanjat pohon, menebang pohon, mengayuh becak, menarik jaring, mendorong atau menarik (mesin pemotong rumput/gerobak/perahu/kendaraan)?", a: "Tidak" },
  { q: "Apakah Anda melakukan olahraga intensitas berat seperti bersepeda cepat (>16 km/jam), jalan cepat (>7 km/jam), lari, sepak bola, futsal, bulutangkis, tenis, basket dan lompat tali?", a: "Tidak" },
// 9. Riwayat Imunisasi Tetanus(Status T) - Hanya untuk Catin
  { q: "Apakah anda pernah mendapatkan imunisasi tetanus minimal 2 kali? (imunisasi tetanus biasanya didapatkan pada vaksin DPT saat bayi, vaksin TT/Td saat usia sekolah dasar)", a: "Pernah imunisasi tetanus minimal dua kali" },
// 10. Pemeriksaan Gula Darah Dewasa Lansia
  { q: "Apakah Anda pernah dinyatakan diabetes atau kencing manis oleh Dokter?", a: "Tidak" },
// 11. Tekanan Darah Dewasa Lansia
  { q: "Apakah Anda pernah dinyatakan tekanan darah tinggi?", a: "Tidak" },
// 12. Skrining Telinga dan Mata (18-39 tahun)
  { q: "Apa Hasil Pemeriksaan Telinga Luar (serumen impaksi)?", a: "Tidak ada serumen impaksi" },
  { q: "Apa Hasil Pemeriksaan Telinga Luar (infeksi telinga)?", a: "Tidak ada infeksi telinga" },
  { q: "Hasil pemeriksaan tajam pendengaran", a: "Normal" },
  { q: "Apa hasil skrining tajam penglihatan?", a: "Normal (visus 6/6 - 6/12)" },
// 13. Mobilisasi - Pemeriksaan Lanjutan (SPPB)
  { q: "Tes keseimbangan: berdiri selama 10 detik dengan kaki di masing-masing : Berdiri berdampingan", a: "Bertahan 10 detik" },
  { q: "Tes keseimbangan: berdiri selama 10 detik dengan kaki di masing-masing : Berdiri semi tandem", a: "Bertahan 10 detik" },
  { q: "Tes keseimbangan: berdiri selama 10 detik dengan kaki di masing-masing : Berdiri Tandem", a: "Bertahan 10 detik" },
  { q: "tes kecepatan berjalan: Waktu untuk berjalan sejauh empat meter", a: "4,82 detik" },
  { q: "Tes berdiri dari kursi: Waktu untuk bangkit dari kursi lima kali", a: "<11.19 detik" },
// 14. Pemeriksaan Gangguan Fungsional/Barthel Index - Lansia
  { q: "apat mengendalikan rangsang buang air besar (BAB)?", a: "Terkendali teratur" },
  { q: "Dapat mengendalikan rangsang berkemih/buar air kecil (BAK)?", a: "Mandiri" },
  { q: "Membersihkan diri (seka wajah, sisir rambut, sikat gigi)?", a: "Mandiri" },
  { q: "Penggunaan jamban (keluar masuk jamban, melepas/memakai celana, membersihkan, menyiram)?", a: "Mandiri" },
  { q: "Makan dan Minum (jika makan harus berupa potongan, dianggap dibantu)", a: "Mandiri" },
  { q: "Berubah sikap dari berbaring ke duduk", a: "Mandiri" },
  { q: "Berpindah/berjalan", a: "Mandiri" },
  { q: "Memakai baju", a: "Mandiri" },
  { q: "Naik turun tangga", a: "Mandiri" },
  { q: "Mandi", a: "Mandiri" },
// 15. Pemeriksaan Gejala Depresi - Pemeriksaan Lanjutan
  { q: "Perasaan dalam 2 Minggu terakhir : Apakah anda pada dasarnya puas dengan kehidupan anda?", a: "Ya" },
  { q: "Menggambarkan perasaan pasien selama dua minggu terakhir:: Apakah anda sering merasa bosan?", a: "Tidak" },
  { q: "Apakah anda sering merasa tidak berdaya?", a: "Tidak" },
  { q: "Apakah anda merasa tidak berharga seperti perasaan anda saat kini?", a: "Tidak" },
// 16. Penurunan Kognitif - Tindak Lanjut (AD-8 INA)
  { q: "Apakah klien/pasien lansia mengalami kesulitan dalam membuat keputusan? Misalnya tidak mempu memberi saran dengan benar, tidak mampu mengurus keuangan, membeli hadiah yang tidak layak untuk orang lain, bermasalah dengan pemikiran?", a: "Tidak, Berubah" },
  { q: "Apakah keluarga anda mengulang-ngulang pertanyaan, cerita atau pernyataan yang sama?", a: "Tidak Berubah" },
  { q: "Apakah anda sering merasa tidak berdaya?", a: "Tidak Berubah" },
  { q: "Apakah klien/pasien lansia mengalami kesulitan belajar menggunakan perkakas dan peralatan? Seperti TV, radio, komputer, microwave, remote control, setrika, blender?", a: "Tidak Berubah" },
  { q: "Apakah klien/pasien lansia lupa nama bulan atau tahun?", a: "Tidak Berubah" },
  { q: "Apakah klien/pasien lansia mengalami kesulitan mengatur keuangan? Misalnya membayar rekening air/listrik, periksa buku cek, pajak pendapatan, mengambil yang pensiun di bank?", a: "Tidak Berubah" },
  { q: "Apakah klien/pasien lansia mengalami kesulitan mengingat janji terhadap orang lain?", a: "Tidak Berubah" },
  { q: "Apakah klien/pasien lansia sehari-harinya mengalami gangguan memori dan pemikiran yang konsisten? Misalnya lupa meletakkan kaca mata, kunci kendaraan, meletakkan barang tidak sesuai pada tempatnya?", a: "Tidak Berubah" },
// 17. SKILAS Mobilisasi - Lansia
  { q: " Tes Berdiri di kursi: Berdiri dari kursi lima kali tanpa bantuan tangan. Apakah orang tersebut dapat berdiri dari kursi utuh sebanyak lima kali dalam 14 detik ?", a: "Tidak" },
// 18. SKILAS Pemeriksaan Gejala Depresi - Lansia
  { q: "Apakah dalam 2 minggu terakhir Anda merasa sedih, tertekan, atau putus asa?", a: "Tidak" },
  { q: "Apakah dalam 2 minggu terakhir Anda sedikit minat atau kesenangan dalam melakukan sesuatu?", a: "Tidak" },
// 19. Skrining Malnutrisi - Lansia
  { q: "Apakah berat badan Anda berkurang >3 kg dalam 3 bulan terakhir atau pakaian menjadi lebih longgar?", a: "Tidak" },
  { q: "Apakah Anda hilang nafsu makan Atau mengalami kesulitan makan (misal batuk atau tersedak saat makan, menggunakan selang makan/sonde)?", a: "Tidak" },
  { q: "Apakah ukuran lingkar lengan atas (LiLA) <21 cm?", a: "Tidak" },
// 20. Skrining Malnutrisi - Pemeriksaan Lanjutan (MNA-SF)
  { q: "Apakah anda mengalami penurunan asupan makanan dalam 3 bulan terakhir disebabkan kehilangan nafsu makan, gangguan saluran cerna, kesulitan mengunyah atau menelan?", a: "Nafsu Makan Biasa saja" },
  { q: "Penurunan berat badan dalam tiga bulan terakhir ?", a: "Tidak Tahu" },
  { q: "Kemampuan melakukan mobilitas ?", a: "Bisa bepergian keluar rumah" },
  { q: "Menderita stress psikologis atau penyakit akut dalam tiga bulan terakhir ?", a: "Tidak" },
  { q: "Menderita stress psikologis atau penyakit akut dalam tiga bulan terakhir ?", a: "Tidak ada masalah psikologis" },
  { q: "Berapa Nilai IMT (Indeks Massa Tubuh)?", a: "IMT 21 - <23" },
  { q: "Berapa Lingkar Betis? Pertanyaan ini hanya berlaku jika dilapangan tidak ada pengukuran BB dan TB (IMT), jika sdh ada IMT, maka pertanyaan ini tidak perlu ada", a: ">= 31 cm" },
// 21. Skrining Kanker paru
  { q: "menderita kanker?", a: "tidak pernah didiagnosis menderita kanker" },
  { q: "menderita kanker sebelumnya", a: "tidak ada keluarga yang terdiagnosis kanker" },
  { q: "riwayat merokok", a: "tidak pernah merokok" },
  { q: "riwayat tempat kerja", a: "tidak tempat kerja mengandung zat karsinogenik" },
  { q: "lingkungan tempat tinggal", a: "tidak memiliki tempat tinggal berpotensi tinggi" },
  { q: "lingkungan dalam rumah", a: "memiliki lingkungan dalam rumah yang sehat" },
  { q: "menderita kanker?", a: "tidak pernah didiagnosis menderita kanker" },
  { q: "paru kronik", a: "Tidak pernah didiagnosis penyakit paru kronik" }
];

    const CUSTOM_ANSWERS = [
        { q: "gigi karies", a: "tidak" }, { q: "gigi hilang", a: "tidak" },
        { q: "periodontal", a: "tidak" }, { q: "gigi goyang", a: "tidak" },
        { q: "koreng", a: "tidak" }, { q: "gatal terutama di malam", a: "tidak" },
        { q: "bercak kulit", a: "tidak" }, { q: "frambusia", a: "tidak ada" }, { q: "papul", a: "tidak ada" },
        { q: "dahak", a: "tidak" }, { q: "batuk", a: "tidak" }, { q: "spirometri", a: "tidak" }
    ];

    // =================================================================
    // 3. UI SIMPLE + TOMBOL PAKSA JALAN
    // =================================================================

    const debugBox = document.createElement('div');
    debugBox.style.cssText = "position:fixed; bottom:10px; left:10px; background:rgba(0,0,0,0.85); color:#fff; padding:8px 15px; font-size:12px; z-index:999999; border-radius:20px; font-family:sans-serif; border: 1px solid #444; width:200px;";

    // --- FITUR PAKSA JALAN MANUAL ---
    const btnForceRun = document.createElement('button');
    btnForceRun.innerText = "🚨 PAKSA JALAN / SKIP";
    btnForceRun.style.cssText = "background:#ef4444; color:white; width:100%; border:none; padding:8px; margin-top:5px; border-radius:10px; cursor:pointer; font-weight:bold;";
    btnForceRun.onclick = () => {
        updateUI("🚨 MEMAKSA SKIP...");
        window.location.href = "https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu";
    };

    const statusDiv = document.createElement('div');
    debugBox.appendChild(statusDiv);
    debugBox.appendChild(btnForceRun);
    document.body.appendChild(debugBox);

    function updateUI(statusOverride) {
        const n = CACHE.nama || "Pasien";
        const g = CACHE.gender || "-";
        const u = CACHE.umur || 0;
        const k = (u >= 60) ? "Lansia" : "Dewasa";
        statusDiv.innerHTML = `
            <div style="font-weight:bold; font-size:13px; margin-bottom:2px;">${n} | ${g} | ${u} Th | ${k}</div>
            <div style="font-size:10px; color:#fbbf24;">${statusOverride || 'Ready'}</div>
        `;
    }

    // =================================================================
    // 4. HELPER & LOGIC
    // =================================================================

    function getStorage(key) {
        let val = GM_getValue(key);
        if (!val) val = localStorage.getItem(key);
        return val;
    }

    function normalisasiTeks(teks) {
        if (!teks) return "";
        return teks.toString().toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    function findButtonByText(txt) {
        const elements = document.querySelectorAll('button, div, a');
        for (let el of elements) {
            if (el.innerText && normalisasiTeks(el.innerText).includes(normalisasiTeks(txt))) {
                const parentBtn = el.closest('button');
                if (parentBtn && !parentBtn.disabled) return parentBtn;
                if (el.tagName === 'BUTTON' && !el.disabled) return el;
            }
        }
        return null;
    }

    function hitungStatus() {
        CACHE.umur = GM_getValue('saved_umur', null);
        CACHE.gender = GM_getValue('saved_gender', null);
        if (CACHE.umur && CACHE.gender) {
            const u = parseInt(CACHE.umur);
            const g = CACHE.gender.toLowerCase();
            let isBelum = (g.includes('laki') && u < 25) || (g.includes('perempuan') && u < 21);
            CACHE.statusTarget = isBelum ? "Belum Menikah" : "Menikah";
        }
    }
    hitungStatus();

    function calculateMedicalMetrics() {
        if (generatedData.isGenerated) return;
        let age = CACHE.umur || 30;
        let isPria = CACHE.gender ? CACHE.gender.toLowerCase().includes('laki') : false;
        let minTB = isPria ? 158 : 148, maxTB = isPria ? 175 : 163;
        if (age > 60) { minTB -= 3; maxTB -= 3; }
        generatedData.tinggi = getRandomInt(minTB, maxTB);
        const targetBMI = Math.random() * (CONFIG_MEDIS.bmi.max - CONFIG_MEDIS.bmi.min) + CONFIG_MEDIS.bmi.min;
        generatedData.berat = (targetBMI * Math.pow(generatedData.tinggi/100, 2)).toFixed(1);
        let maxLP = isPria ? 89 : 79, minLP = isPria ? 68 : 60;
        if (targetBMI > 23) minLP += 5;
        generatedData.perut = getRandomInt(minLP, maxLP);
        generatedData.tensiSys = getRandomInt(CONFIG_MEDIS.systole.min, CONFIG_MEDIS.systole.max);
        generatedData.tensiDia = getRandomInt(CONFIG_MEDIS.diastole.min, CONFIG_MEDIS.diastole.max);
        generatedData.valGulaSewaktu = getRandomInt(CONFIG_MEDIS.sewaktu.min, CONFIG_MEDIS.sewaktu.max);
        generatedData.valGulaPuasa = getRandomInt(CONFIG_MEDIS.puasa.min, CONFIG_MEDIS.puasa.max);
        generatedData.modeGula = (Math.random() < 0.5) ? 'PAKET_SEWAKTU' : 'PAKET_PUASA';
        generatedData.isGenerated = true;
    }

    function scrapeProfile() {
        try {
            const nameEl = document.querySelector('h1, h2, .font-bold.text-xl');
            if(nameEl && nameEl.innerText.length > 3) {
                 const name = nameEl.innerText.trim();
                 if(name !== "Detail Pasien" && CACHE.nama !== name) {
                     CACHE.nama = name;
                     GM_setValue('saved_nama', name);
                 }
            }

            const allElements = document.querySelectorAll('div, span, label, p');
            let foundNew = false;
            allElements.forEach(el => {
                const text = el.innerText?.trim();
                if (text === "Jenis Kelamin") {
                    const val = el.nextElementSibling?.innerText.trim();
                    if (val && GM_getValue('saved_gender') !== val) { GM_setValue('saved_gender', val); foundNew = true; }
                }
                if (text === "Umur") {
                    const val = el.nextElementSibling?.innerText.trim();
                    const match = val?.match(/^(\d+)\s*Tahun/i);
                    if (match && GM_getValue('saved_umur') !== parseInt(match[1])) { GM_setValue('saved_umur', parseInt(match[1])); foundNew = true; }
                }
            });

            if (foundNew) { hitungStatus(); updateUI("Data Terbaca"); }
        } catch (e) { console.log(e); }
    }

    function jalankanHunterDropdown(targetTeks, qDiv) {
        const targetClean = normalisasiTeks(targetTeks);
        let attempt = 0;
        const hunter = setInterval(() => {
            attempt++;
            const items = document.querySelectorAll('.sd-list__item, .sv-list__item, [role="option"], li[role="option"]');
            for (let itm of items) {
                if (itm.offsetParent !== null && normalisasiTeks(itm.innerText).includes(targetClean)) {
                    itm.click();
                    clearInterval(hunter);
                    qDiv.dataset.done = "true";
                    document.body.click();
                    reportProgress();
                    return;
                }
            }
            if (attempt > 20) { clearInterval(hunter); qDiv.dataset.done = "failed"; }
        }, 50);
    }

    function forceInput(input, value) {
        input.focus();
        input.click();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(() => {
            setter.call(input, value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            input.blur();
            document.body.click();
            reportProgress();
        }, 200);
    }

    function smartClick(container, textTarget) {
        const candidates = container.querySelectorAll('.sv-string-viewer, span, label, div');
        const targetClean = normalisasiTeks(textTarget);
        for (let el of candidates) {
            if (normalisasiTeks(el.innerText) === targetClean) {
                const clickTarget = el.closest('label') || el.closest('.sd-item') || el;
                const input = clickTarget.querySelector('input');
                if (!((input && input.checked) || clickTarget.classList.contains('sd-item--checked'))) {
                    clickTarget.click();
                    if(input) { input.click(); input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); }
                }
                return true;
            }
        }
        return false;
    }

    function autoKlikNext() {
        if (document.body.dataset.isWaiting === "true" || isProcessingSkip) return true;

        const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
        for (const btn of buttons) {
            const textTombol = normalisasiTeks(btn.innerText || btn.value);
            const isNextBtn = ['selanjutnya', 'kirim', 'simpan', 'next', 'submit'].includes(textTombol) ||
                              btn.classList.contains('sd-navigation__next-btn') ||
                              btn.classList.contains('sd-navigation__complete-btn');

            if (isNextBtn) {
                if (!btn.disabled && !btn.classList.contains('sd-navigation__complete-btn--disabled') && btn.offsetParent !== null) {
                    document.body.dataset.isWaiting = "true";
                    let countdown = DELAY_NEXT / 1000;
                    updateUI(`Auto Next (${countdown}s)...`);
                    const interval = setInterval(() => { countdown--; if (countdown > 0) updateUI(`Auto Next (${countdown}s)...`); }, 1000);
                    setTimeout(() => {
                        clearInterval(interval);
                        btn.click();
                        reportProgress();
                        updateUI("Memproses...");
                        setTimeout(() => { document.body.dataset.isWaiting = "false"; }, 1000);
                    }, DELAY_NEXT);
                    return true;
                }
            }
        }
        return false;
    }

    function runAutoFillLogic() {
        if (isProcessingSkip) return;
        const elements = document.querySelectorAll('.sd-element, .sd-question, .sd-panel, .grid.grid-cols-5');
        calculateMedicalMetrics();

        for (const qDiv of elements) {
            const qText = normalisasiTeks(qDiv.innerText);
            // 1. SKIP LIST
            const isSkipItem = SKIP_LIST.some(k => qText.includes(k));
            if (isSkipItem) {
                const checkbox = qDiv.querySelector('input[type="checkbox"]');
                if (checkbox && checkbox.checked) {
                    const label = checkbox.closest('label') || qDiv.querySelector('label');
                    const visualToggle = label ? label.querySelector('div') : null;
                    if (label) {
                        isProcessingSkip = true;
                        updateUI(`Skip: ${qText.substring(0,10)}...`);
                        qDiv.scrollIntoView({behavior: "smooth", block: "center"});
                        setTimeout(() => {
                            label.click();
                            if (checkbox) checkbox.click();
                            if (visualToggle) visualToggle.click();
                            reportProgress();
                            setTimeout(() => { handleSystemPopups(); isProcessingSkip = false; updateUI("Lanjut..."); }, 1000);
                        }, 500);
                        return;
                    }
                }
                if (checkbox && !checkbox.checked) continue;
            }
            // 2. PERTANYAAN
            let target = null;
            let jawabanAkhir = null;
            let type = 'radio';
            const t1 = TARGETS.find(t => qText.includes(normalisasiTeks(t.q)));
            if (t1) {
                target = t1;
                jawabanAkhir = (t1.type === 'dynamic') ? CACHE.statusTarget : t1.a;
                if (CACHE.statusTarget === "Menikah" && t1.q.includes("rencana menikah")) continue;
                type = t1.type || 'radio';
            }
            if (!target) {
                const t2 = CUSTOM_ANSWERS.find(t => qText.includes(normalisasiTeks(t.q)));
                if (t2) {
                    jawabanAkhir = t2.a;
                    type = 'radio';
                    if (qDiv.querySelector('.sd-dropdown')) type = 'dropdown';
                }
            }
            if (!jawabanAkhir) {
                if (qDiv.querySelector('input.sd-input')) {
                     type = 'input';
                     if ((qText.includes("sistol") && !qText.includes("ke-2"))) jawabanAkhir = generatedData.tensiSys;
                     else if ((qText.includes("diastol") && !qText.includes("ke-2"))) jawabanAkhir = generatedData.tensiDia;
                     else if (qText.includes("berat badan")) jawabanAkhir = generatedData.berat;
                     else if (qText.includes("tinggi badan")) jawabanAkhir = generatedData.tinggi;
                     else if (qText.includes("lingkar perut")) jawabanAkhir = generatedData.perut;
                     else if (qText.includes("sewaktu") && !qText.includes("kedua") && !qText.includes("gds 2")) {
                         if (generatedData.modeGula === 'PAKET_SEWAKTU') jawabanAkhir = generatedData.valGulaSewaktu;
                     }
                     else if (qText.includes("puasa") || qText.includes("gdp")) {
                         if (generatedData.modeGula === 'PAKET_PUASA') jawabanAkhir = generatedData.valGulaPuasa;
                     }
                }
            }
            if (jawabanAkhir) {
                let isAnswered = false;
                if (type === 'input') {
                    const input = qDiv.querySelector('input');
                    if (input && input.value == "") { forceInput(input, jawabanAkhir); isAnswered = true; }
                    else if (input && input.value != "") isAnswered = true;
                }
                else if (type === 'dropdown' || qDiv.querySelector('.sd-dropdown')) {
                    const dropdown = qDiv.querySelector('.sd-dropdown, [role="combobox"]');
                    if (dropdown) {
                        const targetClean = normalisasiTeks(jawabanAkhir);
                        const isMatch = normalisasiTeks(dropdown.innerText).includes(targetClean) || normalisasiTeks(dropdown.querySelector('input')?.value || "").includes(targetClean);
                        if (!isMatch && qDiv.dataset.done !== "busy") {
                            qDiv.dataset.done = "busy";
                            dropdown.click();
                            jalankanHunterDropdown(jawabanAkhir, qDiv);
                        } else if (isMatch) isAnswered = true;
                    }
                }
                else {
                    const isChecked = Array.from(qDiv.querySelectorAll('label, .sd-item')).some(el =>
                        normalisasiTeks(el.innerText).includes(normalisasiTeks(jawabanAkhir)) &&
                        (el.querySelector('input')?.checked || el.classList.contains('sd-item--checked'))
                    );
                    if (isChecked) isAnswered = true;
                    else if (qDiv.dataset.isWaiting !== "true") {
                        qDiv.dataset.isWaiting = "true";
                        reportProgress();
                        qDiv.scrollIntoView({behavior: "smooth", block: "center"});
                        const targetRadio = Array.from(qDiv.querySelectorAll('label, .sd-item')).find(el => normalisasiTeks(el.innerText).includes(normalisasiTeks(jawabanAkhir)));
                        if(targetRadio) targetRadio.style.backgroundColor = "#dcfce7";
                        setTimeout(() => {
                            let clicked = smartClick(qDiv, jawabanAkhir);
                            if (!clicked && targetRadio) targetRadio.click();
                            reportProgress();
                            if(targetRadio) targetRadio.style.backgroundColor = "";
                            setTimeout(() => { qDiv.dataset.isWaiting = "false"; }, 1000);
                        }, 500);
                    }
                }
            }
        }
        autoKlikNext();
    }

    function handleSystemPopups() {
        const btnCloseX = document.querySelector('button.absolute.right-4.top-3, button.btn-transparent');
        if (btnCloseX && document.body.innerText.includes("Batas Kirim")) btnCloseX.click();

        const btnKonfirmasi = findButtonByText("konfirmasi");
        if (btnKonfirmasi) btnKonfirmasi.click();

        const btnTidakPeriksa = findButtonByText("tidak periksa");
        if (btnTidakPeriksa) btnTidakPeriksa.click();

        if (raporClicked && !finalKirimClicked) {
            const btnKirimPopup = findButtonByText("kirim");
            if (btnKirimPopup && normalisasiTeks(btnKirimPopup.innerText) === "kirim") {
                updateUI("Kirim Final...");
                btnKirimPopup.click();
                finalKirimClicked = true;
                GM_setValue('status_rapor_done', true);
                raporDone = true;
            }
        }
    }

    // =================================================================
    // MAIN LOOP CHECKER + AUTO FORCE RUN (WATCHDOG)
    // =================================================================
    setInterval(() => {
        const currentTime = Date.now();
        const url = window.location.href;
        if (getStorage('asik_autorun') === 'false') { updateUI("PAUSED"); return; }

        const isBusy = isProcessingSkip || Array.from(document.querySelectorAll('.sd-element, .sd-question')).some(q => q.dataset.isWaiting === "true" || q.dataset.done === "busy") || document.body.dataset.isWaiting === "true";
        if (isBusy) reportProgress();

        // --- FITUR PAKSA JALAN OTOMATIS JIKA STUCK 20 DETIK ---
        if (currentTime - window.lastActivity > 20000) {
            console.log("[WATCHDOG] Stuck terdeteksi! Memaksa skip pasien ini...");
            updateUI("🚨 STUCK! Paksa ke Pendaftaran...");
            setTimeout(() => {
                window.location.href = "https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu";
            }, 1000);
            return; // Jangan reload, mending skip saja
        }

        scrapeProfile();
        if (!isProcessingSkip) handleSystemPopups();

        if (url.includes('ckg-pelayanan')) {
            if (isProcessingSkip) isProcessingSkip = false;

            const btnMulai = findButtonByText("mulai pemeriksaan");
            if (btnMulai) { btnMulai.click(); reportProgress(); return; }

            const rows = document.querySelectorAll('tr, .grid.grid-cols-5');
            let isDashboardClean = true;
            let unfinishedRow = null;

            // 1. CEK SEMUA PASIEN
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowText = normalisasiTeks(row.innerText);

                const isSkipRow = SKIP_LIST.some(k => rowText.includes(k));
                if (isSkipRow) {
                    const checkbox = row.querySelector('input[type="checkbox"]');
                    if (checkbox && checkbox.checked) {
                        const label = checkbox.closest('label') || row.querySelector('label');
                        const visualToggle = label ? label.querySelector('div') : null;
                        if (label) {
                            if (raporDone) { GM_setValue('status_rapor_done', false); raporDone = false; }
                            label.click();
                            if (checkbox) checkbox.click();
                            if (visualToggle) visualToggle.click();
                            isProcessingSkip = true;
                            reportProgress();
                            setTimeout(() => { handleSystemPopups(); isProcessingSkip = false; }, 1500);
                            return;
                        }
                    }
                    continue;
                }

                const btnInput = Array.from(row.querySelectorAll('button, a')).find(b => normalisasiTeks(b.innerText) === "input data");
                const imgStatus = row.querySelector('img');
                const isGray = imgStatus && imgStatus.src.includes('gray');
                const isDalamPemeriksaan = rowText.includes("dalam pemeriksaan");
                const isBelumDiperiksa = rowText.includes("belum diperiksa");

                if (btnInput && (isGray || isDalamPemeriksaan || isBelumDiperiksa)) {
                    isDashboardClean = false;
                    unfinishedRow = rowText.substring(0, 10);
                    if (raporDone) { GM_setValue('status_rapor_done', false); raporDone = false; }
                    generatedData.isGenerated = false;
                    updateUI(`Mengerjakan: ${unfinishedRow}...`);
                    btnInput.click();
                    reportProgress();
                    return;
                }
            }

            // 2. DASHBOARD BERSIH (Paksa Hajar Tombol Selesai)
            if (isDashboardClean) {
                // PRIORITAS SUPER: HAJAR TOMBOL SELESAI KALAU ADA
                const btnSelesaiLayanan = document.querySelector('.btn-outline-error') || findButtonByText("selesaikan layanan");
                if (btnSelesaiLayanan) {
                    updateUI("💾 Memaksa Selesai...");
                    btnSelesaiLayanan.click();
                    setTimeout(() => {
                        window.location.href = "https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu";
                    }, 3000);
                    return;
                }

                // PRIORITAS 1: KIRIM RAPOR
                if (!raporDone && !raporClicked) {
                    const btnRapor = document.querySelector('.btn-sent-report') || findButtonByText("kirim rapor");
                    if (btnRapor) {
                        updateUI("📤 Mengirim Rapor...");
                        btnRapor.click();
                        raporClicked = true;
                        reportProgress();
                        setTimeout(() => {
                            updateUI("✅ Rapor Terkirim. Siap Selesai.");
                            raporDone = true;
                        }, 5000);
                        return;
                    }
                }
            } else {
                updateUI(`Cek Status: ${unfinishedRow || "..."}`);
            }
        }

        if (url.includes('form.kemkes.go.id') || document.querySelector('.sd-root-modern')) {
            const btnSelesaiForm = document.querySelector('.btn-outline-error');
            if(btnSelesaiForm && normalisasiTeks(btnSelesaiForm.innerText).includes("selesaikan layanan")) {
                 updateUI("Selesaikan...");
                 btnSelesaiForm.click();
                 return;
            }
            runAutoFillLogic();
        }
    }, 1000);
})();
