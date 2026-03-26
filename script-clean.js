const STORAGE_KEY = "s7-formation-manager-clean";
const DIRECTORY_DB_NAME = "s7-formation-manager-db";
const DIRECTORY_STORE_NAME = "handles";
const DIRECTORY_HANDLE_KEY = "data-directory";

const ROOT_FILES = {
    metadata: "metadata.json",
    squads: "squads.json",
    players: "players.json",
    injuries: "injuries.json",
    suspensions: "suspensions.json"
};

const STATUS_ICONS = {
    injury: "kontuzjowany.png",
    suspension: "zawieszony.png"
};

const POSITION_OPTIONS = ["ATT", "LS", "N", "SN", "PS", "POM", "LP", "SPO", "SP", "PP", "SPD", "DEF", "CLS", "LO", "SO", "PO", "CPS", "BR"];

const SCORE_MAP = {
    BR: ["BR"],
    LO: ["LO", "CLS", "DEF"],
    SO: ["SO", "DEF", "CLS", "CPS"],
    PO: ["PO", "CPS", "DEF"],
    CLS: ["CLS", "LO", "SO"],
    CPS: ["CPS", "PO", "SO"],
    SPD: ["SPD", "SP", "DEF"],
    SP: ["SP", "SPD", "SPO"],
    SPO: ["SPO", "POM", "SP"],
    LP: ["LP", "POM", "ATT"],
    PP: ["PP", "POM", "ATT"],
    ATT: ["ATT", "N", "SN", "LS", "PS"],
    LS: ["LS", "N", "ATT"],
    N: ["N", "SN", "ATT"],
    SN: ["SN", "N", "ATT"],
    PS: ["PS", "N", "ATT"],
    POM: ["POM", "SPO", "SP"]
};

const dom = {};

let state = null;
let directoryHandle = null;
let saveTimer = null;
let historyStack = [];
let selectedPitchPlayerId = null;
let selectedBenchPlayerId = null;
let activeModalResolver = null;
let injuryViewMode = "active";
let suspensionViewMode = "active";
let benchFilterMode = "all";

document.addEventListener("DOMContentLoaded", async () => {
    state = migrateState(loadFromLocalStorage());
    cacheDom();
    renderPositionOptions();
    bindEvents();
    ensureStateConsistency();
    await restoreDirectoryHandle();
    refreshAll();
});

function cacheDom() {
    dom.tabButtons = [...document.querySelectorAll(".tab-button")];
    dom.tabPanels = [...document.querySelectorAll(".tab-panel")];
    dom.toggleFullscreenButton = document.getElementById("toggle-fullscreen-button");
    dom.chooseFolderButton = document.getElementById("choose-folder-button");
    dom.saveStatus = document.getElementById("save-status");
    dom.folderName = document.getElementById("folder-name");
    dom.squadList = document.getElementById("squad-list");
    dom.currentSquadName = document.getElementById("current-squad-name");
    dom.undoButton = document.getElementById("undo-button");
    dom.renameSquadButton = document.getElementById("rename-squad-button");
    dom.deleteSquadButton = document.getElementById("delete-squad-button");
    dom.addSquadButton = document.getElementById("add-squad-button");
    dom.lineupModeButtons = [...document.querySelectorAll("[data-lineup-mode]")];
    dom.matchToolbar = document.getElementById("match-lineup-toolbar");
    dom.matchLineupSelect = document.getElementById("match-lineup-select");
    dom.matchDateField = document.getElementById("match-date-field");
    dom.matchDateInput = document.getElementById("match-date-input");
    dom.addMatchLineupButton = document.getElementById("add-match-lineup-button");
    dom.renameMatchLineupButton = document.getElementById("rename-match-lineup-button");
    dom.deleteMatchLineupButton = document.getElementById("delete-match-lineup-button");
    dom.formationInput = document.getElementById("formation-input-inline");
    dom.formationInputLegacy = document.getElementById("formation-input");
    dom.applyFormationButton = document.getElementById("apply-formation-button-inline");
    dom.applyFormationButtonLegacy = document.getElementById("apply-formation-button");
    dom.availabilityPanel = document.getElementById("availability-panel-collapsible");
    dom.availabilityDetails = document.getElementById("availability-details");
    dom.pitchAndBench = document.querySelector(".pitch-and-bench");
    dom.benchCard = document.querySelector(".bench-card");
    dom.benchHeader = document.querySelector(".bench-card .pitch-header");
    dom.benchFilterSwitch = document.getElementById("bench-filter-switch");
    dom.pitch = document.getElementById("pitch");
    dom.lineupSummary = document.getElementById("lineup-summary");
    dom.lineupActionsPanel = document.getElementById("lineup-actions-panel");
    dom.benchFilterButtons = [...document.querySelectorAll("[data-bench-filter]")];
    dom.benchList = document.getElementById("bench-list");
    dom.playerForm = document.getElementById("player-form");
    dom.playerId = document.getElementById("player-id");
    dom.playerFirstName = document.getElementById("player-first-name");
    dom.playerLastName = document.getElementById("player-last-name");
    dom.playerPositions = document.getElementById("player-positions");
    dom.playerNumber = document.getElementById("player-number");
    dom.playerMiniface = document.getElementById("player-miniface");
    dom.cancelPlayerEdit = document.getElementById("cancel-player-edit");
    dom.playersList = document.getElementById("players-list");
    dom.injuryForm = document.getElementById("injury-form");
    dom.injuryId = document.getElementById("injury-id");
    dom.injuryPlayerId = document.getElementById("injury-player-id");
    dom.injuryStartDate = document.getElementById("injury-start-date");
    dom.injuryType = document.getElementById("injury-type");
    dom.injurySeverity = document.getElementById("injury-severity");
    dom.injuryReturnDate = document.getElementById("injury-return-date");
    dom.cancelInjuryEdit = document.getElementById("cancel-injury-edit");
    dom.injuriesList = document.getElementById("injuries-list");
    dom.injuryViewButtons = [...document.querySelectorAll("[data-injury-view]")];
    dom.suspensionForm = document.getElementById("suspension-form");
    dom.suspensionId = document.getElementById("suspension-id");
    dom.suspensionPlayerId = document.getElementById("suspension-player-id");
    dom.suspensionEndDate = document.getElementById("suspension-end-date");
    dom.cancelSuspensionEdit = document.getElementById("cancel-suspension-edit");
    dom.suspensionsList = document.getElementById("suspensions-list");
    dom.suspensionViewButtons = [...document.querySelectorAll("[data-suspension-view]")];
    dom.settingsForm = document.getElementById("settings-form");
    dom.benchLayoutMode = document.getElementById("bench-layout-mode");
    dom.disableMiniface = document.getElementById("disable-miniface");
    dom.hidePlayerNumber = document.getElementById("hide-player-number");
    dom.hidePlayerPositions = document.getElementById("hide-player-positions");
    dom.autoFixPositions = document.getElementById("auto-fix-positions");
    dom.fixPositionsButton = document.getElementById("fix-positions-button");
    dom.injuryRetentionDays = document.getElementById("injury-retention-days");
    dom.suspensionRetentionDays = document.getElementById("suspension-retention-days");
    dom.matchLineupRetentionDays = document.getElementById("match-lineup-retention-days");
    dom.modalOverlay = document.getElementById("modal-overlay");
    dom.modalTitle = document.getElementById("modal-title");
    dom.modalBody = document.getElementById("modal-body");
    dom.modalActions = document.getElementById("modal-actions");
    dom.modalCloseButton = document.getElementById("modal-close-button");
    normalizeBenchHeader();
}

function normalizeBenchHeader() {
    if (!dom.benchHeader || !dom.benchFilterSwitch) {
        return;
    }
    if (!dom.benchHeader.classList.contains("bench-header")) {
        dom.benchHeader.classList.add("bench-header");
    }
    let titleGroup = dom.benchHeader.querySelector(".bench-header-copy");
    if (!titleGroup) {
        titleGroup = document.createElement("div");
        titleGroup.className = "bench-header-copy";
        while (dom.benchHeader.firstChild) {
            titleGroup.appendChild(dom.benchHeader.firstChild);
        }
        dom.benchHeader.appendChild(titleGroup);
    }
    if (dom.benchFilterSwitch.parentElement !== dom.benchHeader) {
        dom.benchHeader.appendChild(dom.benchFilterSwitch);
    }
}

function bindEvents() {
    dom.tabButtons.forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));
    dom.toggleFullscreenButton.addEventListener("click", toggleFullscreenMode);
    dom.chooseFolderButton.addEventListener("click", chooseDataFolder);
    dom.undoButton.addEventListener("click", undoLastChange);
    dom.addSquadButton.addEventListener("click", addSquad);
    dom.renameSquadButton.addEventListener("click", renameActiveSquad);
    dom.deleteSquadButton.addEventListener("click", deleteActiveSquad);
    dom.lineupModeButtons.forEach((button) => button.addEventListener("click", () => {
        state.metadata.lineupMode = button.dataset.lineupMode;
        refreshAll();
    }));
    dom.matchLineupSelect.addEventListener("change", () => {
        state.metadata.lastOpenedMatchLineupId = dom.matchLineupSelect.value;
        selectedPitchPlayerId = null;
        selectedBenchPlayerId = null;
        refreshAll();
    });
    dom.matchDateInput.addEventListener("change", handleMatchDateChange);
    dom.addMatchLineupButton.addEventListener("click", addMatchLineup);
    dom.renameMatchLineupButton.addEventListener("click", renameActiveMatchLineup);
    dom.deleteMatchLineupButton.addEventListener("click", deleteActiveMatchLineup);
    dom.applyFormationButton.addEventListener("click", applyFormation);
    dom.applyFormationButtonLegacy?.addEventListener("click", applyFormation);
    dom.playerForm.addEventListener("submit", handlePlayerSubmit);
    dom.cancelPlayerEdit.addEventListener("click", resetPlayerForm);
    dom.injuryForm.addEventListener("submit", handleInjurySubmit);
    dom.cancelInjuryEdit.addEventListener("click", resetInjuryForm);
    dom.injuryViewButtons.forEach((button) => button.addEventListener("click", () => {
        injuryViewMode = button.dataset.injuryView;
        renderInjuriesSection();
    }));
    dom.suspensionForm.addEventListener("submit", handleSuspensionSubmit);
    dom.cancelSuspensionEdit.addEventListener("click", resetSuspensionForm);
    dom.suspensionViewButtons.forEach((button) => button.addEventListener("click", () => {
        suspensionViewMode = button.dataset.suspensionView;
        renderSuspensionsSection();
    }));
    dom.benchFilterButtons.forEach((button) => button.addEventListener("click", () => {
        benchFilterMode = button.dataset.benchFilter || "all";
        renderBench();
    }));
    dom.settingsForm.addEventListener("input", handleSettingsChange);
    dom.settingsForm.addEventListener("change", handleSettingsChange);
    dom.fixPositionsButton.addEventListener("click", fixCurrentLineupPositions);
    dom.modalCloseButton.addEventListener("click", () => closeModal(""));
    dom.modalOverlay.addEventListener("click", (event) => {
        if (event.target === dom.modalOverlay) {
            closeModal("");
        }
    });
}

function createId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function uniqueIds(values) {
    return [...new Set(values)];
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function sanitizeFolderName(value) {
    return String(value || "zestaw")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._ -]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .slice(0, 80) || "zestaw";
}

function openModal({ title, titleHtml, bodyHtml, actions, closeable = true }) {
    if (titleHtml) {
        dom.modalTitle.innerHTML = titleHtml;
    } else {
        dom.modalTitle.textContent = title;
    }
    dom.modalBody.innerHTML = bodyHtml;
    dom.modalActions.innerHTML = "";
    dom.modalCloseButton.style.display = closeable ? "" : "none";
    actions.forEach((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = action.className || "ghost-button";
        button.textContent = action.label;
        button.addEventListener("click", action.onClick);
        dom.modalActions.appendChild(button);
    });
    dom.modalOverlay.classList.remove("hidden");
    dom.modalOverlay.setAttribute("aria-hidden", "false");
}

function closeModal(result) {
    dom.modalOverlay.classList.add("hidden");
    dom.modalOverlay.setAttribute("aria-hidden", "true");
    if (activeModalResolver) {
        const resolve = activeModalResolver;
        activeModalResolver = null;
        resolve(result);
    }
}

async function toggleFullscreenMode() {
    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else {
            await document.documentElement.requestFullscreen();
        }
    } catch (error) {
        await showAlertModal("Fullscreen", "Nie udalo sie przelaczyc trybu fullscreen.");
    }
}

function showAlertModal(title, message) {
    return new Promise((resolve) => {
        activeModalResolver = resolve;
        openModal({
            title,
            bodyHtml: `<p>${escapeHtml(message)}</p>`,
            actions: [{ label: "OK", className: "primary-button", onClick: () => closeModal(true) }]
        });
    });
}

function showConfirmModal(title, message) {
    return new Promise((resolve) => {
        activeModalResolver = resolve;
        openModal({
            title,
            bodyHtml: `<p>${escapeHtml(message)}</p>`,
            actions: [
                { label: "Anuluj", className: "ghost-button", onClick: () => closeModal(false) },
                { label: "Usun", className: "danger-button", onClick: () => closeModal(true) }
            ]
        });
    });
}

function showPromptModal(title, message, value = "") {
    return new Promise((resolve) => {
        activeModalResolver = resolve;
        openModal({
            title,
            bodyHtml: `<p>${escapeHtml(message)}</p><input id="modal-input" type="text" value="${escapeHtml(value)}">`,
            actions: [
                { label: "Anuluj", className: "ghost-button", onClick: () => closeModal("") },
                { label: "Zapisz", className: "primary-button", onClick: () => closeModal(document.getElementById("modal-input").value.trim()) }
            ]
        });
    });
}

function showChoiceModal(title, options) {
    return new Promise((resolve) => {
        activeModalResolver = resolve;
        openModal({
            title,
            bodyHtml: `<div class="table-list">${options.map((option) => `<button type="button" class="ghost-button modal-choice" data-value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</button>`).join("")}</div>`,
            actions: [{ label: "Anuluj", className: "ghost-button", onClick: () => closeModal("") }]
        });
        document.querySelectorAll(".modal-choice").forEach((button) => {
            button.addEventListener("click", () => closeModal(button.dataset.value));
        });
    });
}

function defaultState() {
    const squad = createSquad("Zestaw 1");
    return {
        metadata: {
            version: 1,
            lastOpenedSquadId: squad.id,
            lastOpenedMatchLineupId: "",
            lineupMode: "general",
            settings: {
                benchLayoutMode: "bottom",
                disableMiniface: false,
                hidePlayerNumber: false,
                hidePlayerPositions: false,
                autoFixPositions: true,
                injuryRetentionDays: null,
                suspensionRetentionDays: 1,
                matchLineupRetentionDays: null
            }
        },
        squads: [squad]
    };
}

function createSquad(name) {
    return {
        id: createId("squad"),
        name,
        teamFolder: sanitizeFolderName(name),
        teamData: normalizeTeamData(),
        generalLineup: createLineupBase(false),
        matchLineups: []
    };
}

function createLineupBase(isMatch) {
    return {
        id: isMatch ? createId("match") : "general",
        name: isMatch ? "Mecz 1" : "Sklad ogolny",
        formation: "4-3-3",
        draftFormation: "4-3-3",
        placedPlayers: [],
        availablePlayerIds: [],
        matchDate: ""
    };
}

function normalizeTeamData(teamData) {
    return {
        players: (teamData?.players || []).map((player) => ({
            id: player.id || createId("player"),
            firstName: player.firstName || "",
            lastName: player.lastName || "",
            positions: Array.isArray(player.positions) ? player.positions.filter(Boolean) : [],
            number: player.number || "",
            miniface: player.miniface || "",
            minifaceFileName: player.minifaceFileName || ""
        })),
        injuries: (teamData?.injuries || []).map((injury) => ({
            id: injury.id || createId("injury"),
            playerId: injury.playerId || "",
            startDate: injury.startDate || "",
            type: injury.type || "",
            severity: injury.severity || "",
            returnDate: injury.returnDate || ""
        })),
        suspensions: (teamData?.suspensions || []).map((suspension) => ({
            id: suspension.id || createId("suspension"),
            playerId: suspension.playerId || "",
            endDate: suspension.endDate || ""
        }))
    };
}

function migrateState(rawState) {
    const base = defaultState();
    const next = rawState && typeof rawState === "object" ? rawState : base;
    const metadata = {
        ...base.metadata,
        ...next.metadata,
        settings: {
            ...base.metadata.settings,
            ...(next.metadata?.settings || {})
        }
    };
    const legacyTeamData = normalizeTeamData({
        players: next.players,
        injuries: next.injuries,
        suspensions: next.suspensions
    });
    const squads = (next.squads || []).map((squad, index) => {
        const teamData = normalizeTeamData(squad.teamData || (index === 0 ? legacyTeamData : null));
        const players = teamData.players;
        return {
            id: squad.id || createId("squad"),
            name: squad.name || `Zestaw ${index + 1}`,
            teamFolder: squad.teamFolder || sanitizeFolderName(squad.name || `zestaw-${index + 1}`),
            teamData,
            generalLineup: migrateLineup(squad.generalLineup || createLineupBase(false), false, players),
            matchLineups: (squad.matchLineups || []).map((lineup, lineupIndex) => migrateLineup({
                ...createLineupBase(true),
                name: lineup.name || `Mecz ${lineupIndex + 1}`,
                ...lineup
            }, true, players))
        };
    });
    return {
        metadata,
        squads: squads.length ? squads : [base.squads[0]]
    };
}

function migrateLineup(lineup, isMatch, players) {
    const base = createLineupBase(isMatch);
    const merged = {
        ...base,
        ...lineup,
        draftFormation: lineup.draftFormation || lineup.formation || base.formation,
        formation: lineup.formation || base.formation,
        matchDate: isMatch ? lineup.matchDate || "" : "",
        availablePlayerIds: isMatch ? uniqueIds(lineup.availablePlayerIds || players.map((player) => player.id)) : []
    };
    if (!Array.isArray(merged.placedPlayers)) {
        merged.placedPlayers = [];
    }
    return merged;
}

function getActiveSquad() {
    return state.squads.find((squad) => squad.id === state.metadata.lastOpenedSquadId) || state.squads[0] || null;
}

function getActiveMatchLineup() {
    const squad = getActiveSquad();
    return squad?.matchLineups.find((lineup) => lineup.id === state.metadata.lastOpenedMatchLineupId) || squad?.matchLineups[0] || null;
}

function getCurrentLineup() {
    const squad = getActiveSquad();
    if (!squad) {
        return null;
    }
    return state.metadata.lineupMode === "match" ? getActiveMatchLineup() : squad.generalLineup;
}

function getTeamData() {
    return getActiveSquad()?.teamData || normalizeTeamData();
}

function getPlayers() {
    return getTeamData().players;
}

function getInjuries() {
    return getTeamData().injuries;
}

function getSuspensions() {
    return getTeamData().suspensions;
}

function getPlayerById(playerId) {
    return getPlayers().find((player) => player.id === playerId) || null;
}

function getPlayerLabel(player) {
    return `${player.firstName} ${player.lastName}`.trim() || "Bez nazwy";
}

function normalizePositionCode(position) {
    const raw = String(position || "").trim().toUpperCase();
    const aliases = {
        "ŚN": "SN",
        "SN": "SN",
        "ŚPO": "SPO",
        "SPO": "SPO",
        "ŚP": "SP",
        "SP": "SP",
        "ŚPD": "SPD",
        "SPD": "SPD",
        "ŚO": "SO",
        "SO": "SO",
        "OBR": "DEF",
        "DEF": "DEF",
        "BR": "BR"
    };
    return aliases[raw] || raw;
}

function formatPositions(positions) {
    return positions?.length ? positions.join(", ") : "Bez pozycji";
}

function ensureStateConsistency() {
    state.squads = (state.squads || []).map((squad, index) => {
        const teamData = normalizeTeamData(squad.teamData);
        const playerIds = new Set(teamData.players.map((player) => player.id));
        const generalLineup = sanitizeLineup(squad.generalLineup || createLineupBase(false), playerIds, false);
        const matchLineups = (squad.matchLineups || []).map((lineup, lineupIndex) => sanitizeLineup({
            ...createLineupBase(true),
            name: lineup.name || `Mecz ${lineupIndex + 1}`,
            ...lineup
        }, playerIds, true));
        return {
            id: squad.id || createId("squad"),
            name: squad.name || `Zestaw ${index + 1}`,
            teamFolder: squad.teamFolder || sanitizeFolderName(squad.name || `zestaw-${index + 1}`),
            teamData,
            generalLineup,
            matchLineups
        };
    });
    if (!state.squads.some((squad) => squad.id === state.metadata.lastOpenedSquadId)) {
        state.metadata.lastOpenedSquadId = state.squads[0]?.id || "";
    }
    const activeSquad = getActiveSquad();
    if (!activeSquad) {
        state.metadata.lastOpenedMatchLineupId = "";
        return;
    }
    if (!activeSquad.matchLineups.some((lineup) => lineup.id === state.metadata.lastOpenedMatchLineupId)) {
        state.metadata.lastOpenedMatchLineupId = activeSquad.matchLineups[0]?.id || "";
    }
}

function sanitizeLineup(lineup, playerIds, isMatch) {
    const seen = new Set();
    const placedPlayers = (lineup.placedPlayers || []).filter((placed) => {
        if (!placed || !playerIds.has(placed.playerId) || seen.has(placed.playerId)) {
            return false;
        }
        if (isMatch && !(lineup.availablePlayerIds || []).includes(placed.playerId)) {
            return false;
        }
        seen.add(placed.playerId);
        placed.x = clamp(Number(placed.x) || 50, 10, 90);
        placed.y = clamp(Number(placed.y) || 50, 10, 88);
        return true;
    });
    return {
        ...createLineupBase(isMatch),
        ...lineup,
        placedPlayers,
        availablePlayerIds: isMatch ? uniqueIds((lineup.availablePlayerIds || []).filter((id) => playerIds.has(id))) : [],
        draftFormation: lineup.draftFormation || lineup.formation || "4-3-3",
        formation: lineup.formation || "4-3-3"
    };
}

function saveToLocalStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.error(error);
    }
}

function loadFromLocalStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : defaultState();
    } catch (error) {
        return defaultState();
    }
}

function commitChange(mutator, trackHistory = true) {
    const snapshot = JSON.stringify(state);
    mutator();
    ensureStateConsistency();
    cleanupHistoricalRecords();
    const changed = snapshot !== JSON.stringify(state);
    if (trackHistory && changed) {
        historyStack.push(snapshot);
        if (historyStack.length > 50) {
            historyStack.shift();
        }
    }
    if (changed) {
        scheduleSave();
    }
    refreshAll();
}

function undoLastChange() {
    const snapshot = historyStack.pop();
    if (!snapshot) {
        return;
    }
    state = migrateState(JSON.parse(snapshot));
    selectedPitchPlayerId = null;
    selectedBenchPlayerId = null;
    scheduleSave();
    refreshAll();
}

function openDirectoryDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DIRECTORY_DB_NAME, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(DIRECTORY_STORE_NAME)) {
                request.result.createObjectStore(DIRECTORY_STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function storeDirectoryHandle(handle) {
    const db = await openDirectoryDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(DIRECTORY_STORE_NAME, "readwrite");
        tx.objectStore(DIRECTORY_STORE_NAME).put(handle, DIRECTORY_HANDLE_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function readStoredDirectoryHandle() {
    const db = await openDirectoryDb();
    const result = await new Promise((resolve, reject) => {
        const tx = db.transaction(DIRECTORY_STORE_NAME, "readonly");
        const request = tx.objectStore(DIRECTORY_STORE_NAME).get(DIRECTORY_HANDLE_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
}

async function chooseDataFolder() {
    if (!("showDirectoryPicker" in window)) {
        await showAlertModal("Brak obslugi", "Ta przegladarka nie obsluguje wyboru folderu. Uzyj aktualnego Chrome albo Edge.");
        return;
    }
    try {
        directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
        await storeDirectoryHandle(directoryHandle);
        await loadOrCreateDirectoryData();
        scheduleSave(true);
        refreshAll();
    } catch (error) {
        if (error?.name === "AbortError") {
            return;
        }
        directoryHandle = null;
        updateSaveStatus();
        console.error(error);
        await showAlertModal("Blad folderu", `Nie udalo sie otworzyc folderu danych: ${error?.message || error}`);
    }
}

async function restoreDirectoryHandle() {
    if (!("showDirectoryPicker" in window)) {
        return;
    }
    try {
        const handle = await readStoredDirectoryHandle();
        if (!handle) {
            return;
        }
        const permission = await handle.queryPermission({ mode: "readwrite" });
        if (permission !== "granted") {
            return;
        }
        directoryHandle = handle;
        await loadOrCreateDirectoryData();
    } catch (error) {
        console.error(error);
        directoryHandle = null;
    }
}

function scheduleSave(immediate = false) {
    clearTimeout(saveTimer);
    if (immediate) {
        persistAll().catch(console.error);
        return;
    }
    dom.saveStatus.textContent = "Zapisywanie...";
    saveTimer = setTimeout(() => persistAll().catch(console.error), 200);
}

async function readJsonFile(filename) {
    if (!directoryHandle) {
        return null;
    }
    try {
        const fileHandle = await directoryHandle.getFileHandle(filename);
        const file = await fileHandle.getFile();
        return JSON.parse(await file.text());
    } catch (error) {
        return null;
    }
}

async function writeJsonFile(filename, data) {
    const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
}

async function writeTeamJson(dirHandle, filename, data) {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
}

async function listDirectoryEntries(dirHandle) {
    const entries = [];
    if (!dirHandle?.entries) {
        return entries;
    }
    for await (const entry of dirHandle.entries()) {
        entries.push(entry);
    }
    return entries;
}

async function readTeamJsonFile(dirHandle, filename) {
    try {
        const fileHandle = await dirHandle.getFileHandle(filename);
        const file = await fileHandle.getFile();
        return JSON.parse(await file.text());
    } catch (error) {
        return null;
    }
}

async function getNestedFileHandle(dirHandle, relativePath) {
    const parts = String(relativePath || "").split("/").filter(Boolean);
    let current = dirHandle;
    for (let index = 0; index < parts.length - 1; index += 1) {
        current = await current.getDirectoryHandle(parts[index], { create: false });
    }
    return current.getFileHandle(parts[parts.length - 1], { create: false });
}

async function ensureNestedDirectory(dirHandle, relativeDir) {
    const parts = String(relativeDir || "").split("/").filter(Boolean);
    let current = dirHandle;
    for (const part of parts) {
        current = await current.getDirectoryHandle(part, { create: true });
    }
    return current;
}

async function writeFileToHandle(fileHandle, content) {
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
}

function dataUrlToBlob(dataUrl) {
    const [header, base64] = String(dataUrl).split(",");
    const mime = header.match(/data:(.*?);base64/)?.[1] || "image/png";
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    return new Blob([bytes], { type: mime });
}

async function writePlayerMinifaceFile(teamDir, player) {
    if (!player.miniface || !String(player.miniface).startsWith("data:")) {
        return player.minifaceFileName || "";
    }
    const relativePath = player.minifaceFileName || `miniface/${player.id}.png`;
    const dirPath = relativePath.split("/").slice(0, -1).join("/");
    const fileName = relativePath.split("/").pop();
    const parentDir = dirPath ? await ensureNestedDirectory(teamDir, dirPath) : teamDir;
    const fileHandle = await parentDir.getFileHandle(fileName, { create: true });
    await writeFileToHandle(fileHandle, dataUrlToBlob(player.miniface));
    return relativePath;
}

async function hydratePlayersFromTeamDir(players, teamDir) {
    return Promise.all((players || []).map(async (player) => {
        const hydrated = {
            id: player.id || createId("player"),
            firstName: player.firstName || "",
            lastName: player.lastName || "",
            positions: Array.isArray(player.positions) ? player.positions : [],
            number: player.number || "",
            miniface: "",
            minifaceFileName: player.minifaceFileName || player.miniface || ""
        };
        if (hydrated.minifaceFileName) {
            try {
                const fileHandle = await getNestedFileHandle(teamDir, hydrated.minifaceFileName);
                hydrated.miniface = await readFileAsDataUrl(await fileHandle.getFile());
            } catch (error) {
                hydrated.miniface = "";
            }
        }
        return hydrated;
    }));
}

async function readTeamBundleFromDirectory(teamDir, fallbackName) {
    const teamMeta = await readTeamJsonFile(teamDir, "team.json");
    const playersPayload = await readTeamJsonFile(teamDir, "players.json");
    const injuriesPayload = await readTeamJsonFile(teamDir, "injuries.json");
    const suspensionsPayload = await readTeamJsonFile(teamDir, "suspensions.json");
    if (!teamMeta && !playersPayload && !injuriesPayload && !suspensionsPayload) {
        return null;
    }
    return {
        id: teamMeta?.id || createId("squad"),
        name: teamMeta?.name || fallbackName,
        teamFolder: teamMeta?.teamFolder || fallbackName,
        teamData: normalizeTeamData({
            players: await hydratePlayersFromTeamDir(playersPayload?.players, teamDir),
            injuries: injuriesPayload?.injuries,
            suspensions: suspensionsPayload?.suspensions
        }),
        generalLineup: teamMeta?.generalLineup || createLineupBase(false),
        matchLineups: teamMeta?.matchLineups || []
    };
}

async function loadOrCreateDirectoryData() {
    const metadata = await readJsonFile(ROOT_FILES.metadata);
    const squadsPayload = await readJsonFile(ROOT_FILES.squads);
    const fallbackPlayers = await readJsonFile(ROOT_FILES.players);
    const fallbackInjuries = await readJsonFile(ROOT_FILES.injuries);
    const fallbackSuspensions = await readJsonFile(ROOT_FILES.suspensions);
    const discoveredSquads = [];
    for (const [name, handle] of await listDirectoryEntries(directoryHandle)) {
        if (handle.kind !== "directory") {
            continue;
        }
        const bundle = await readTeamBundleFromDirectory(handle, name);
        if (bundle) {
            discoveredSquads.push(bundle);
        }
    }
    const rootSquads = squadsPayload?.squads || [];
    const merged = rootSquads.map((summary, index) => {
        const folderName = summary.teamFolder || sanitizeFolderName(summary.name || `zestaw-${index + 1}`);
        const discovered = discoveredSquads.find((item) => item.teamFolder === folderName || item.id === summary.id);
        return {
            id: summary.id || discovered?.id || createId("squad"),
            name: summary.name || discovered?.name || `Zestaw ${index + 1}`,
            teamFolder: folderName,
            teamData: normalizeTeamData(discovered?.teamData),
            generalLineup: summary.generalLineup || discovered?.generalLineup || createLineupBase(false),
            matchLineups: summary.matchLineups || discovered?.matchLineups || []
        };
    });
    discoveredSquads.forEach((squad) => {
        if (!merged.some((item) => item.teamFolder === squad.teamFolder || item.id === squad.id)) {
            merged.push(squad);
        }
    });
    state = migrateState({
        metadata,
        squads: merged,
        players: fallbackPlayers?.players,
        injuries: fallbackInjuries?.injuries,
        suspensions: fallbackSuspensions?.suspensions
    });
    ensureStateConsistency();
}

async function persistAll() {
    saveToLocalStorage();
    if (!directoryHandle) {
        updateSaveStatus();
        return;
    }
    const squadsSummary = state.squads.map((squad) => ({
        id: squad.id,
        name: squad.name,
        teamFolder: squad.teamFolder,
        generalLineup: squad.generalLineup,
        matchLineups: squad.matchLineups
    }));
    await writeJsonFile(ROOT_FILES.metadata, state.metadata);
    await writeJsonFile(ROOT_FILES.squads, { squads: squadsSummary });
    await writeJsonFile(ROOT_FILES.players, { players: [] });
    await writeJsonFile(ROOT_FILES.injuries, { injuries: [] });
    await writeJsonFile(ROOT_FILES.suspensions, { suspensions: [] });
    for (const squad of state.squads) {
        const teamDir = await directoryHandle.getDirectoryHandle(squad.teamFolder, { create: true });
        const serializedPlayers = [];
        for (const player of squad.teamData.players) {
            const minifaceFileName = await writePlayerMinifaceFile(teamDir, player);
            serializedPlayers.push({ ...player, miniface: minifaceFileName, minifaceFileName });
        }
        await writeTeamJson(teamDir, "players.json", { players: serializedPlayers });
        await writeTeamJson(teamDir, "injuries.json", { injuries: squad.teamData.injuries });
        await writeTeamJson(teamDir, "suspensions.json", { suspensions: squad.teamData.suspensions });
        await writeTeamJson(teamDir, "team.json", {
            id: squad.id,
            name: squad.name,
            teamFolder: squad.teamFolder,
            generalLineup: squad.generalLineup,
            matchLineups: squad.matchLineups
        });
    }
    updateSaveStatus();
}

function normalizeDateInput(value) {
    const parts = String(value || "").trim().replaceAll("/", "-").replaceAll(".", "-").split("-").filter(Boolean);
    return parts.length === 3 ? `${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}-${parts[2]}` : String(value || "").trim();
}

function parseFlexibleDate(value) {
    const match = String(value || "").trim().match(/^(\d{1,2})-(\d{1,2})-(\d+)$/);
    if (!match) {
        return null;
    }
    return { day: Number(match[1]), month: Number(match[2]), year: BigInt(match[3]) };
}

function isValidFlexibleDate(value) {
    const parsed = parseFlexibleDate(value);
    return Boolean(parsed && parsed.day >= 1 && parsed.day <= 31 && parsed.month >= 1 && parsed.month <= 12);
}

function compareFlexibleDates(a, b) {
    const left = typeof a === "string" ? parseFlexibleDate(a) : a;
    const right = typeof b === "string" ? parseFlexibleDate(b) : b;
    if (!left || !right) {
        return 0;
    }
    if (left.year !== right.year) {
        return left.year > right.year ? 1 : -1;
    }
    if (left.month !== right.month) {
        return left.month > right.month ? 1 : -1;
    }
    if (left.day !== right.day) {
        return left.day > right.day ? 1 : -1;
    }
    return 0;
}

function addDaysToFlexibleDate(value, days) {
    const parsed = parseFlexibleDate(value);
    if (!parsed) {
        return value;
    }
    const year = Number(parsed.year);
    if (!Number.isFinite(year) || year > 275760) {
        return value;
    }
    const date = new Date(year, parsed.month - 1, parsed.day + days);
    return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

function getFlexibleDateTimestamp(value) {
    const parsed = parseFlexibleDate(value);
    if (!parsed) {
        return null;
    }
    const year = Number(parsed.year);
    if (!Number.isFinite(year) || year > 275760) {
        return null;
    }
    return new Date(year, parsed.month - 1, parsed.day).getTime();
}

function getFlexibleDateDayDiff(startValue, endValue) {
    const start = getFlexibleDateTimestamp(startValue);
    const end = getFlexibleDateTimestamp(endValue);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return null;
    }
    return Math.round((end - start) / 86400000);
}

function formatDaysLabel(days) {
    if (!Number.isFinite(days)) {
        return "";
    }
    return `${days} ${Math.abs(days) === 1 ? "dzien" : "dni"}`;
}

function getTodayFlexibleDate() {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
}

function isRecordActive(endDate) {
    return compareFlexibleDates(endDate, getTodayFlexibleDate()) >= 0;
}

function compareByDateDesc(field) {
    return (left, right) => compareFlexibleDates(right[field], left[field]);
}

function shouldKeepHistorical(endDate, retentionDays) {
    if (retentionDays === null || retentionDays === undefined || retentionDays === "") {
        return true;
    }
    if (isRecordActive(endDate)) {
        return true;
    }
    return compareFlexibleDates(addDaysToFlexibleDate(endDate, Number(retentionDays)), getTodayFlexibleDate()) >= 0;
}

function shouldKeepMatchLineup(lineup, retentionDays) {
    if (retentionDays === null || retentionDays === undefined || retentionDays === "") {
        return true;
    }
    if (!lineup.matchDate || !isValidFlexibleDate(lineup.matchDate)) {
        return true;
    }
    return compareFlexibleDates(addDaysToFlexibleDate(lineup.matchDate, Number(retentionDays)), getTodayFlexibleDate()) >= 0;
}

function cleanupHistoricalRecords() {
    const settings = state.metadata.settings;
    state.squads.forEach((squad) => {
        squad.teamData.injuries = squad.teamData.injuries.filter((item) => shouldKeepHistorical(item.returnDate, settings.injuryRetentionDays));
        squad.teamData.suspensions = squad.teamData.suspensions.filter((item) => shouldKeepHistorical(item.endDate, settings.suspensionRetentionDays));
        squad.matchLineups = squad.matchLineups.filter((lineup) => shouldKeepMatchLineup(lineup, settings.matchLineupRetentionDays));
    });
}

function fileToDataUrl(file) {
    if (!file) {
        return Promise.resolve("");
    }
    return readFileAsDataUrl(file).then(normalizeMinifaceDataUrl);
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
    });
}

async function normalizeMinifaceDataUrl(dataUrl) {
    try {
        const image = await loadImageElement(dataUrl);
        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = image.naturalWidth || image.width;
        sourceCanvas.height = image.naturalHeight || image.height;
        const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
        sourceContext.drawImage(image, 0, 0);
        const { minX, minY, maxX, maxY } = findOpaqueBounds(sourceContext, sourceCanvas.width, sourceCanvas.height);
        if (maxX < minX || maxY < minY) {
            return dataUrl;
        }
        const cropWidth = maxX - minX + 1;
        const cropHeight = maxY - minY + 1;
        const outputCanvas = document.createElement("canvas");
        outputCanvas.width = 256;
        outputCanvas.height = 256;
        const outputContext = outputCanvas.getContext("2d");
        const scale = Math.min(220 / cropWidth, 220 / cropHeight);
        const drawWidth = Math.round(cropWidth * scale);
        const drawHeight = Math.round(cropHeight * scale);
        const offsetX = Math.round((256 - drawWidth) / 2);
        const offsetY = Math.round((256 - drawHeight) / 2);
        outputContext.drawImage(sourceCanvas, minX, minY, cropWidth, cropHeight, offsetX, offsetY, drawWidth, drawHeight);
        return outputCanvas.toDataURL("image/png");
    } catch (error) {
        return dataUrl;
    }
}

function findOpaqueBounds(context, width, height) {
    const { data } = context.getImageData(0, 0, width, height);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha === 0) {
                continue;
            }
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }
    return { minX, minY, maxX, maxY };
}

function actionButton(label, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
}

function updateSaveStatus() {
    dom.saveStatus.textContent = directoryHandle ? "Autozapis aktywny" : "Brak folderu danych";
    dom.folderName.textContent = directoryHandle ? directoryHandle.name : "Dane lokalne w pamieci przegladarki";
}

function switchTab(tabId) {
    dom.tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tabId));
    dom.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tabId));
}

function renderPositionOptions() {
    dom.playerPositions.innerHTML = "";
    POSITION_OPTIONS.forEach((position) => {
        const label = document.createElement("label");
        label.className = "position-option";
        label.innerHTML = `<input type="checkbox" value="${position}"><span>${position}</span>`;
        dom.playerPositions.appendChild(label);
    });
}

function getSelectedPositions() {
    return [...dom.playerPositions.querySelectorAll("input:checked")].map((input) => input.value);
}

function setSelectedPositions(positions) {
    const values = new Set(positions || []);
    dom.playerPositions.querySelectorAll("input").forEach((input) => {
        input.checked = values.has(input.value);
    });
}

function normalizeFormationInput(value) {
    const parts = String(value || "").split("-").map((part) => Number.parseInt(part.trim(), 10)).filter((part) => Number.isFinite(part) && part > 0);
    return parts.length ? parts.join("-") : "4-3-3";
}

function parseFormation(value) {
    return normalizeFormationInput(value).split("-").map((part) => Number(part));
}

function rowLabels(type, count) {
    const maps = {
        def: { 3: ["LO", "SO", "PO"], 4: ["LO", "SO", "SO", "PO"], 5: ["LO", "CLS", "SO", "CPS", "PO"] },
        mid: { 2: ["SPD", "SP"], 3: ["LP", "SP", "PP"], 4: ["LP", "SPD", "SP", "PP"], 5: ["LP", "SPD", "SP", "SPO", "PP"] },
        att: { 1: ["ATT"], 2: ["LS", "PS"], 3: ["LS", "N", "PS"], 4: ["LP", "SN", "N", "PP"] },
        extra: { 1: ["ATT"], 2: ["LS", "PS"], 3: ["LS", "N", "PS"], 4: ["ATT", "ATT", "ATT", "ATT"] }
    };
    return maps[type]?.[count] || Array.from({ length: count }, () => type === "def" ? "DEF" : type === "mid" ? "SP" : "ATT");
}

function buildFormationRows(formation) {
    const rows = parseFormation(formation);
    return [
        ["BR"],
        rowLabels("def", rows[0] || 4),
        rowLabels("mid", rows[1] || 3),
        rowLabels("att", rows[2] || 3),
        rowLabels("extra", rows[3] || 0),
        rowLabels("extra", rows[4] || 0)
    ].filter((labels) => labels.length);
}

function buildSmartFormationTargets(formation) {
    const templates = buildFormationRows(formation);
    const bottom = 88;
    const top = 12;
    const step = templates.length > 1 ? (bottom - top) / (templates.length - 1) : 0;
    const targets = [];
    templates.forEach((labels, rowIndex) => {
        const y = bottom - rowIndex * step;
        labels.forEach((label, index) => {
            targets.push({ label, x: ((index + 1) / (labels.length + 1)) * 100, y });
        });
    });
    return targets;
}

function getFormationTargetsForLineup(lineup) {
    const targets = buildSmartFormationTargets(lineup.formation);
    const extraNeeded = Math.max(0, lineup.placedPlayers.length - targets.length);
    for (let index = 0; index < extraNeeded; index += 1) {
        targets.push({ label: "ATT", x: 16 + (index % 4) * 18, y: 8 + Math.floor(index / 4) * 8 });
    }
    return targets;
}

function getDistanceBetweenPoints(left, right) {
    const deltaX = Number(left.x) - Number(right.x);
    const deltaY = Number(left.y) - Number(right.y);
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

function fixLineupPositions(lineup) {
    if (!lineup || !lineup.placedPlayers?.length) {
        return;
    }
    const targets = getFormationTargetsForLineup(lineup).map((target, index) => ({ ...target, index }));
    const players = lineup.placedPlayers
        .map((placed, index) => ({ placed, player: getPlayerById(placed.playerId), index }))
        .filter((entry) => entry.player);
    const remainingPlayers = [...players];
    const remainingTargets = [...targets];
    const assignments = [];

    while (remainingPlayers.length && remainingTargets.length) {
        let bestTargetIndex = 0;
        let bestPlayerIndex = 0;
        let bestScore = -Infinity;
        remainingTargets.forEach((target, targetIndex) => {
            remainingPlayers.forEach((entry, playerIndex) => {
                const positionalScore = scorePlayerForLabel(entry.player, target.label);
                const exactDistance = getDistanceBetweenPoints(entry.placed, target);
                const combinedScore = positionalScore * 1000 - exactDistance;
                if (combinedScore > bestScore) {
                    bestScore = combinedScore;
                    bestTargetIndex = targetIndex;
                    bestPlayerIndex = playerIndex;
                }
            });
        });
        const [target] = remainingTargets.splice(bestTargetIndex, 1);
        const [entry] = remainingPlayers.splice(bestPlayerIndex, 1);
        assignments.push({ target, entry });
    }

    assignments.forEach(({ target, entry }) => {
        entry.placed.x = target.x;
        entry.placed.y = target.y;
    });
}

function fixCurrentLineupPositions() {
    const lineup = getCurrentLineup();
    if (!lineup || !lineup.placedPlayers?.length) {
        return;
    }
    commitChange(() => {
        fixLineupPositions(lineup);
    });
}

function scorePlayerForLabel(player, label) {
    const preferences = SCORE_MAP[label] || [label];
    for (let index = 0; index < preferences.length; index += 1) {
        if (player.positions.includes(preferences[index])) {
            return preferences.length - index;
        }
    }
    return 0;
}

function getPlayerStatuses(playerId) {
    const statuses = [];
    const injury = getInjuries().find((item) => item.playerId === playerId && isRecordActive(item.returnDate));
    const suspension = getSuspensions().find((item) => item.playerId === playerId && isRecordActive(item.endDate));
    if (injury) {
        statuses.push({
            type: "injury",
            playerId,
            startDate: injury.startDate,
            typeLabel: injury.type,
            severity: injury.severity,
            returnDate: injury.returnDate
        });
    }
    if (suspension) {
        statuses.push({
            type: "suspension",
            playerId,
            endDate: suspension.endDate
        });
    }
    return statuses;
}

function isInactiveMatchPlayer(playerId) {
    return state.metadata.lineupMode === "match" && getPlayerStatuses(playerId).length > 0;
}

function createStatusBadge(status) {
    const badge = document.createElement("span");
    badge.className = "status-badge";
    const icon = document.createElement("img");
    icon.src = STATUS_ICONS[status.type];
    icon.alt = status.type;
    icon.addEventListener("error", () => {
        icon.remove();
        badge.textContent = status.type === "injury" ? "K" : "Z";
    }, { once: true });
    badge.append(icon);
    badge.addEventListener("click", () => showStatusModal(status));
    return badge;
}

function showStatusModal(status) {
    const player = getPlayerById(status.playerId);
    const items = [];
    if (player) {
        items.push(`Zawodnik: ${getPlayerLabel(player)}`);
    }
    if (status.type === "injury") {
        if (status.startDate) {
            items.push(`Data urazu: ${status.startDate}`);
        }
        if (status.typeLabel) {
            items.push(`Typ urazu: ${status.typeLabel}`);
        }
        if (status.severity) {
            items.push(`Stopien powagi: ${status.severity}`);
        }
        if (status.returnDate) {
            items.push(`Przewidywany powrot: ${status.returnDate}`);
        }
        const totalInjuryDuration = status.startDate && status.returnDate ? getFlexibleDateDayDiff(status.startDate, status.returnDate) : null;
        if (totalInjuryDuration !== null) {
            items.push(`Laczny czas kontuzji (do wyleczenia): ${formatDaysLabel(Math.max(0, totalInjuryDuration))}`);
        }
        const injuryElapsed = status.startDate ? getFlexibleDateDayDiff(status.startDate, getTodayFlexibleDate()) : null;
        if (injuryElapsed !== null && injuryElapsed >= 0) {
            items.push(`Czas trwania od urazu: ${formatDaysLabel(injuryElapsed)}`);
        }
        if (status.returnDate && isValidFlexibleDate(status.returnDate)) {
            const daysToReturn = getFlexibleDateDayDiff(getTodayFlexibleDate(), status.returnDate);
            if (daysToReturn !== null && daysToReturn >= 0) {
                items.push(`Do powrotu: ${formatDaysLabel(daysToReturn)}`);
            } else if (daysToReturn !== null) {
                items.push(`Powrot byl: ${formatDaysLabel(Math.abs(daysToReturn))} temu`);
            }
        }
    } else {
        if (status.endDate) {
            items.push(`Koniec zawieszenia: ${status.endDate}`);
        }
        if (status.endDate && isValidFlexibleDate(status.endDate)) {
            const daysToEnd = getFlexibleDateDayDiff(getTodayFlexibleDate(), status.endDate);
            if (daysToEnd !== null && daysToEnd >= 0) {
                items.push(`Do konca zawieszenia: ${formatDaysLabel(daysToEnd)}`);
            } else if (daysToEnd !== null) {
                items.push(`Zawieszenie zakonczylo sie: ${formatDaysLabel(Math.abs(daysToEnd))} temu`);
            }
        }
    }
    const bodyHtml = items.length ? `<ul class="status-modal-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>Brak dodatkowych szczegolow.</p>`;
    openModal({
        titleHtml: `<span class="status-modal-heading"><img src="${escapeHtml(STATUS_ICONS[status.type])}" alt="${status.type}"><span>${status.type === "injury" ? "Kontuzja" : "Zawieszenie"}</span></span>`,
        bodyHtml,
        actions: [{ label: "OK", className: "primary-button", onClick: () => closeModal(true) }]
    });
}

function refreshAll() {
    ensureStateConsistency();
    cleanupHistoricalRecords();
    applyBenchLayoutMode();
    renderSquads();
    renderLineupControls();
    renderPitch();
    renderBench();
    renderPlayersSection();
    renderInjuriesSection();
    renderSuspensionsSection();
    renderSettings();
    dom.undoButton.disabled = historyStack.length === 0;
    updateSaveStatus();
    saveToLocalStorage();
}

function getAvailablePlayersForCurrentLineup() {
    if (state.metadata.lineupMode !== "match") {
        return getPlayers();
    }
    const lineup = getActiveMatchLineup();
    return lineup ? getPlayers().filter((player) => lineup.availablePlayerIds.includes(player.id)) : [];
}

function getBenchCandidates() {
    const lineup = getCurrentLineup();
    const onPitch = new Set((lineup?.placedPlayers || []).map((placed) => placed.playerId));
    return getAvailablePlayersForCurrentLineup().filter((player) => !onPitch.has(player.id)).sort((left, right) => {
        const inactiveDelta = Number(isInactiveMatchPlayer(left.id)) - Number(isInactiveMatchPlayer(right.id));
        if (inactiveDelta !== 0) {
            return inactiveDelta;
        }
        return getPlayerLabel(left).localeCompare(getPlayerLabel(right), "pl");
    });
}

function matchesBenchFilter(player) {
    const positions = new Set((player.positions || []).map(normalizePositionCode));
    if (benchFilterMode === "all") {
        return true;
    }
    if (benchFilterMode === "gk") {
        return positions.has("BR");
    }
    if (benchFilterMode === "def") {
        return ["DEF", "CLS", "LO", "SO", "PO", "CPS"].some((position) => positions.has(position));
    }
    if (benchFilterMode === "mid") {
        return ["POM", "LP", "SPO", "SP", "PP", "SPD"].some((position) => positions.has(position));
    }
    if (benchFilterMode === "att") {
        return ["ATT", "LS", "N", "SN", "PS"].some((position) => positions.has(position));
    }
    return true;
}

function renderSquads() {
    dom.squadList.innerHTML = "";
    state.squads.forEach((squad) => {
        const item = document.createElement("div");
        item.className = `squad-item${squad.id === state.metadata.lastOpenedSquadId ? " active" : ""}`;
        item.innerHTML = `<div class="squad-main"><strong>${escapeHtml(squad.name)}</strong><span class="status-text">${squad.matchLineups.length} skladow meczowych</span></div>`;
        item.appendChild(actionButton("Otworz", "ghost-button", () => {
            state.metadata.lastOpenedSquadId = squad.id;
            state.metadata.lastOpenedMatchLineupId = squad.matchLineups[0]?.id || "";
            selectedPitchPlayerId = null;
            selectedBenchPlayerId = null;
            refreshAll();
        }));
        dom.squadList.appendChild(item);
    });
}

function renderLineupControls() {
    const squad = getActiveSquad();
    const lineup = getCurrentLineup();
    const activeMatchLineup = getActiveMatchLineup();
    const isMatchMode = state.metadata.lineupMode === "match";
    dom.currentSquadName.textContent = squad?.name || "Brak skladu";
    dom.renameSquadButton.disabled = !squad;
    dom.deleteSquadButton.disabled = !squad;
    dom.lineupModeButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.lineupMode === state.metadata.lineupMode);
    });
    dom.matchToolbar.classList.toggle("hidden", !isMatchMode);
    dom.availabilityDetails.classList.toggle("hidden", !isMatchMode);
    dom.matchDateField.classList.toggle("hidden", !isMatchMode || !activeMatchLineup);
    dom.matchLineupSelect.innerHTML = "";
    squad?.matchLineups.forEach((lineupItem) => {
        const option = document.createElement("option");
        option.value = lineupItem.id;
        option.textContent = lineupItem.matchDate ? `${lineupItem.name} | ${lineupItem.matchDate}` : lineupItem.name;
        option.selected = lineupItem.id === state.metadata.lastOpenedMatchLineupId;
        dom.matchLineupSelect.appendChild(option);
    });
    const formationValue = lineup?.draftFormation || lineup?.formation || "4-3-3";
    dom.formationInput.value = formationValue;
    if (dom.formationInputLegacy) {
        dom.formationInputLegacy.value = formationValue;
    }
    dom.matchDateInput.value = activeMatchLineup?.matchDate || "";
    renderAvailabilityPanel();
}

function renderAvailabilityPanel() {
    const lineup = getActiveMatchLineup();
    if (state.metadata.lineupMode !== "match") {
        dom.availabilityPanel.innerHTML = "";
        return;
    }
    if (!lineup) {
        dom.availabilityPanel.innerHTML = `<div class="empty-state">Brak skladow meczowych.</div>`;
        return;
    }
    const grid = document.createElement("div");
    grid.className = "availability-grid";
    getPlayers().forEach((player) => {
        const row = document.createElement("label");
        row.className = "availability-item";
        row.innerHTML = `<div class="table-main"><strong>${escapeHtml(getPlayerLabel(player))}</strong><span class="status-text">${escapeHtml(formatPositions(player.positions))}</span></div>`;
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = lineup.availablePlayerIds.includes(player.id);
        checkbox.addEventListener("change", () => commitChange(() => {
            if (checkbox.checked) {
                lineup.availablePlayerIds = uniqueIds([...lineup.availablePlayerIds, player.id]);
            } else {
                lineup.availablePlayerIds = lineup.availablePlayerIds.filter((id) => id !== player.id);
                lineup.placedPlayers = lineup.placedPlayers.filter((item) => item.playerId !== player.id);
            }
        }));
        row.appendChild(checkbox);
        grid.appendChild(row);
    });
    dom.availabilityPanel.innerHTML = "";
    dom.availabilityPanel.appendChild(grid);
}

function renderPitch() {
    const lineup = getCurrentLineup();
    dom.pitch.innerHTML = "";
    dom.pitch.style.removeProperty("min-width");
    dom.pitch.style.removeProperty("min-height");
    dom.pitch.classList.toggle("miniface-off", Boolean(state.metadata.settings.disableMiniface));
    dom.pitch.style.setProperty("--pitch-player-width", state.metadata.settings.disableMiniface ? "140px" : "154px");
    dom.pitch.style.setProperty("--pitch-card-min-height", state.metadata.settings.disableMiniface ? "68px" : "96px");
    dom.lineupActionsPanel.innerHTML = "";
    dom.lineupActionsPanel.classList.toggle("hidden", !selectedPitchPlayerId);
    if (!lineup) {
        dom.lineupSummary.textContent = "Brak aktywnego skladu.";
        return;
    }
    if (selectedPitchPlayerId) {
        dom.lineupActionsPanel.append(actionButton("Odznacz", "ghost-button", () => { selectedPitchPlayerId = null; refreshAll(); }), actionButton("Madry swap", "ghost-button", smartSwapSelectedPlayer), actionButton("Na lawke", "danger-button", () => commitChange(() => {
            lineup.placedPlayers = lineup.placedPlayers.filter((item) => item.playerId !== selectedPitchPlayerId);
            selectedPitchPlayerId = null;
        })));
    }
    getFormationTargetsForLineup(lineup).forEach((target) => {
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "formation-target";
        marker.style.left = `${target.x}%`;
        marker.style.top = `${target.y}%`;
        marker.title = target.label;
        marker.addEventListener("click", () => placeSelectedOnTarget(target));
        dom.pitch.appendChild(marker);
    });
    dom.lineupSummary.textContent = `${lineup.placedPlayers.length} zawodnikow na boisku. Formacja: ${lineup.formation}.${lineup.matchDate ? ` Mecz: ${lineup.matchDate}.` : ""}`;
    lineup.placedPlayers.forEach((placed) => {
        const player = getPlayerById(placed.playerId);
        if (!player) {
            return;
        }
        const showMiniface = !state.metadata.settings.disableMiniface;
        const showNumber = !state.metadata.settings.hidePlayerNumber;
        const showPositions = !state.metadata.settings.hidePlayerPositions;
        const wrapper = document.createElement("button");
        wrapper.type = "button";
        wrapper.className = `draggable-player${selectedPitchPlayerId === player.id ? " selected" : ""}`;
        wrapper.style.left = `${placed.x}%`;
        wrapper.style.top = `${placed.y}%`;
        wrapper.addEventListener("click", () => handlePitchPlayerClick(player.id));
        const card = document.createElement("div");
        card.className = `player-card${isInactiveMatchPlayer(player.id) ? " match-inactive" : ""}${showMiniface ? "" : " no-miniface"}`;
        card.innerHTML = `${showMiniface ? `<img src="${escapeHtml(player.miniface || "defaultMiniface.png")}" alt="${escapeHtml(getPlayerLabel(player))}">` : ""}<div class="player-ident"><div class="player-head"><div class="player-side player-side-left"><span class="player-icons"></span><span class="player-number-badge">${showNumber && player.number ? escapeHtml(player.number) : ""}</span></div><span class="player-name">${escapeHtml(getPlayerLabel(player))}</span><span class="player-side-spacer" aria-hidden="true"></span></div><div class="player-positions">${showPositions ? escapeHtml(formatPositions(player.positions)) : ""}</div></div>`;
        const iconRow = card.querySelector(".player-icons");
        getPlayerStatuses(player.id).forEach((status) => iconRow.appendChild(createStatusBadge(status)));
        wrapper.appendChild(card);
        dom.pitch.appendChild(wrapper);
    });
    requestAnimationFrame(() => adjustPitchLayout(lineup));
}

function adjustPitchLayout(lineup) {
    if (!lineup || !dom.pitch) {
        return;
    }
    const minifaceEnabled = !state.metadata.settings.disableMiniface;
    const defaultPlayerWidth = minifaceEnabled ? 154 : 140;
    const minPlayerWidth = minifaceEnabled ? 132 : 118;
    const defaultCardHeight = minifaceEnabled ? 96 : 68;
    const minPitchHeight = 580;
    const horizontalGap = 18;
    const verticalGap = 18;
    const sidePadding = 44;
    const edgePadding = 28;
    const topPercent = 12;
    const bottomPercent = 88;
    const formationRows = buildFormationRows(lineup.formation);
    const baseTargetCount = formationRows.reduce((sum, row) => sum + row.length, 0);
    const extraPlayers = Math.max(0, lineup.placedPlayers.length - baseTargetCount);
    const extraRowCount = Math.ceil(extraPlayers / 4);
    const rowCount = formationRows.length + extraRowCount;
    const maxPlayersInFormationRow = formationRows.reduce((max, row) => Math.max(max, row.length), 1);
    const maxPlayersInExtraRow = extraPlayers > 0 ? Math.min(4, extraPlayers) : 0;
    const maxPlayersInRow = Math.max(1, maxPlayersInFormationRow, maxPlayersInExtraRow);
    const pitchContainerWidth = dom.pitch.parentElement?.clientWidth || dom.pitch.clientWidth || 0;
    const maxWidthWithinContainer = pitchContainerWidth
        ? Math.floor((pitchContainerWidth - sidePadding - horizontalGap * (maxPlayersInRow - 1)) / maxPlayersInRow)
        : defaultPlayerWidth;
    const playerWidth = clamp(
        Number.isFinite(maxWidthWithinContainer) ? Math.min(defaultPlayerWidth, maxWidthWithinContainer) : defaultPlayerWidth,
        minPlayerWidth,
        defaultPlayerWidth
    );
    const cardHeight = Math.max(88, Math.round(defaultCardHeight * (playerWidth / defaultPlayerWidth)));
    dom.pitch.style.setProperty("--pitch-player-width", `${playerWidth}px`);
    dom.pitch.style.setProperty("--pitch-card-min-height", `${cardHeight}px`);
    const requiredPitchWidth = Math.ceil(maxPlayersInRow * playerWidth + horizontalGap * (maxPlayersInRow - 1) + sidePadding);
    if (!pitchContainerWidth || maxWidthWithinContainer < minPlayerWidth) {
        dom.pitch.style.minWidth = `${requiredPitchWidth}px`;
    }
    const spanRatio = (bottomPercent - topPercent) / 100;
    const spacingHeight = rowCount > 1 ? Math.ceil(((cardHeight + verticalGap) * (rowCount - 1)) / spanRatio) : 0;
    const topRequirement = Math.ceil((cardHeight / 2 + edgePadding) / (topPercent / 100));
    const bottomRequirement = Math.ceil((cardHeight / 2 + edgePadding) / ((100 - bottomPercent) / 100));
    const requiredPitchHeight = Math.max(minPitchHeight, spacingHeight, topRequirement, bottomRequirement);
    dom.pitch.style.minHeight = `${requiredPitchHeight}px`;

    const pitchRect = dom.pitch.getBoundingClientRect();
    const cards = [...dom.pitch.querySelectorAll(".draggable-player")];
    let extraWidth = 0;
    let extraHeight = 0;
    cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        extraWidth = Math.max(extraWidth, pitchRect.left - rect.left, rect.right - pitchRect.right);
        extraHeight = Math.max(extraHeight, pitchRect.top - rect.top, rect.bottom - pitchRect.bottom);
    });
    for (let index = 0; index < cards.length; index += 1) {
        const first = cards[index].getBoundingClientRect();
        for (let nextIndex = index + 1; nextIndex < cards.length; nextIndex += 1) {
            const second = cards[nextIndex].getBoundingClientRect();
            const overlapX = Math.min(first.right, second.right) - Math.max(first.left, second.left);
            const overlapY = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
            if (overlapX > 0 && overlapY > 0) {
                if (overlapX >= overlapY) {
                    extraWidth = Math.max(extraWidth, overlapX + 12);
                } else {
                    extraHeight = Math.max(extraHeight, overlapY + 12);
                }
            }
        }
    }
    if (extraWidth > 0) {
        dom.pitch.style.minWidth = `${Math.ceil(Math.max(requiredPitchWidth, pitchRect.width + extraWidth + 12))}px`;
    }
    if (extraHeight > 0) {
        dom.pitch.style.minHeight = `${Math.ceil(Math.max(requiredPitchHeight, pitchRect.height + extraHeight + 12))}px`;
    }
}

function renderBench() {
    dom.benchList.innerHTML = "";
    dom.benchFilterButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.benchFilter === benchFilterMode);
    });
    const players = getBenchCandidates().filter(matchesBenchFilter);
    const showMiniface = !state.metadata.settings.disableMiniface;
    if (!players.length) {
        dom.benchList.innerHTML = `<div class="empty-state">Brak zawodnikow poza boiskiem.</div>`;
        return;
    }
    players.forEach((player) => {
        const row = document.createElement("div");
        row.className = `bench-player selectable${selectedBenchPlayerId === player.id ? " selected" : ""}${isInactiveMatchPlayer(player.id) ? " match-inactive" : ""}${showMiniface ? "" : " no-miniface"}`;
        row.innerHTML = `${showMiniface ? `<img src="${escapeHtml(player.miniface || "defaultMiniface.png")}" alt="${escapeHtml(getPlayerLabel(player))}">` : ""}<div class="table-main"><strong>${escapeHtml(getPlayerLabel(player))}</strong><span class="status-text">${escapeHtml(formatPositions(player.positions))}${player.number ? ` | Nr ${escapeHtml(player.number)}` : ""}</span></div>`;
        const actions = document.createElement("div");
        actions.className = "player-icons";
        getPlayerStatuses(player.id).forEach((status) => actions.appendChild(createStatusBadge(status)));
        row.appendChild(actions);
        row.addEventListener("click", () => {
            if (selectedPitchPlayerId) {
                commitChange(() => {
                    const lineup = getCurrentLineup();
                    const current = lineup?.placedPlayers.find((item) => item.playerId === selectedPitchPlayerId);
                    if (current) {
                        current.playerId = player.id;
                        selectedPitchPlayerId = null;
                        selectedBenchPlayerId = null;
                    }
                });
                return;
            }
            selectedBenchPlayerId = selectedBenchPlayerId === player.id ? null : player.id;
            selectedPitchPlayerId = null;
            refreshAll();
        });
        dom.benchList.appendChild(row);
    });
}

function handlePitchPlayerClick(playerId) {
    const lineup = getCurrentLineup();
    if (!lineup) {
        return;
    }
    if (selectedBenchPlayerId) {
        commitChange(() => {
            const current = lineup.placedPlayers.find((item) => item.playerId === playerId);
            if (current) {
                current.playerId = selectedBenchPlayerId;
                selectedBenchPlayerId = null;
                selectedPitchPlayerId = null;
            }
        });
        return;
    }
    if (selectedPitchPlayerId === playerId) {
        selectedPitchPlayerId = null;
        refreshAll();
        return;
    }
    if (selectedPitchPlayerId) {
        commitChange(() => {
            const first = lineup.placedPlayers.find((item) => item.playerId === selectedPitchPlayerId);
            const second = lineup.placedPlayers.find((item) => item.playerId === playerId);
            if (first && second) {
                const temp = { x: first.x, y: first.y };
                first.x = second.x;
                first.y = second.y;
                second.x = temp.x;
                second.y = temp.y;
                selectedPitchPlayerId = null;
            }
        });
        return;
    }
    selectedPitchPlayerId = playerId;
    selectedBenchPlayerId = null;
    refreshAll();
}

function placeSelectedOnTarget(target) {
    const lineup = getCurrentLineup();
    if (!lineup || (!selectedPitchPlayerId && !selectedBenchPlayerId)) {
        return;
    }
    commitChange(() => {
        if (selectedBenchPlayerId) {
            const occupied = lineup.placedPlayers.find((item) => item.x === target.x && item.y === target.y);
            if (occupied) {
                occupied.playerId = selectedBenchPlayerId;
            } else {
                lineup.placedPlayers.push({ playerId: selectedBenchPlayerId, x: target.x, y: target.y });
            }
            selectedBenchPlayerId = null;
            return;
        }
        const moving = lineup.placedPlayers.find((item) => item.playerId === selectedPitchPlayerId);
        if (!moving) {
            return;
        }
        const occupied = lineup.placedPlayers.find((item) => item.x === target.x && item.y === target.y && item.playerId !== moving.playerId);
        if (occupied) {
            occupied.x = moving.x;
            occupied.y = moving.y;
        }
        moving.x = target.x;
        moving.y = target.y;
        selectedPitchPlayerId = null;
    });
}

async function smartSwapSelectedPlayer() {
    const player = getPlayerById(selectedPitchPlayerId);
    if (!player) {
        return;
    }
    const candidates = getBenchCandidates().filter((candidate) => candidate.id !== player.id && candidate.positions.some((position) => player.positions.includes(position)));
    if (!candidates.length) {
        await showAlertModal("Madry swap", "Brak podobnych pozycji na lawce.");
        return;
    }
    const choice = await showChoiceModal("Madry swap", candidates.map((candidate) => ({
        label: `${getPlayerLabel(candidate)}${candidate.number ? ` | ${candidate.number}` : ""} | ${formatPositions(candidate.positions)}`,
        value: candidate.id
    })));
    if (!choice) {
        return;
    }
    commitChange(() => {
        const lineup = getCurrentLineup();
        const current = lineup?.placedPlayers.find((item) => item.playerId === selectedPitchPlayerId);
        if (current) {
            current.playerId = choice;
            selectedPitchPlayerId = null;
        }
    });
}

function renderPlayersSection() {
    renderPlayerSelectOptions();
    dom.playersList.innerHTML = "";
    const players = getPlayers();
    const showMiniface = !state.metadata.settings.disableMiniface;
    if (!players.length) {
        dom.playersList.innerHTML = `<div class="empty-state">Brak zawodnikow.</div>`;
        return;
    }
    players.forEach((player) => {
        const row = document.createElement("div");
        row.className = `table-row${showMiniface ? "" : " no-miniface"}`;
        row.innerHTML = `${showMiniface ? `<img src="${escapeHtml(player.miniface || "defaultMiniface.png")}" alt="${escapeHtml(getPlayerLabel(player))}" width="44" height="44">` : ""}<div class="table-main"><strong>${escapeHtml(getPlayerLabel(player))}</strong><span class="status-text">${escapeHtml(formatPositions(player.positions))}${player.number ? ` | Nr ${escapeHtml(player.number)}` : ""}</span></div>`;
        const actions = document.createElement("div");
        actions.className = "toolbar-actions";
        getPlayerStatuses(player.id).forEach((status) => actions.appendChild(createStatusBadge(status)));
        actions.appendChild(actionButton("Edytuj", "ghost-button", () => editPlayer(player.id)));
        actions.appendChild(actionButton("Usun", "danger-button", () => deletePlayer(player.id)));
        row.appendChild(actions);
        dom.playersList.appendChild(row);
    });
}

function renderPlayerSelectOptions() {
    const options = ['<option value="">Wybierz zawodnika</option>'];
    getPlayers().forEach((player) => options.push(`<option value="${escapeHtml(player.id)}">${escapeHtml(getPlayerLabel(player))}</option>`));
    dom.injuryPlayerId.innerHTML = options.join("");
    dom.suspensionPlayerId.innerHTML = options.join("");
}

function renderInjuriesSection() {
    dom.injuriesList.innerHTML = "";
    dom.injuryViewButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.injuryView === injuryViewMode);
    });
    const injuries = [...getInjuries()]
        .filter((injury) => injuryViewMode === "active" ? isRecordActive(injury.returnDate) : !isRecordActive(injury.returnDate))
        .sort(compareByDateDesc("startDate"));
    if (!injuries.length) {
        dom.injuriesList.innerHTML = `<div class="empty-state">${injuryViewMode === "active" ? "Brak aktywnych kontuzji." : "Brak archiwalnych kontuzji."}</div>`;
        return;
    }
    injuries.forEach((injury) => {
        const player = getPlayerById(injury.playerId);
        const row = document.createElement("div");
        row.className = "table-row";
        row.innerHTML = `<div class="table-main"><strong>${escapeHtml(player ? getPlayerLabel(player) : "Brak zawodnika")}</strong><span class="status-text">${escapeHtml(`${injury.startDate} | ${injury.type} | ${injury.severity} | powrot: ${injury.returnDate}`)}</span></div>`;
        const actions = document.createElement("div");
        actions.className = "toolbar-actions";
        actions.appendChild(actionButton("Edytuj", "ghost-button", () => editInjury(injury.id)));
        actions.appendChild(actionButton("Usun", "danger-button", () => deleteInjury(injury.id)));
        row.appendChild(actions);
        dom.injuriesList.appendChild(row);
    });
}

function renderSuspensionsSection() {
    dom.suspensionsList.innerHTML = "";
    dom.suspensionViewButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.suspensionView === suspensionViewMode);
    });
    const suspensions = [...getSuspensions()]
        .filter((suspension) => suspensionViewMode === "active" ? isRecordActive(suspension.endDate) : !isRecordActive(suspension.endDate))
        .sort(compareByDateDesc("endDate"));
    if (!suspensions.length) {
        dom.suspensionsList.innerHTML = `<div class="empty-state">${suspensionViewMode === "active" ? "Brak aktywnych zawieszen." : "Brak archiwalnych zawieszen."}</div>`;
        return;
    }
    suspensions.forEach((suspension) => {
        const player = getPlayerById(suspension.playerId);
        const row = document.createElement("div");
        row.className = "table-row";
        row.innerHTML = `<div class="table-main"><strong>${escapeHtml(player ? getPlayerLabel(player) : "Brak zawodnika")}</strong><span class="status-text">${escapeHtml(`Do: ${suspension.endDate}`)}</span></div>`;
        const actions = document.createElement("div");
        actions.className = "toolbar-actions";
        actions.appendChild(actionButton("Edytuj", "ghost-button", () => editSuspension(suspension.id)));
        actions.appendChild(actionButton("Usun", "danger-button", () => deleteSuspension(suspension.id)));
        row.appendChild(actions);
        dom.suspensionsList.appendChild(row);
    });
}

function renderSettings() {
    dom.benchLayoutMode.value = state.metadata.settings.benchLayoutMode || "bottom";
    dom.disableMiniface.checked = Boolean(state.metadata.settings.disableMiniface);
    dom.hidePlayerNumber.checked = Boolean(state.metadata.settings.hidePlayerNumber);
    dom.hidePlayerPositions.checked = Boolean(state.metadata.settings.hidePlayerPositions);
    dom.autoFixPositions.checked = Boolean(state.metadata.settings.autoFixPositions);
    dom.injuryRetentionDays.value = state.metadata.settings.injuryRetentionDays ?? "";
    dom.suspensionRetentionDays.value = state.metadata.settings.suspensionRetentionDays ?? "";
    dom.matchLineupRetentionDays.value = state.metadata.settings.matchLineupRetentionDays ?? "";
}

function applyBenchLayoutMode() {
    if (!dom.pitchAndBench || !dom.benchCard) {
        return;
    }
    const layoutMode = state.metadata.settings.benchLayoutMode === "side" ? "side" : "bottom";
    dom.pitchAndBench.classList.toggle("bench-bottom", layoutMode === "bottom");
    dom.pitchAndBench.classList.toggle("bench-side", layoutMode === "side");
    dom.benchCard.classList.toggle("bench-bottom-card", layoutMode === "bottom");
}

function upsertById(collection, item) {
    const index = collection.findIndex((entry) => entry.id === item.id);
    if (index >= 0) {
        collection[index] = item;
    } else {
        collection.push(item);
    }
}

function parseRetentionValue(value) {
    if (value === "") {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function handleSettingsChange() {
    const nextDisableMiniface = Boolean(dom.disableMiniface.checked);
    const nextHidePlayerNumber = Boolean(dom.hidePlayerNumber.checked);
    const nextHidePlayerPositions = Boolean(dom.hidePlayerPositions.checked);
    const shouldAutoFix = Boolean(dom.autoFixPositions.checked);
    const cardLayoutChanged = state.metadata.settings.disableMiniface !== nextDisableMiniface
        || state.metadata.settings.hidePlayerNumber !== nextHidePlayerNumber
        || state.metadata.settings.hidePlayerPositions !== nextHidePlayerPositions;
    commitChange(() => {
        state.metadata.settings.benchLayoutMode = dom.benchLayoutMode.value === "side" ? "side" : "bottom";
        state.metadata.settings.disableMiniface = nextDisableMiniface;
        state.metadata.settings.hidePlayerNumber = nextHidePlayerNumber;
        state.metadata.settings.hidePlayerPositions = nextHidePlayerPositions;
        state.metadata.settings.autoFixPositions = shouldAutoFix;
        state.metadata.settings.injuryRetentionDays = parseRetentionValue(dom.injuryRetentionDays.value);
        state.metadata.settings.suspensionRetentionDays = parseRetentionValue(dom.suspensionRetentionDays.value);
        state.metadata.settings.matchLineupRetentionDays = parseRetentionValue(dom.matchLineupRetentionDays.value);
        if (shouldAutoFix && cardLayoutChanged) {
            fixLineupPositions(getCurrentLineup());
        }
    }, false);
}

function createUniqueTeamFolder(baseName, excludedSquadId = "") {
    const base = sanitizeFolderName(baseName);
    const taken = new Set(state.squads.filter((squad) => squad.id !== excludedSquadId).map((squad) => squad.teamFolder));
    if (!taken.has(base)) {
        return base;
    }
    let counter = 2;
    while (taken.has(`${base}_${counter}`)) {
        counter += 1;
    }
    return `${base}_${counter}`;
}

async function addSquad() { const name = await showPromptModal("Nowy zestaw", "Nazwa nowej druzyny / zestawu:", `Zestaw ${state.squads.length + 1}`); if (!name) return; commitChange(() => { const squad = createSquad(name.trim()); squad.teamFolder = createUniqueTeamFolder(name.trim()); state.squads.push(squad); state.metadata.lastOpenedSquadId = squad.id; state.metadata.lastOpenedMatchLineupId = ""; state.metadata.lineupMode = "general"; selectedPitchPlayerId = null; selectedBenchPlayerId = null; }); }
async function renameActiveSquad() { const squad = getActiveSquad(); if (!squad) return; const name = await showPromptModal("Zmien nazwe", "Nowa nazwa zestawu:", squad.name); if (!name) return; commitChange(() => { squad.name = name.trim(); }, false); }
async function deleteActiveSquad() { const squad = getActiveSquad(); if (!squad) return; if (!await showConfirmModal("Usun zestaw", `Usunac zestaw ${squad.name}?`)) return; if (directoryHandle && squad.teamFolder) { try { await directoryHandle.removeEntry(squad.teamFolder, { recursive: true }); } catch (error) { if (error?.name !== "NotFoundError") { await showAlertModal("Blad", `Nie udalo sie usunac folderu druzyny: ${error.message || error}`); return; } } } commitChange(() => { state.squads = state.squads.filter((item) => item.id !== squad.id); state.metadata.lastOpenedSquadId = state.squads[0]?.id || ""; state.metadata.lastOpenedMatchLineupId = state.squads[0]?.matchLineups[0]?.id || ""; selectedPitchPlayerId = null; selectedBenchPlayerId = null; }, false); }
async function addMatchLineup() { const squad = getActiveSquad(); if (!squad) return; const name = await showPromptModal("Nowy sklad meczowy", "Nazwa skladu meczowego:", `Mecz ${squad.matchLineups.length + 1}`); if (!name) return; const rawDate = await showPromptModal("Data meczu", "Podaj date meczu lub zostaw puste:", ""); const matchDate = normalizeDateInput(rawDate || ""); if (matchDate && !isValidFlexibleDate(matchDate)) { await showAlertModal("Blad", "Wpisz date meczu w formacie dd-mm-rrrr."); return; } commitChange(() => { const lineup = createLineupBase(true); lineup.name = name.trim(); lineup.matchDate = matchDate; lineup.availablePlayerIds = getPlayers().map((player) => player.id); squad.matchLineups.push(lineup); state.metadata.lastOpenedMatchLineupId = lineup.id; state.metadata.lineupMode = "match"; }); }
async function renameActiveMatchLineup() { const lineup = getActiveMatchLineup(); if (!lineup) return; const name = await showPromptModal("Zmien nazwe", "Nowa nazwa skladu meczowego:", lineup.name); if (!name) return; commitChange(() => { lineup.name = name.trim(); }, false); }
async function deleteActiveMatchLineup() { const squad = getActiveSquad(); const lineup = getActiveMatchLineup(); if (!squad || !lineup) return; if (!await showConfirmModal("Usun sklad meczowy", `Usunac ${lineup.name}?`)) return; commitChange(() => { squad.matchLineups = squad.matchLineups.filter((item) => item.id !== lineup.id); state.metadata.lastOpenedMatchLineupId = squad.matchLineups[0]?.id || ""; selectedPitchPlayerId = null; selectedBenchPlayerId = null; }, false); }
function handleMatchDateChange() { const lineup = getActiveMatchLineup(); if (!lineup) return; const normalized = normalizeDateInput(dom.matchDateInput.value); if (normalized && !isValidFlexibleDate(normalized)) { showAlertModal("Blad", "Wpisz date meczu w formacie dd-mm-rrrr."); dom.matchDateInput.value = lineup.matchDate || ""; return; } commitChange(() => { lineup.matchDate = normalized; }, false); }
function applyFormation() { const lineup = getCurrentLineup(); if (!lineup) return; const formation = normalizeFormationInput(dom.formationInput.value || dom.formationInputLegacy?.value || lineup.formation); commitChange(() => { lineup.draftFormation = formation; lineup.formation = formation; fixLineupPositions(lineup); }); }
async function handlePlayerSubmit(event) { event.preventDefault(); const existing = getPlayerById(dom.playerId.value); const playerId = dom.playerId.value || createId("player"); const miniface = await fileToDataUrl(dom.playerMiniface.files[0]); const player = { id: playerId, firstName: dom.playerFirstName.value.trim(), lastName: dom.playerLastName.value.trim(), positions: getSelectedPositions(), number: dom.playerNumber.value.trim(), miniface: miniface || existing?.miniface || "", minifaceFileName: dom.playerMiniface.files[0] ? `miniface/${playerId}.png` : (existing?.minifaceFileName || "") }; if (!player.firstName && !player.lastName) { await showAlertModal("Blad", "Podaj przynajmniej imie albo nazwisko."); return; } commitChange(() => { const teamData = getTeamData(); const index = teamData.players.findIndex((item) => item.id === player.id); if (index >= 0) teamData.players[index] = player; else { teamData.players.push(player); getActiveSquad().matchLineups.forEach((lineup) => { lineup.availablePlayerIds = uniqueIds([...lineup.availablePlayerIds, player.id]); }); } }); resetPlayerForm(); }
function editPlayer(playerId) { const player = getPlayerById(playerId); if (!player) return; dom.playerId.value = player.id; dom.playerFirstName.value = player.firstName; dom.playerLastName.value = player.lastName; dom.playerNumber.value = player.number; dom.playerMiniface.value = ""; setSelectedPositions(player.positions); switchTab("players"); }
async function deletePlayer(playerId) { const player = getPlayerById(playerId); if (!player) return; if (!await showConfirmModal("Usun zawodnika", `Usunac zawodnika ${getPlayerLabel(player)}?`)) return; commitChange(() => { const teamData = getTeamData(); teamData.players = teamData.players.filter((item) => item.id !== playerId); teamData.injuries = teamData.injuries.filter((item) => item.playerId !== playerId); teamData.suspensions = teamData.suspensions.filter((item) => item.playerId !== playerId); const squad = getActiveSquad(); squad.generalLineup.placedPlayers = squad.generalLineup.placedPlayers.filter((item) => item.playerId !== playerId); squad.matchLineups.forEach((lineup) => { lineup.placedPlayers = lineup.placedPlayers.filter((item) => item.playerId !== playerId); lineup.availablePlayerIds = lineup.availablePlayerIds.filter((id) => id !== playerId); }); }); }
function resetPlayerForm() { dom.playerForm.reset(); dom.playerId.value = ""; setSelectedPositions([]); }
async function handleInjurySubmit(event) { event.preventDefault(); const injury = { id: dom.injuryId.value || createId("injury"), playerId: dom.injuryPlayerId.value, startDate: normalizeDateInput(dom.injuryStartDate.value), type: dom.injuryType.value.trim(), severity: dom.injurySeverity.value.trim(), returnDate: normalizeDateInput(dom.injuryReturnDate.value) }; if (!injury.playerId) { await showAlertModal("Blad", "Wybierz zawodnika."); return; } if (injury.startDate && !isValidFlexibleDate(injury.startDate)) { await showAlertModal("Blad", "Data urazu musi byc w formacie dd-mm-rrrr."); return; } if (injury.returnDate && !isValidFlexibleDate(injury.returnDate)) { await showAlertModal("Blad", "Przewidywany powrot musi byc w formacie dd-mm-rrrr."); return; } commitChange(() => upsertById(getTeamData().injuries, injury)); resetInjuryForm(); }
function editInjury(id) { const injury = getInjuries().find((item) => item.id === id); if (!injury) return; dom.injuryId.value = injury.id; dom.injuryPlayerId.value = injury.playerId; dom.injuryStartDate.value = injury.startDate; dom.injuryType.value = injury.type; dom.injurySeverity.value = injury.severity; dom.injuryReturnDate.value = injury.returnDate; switchTab("injuries"); }
async function deleteInjury(id) { if (!await showConfirmModal("Usun kontuzje", "Usunac kontuzje?")) return; commitChange(() => { getTeamData().injuries = getTeamData().injuries.filter((item) => item.id !== id); }); }
function resetInjuryForm() { dom.injuryForm.reset(); dom.injuryId.value = ""; }
async function handleSuspensionSubmit(event) { event.preventDefault(); const suspension = { id: dom.suspensionId.value || createId("suspension"), playerId: dom.suspensionPlayerId.value, endDate: normalizeDateInput(dom.suspensionEndDate.value) }; if (!suspension.playerId || !isValidFlexibleDate(suspension.endDate)) { await showAlertModal("Blad", "Wpisz date w formacie dd-mm-rrrr."); return; } commitChange(() => upsertById(getTeamData().suspensions, suspension)); resetSuspensionForm(); }
function editSuspension(id) { const suspension = getSuspensions().find((item) => item.id === id); if (!suspension) return; dom.suspensionId.value = suspension.id; dom.suspensionPlayerId.value = suspension.playerId; dom.suspensionEndDate.value = suspension.endDate; switchTab("suspensions"); }
async function deleteSuspension(id) { if (!await showConfirmModal("Usun zawieszenie", "Usunac zawieszenie?")) return; commitChange(() => { getTeamData().suspensions = getTeamData().suspensions.filter((item) => item.id !== id); }); }
function resetSuspensionForm() { dom.suspensionForm.reset(); dom.suspensionId.value = ""; }
