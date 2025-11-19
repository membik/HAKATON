document.addEventListener("DOMContentLoaded", () => {
    let html5QrCode = null;
    let lastScannedId = null;

    const qrContainer = document.querySelector(".qr-container");
    const qrBox = document.getElementById("qr-reader");
    const modal = document.getElementById("device-modal");
    const modalClose = document.getElementById("modal-close");
    const favBtn = document.getElementById("favorite-btn");

    const tabs = document.querySelectorAll(".container-menu a");
    const menu = document.querySelector(".container-menu");
    let activeTab = document.querySelector(".tab-active") || tabs[0];

    // стекляшка
    const glass = document.createElement("div");
    glass.classList.add("menu-active-glass");
    menu.appendChild(glass);

    // ---------------------------
    // QR Scanner
    // ---------------------------
    function onScanSuccess(decodedText) {
        lastScannedId = decodedText.trim();
        fetch(`http://localhost:3000/history/${lastScannedId}`, { method: "POST" }).catch(console.error);
        fetch(`http://localhost:3000/device/${lastScannedId}`)
            .then(r => r.json())
            .then(device => {
                openDeviceModal(device);
                stopScanner();
            })
            .catch(console.error);
    }

    function startScanner() {
        qrContainer.style.display = "flex";
        if (!html5QrCode) html5QrCode = new Html5Qrcode("qr-reader");
        Html5Qrcode.getCameras()
            .then(cameras => {
                if (!cameras.length) return console.error("Нет камеры");
                html5QrCode.start(cameras[0].id, { fps: 10, qrbox: 250 }, onScanSuccess)
                    .catch(console.error);
            })
            .catch(console.error);
    }

    function stopScanner() {
        if (html5QrCode && html5QrCode.getState && html5QrCode.getState() === 2) {
            html5QrCode.stop().then(() => {
                qrContainer.style.display = "none";
            }).catch(console.error);
        } else {
            qrContainer.style.display = "none";
        }
    }

    // ---------------------------
    // Modal
    // ---------------------------
    function openDeviceModal(device) {
        lastScannedId = device.device_id; // чтобы кнопка избранного работала корректно
        modal.style.display = "flex";
        document.getElementById("modal-model").innerHTML = `<b>Модель</b>: ${device.model}`;
        document.getElementById("modal-type").innerHTML = `<b>Тип</b>: ${device.device_type}`;
        document.getElementById("modal-total-cycles").innerHTML = `<b>Всего циклов</b>: ${device.total_cycles}`;
        document.getElementById("modal-used-cycles").innerHTML = `<b>Использовано</b>: ${device.used_cycles}`;
        document.getElementById("modal-wear").innerHTML = `<b>Износ</b>: ${device.wear_percent}%`;
        document.getElementById("modal-additional").innerHTML = `<b>Место</b>: ${device.additional || ""}`;
        updateFavoriteButton(lastScannedId);
    }

    modalClose.addEventListener("click", () => {
        modal.style.display = "none";
        if (activeTab.dataset.page === "scan") startScanner();
    });

    // ---------------------------
    // Favorites
    // ---------------------------
    async function updateFavoriteButton(id) {
        if (!id) return;
        const favs = await fetch("/favorites").then(r => r.json());
        const isFav = favs.some(f => f.device_id === id);
        favBtn.innerHTML = isFav
            ? `<img src="img/icon/trash.svg">`
            : `<img src="img/icon/heart.svg">`;
    }

    favBtn.addEventListener("click", async () => {
        if (!lastScannedId) return;
        const favs = await fetch("/favorites").then(r => r.json());
        const isFav = favs.some(f => f.device_id === lastScannedId);

        await fetch(`/favorite/${lastScannedId}`, { method: isFav ? "DELETE" : "POST" }).catch(console.error);
        updateFavoriteButton(lastScannedId);
        if (activeTab.dataset.page === "favorite") loadFavorites();
    });

    async function loadFavorites() {
        const container = document.querySelector(".favorite-container");
        container.innerHTML = "";
        const list = await fetch("/favorites").then(r => r.json());

        list.forEach(item => {
            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <h3>${item.model}</h3>
                <p><b>Нахождение</b>: ${item.additional}</p>
                <div style="display: flex; justify-content: space-between; gap: 10px;">
                    <button class="remove-fav" data-id="${item.device_id}">Удалить</button>
                    <button class="details-fav" data-id="${item.device_id}">Подробнее</button>
                </div>
            `;
            container.appendChild(card);
        });

        container.querySelectorAll(".remove-fav").forEach(btn => {
            btn.addEventListener("click", async () => {
                await fetch(`/favorite/${btn.dataset.id}`, { method: "DELETE" }).catch(console.error);
                loadFavorites();
            });
        });

        container.querySelectorAll(".details-fav").forEach(btn => {
            btn.addEventListener("click", async () => {
                try {
                    const device = await fetch(`/device/${btn.dataset.id}`).then(r => r.json());
                    openDeviceModal(device);
                } catch (err) {
                    console.error(err);
                }
            });
        });
    }

    async function loadHistory() {
        const container = document.querySelector(".history-container");
        container.innerHTML = "";
        const list = await fetch("/history").then(r => r.json());

        list.forEach(item => {
            const row = document.createElement("div");
            row.className = "history-card";
            row.innerHTML = `
                <h3>${item.model}</h3>
                <p><b>Дата поиска</b>: ${item.scanned_at}</p>
                <p><b>Место нахождение</b>: ${item.additional}</p>
                <div style="display: flex; justify-content: flex-end;">
                    <button class="details-history" data-id="${item.device_id}">Подробнее</button>
                </div>
            `;
            container.appendChild(row);
        });

        container.querySelectorAll(".details-history").forEach(btn => {
            btn.addEventListener("click", async () => {
                try {
                    const device = await fetch(`/device/${btn.dataset.id}`).then(r => r.json());
                    openDeviceModal(device);
                } catch (err) {
                    console.error(err);
                }
            });
        });
    }

    // ---------------------------
    // Tabs
    // ---------------------------
    function setActiveTab(tab) {
        activeTab = tab;

        // Скрываем все секции
        document.querySelectorAll("section.page").forEach(sec => sec.classList.remove("page-active"));
        document.getElementById(tab.dataset.page).classList.add("page-active");

        // Вкладки
        tabs.forEach(t => t.classList.remove("tab-active"));
        tab.classList.add("tab-active");

        // Стекляшка
        const rect = tab.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const width = Math.max(60, rect.width);
        const left = rect.left - menuRect.left + (rect.width - width)/2;
        glass.style.width = `${width}px`;
        glass.style.transform = `translateX(${left}px)`;

        // Контент — загружаем только при смене вкладки, не на resize
        if (tab.dataset.page === "scan") startScanner();
        else stopScanner();

        if (tab.dataset.page === "favorite") loadFavorites();
        if (tab.dataset.page === "history") loadHistory();
    }

    tabs.forEach(tab => tab.addEventListener("click", e => {
        e.preventDefault();
        setActiveTab(tab);
    }));

    window.addEventListener("resize", () => {
        // На resize только стекляшка
        const rect = activeTab.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const width = Math.max(60, rect.width);
        const left = rect.left - menuRect.left + (rect.width - width)/2;
        glass.style.width = `${width}px`;
        glass.style.transform = `translateX(${left}px)`;
    });

    // старт
    setActiveTab(activeTab);
});
