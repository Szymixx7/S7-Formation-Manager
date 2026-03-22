const STORAGE_KEY = "s7-formation-manager-state";
const DIRECTORY_DB_NAME = "s7-formation-manager-db";
const DIRECTORY_STORE_NAME = "handles";
const DIRECTORY_HANDLE_KEY = "data-directory";
const DATA_FILES = { metadata: "metadata.json", players: "players.json", injuries: "injuries.json", suspensions: "suspensions.json", squads: "squads.json" };
const STATUS_ICONS = { injury: "kontuzjowany.png", suspension: "zawieszony.png" };
const POSITION_OPTIONS = ["ATT", "LS", "N", "ŚN", "PS", "POM", "LP", "ŚPO", "ŚP", "PP", "ŚPD", "DEF", "CLS", "LO", "ŚO", "PO", "CPS", "BR"];

const dom = {};
let directoryHandle = null;
let saveTimer = null;
let historyStack = [];
let dragState = null;

const defaultState = () => {
    const squadId = createId("squad");
    const matchId = createId("match");
    return {
        metadata: {
            version: 2,
            lastOpenedSquadId: squadId,
            lastOpenedMatchLineupId: matchId,
            lineupMode: "general",
            settings: { injuryRetentionDays: null, suspensionRetentionDays: 1 }
        },
        players: [],
        injuries: [],
        suspensions: [],
        squads: [
            {
                id: squadId,
                name: "Skład 1",
                generalLineup: createLineupBase(),
                matchLineups: [{ ...createLineupBase(), id: matchId, name: "Mecz 1" }]
            }
        ]
    };
};

let state = migrateState(loadFromLocalStorage());

document.addEventListener("DOMContentLoaded", async () => {
    cacheDom();
    renderPositionOptions();
    bindEvents();
    await restoreDirectoryHandle();
    refreshAll();
});

function cacheDom() {
    dom.tabButtons = [...document.querySelectorAll(".tab-button")];
    dom.tabPanels = [...document.querySelectorAll(".tab-panel")];
    dom.chooseFolderButton = document.getElementById("choose-folder-button");
    dom.saveStatus = document.getElementById("save-status");
    dom.folderName = document.getElementById("folder-name");
    dom.undoButton = document.getElementById("undo-button");
    dom.squadList = document.getElementById("squad-list");
    dom.currentSquadName = document.getElementById("current-squad-name");
    dom.addSquadButton = document.getElementById("add-squad-button");
    dom.renameSquadButton = document.getElementById("rename-squad-button");
    dom.deleteSquadButton = document.getElementById("delete-squad-button");
    dom.lineupModeButtons = [...document.querySelectorAll("[data-lineup-mode]")];
    dom.matchToolbar = document.getElementById("match-lineup-toolbar");
    dom.matchLineupSelect = document.getElementById("match-lineup-select");
    dom.addMatchLineupButton = document.getElementById("add-match-lineup-button");
    dom.renameMatchLineupButton = document.getElementById("rename-match-lineup-button");
    dom.deleteMatchLineupButton = document.getElementById("delete-match-lineup-button");
    dom.formationInput = document.getElementById("formation-input-inline");
    dom.applyFormationButton = document.getElementById("apply-formation-button-inline");
    dom.availabilityPanel = document.getElementById("availability-panel-collapsible");
    dom.availabilityDetails = document.getElementById("availability-details");
    dom.pitch = document.getElementById("pitch");
    dom.lineupSummary = document.getElementById("lineup-summary");
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
    dom.suspensionForm = document.getElementById("suspension-form");
    dom.suspensionId = document.getElementById("suspension-id");
    dom.suspensionPlayerId = document.getElementById("suspension-player-id");
    dom.suspensionEndDate = document.getElementById("suspension-end-date");
    dom.cancelSuspensionEdit = document.getElementById("cancel-suspension-edit");
    dom.suspensionsList = document.getElementById("suspensions-list");
    dom.settingsForm = document.getElementById("settings-form");
    dom.injuryRetentionDays = document.getElementById("injury-retention-days");
    dom.suspensionRetentionDays = document.getElementById("suspension-retention-days");
    dom.modalOverlay = document.getElementById("modal-overlay");
    dom.modalTitle = document.getElementById("modal-title");
    dom.modalBody = document.getElementById("modal-body");
    dom.modalActions = document.getElementById("modal-actions");
    dom.modalCloseButton = document.getElementById("modal-close-button");
}

function bindEvents() {
    dom.tabButtons.forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));
    dom.chooseFolderButton.addEventListener("click", chooseDataFolder);
    dom.undoButton.addEventListener("click", undoLastChange);
    dom.addSquadButton.addEventListener("click", addSquad);
    dom.renameSquadButton.addEventListener("click", renameActiveSquad);
    dom.deleteSquadButton.addEventListener("click", deleteActiveSquad);
    dom.lineupModeButtons.forEach((button) => button.addEventListener("click", () => commitChange(() => {
        state.metadata.lineupMode = button.dataset.lineupMode;
    }, false)));
    dom.matchLineupSelect.addEventListener("change", () => commitChange(() => {
        state.metadata.lastOpenedMatchLineupId = dom.matchLineupSelect.value;
    }, false));
    dom.addMatchLineupButton.addEventListener("click", addMatchLineup);
    dom.renameMatchLineupButton.addEventListener("click", renameActiveMatchLineup);
    dom.deleteMatchLineupButton.addEventListener("click", deleteActiveMatchLineup);
    dom.applyFormationButton.addEventListener("click", applyFormation);
    dom.playerForm.addEventListener("submit", handlePlayerSubmit);
    dom.cancelPlayerEdit.addEventListener("click", resetPlayerForm);
    dom.injuryForm.addEventListener("submit", handleInjurySubmit);
    dom.cancelInjuryEdit.addEventListener("click", resetInjuryForm);
    dom.suspensionForm.addEventListener("submit", handleSuspensionSubmit);
    dom.cancelSuspensionEdit.addEventListener("click", resetSuspensionForm);
    dom.settingsForm.addEventListener("input", handleSettingsChange);
    dom.modalCloseButton.addEventListener("click", () => closeModal(null));
    dom.modalOverlay.addEventListener("click", (event) => {
        if (event.target === dom.modalOverlay) {
            closeModal(null);
        }
    });
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

function switchTab(tabId) {
    dom.tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tabId));
    dom.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tabId));
}

function refreshAll() {
    state = migrateState(state);
    ensureStateConsistency();
    cleanupHistoricalRecords();
    renderSquads();
    renderLineupControls();
    renderPitch();
    renderBench();
    renderPlayerLists();
    renderInjurySection();
    renderSuspensionSection();
    renderSettings();
    dom.undoButton.disabled = historyStack.length === 0;
    updateSaveStatus();
    saveToLocalStorage();
}

function ensureStateConsistency() {
    if (!state.squads.length) {
        state = defaultState();
    }
    if (!getActiveSquad()) {
        state.metadata.lastOpenedSquadId = state.squads[0].id;
    }
    const squad = getActiveSquad();
    if (!squad.matchLineups.length) {
        squad.matchLineups.push({ ...createLineupBase(), id: createId("match"), name: "Mecz 1" });
    }
    if (!getActiveMatchLineup()) {
        state.metadata.lastOpenedMatchLineupId = squad.matchLineups[0].id;
    }
    squad.generalLineup.placedPlayers = sanitizePlacedPlayers(squad.generalLineup.placedPlayers);
    squad.matchLineups.forEach((lineup) => {
        lineup.availablePlayerIds = uniqueIds((lineup.availablePlayerIds || []).filter((id) => getPlayerById(id)));
        lineup.placedPlayers = sanitizePlacedPlayers(lineup.placedPlayers).filter((item) => lineup.availablePlayerIds.includes(item.playerId));
    });
}

function renderSquads() {
    dom.squadList.innerHTML = "";
    state.squads.forEach((squad) => {
        const item = document.createElement("div");
        item.className = `squad-item${squad.id === state.metadata.lastOpenedSquadId ? " active" : ""}`;
        item.innerHTML = `<div class="squad-main"><strong>${escapeHtml(squad.name)}</strong><span class="status-text">${squad.matchLineups.length} składów meczowych</span></div>`;
        item.appendChild(actionButton("Otwórz", "ghost-button", () => commitChange(() => {
            state.metadata.lastOpenedSquadId = squad.id;
            state.metadata.lastOpenedMatchLineupId = squad.matchLineups[0]?.id || "";
        }, false)));
        dom.squadList.appendChild(item);
    });
}

function renderLineupControls() {
    const squad = getActiveSquad();
    const lineup = getCurrentLineup();
    const isMatchMode = state.metadata.lineupMode === "match";
    dom.currentSquadName.textContent = squad?.name || "Brak składu";
    dom.renameSquadButton.disabled = !squad;
    dom.deleteSquadButton.disabled = !squad;
    dom.lineupModeButtons.forEach((button) => button.classList.toggle("active", button.dataset.lineupMode === state.metadata.lineupMode));
    dom.matchToolbar.classList.toggle("hidden", !isMatchMode);
    dom.availabilityPanel.classList.toggle("hidden", !isMatchMode);
    dom.availabilityDetails.classList.toggle("hidden", !isMatchMode);
    dom.formationInput.value = lineup.draftFormation || lineup.formation || "4-3-3";
    dom.matchLineupSelect.innerHTML = "";
    if (squad) {
        squad.matchLineups.forEach((lineupItem) => {
            const option = document.createElement("option");
            option.value = lineupItem.id;
            option.textContent = lineupItem.name;
            option.selected = lineupItem.id === state.metadata.lastOpenedMatchLineupId;
            dom.matchLineupSelect.appendChild(option);
        });
    }
    renderAvailabilityPanel();
}

function renderAvailabilityPanel() {
    if (state.metadata.lineupMode !== "match") {
        dom.availabilityPanel.innerHTML = "";
        dom.availabilityDetails.open = false;
        return;
    }
    const lineup = getActiveMatchLineup();
    if (!lineup || !state.players.length) {
        dom.availabilityPanel.innerHTML = `<div class="empty-state">Najpierw dodaj zawodników.</div>`;
        dom.availabilityDetails.open = false;
        return;
    }
    dom.availabilityDetails.open = false;
    const grid = document.createElement("div");
    grid.className = "availability-grid";
    state.players.forEach((player) => {
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
    dom.availabilityPanel.innerHTML = `<div class="section-header"><div><p class="section-kicker">Lista obecności</p><h3>Dostępność na mecz</h3></div></div>`;
    dom.availabilityPanel.appendChild(grid);
}

function renderPitch() {
    const lineup = getCurrentLineup();
    dom.pitch.innerHTML = "";
    const guides = createFormationGuides(lineup.formation);
    guides.forEach((guide) => {
        const line = document.createElement("div");
        line.className = "formation-line";
        line.style.top = `${guide.top}%`;
        line.innerHTML = `<span>${guide.label}</span>`;
        dom.pitch.appendChild(line);
    });
    buildFormationTargets(lineup.formation).forEach((target) => {
        const marker = document.createElement("div");
        marker.className = "formation-target";
        marker.style.left = `${target.x}%`;
        marker.style.top = `${target.y}%`;
        marker.title = `Szablon ${target.label}`;
        dom.pitch.appendChild(marker);
    });
    dom.lineupSummary.textContent = `${lineup.placedPlayers.length} zawodników na boisku. Formacja: ${lineup.formation}.`;
    lineup.placedPlayers.forEach((placed) => {
        const player = getPlayerById(placed.playerId);
        if (!player) {
            return;
        }
        const wrapper = document.createElement("div");
        wrapper.className = "draggable-player";
        wrapper.style.left = `${placed.x}%`;
        wrapper.style.top = `${placed.y}%`;
        wrapper.dataset.playerId = player.id;
        wrapper.addEventListener("pointerdown", startDrag);
        const card = document.createElement("div");
        card.className = "player-card";
        card.innerHTML = `<img src="${player.miniface || "defaultMiniface.png"}" alt="${escapeHtml(getPlayerLabel(player))}"><div class="player-ident"><div class="player-head"><span class="player-number-badge">${player.number ? escapeHtml(player.number) : ""}</span><span class="player-name">${escapeHtml(getPlayerLabel(player))}</span><span class="player-icons"></span></div><div class="player-positions">${escapeHtml(formatPositions(player.positions))}</div></div>`;
        const iconRow = card.querySelector(".player-icons");
        getPlayerStatuses(player.id).forEach((status) => iconRow.appendChild(createStatusBadge(status)));
        wrapper.appendChild(card);
        dom.pitch.appendChild(wrapper);
    });
}

function renderBench() {
    const lineup = getCurrentLineup();
    const onPitch = new Set(lineup.placedPlayers.map((item) => item.playerId));
    const players = getAvailablePlayersForCurrentLineup().filter((player) => !onPitch.has(player.id));
    dom.benchList.innerHTML = "";
    if (!players.length) {
        dom.benchList.innerHTML = `<div class="empty-state">Brak zawodników poza boiskiem.</div>`;
        return;
    }
    players.forEach((player) => {
        const row = document.createElement("div");
        row.className = "bench-player";
        row.innerHTML = `<div class="miniface-placeholder"></div><div class="table-main"><strong>${escapeHtml(getPlayerLabel(player))}</strong><span class="status-text">${escapeHtml(formatPositions(player.positions))}${player.number ? ` | Nr ${escapeHtml(player.number)}` : ""}</span></div>`;
        const actions = document.createElement("div");
        actions.className = "toolbar-actions";
        actions.appendChild(actionButton("Na boisko", "ghost-button", () => commitChange(() => addPlayerToPitch(player.id))));
        getPlayerStatuses(player.id).forEach((status) => actions.appendChild(createStatusBadge(status)));
        row.appendChild(actions);
        dom.benchList.appendChild(row);
    });
}

function renderPlayerLists() {
    const options = [`<option value="">Wybierz zawodnika</option>`];
    state.players.forEach((player) => options.push(`<option value="${player.id}">${escapeHtml(getPlayerLabel(player))}</option>`));
    dom.injuryPlayerId.innerHTML = options.join("");
    dom.suspensionPlayerId.innerHTML = options.join("");
    dom.playersList.innerHTML = "";
    if (!state.players.length) {
        dom.playersList.innerHTML = `<div class="empty-state">Nie ma jeszcze zawodników w bazie.</div>`;
        return;
    }
    state.players.forEach((player) => {
        const row = document.createElement("div");
        row.className = "table-row";
        row.innerHTML = `<div class="table-main"><strong>${escapeHtml(getPlayerLabel(player))}</strong><span class="status-text">Pozycje: ${escapeHtml(formatPositions(player.positions))}${player.number ? ` | Nr ${escapeHtml(player.number)}` : ""}</span></div>`;
        const actions = document.createElement("div");
        actions.className = "toolbar-actions";
        actions.append(actionButton("Edytuj", "ghost-button", () => editPlayer(player.id)), actionButton("Usuń", "danger-button", () => deletePlayer(player.id)));
        row.appendChild(actions);
        dom.playersList.appendChild(row);
    });
}

function renderInjurySection() {
    dom.injuriesList.innerHTML = "";
    if (!state.injuries.length) {
        dom.injuriesList.innerHTML = `<div class="empty-state">Brak zapisanych kontuzji.</div>`;
        return;
    }
    [...state.injuries].sort(compareByDateDesc("startDate")).forEach((injury) => {
        const player = getPlayerById(injury.playerId);
        const row = document.createElement("div");
        row.className = "table-row";
        row.innerHTML = `<div class="table-main"><strong>${escapeHtml(player ? getPlayerLabel(player) : "Usunięty zawodnik")}</strong><span class="status-text">${isRecordActive(injury.returnDate) ? "Aktywna" : "Archiwalna"} | ${escapeHtml(injury.type)} | ${escapeHtml(injury.severity)} | od ${escapeHtml(injury.startDate)} do ${escapeHtml(injury.returnDate)}</span></div>`;
        const actions = document.createElement("div");
        actions.className = "toolbar-actions";
        actions.append(actionButton("Edytuj", "ghost-button", () => editInjury(injury.id)), actionButton("Usuń", "danger-button", () => deleteInjury(injury.id)));
        row.appendChild(actions);
        dom.injuriesList.appendChild(row);
    });
}

function renderSuspensionSection() {
    dom.suspensionsList.innerHTML = "";
    if (!state.suspensions.length) {
        dom.suspensionsList.innerHTML = `<div class="empty-state">Brak zapisanych zawieszeń.</div>`;
        return;
    }
    [...state.suspensions].sort(compareByDateDesc("endDate")).forEach((suspension) => {
        const player = getPlayerById(suspension.playerId);
        const row = document.createElement("div");
        row.className = "table-row";
        row.innerHTML = `<div class="table-main"><strong>${escapeHtml(player ? getPlayerLabel(player) : "Usunięty zawodnik")}</strong><span class="status-text">${isRecordActive(suspension.endDate) ? "Aktywne" : "Archiwalne"} | koniec: ${escapeHtml(suspension.endDate)}</span></div>`;
        const actions = document.createElement("div");
        actions.className = "toolbar-actions";
        actions.append(actionButton("Edytuj", "ghost-button", () => editSuspension(suspension.id)), actionButton("Usuń", "danger-button", () => deleteSuspension(suspension.id)));
        row.appendChild(actions);
        dom.suspensionsList.appendChild(row);
    });
}

function renderSettings() {
    dom.injuryRetentionDays.value = state.metadata.settings.injuryRetentionDays ?? "";
    dom.suspensionRetentionDays.value = state.metadata.settings.suspensionRetentionDays ?? "";
}

async function handlePlayerSubmit(event) {
    event.preventDefault();
    const miniface = await fileToDataUrl(dom.playerMiniface.files[0]);
    const player = {
        id: dom.playerId.value || createId("player"),
        firstName: dom.playerFirstName.value.trim(),
        lastName: dom.playerLastName.value.trim(),
        positions: getSelectedPositions(),
        number: dom.playerNumber.value.trim(),
        miniface: miniface || getPlayerById(dom.playerId.value)?.miniface || ""
    };
    if (!player.firstName && !player.lastName) {
        window.alert("Podaj przynajmniej imię albo nazwisko.");
        return;
    }
    commitChange(() => {
        const index = state.players.findIndex((item) => item.id === player.id);
        if (index >= 0) {
            state.players[index] = player;
        } else {
            state.players.push(player);
            state.squads.forEach((squad) => squad.matchLineups.forEach((lineup) => {
                lineup.availablePlayerIds = uniqueIds([...lineup.availablePlayerIds, player.id]);
            }));
        }
    });
    resetPlayerForm();
}

async function handleInjurySubmit(event) {
    event.preventDefault();
    const injury = {
        id: dom.injuryId.value || createId("injury"),
        playerId: dom.injuryPlayerId.value,
        startDate: normalizeDateInput(dom.injuryStartDate.value),
        type: dom.injuryType.value.trim(),
        severity: dom.injurySeverity.value.trim(),
        returnDate: normalizeDateInput(dom.injuryReturnDate.value)
    };
    if (!injury.playerId || !isValidFlexibleDate(injury.startDate) || !isValidFlexibleDate(injury.returnDate)) {
        window.alert("Wpisz daty w formacie dd-mm-rrrr.");
        return;
    }
    commitChange(() => upsertById(state.injuries, injury));
    resetInjuryForm();
}

async function handleSuspensionSubmit(event) {
    event.preventDefault();
    const suspension = {
        id: dom.suspensionId.value || createId("suspension"),
        playerId: dom.suspensionPlayerId.value,
        endDate: normalizeDateInput(dom.suspensionEndDate.value)
    };
    if (!suspension.playerId || !isValidFlexibleDate(suspension.endDate)) {
        window.alert("Wpisz datę w formacie dd-mm-rrrr.");
        return;
    }
    commitChange(() => upsertById(state.suspensions, suspension));
    resetSuspensionForm();
}

function handleSettingsChange() {
    commitChange(() => {
        state.metadata.settings.injuryRetentionDays = parseRetentionValue(dom.injuryRetentionDays.value);
        state.metadata.settings.suspensionRetentionDays = parseRetentionValue(dom.suspensionRetentionDays.value);
    });
}

async function addSquad() {
    const name = window.prompt("Nazwa nowego składu:", `Skład ${state.squads.length + 1}`);
    if (!name) {
        return;
    }
    commitChange(() => {
        const squad = {
            id: createId("squad"),
            name: name.trim(),
            generalLineup: createLineupBase(),
            matchLineups: [{ ...createLineupBase(), id: createId("match"), name: "Mecz 1", availablePlayerIds: state.players.map((player) => player.id) }]
        };
        state.squads.push(squad);
        state.metadata.lastOpenedSquadId = squad.id;
        state.metadata.lastOpenedMatchLineupId = squad.matchLineups[0].id;
        state.metadata.lineupMode = "general";
    });
}

async function renameActiveSquad() {
    const squad = getActiveSquad();
    const name = squad ? window.prompt("Nowa nazwa składu:", squad.name) : "";
    if (name) {
        commitChange(() => {
            squad.name = name.trim();
        });
    }
}

async function deleteActiveSquad() {
    const squad = getActiveSquad();
    if (squad && window.confirm(`Usunąć skład ${squad.name}?`)) {
        commitChange(() => {
            state.squads = state.squads.filter((item) => item.id !== squad.id);
        });
    }
}

async function addMatchLineup() {
    const squad = getActiveSquad();
    const name = squad ? window.prompt("Nazwa składu meczowego:", `Mecz ${squad.matchLineups.length + 1}`) : "";
    if (name) {
        commitChange(() => {
            const lineup = { ...createLineupBase(), id: createId("match"), name: name.trim(), availablePlayerIds: state.players.map((player) => player.id) };
            squad.matchLineups.push(lineup);
            state.metadata.lastOpenedMatchLineupId = lineup.id;
            state.metadata.lineupMode = "match";
        });
    }
}

async function renameActiveMatchLineup() {
    const lineup = getActiveMatchLineup();
    const name = lineup ? window.prompt("Nowa nazwa składu meczowego:", lineup.name) : "";
    if (name) {
        commitChange(() => {
            lineup.name = name.trim();
        });
    }
}

async function deleteActiveMatchLineup() {
    const squad = getActiveSquad();
    const lineup = getActiveMatchLineup();
    if (squad && lineup && window.confirm(`Usunąć ${lineup.name}?`)) {
        commitChange(() => {
            squad.matchLineups = squad.matchLineups.filter((item) => item.id !== lineup.id);
        });
    }
}

function applyFormation() {
    const lineup = getCurrentLineup();
    const nextFormation = dom.formationInput.value.trim() || "4-3-3";
    commitChange(() => {
        lineup.draftFormation = nextFormation;
        lineup.formation = nextFormation;
        applyFormationLayout(lineup);
    });
}

function editPlayer(playerId) {
    const player = getPlayerById(playerId);
    if (!player) {
        return;
    }
    dom.playerId.value = player.id;
    dom.playerFirstName.value = player.firstName;
    dom.playerLastName.value = player.lastName;
    dom.playerNumber.value = player.number;
    setSelectedPositions(player.positions);
    switchTab("players");
}

async function deletePlayer(playerId) {
    const player = getPlayerById(playerId);
    if (!player || !window.confirm(`Usunąć zawodnika ${getPlayerLabel(player)}?`)) {
        return;
    }
    commitChange(() => {
        state.players = state.players.filter((item) => item.id !== playerId);
        state.injuries = state.injuries.filter((item) => item.playerId !== playerId);
        state.suspensions = state.suspensions.filter((item) => item.playerId !== playerId);
        state.squads.forEach((squad) => {
            squad.generalLineup.placedPlayers = squad.generalLineup.placedPlayers.filter((item) => item.playerId !== playerId);
            squad.matchLineups.forEach((lineup) => {
                lineup.placedPlayers = lineup.placedPlayers.filter((item) => item.playerId !== playerId);
                lineup.availablePlayerIds = lineup.availablePlayerIds.filter((id) => id !== playerId);
            });
        });
    });
}

function editInjury(id) {
    const injury = state.injuries.find((item) => item.id === id);
    if (!injury) {
        return;
    }
    dom.injuryId.value = injury.id;
    dom.injuryPlayerId.value = injury.playerId;
    dom.injuryStartDate.value = injury.startDate;
    dom.injuryType.value = injury.type;
    dom.injurySeverity.value = injury.severity;
    dom.injuryReturnDate.value = injury.returnDate;
    switchTab("injuries");
}

function deleteInjury(id) {
    commitChange(() => {
        state.injuries = state.injuries.filter((item) => item.id !== id);
    });
}

function editSuspension(id) {
    const suspension = state.suspensions.find((item) => item.id === id);
    if (!suspension) {
        return;
    }
    dom.suspensionId.value = suspension.id;
    dom.suspensionPlayerId.value = suspension.playerId;
    dom.suspensionEndDate.value = suspension.endDate;
    switchTab("suspensions");
}

function deleteSuspension(id) {
    commitChange(() => {
        state.suspensions = state.suspensions.filter((item) => item.id !== id);
    });
}

function resetPlayerForm() {
    dom.playerForm.reset();
    dom.playerId.value = "";
    setSelectedPositions([]);
}

function resetInjuryForm() {
    dom.injuryForm.reset();
    dom.injuryId.value = "";
}

function resetSuspensionForm() {
    dom.suspensionForm.reset();
    dom.suspensionId.value = "";
}

function addPlayerToPitch(playerId) {
    const lineup = getCurrentLineup();
    if (lineup.placedPlayers.some((item) => item.playerId === playerId)) {
        return;
    }
    lineup.placedPlayers.push({ playerId, x: 50, y: clamp(20 + lineup.placedPlayers.length * 6, 10, 90) });
}

function startDrag(event) {
    const target = event.currentTarget;
    dragState = { playerId: target.dataset.playerId };
    target.classList.add("dragging");
    window.addEventListener("pointermove", onDrag);
    window.addEventListener("pointerup", endDrag, { once: true });
}

function onDrag(event) {
    if (!dragState) {
        return;
    }
    const rect = dom.pitch.getBoundingClientRect();
    dragState.x = clamp(((event.clientX - rect.left) / rect.width) * 100, 8, 92);
    dragState.y = clamp(((event.clientY - rect.top) / rect.height) * 100, 8, 92);
    const element = dom.pitch.querySelector(`[data-player-id="${dragState.playerId}"]`);
    if (element) {
        element.style.left = `${dragState.x}%`;
        element.style.top = `${dragState.y}%`;
    }
}

function endDrag() {
    window.removeEventListener("pointermove", onDrag);
    dom.pitch.querySelectorAll(".draggable-player").forEach((element) => element.classList.remove("dragging"));
    if (!dragState || dragState.x === undefined) {
        dragState = null;
        return;
    }
    const { playerId, x, y } = dragState;
    dragState = null;
    commitChange(() => {
        const placed = getCurrentLineup().placedPlayers.find((item) => item.playerId === playerId);
        if (placed) {
            placed.x = x;
            placed.y = y;
        }
    });
}

function addPlayerToPitch(playerId) {
    const lineup = getCurrentLineup();
    if (lineup.placedPlayers.some((item) => item.playerId === playerId)) {
        return;
    }
    const snap = getNearestFormationTarget(50, 50, lineup, playerId);
    lineup.placedPlayers.push({ playerId, x: snap.x, y: snap.y });
}

let selectedPitchPlayerId = null;
let selectedBenchPlayerId = null;

function getLineupActionsPanel() {
    return document.getElementById("lineup-actions-panel");
}

function getFormationTargetsForLineup(lineup) {
    const base = buildSmartFormationTargets(lineup.formation);
    const extraNeeded = Math.max(0, lineup.placedPlayers.length - base.length);
    for (let i = 0; i < extraNeeded; i += 1) {
        base.push({ x: 14 + (i % 5) * 18, y: 10 + Math.floor(i / 5) * 8, label: "EXTRA" });
    }
    return base;
}

function buildSmartFormationTargets(formation) {
    const rows = parseFormation(formation);
    const templates = [
        ["BR"],
        rowLabels("def", rows[0] || 4),
        rowLabels("mid", rows[1] || 3),
        rowLabels("att", rows[2] || 3),
        rowLabels("extra", rows[3] || 0),
        rowLabels("extra", rows[4] || 0)
    ];
    const targets = [];
    const rowTops = [90, 70, 48, 26, 14, 6];
    templates.forEach((labels, rowIndex) => {
        if (!labels.length) {
            return;
        }
        const top = rowTops[rowIndex] ?? 6;
        labels.forEach((label, index) => {
            targets.push({ x: ((index + 1) / (labels.length + 1)) * 100, y: top, label });
        });
    });
    return targets;
}

function rowLabels(type, count) {
    if (count <= 0) {
        return [];
    }
    const maps = {
        def: {
            3: ["LO", "ŚO", "PO"],
            4: ["LO", "ŚO", "ŚO", "PO"],
            5: ["LO", "CLS", "ŚO", "CPS", "PO"]
        },
        mid: {
            2: ["ŚPD", "ŚP"],
            3: ["LP", "ŚP", "PP"],
            4: ["LP", "ŚPD", "ŚP", "PP"],
            5: ["LP", "ŚPD", "ŚP", "ŚPO", "PP"]
        },
        att: {
            1: ["ATT"],
            2: ["LS", "PS"],
            3: ["LS", "N", "PS"],
            4: ["LP", "ŚN", "N", "PP"]
        },
        extra: {
            1: ["ATT"],
            2: ["LS", "PS"],
            3: ["LS", "N", "PS"],
            4: ["ATT", "ATT", "ATT", "ATT"],
            5: ["ATT", "ATT", "ATT", "ATT", "ATT"]
        }
    };
    return maps[type][count] || Array.from({ length: count }, () => type === "def" ? "DEF" : type === "mid" ? "ŚP" : "ATT");
}

function renderLineupControls() {
    const squad = getActiveSquad();
    const lineup = getCurrentLineup();
    const isMatchMode = state.metadata.lineupMode === "match";
    dom.currentSquadName.textContent = squad?.name || "Brak składu";
    dom.renameSquadButton.disabled = !squad;
    dom.deleteSquadButton.disabled = !squad;
    dom.lineupModeButtons.forEach((button) => button.classList.toggle("active", button.dataset.lineupMode === state.metadata.lineupMode));
    dom.matchToolbar.classList.toggle("hidden", !isMatchMode);
    dom.availabilityPanel.classList.toggle("hidden", !isMatchMode);
    dom.availabilityDetails.classList.toggle("hidden", !isMatchMode);
    dom.formationInput.value = lineup?.draftFormation || lineup?.formation || "4-3-3";
    dom.matchLineupSelect.innerHTML = "";
    if (squad) {
        squad.matchLineups.forEach((lineupItem) => {
            const option = document.createElement("option");
            option.value = lineupItem.id;
            option.textContent = lineupItem.name;
            option.selected = lineupItem.id === state.metadata.lastOpenedMatchLineupId;
            dom.matchLineupSelect.appendChild(option);
        });
    }
}

function renderAvailabilityPanel() {
    if (state.metadata.lineupMode !== "match") {
        dom.availabilityPanel.innerHTML = "";
        return;
    }
    const lineup = getActiveMatchLineup();
    if (!lineup) {
        dom.availabilityPanel.innerHTML = `<div class="empty-state">Brak składów meczowych.</div>`;
        return;
    }
    const grid = document.createElement("div");
    grid.className = "availability-grid";
    state.players.forEach((player) => {
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

function renderBench() {
    const lineup = getCurrentLineup();
    const onPitch = new Set(lineup.placedPlayers.map((item) => item.playerId));
    const players = getAvailablePlayersForCurrentLineup().filter((player) => !onPitch.has(player.id));
    dom.benchList.innerHTML = "";
    if (!players.length) {
        dom.benchList.innerHTML = `<div class="empty-state">Brak zawodników poza boiskiem.</div>`;
        return;
    }
    players.forEach((player) => {
        const row = document.createElement("div");
        row.className = `bench-player selectable${selectedBenchPlayerId === player.id ? " selected" : ""}`;
        row.innerHTML = `<div class="miniface-placeholder"></div><div class="table-main"><strong>${escapeHtml(getPlayerLabel(player))}</strong><span class="status-text">${escapeHtml(formatPositions(player.positions))}${player.number ? ` | Nr ${escapeHtml(player.number)}` : ""}</span></div>`;
        row.addEventListener("click", () => {
            selectedBenchPlayerId = player.id;
            selectedPitchPlayerId = null;
            refreshAll();
        });
        dom.benchList.appendChild(row);
    });
}

function renderPitch() {
    const lineup = getCurrentLineup();
    const actionPanel = getLineupActionsPanel();
    actionPanel.innerHTML = "";
    actionPanel.classList.toggle("hidden", !selectedPitchPlayerId);
    if (selectedPitchPlayerId) {
        actionPanel.append(
            actionButton("Mądry swap", "ghost-button", async () => smartSwapSelectedPlayer()),
            actionButton("Na ławkę", "danger-button", () => commitChange(() => {
                getCurrentLineup().placedPlayers = getCurrentLineup().placedPlayers.filter((item) => item.playerId !== selectedPitchPlayerId);
                selectedPitchPlayerId = null;
            }))
        );
    }

    dom.pitch.innerHTML = "";
    const targets = getFormationTargetsForLineup(lineup);
    targets.forEach((target) => {
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "formation-target";
        marker.style.left = `${target.x}%`;
        marker.style.top = `${target.y}%`;
        marker.title = target.label;
        marker.addEventListener("click", () => placeSelectedOnTarget(target));
        dom.pitch.appendChild(marker);
    });
    dom.lineupSummary.textContent = `${lineup.placedPlayers.length} zawodników na boisku. Formacja: ${lineup.formation}.`;
    lineup.placedPlayers.forEach((placed) => {
        const player = getPlayerById(placed.playerId);
        if (!player) {
            return;
        }
        const wrapper = document.createElement("button");
        wrapper.type = "button";
        wrapper.className = `draggable-player${selectedPitchPlayerId === player.id ? " selected" : ""}`;
        wrapper.style.left = `${placed.x}%`;
        wrapper.style.top = `${placed.y}%`;
        wrapper.dataset.playerId = player.id;
        wrapper.addEventListener("click", () => handlePitchPlayerClick(player.id));
        const card = document.createElement("div");
        card.className = "player-card";
        card.innerHTML = `<img src="${player.miniface || "defaultMiniface.png"}" alt="${escapeHtml(getPlayerLabel(player))}"><div class="player-ident"><div class="player-head"><span class="player-number-badge">${player.number ? escapeHtml(player.number) : ""}</span><span class="player-name">${escapeHtml(getPlayerLabel(player))}</span><span class="player-icons"></span></div><div class="player-positions">${escapeHtml(formatPositions(player.positions))}</div></div>`;
        const iconRow = card.querySelector(".player-icons");
        getPlayerStatuses(player.id).forEach((status) => iconRow.appendChild(createStatusBadge(status)));
        wrapper.appendChild(card);
        dom.pitch.appendChild(wrapper);
    });
}

function handlePitchPlayerClick(playerId) {
    if (selectedBenchPlayerId) {
        commitChange(() => {
            const lineup = getCurrentLineup();
            const current = lineup.placedPlayers.find((item) => item.playerId === playerId);
            if (current) {
                current.playerId = selectedBenchPlayerId;
                selectedBenchPlayerId = null;
                selectedPitchPlayerId = null;
            }
        });
        return;
    }
    if (selectedPitchPlayerId && selectedPitchPlayerId !== playerId) {
        commitChange(() => {
            const lineup = getCurrentLineup();
            const first = lineup.placedPlayers.find((item) => item.playerId === selectedPitchPlayerId);
            const second = lineup.placedPlayers.find((item) => item.playerId === playerId);
            if (first && second) {
                const temp = { x: first.x, y: first.y, playerId: first.playerId };
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
    if (!selectedPitchPlayerId && !selectedBenchPlayerId) {
        return;
    }
    commitChange(() => {
        const lineup = getCurrentLineup();
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
    const candidates = getAvailablePlayersForCurrentLineup().filter((candidate) => {
        if (candidate.id === player.id) {
            return false;
        }
        return candidate.positions.some((position) => player.positions.includes(position));
    });
    if (!candidates.length) {
        await showAlertModal("Mądry swap", "Brak podobnych pozycji do podmiany.");
        return;
    }
    const choice = await showChoiceModal("Mądry swap", candidates.map((candidate) => ({
        label: `${getPlayerLabel(candidate)}${candidate.number ? ` | ${candidate.number}` : ""} | ${formatPositions(candidate.positions)}`,
        value: candidate.id
    })));
    if (!choice) {
        return;
    }
    commitChange(() => {
        const lineup = getCurrentLineup();
        const current = lineup.placedPlayers.find((item) => item.playerId === selectedPitchPlayerId);
        if (current) {
            current.playerId = choice;
            selectedPitchPlayerId = null;
        }
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

function applyFormationLayout(lineup) {
    const targets = getFormationTargetsForLineup(lineup);
    const players = lineup.placedPlayers.map((placed) => ({ placed, player: getPlayerById(placed.playerId) })).filter((item) => item.player);
    const unusedTargets = [...targets];
    players.sort((left, right) => scorePlayerForLabel(right.player, "BR") - scorePlayerForLabel(left.player, "BR"));
    players.forEach(({ placed, player }) => {
        unusedTargets.sort((left, right) => scorePlayerForLabel(player, right.label) - scorePlayerForLabel(player, left.label));
        const target = unusedTargets.shift();
        if (target) {
            placed.x = target.x;
            placed.y = target.y;
        }
    });
}

function scorePlayerForLabel(player, label) {
    if (player.positions.includes(label)) {
        return 100;
    }
    const families = {
        BR: ["BR"],
        LO: ["LO", "DEF", "CLS"],
        PO: ["PO", "DEF", "CPS"],
        "ŚO": ["ŚO", "DEF", "CLS", "CPS"],
        CLS: ["CLS", "DEF", "LO"],
        CPS: ["CPS", "DEF", "PO"],
        "ŚPD": ["ŚPD", "ŚP", "DEF"],
        "ŚP": ["ŚP", "ŚPO", "ŚPD"],
        "ŚPO": ["ŚPO", "POM", "ŚP"],
        LP: ["LP", "POM", "ATT"],
        PP: ["PP", "POM", "ATT"],
        LS: ["LS", "N", "ATT", "ŚN"],
        N: ["N", "ATT", "ŚN"],
        PS: ["PS", "N", "ATT", "ŚN"],
        "ŚN": ["ŚN", "ATT", "N", "LS", "PS"],
        ATT: ["ATT", "ŚN", "N", "LS", "PS"]
    };
    const family = families[label] || [label];
    return player.positions.some((position) => family.includes(position)) ? 50 : 0;
}

function ensureStateConsistency() {
    if (!state.squads.length) {
        state = defaultState();
    }
    if (!getActiveSquad()) {
        state.metadata.lastOpenedSquadId = state.squads[0].id;
    }
    const squad = getActiveSquad();
    squad.generalLineup.placedPlayers = sanitizePlacedPlayers(squad.generalLineup.placedPlayers);
    squad.matchLineups.forEach((lineup) => {
        lineup.availablePlayerIds = uniqueIds((lineup.availablePlayerIds || []).filter((id) => getPlayerById(id)));
        lineup.placedPlayers = sanitizePlacedPlayers(lineup.placedPlayers).filter((item) => lineup.availablePlayerIds.includes(item.playerId));
    });
    if (squad.matchLineups.length && !getActiveMatchLineup()) {
        state.metadata.lastOpenedMatchLineupId = squad.matchLineups[0].id;
    }
}

function getActiveMatchLineup() {
    const squad = getActiveSquad();
    return squad.matchLineups.find((lineup) => lineup.id === state.metadata.lastOpenedMatchLineupId) || null;
}

function getAvailablePlayersForCurrentLineup() {
    if (state.metadata.lineupMode === "general") {
        return [...state.players];
    }
    const lineup = getActiveMatchLineup();
    return lineup ? state.players.filter((player) => lineup.availablePlayerIds.includes(player.id)) : [];
}

async function persistAll() {
    saveToLocalStorage();
    if (directoryHandle) {
        await writeJsonFile(DATA_FILES.metadata, state.metadata);
        await writeJsonFile(DATA_FILES.players, { players: state.players });
        state.squads.forEach(async (squad) => {
            const teamDir = await directoryHandle.getDirectoryHandle(sanitizeFolderName(squad.name), { create: true });
            await writeTeamJson(teamDir, "players.json", { players: state.players });
            await writeTeamJson(teamDir, "injuries.json", { injuries: state.injuries });
            await writeTeamJson(teamDir, "suspensions.json", { suspensions: state.suspensions });
            await writeTeamJson(teamDir, "team.json", { squad });
        });
    }
    updateSaveStatus();
}

function normalizeTeamData(teamData) {
    return {
        players: (teamData?.players || []).map((player) => ({
            id: player.id || createId("player"),
            firstName: player.firstName || "",
            lastName: player.lastName || "",
            positions: Array.isArray(player.positions) ? player.positions : [],
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

async function handlePlayerSubmit(event) {
    event.preventDefault();
    const existing = getPlayerById(dom.playerId.value);
    const miniface = await fileToDataUrl(dom.playerMiniface.files[0]);
    const playerId = dom.playerId.value || createId("player");
    const player = {
        id: playerId,
        firstName: dom.playerFirstName.value.trim(),
        lastName: dom.playerLastName.value.trim(),
        positions: getSelectedPositions(),
        number: dom.playerNumber.value.trim(),
        miniface: miniface || existing?.miniface || "",
        minifaceFileName: dom.playerMiniface.files[0] ? `miniface/${playerId}.png` : (existing?.minifaceFileName || "")
    };
    if (!player.firstName && !player.lastName) {
        await showAlertModal("Błąd", "Podaj przynajmniej imię albo nazwisko.");
        return;
    }
    commitChange(() => {
        const index = state.players.findIndex((item) => item.id === player.id);
        if (index >= 0) {
            state.players[index] = player;
        } else {
            state.players.push(player);
            state.squads.forEach((squad) => squad.matchLineups.forEach((lineup) => {
                lineup.availablePlayerIds = uniqueIds([...lineup.availablePlayerIds, player.id]);
            }));
        }
    });
    resetPlayerForm();
}

async function listDirectoryEntries(dirHandle) {
    const entries = [];
    if (!dirHandle?.entries) {
        return entries;
    }
    for await (const [name, handle] of dirHandle.entries()) {
        entries.push([name, handle]);
    }
    return entries;
}

async function readFileTextFromHandle(fileHandle) {
    const file = await fileHandle.getFile();
    return file.text();
}

async function readDataUrlFromHandle(fileHandle) {
    const file = await fileHandle.getFile();
    return readFileAsDataUrl(file);
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
    if (!player?.miniface || !String(player.miniface).startsWith("data:")) {
        return player?.minifaceFileName || "";
    }
    const relativePath = player.minifaceFileName || `miniface/${player.id}.png`;
    const directory = relativePath.includes("/") ? relativePath.split("/").slice(0, -1).join("/") : "";
    const fileName = relativePath.split("/").pop();
    const parentDir = directory ? await ensureNestedDirectory(teamDir, directory) : teamDir;
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
            minifaceFileName: player.minifaceFileName || ""
        };
        if (player.miniface && String(player.miniface).startsWith("data:")) {
            hydrated.miniface = player.miniface;
            if (!hydrated.minifaceFileName) {
                hydrated.minifaceFileName = `miniface/${hydrated.id}.png`;
            }
            return hydrated;
        }
        const fileRef = player.minifaceFileName || player.miniface;
        if (fileRef) {
            try {
                const fileHandle = await getNestedFileHandle(teamDir, fileRef);
                hydrated.miniface = await readDataUrlFromHandle(fileHandle);
                hydrated.minifaceFileName = fileRef;
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
    const injuries = await readTeamJsonFile(teamDir, "injuries.json");
    const suspensions = await readTeamJsonFile(teamDir, "suspensions.json");
    if (!teamMeta && !playersPayload && !injuries && !suspensions) {
        return null;
    }
    const hydratedPlayers = await hydratePlayersFromTeamDir(playersPayload?.players, teamDir);
    return {
        id: teamMeta?.id || createId("squad"),
        name: teamMeta?.name || fallbackName,
        teamFolder: fallbackName,
        teamData: normalizeTeamData({
            players: hydratedPlayers,
            injuries: injuries?.injuries,
            suspensions: suspensions?.suspensions
        }),
        generalLineup: migrateLineup(teamMeta?.generalLineup || createLineupBase(), false),
        matchLineups: (teamMeta?.matchLineups || []).map((lineup) => migrateLineup(lineup, true))
    };
}
chooseDataFolder = async function chooseDataFolderFinal() {
    if (!("showDirectoryPicker" in window)) {
        await showAlertModal("Brak obsługi", "Ta przeglądarka nie obsługuje wyboru folderu. Użyj aktualnego Chrome albo Edge.");
        return;
    }
    try {
        const pickedHandle = await window.showDirectoryPicker({ mode: "readwrite" });
        if (!pickedHandle) {
            return;
        }
        directoryHandle = pickedHandle;
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
        await showAlertModal("Błąd folderu", `Nie udało się otworzyć folderu danych: ${error?.message || error}`);
    }
};

restoreDirectoryHandle = async function restoreDirectoryHandleFinal() {
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
        updateSaveStatus();
    }
}

chooseDataFolder = async function chooseDataFolderFinal() {
    if (!("showDirectoryPicker" in window)) {
        await showAlertModal("Brak obsługi", "Ta przeglądarka nie obsługuje wyboru folderu. Użyj aktualnego Chrome albo Edge.");
        return;
    }
    try {
        const pickedHandle = await window.showDirectoryPicker({ mode: "readwrite" });
        if (!pickedHandle) {
            return;
        }
        directoryHandle = pickedHandle;
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
        await showAlertModal("Błąd folderu", `Nie udało się otworzyć folderu danych: ${error?.message || error}`);
    }
};

restoreDirectoryHandle = async function restoreDirectoryHandleFinal() {
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
        updateSaveStatus();
    }
};

async function chooseDataFolder() {
    if (!("showDirectoryPicker" in window)) {
        await showAlertModal("Brak obsługi", "Ta przeglądarka nie obsługuje wyboru folderu. Użyj aktualnego Chrome albo Edge.");
        return;
    }
    try {
        const pickedHandle = await window.showDirectoryPicker({ mode: "readwrite" });
        if (!pickedHandle) {
            return;
        }
        directoryHandle = pickedHandle;
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
        await showAlertModal("Błąd folderu", `Nie udało się otworzyć folderu danych: ${error?.message || error}`);
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
        updateSaveStatus();
    }
}

async function chooseDataFolder() {
    if (!("showDirectoryPicker" in window)) {
        await showAlertModal("Brak obsługi", "Ta przeglądarka nie obsługuje wyboru folderu. Użyj aktualnego Chrome albo Edge.");
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
        console.error(error);
        await showAlertModal("Błąd folderu", `Nie udało się wczytać wybranego folderu: ${error?.message || error}`);
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
        if (permission === "granted") {
            directoryHandle = handle;
            await loadOrCreateDirectoryData();
        }
    } catch (error) {
        console.error(error);
        directoryHandle = null;
        updateSaveStatus();
    }
}

async function loadOrCreateDirectoryData() {
    const metadata = await readJsonFile(DATA_FILES.metadata);
    const squadsPayload = await readJsonFile(DATA_FILES.squads);
    const rootPlayers = await readJsonFile(DATA_FILES.players);
    const rootInjuries = await readJsonFile(DATA_FILES.injuries);
    const rootSuspensions = await readJsonFile(DATA_FILES.suspensions);

    const discoveredSquads = [];
    for (const [folderName, handle] of await listDirectoryEntries(directoryHandle)) {
        if (handle.kind !== "directory") {
            continue;
        }
        const squad = await readTeamBundleFromDirectory(handle, folderName);
        if (squad) {
            discoveredSquads.push(squad);
        }
    }

    const rootSquads = squadsPayload?.squads || [];
    const mergedSquads = rootSquads.map((rootSquad, index) => {
        const folderName = rootSquad.teamFolder || sanitizeFolderName(rootSquad.name || `squad-${index + 1}`);
        const discovered = discoveredSquads.find((item) => item.teamFolder === folderName);
        return {
            id: rootSquad.id || discovered?.id || createId("squad"),
            name: rootSquad.name || discovered?.name || `Skład ${index + 1}`,
            teamFolder: folderName,
            teamData: normalizeTeamData(discovered?.teamData),
            generalLineup: migrateLineup(discovered?.generalLineup || rootSquad.generalLineup || createLineupBase(), false),
            matchLineups: (discovered?.matchLineups || rootSquad.matchLineups || []).map((lineup) => migrateLineup(lineup, true))
        };
    });

    discoveredSquads.forEach((discovered) => {
        if (!mergedSquads.some((item) => item.teamFolder === discovered.teamFolder)) {
            mergedSquads.push(discovered);
        }
    });

    state = migrateState({
        metadata,
        players: [],
        injuries: [],
        suspensions: [],
        squads: mergedSquads
    });

    if (!state.squads.length) {
        state = migrateState({
            metadata,
            players: rootPlayers?.players,
            injuries: rootInjuries?.injuries,
            suspensions: rootSuspensions?.suspensions
        });
    } else if (!state.squads.some((squad) => (squad.teamData?.players?.length || squad.teamData?.injuries?.length || squad.teamData?.suspensions?.length))) {
        ensureSquadTeamData(state.squads[0]);
        state.squads[0].teamData = normalizeTeamData({
            players: rootPlayers?.players,
            injuries: rootInjuries?.injuries,
            suspensions: rootSuspensions?.suspensions
        });
    }

    activeTeamDataSquadId = null;
    ensureStateConsistency();
}

async function persistAll() {
    saveToLocalStorage();
    if (!directoryHandle) {
        updateSaveStatus();
        return;
    }

    syncRootDataToSquad(getActiveSquad());
    const squadsPayload = {
        squads: state.squads.map((squad) => ({
            id: squad.id,
            name: squad.name,
            teamFolder: squad.teamFolder || sanitizeFolderName(squad.name),
            generalLineup: squad.generalLineup,
            matchLineups: squad.matchLineups
        }))
    };

    await writeJsonFile(DATA_FILES.metadata, state.metadata);
    await writeJsonFile(DATA_FILES.squads, squadsPayload);

    for (const squad of state.squads) {
        ensureSquadTeamData(squad);
        const teamDir = await directoryHandle.getDirectoryHandle(squad.teamFolder, { create: true });
        const serializedPlayers = [];
        for (const player of squad.teamData.players) {
            const minifaceFileName = await writePlayerMinifaceFile(teamDir, player);
            serializedPlayers.push({
                ...player,
                miniface: minifaceFileName || player.miniface || "",
                minifaceFileName
            });
        }
        await writeTeamJson(teamDir, "players.json", { players: serializedPlayers });
        await writeTeamJson(teamDir, "injuries.json", { injuries: squad.teamData.injuries });
        await writeTeamJson(teamDir, "suspensions.json", { suspensions: squad.teamData.suspensions });
        await writeTeamJson(teamDir, "team.json", {
            id: squad.id,
            name: squad.name,
            generalLineup: squad.generalLineup,
            matchLineups: squad.matchLineups
        });
    }

    updateSaveStatus();
}

function migrateState(rawState) {
    const base = defaultState();
    const next = rawState || base;
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
    const activeSquadId = metadata.lastOpenedSquadId || next.squads?.[0]?.id || base.metadata.lastOpenedSquadId;

    next.metadata = metadata;
    next.players = legacyTeamData.players;
    next.injuries = legacyTeamData.injuries;
    next.suspensions = legacyTeamData.suspensions;
    next.squads = (next.squads || base.squads).map((squad, index) => {
        const squadId = squad.id || createId("squad");
        const isActiveLegacySquad = squadId === activeSquadId || (!activeSquadId && index === 0);
        const teamData = squad.teamData && (squad.teamData.players?.length || squad.teamData.injuries?.length || squad.teamData.suspensions?.length)
            ? squad.teamData
            : (isActiveLegacySquad ? legacyTeamData : normalizeTeamData());

        return {
            id: squadId,
            name: squad.name || "Skład",
            teamFolder: squad.teamFolder || sanitizeFolderName(squad.name || `squad-${index + 1}`),
            teamData: normalizeTeamData(teamData),
            generalLineup: migrateLineup(squad.generalLineup || createLineupBase(), false),
            matchLineups: (squad.matchLineups || []).map((lineup) => migrateLineup(lineup, true))
        };
    });
    return next;
}

async function listDirectoryEntries(dirHandle) {
    const entries = [];
    if (!dirHandle?.entries) {
        return entries;
    }
    for await (const [name, handle] of dirHandle.entries()) {
        entries.push([name, handle]);
    }
    return entries;
}

async function readTeamBundleFromDirectory(teamDir, fallbackName) {
    const teamMeta = await readTeamJsonFile(teamDir, "team.json");
    const players = await readTeamJsonFile(teamDir, "players.json");
    const injuries = await readTeamJsonFile(teamDir, "injuries.json");
    const suspensions = await readTeamJsonFile(teamDir, "suspensions.json");

    if (!teamMeta && !players && !injuries && !suspensions) {
        return null;
    }

    return {
        id: teamMeta?.id || createId("squad"),
        name: teamMeta?.name || fallbackName,
        teamFolder: fallbackName,
        teamData: normalizeTeamData({
            players: players?.players,
            injuries: injuries?.injuries,
            suspensions: suspensions?.suspensions
        }),
        generalLineup: migrateLineup(teamMeta?.generalLineup || createLineupBase(), false),
        matchLineups: (teamMeta?.matchLineups || []).map((lineup) => migrateLineup(lineup, true))
    };
}

async function loadOrCreateDirectoryData() {
    const metadata = await readJsonFile(DATA_FILES.metadata);
    const squadsPayload = await readJsonFile(DATA_FILES.squads);
    const rootPlayers = await readJsonFile(DATA_FILES.players);
    const rootInjuries = await readJsonFile(DATA_FILES.injuries);
    const rootSuspensions = await readJsonFile(DATA_FILES.suspensions);

    const discoveredSquads = [];
    const entries = await listDirectoryEntries(directoryHandle);
    for (const [folderName, handle] of entries) {
        if (handle.kind !== "directory") {
            continue;
        }
        const squad = await readTeamBundleFromDirectory(handle, folderName);
        if (squad) {
            discoveredSquads.push(squad);
        }
    }

    const rootSquads = squadsPayload?.squads || [];
    const mergedSquads = rootSquads.length
        ? await Promise.all(rootSquads.map(async (rootSquad, index) => {
            const folderName = rootSquad.teamFolder || sanitizeFolderName(rootSquad.name || `squad-${index + 1}`);
            const discovered = discoveredSquads.find((item) => item.teamFolder === folderName);
            return {
                id: rootSquad.id || discovered?.id || createId("squad"),
                name: rootSquad.name || discovered?.name || `Skład ${index + 1}`,
                teamFolder: folderName,
                teamData: normalizeTeamData(discovered?.teamData),
                generalLineup: migrateLineup(rootSquad.generalLineup || discovered?.generalLineup || createLineupBase(), false),
                matchLineups: (rootSquad.matchLineups || discovered?.matchLineups || []).map((lineup) => migrateLineup(lineup, true))
            };
        }))
        : discoveredSquads;

    state = migrateState({
        metadata,
        players: [],
        injuries: [],
        suspensions: [],
        squads: mergedSquads
    });

    if (!state.squads.length) {
        state = migrateState({
            metadata,
            players: rootPlayers?.players,
            injuries: rootInjuries?.injuries,
            suspensions: rootSuspensions?.suspensions,
            squads: undefined
        });
    } else if (!state.squads.some((squad) => squad.teamData?.players?.length || squad.teamData?.injuries?.length || squad.teamData?.suspensions?.length)) {
        ensureSquadTeamData(state.squads[0]);
        state.squads[0].teamData = normalizeTeamData({
            players: rootPlayers?.players,
            injuries: rootInjuries?.injuries,
            suspensions: rootSuspensions?.suspensions
        });
    }

    activeTeamDataSquadId = null;
    ensureStateConsistency();
}

async function writeTeamJson(dirHandle, filename, data) {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
}

function sanitizeFolderName(value) {
    return String(value || "sklad").replace(/[<>:"/\\|?*]+/g, "_").trim() || "sklad";
}

function renderLineupControls() {
    const squad = getActiveSquad();
    const lineup = getCurrentLineup();
    const isMatchMode = state.metadata.lineupMode === "match";
    dom.currentSquadName.textContent = squad?.name || "Brak składu";
    dom.renameSquadButton.disabled = !squad;
    dom.deleteSquadButton.disabled = !squad;
    dom.lineupModeButtons.forEach((button) => button.classList.toggle("active", button.dataset.lineupMode === state.metadata.lineupMode));
    dom.matchToolbar.classList.toggle("hidden", !isMatchMode);
    dom.availabilityDetails.classList.toggle("hidden", !isMatchMode);
    dom.formationInput.value = lineup?.draftFormation || lineup?.formation || "4-3-3";
    dom.matchLineupSelect.innerHTML = "";
    if (squad) {
        squad.matchLineups.forEach((lineupItem) => {
            const option = document.createElement("option");
            option.value = lineupItem.id;
            option.textContent = lineupItem.name;
            option.selected = lineupItem.id === state.metadata.lastOpenedMatchLineupId;
            dom.matchLineupSelect.appendChild(option);
        });
    }
    renderAvailabilityPanel();
}

function renderAvailabilityPanel() {
    if (state.metadata.lineupMode !== "match") {
        dom.availabilityPanel.innerHTML = "";
        return;
    }
    const lineup = getActiveMatchLineup();
    if (!lineup) {
        dom.availabilityPanel.innerHTML = `<div class="empty-state">Brak składów meczowych.</div>`;
        return;
    }
    const grid = document.createElement("div");
    grid.className = "availability-grid";
    if (!state.players.length) {
        dom.availabilityPanel.innerHTML = `<div class="empty-state">Najpierw dodaj zawodników.</div>`;
        return;
    }
    state.players.forEach((player) => {
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
                if (selectedBenchPlayerId === player.id) {
                    selectedBenchPlayerId = null;
                }
                if (selectedPitchPlayerId === player.id) {
                    selectedPitchPlayerId = null;
                }
            }
        }));
        row.appendChild(checkbox);
        grid.appendChild(row);
    });
    dom.availabilityPanel.innerHTML = "";
    dom.availabilityPanel.appendChild(grid);
}

function renderBench() {
    const lineup = getCurrentLineup();
    const onPitch = new Set(lineup.placedPlayers.map((item) => item.playerId));
    const players = getAvailablePlayersForCurrentLineup().filter((player) => !onPitch.has(player.id));
    dom.benchList.innerHTML = "";
    if (!players.length) {
        dom.benchList.innerHTML = `<div class="empty-state">Brak zawodników poza boiskiem.</div>`;
        return;
    }
    players.forEach((player) => {
        const row = document.createElement("div");
        row.className = `bench-player selectable${selectedBenchPlayerId === player.id ? " selected" : ""}`;
        row.innerHTML = `<div class="miniface-placeholder"></div><div class="table-main"><strong>${escapeHtml(getPlayerLabel(player))}</strong><span class="status-text">${escapeHtml(formatPositions(player.positions))}${player.number ? ` | Nr ${escapeHtml(player.number)}` : ""}</span></div>`;
        const actions = document.createElement("div");
        actions.className = "player-icons";
        getPlayerStatuses(player.id).forEach((status) => actions.appendChild(createStatusBadge(status)));
        row.appendChild(actions);
        row.addEventListener("click", () => {
            selectedBenchPlayerId = selectedBenchPlayerId === player.id ? null : player.id;
            selectedPitchPlayerId = null;
            refreshAll();
        });
        dom.benchList.appendChild(row);
    });
}

function renderPitch() {
    const lineup = getCurrentLineup();
    const actionPanel = getLineupActionsPanel();
    actionPanel.innerHTML = "";
    actionPanel.classList.toggle("hidden", !selectedPitchPlayerId);
    if (selectedPitchPlayerId) {
        actionPanel.append(
            actionButton("Mądry swap", "ghost-button", async () => smartSwapSelectedPlayer()),
            actionButton("Na ławkę", "danger-button", () => commitChange(() => {
                getCurrentLineup().placedPlayers = getCurrentLineup().placedPlayers.filter((item) => item.playerId !== selectedPitchPlayerId);
                selectedPitchPlayerId = null;
            }))
        );
    }

    dom.pitch.innerHTML = "";
    const targets = getFormationTargetsForLineup(lineup);
    targets.forEach((target) => {
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "formation-target";
        marker.style.left = `${target.x}%`;
        marker.style.top = `${target.y}%`;
        marker.title = target.label;
        marker.addEventListener("click", () => placeSelectedOnTarget(target));
        dom.pitch.appendChild(marker);
    });
    dom.lineupSummary.textContent = `${lineup.placedPlayers.length} zawodników na boisku. Formacja: ${lineup.formation}.`;
    lineup.placedPlayers.forEach((placed) => {
        const player = getPlayerById(placed.playerId);
        if (!player) {
            return;
        }
        const wrapper = document.createElement("button");
        wrapper.type = "button";
        wrapper.className = `draggable-player${selectedPitchPlayerId === player.id ? " selected" : ""}`;
        wrapper.style.left = `${placed.x}%`;
        wrapper.style.top = `${placed.y}%`;
        wrapper.dataset.playerId = player.id;
        wrapper.addEventListener("click", () => handlePitchPlayerClick(player.id));
        const card = document.createElement("div");
        card.className = "player-card";
        card.innerHTML = `<img src="${player.miniface || "defaultMiniface.png"}" alt="${escapeHtml(getPlayerLabel(player))}"><div class="player-ident"><div class="player-head"><span class="player-number-badge">${player.number ? escapeHtml(player.number) : ""}</span><span class="player-name">${escapeHtml(getPlayerLabel(player))}</span><span class="player-icons"></span></div><div class="player-positions">${escapeHtml(formatPositions(player.positions))}</div></div>`;
        const iconRow = card.querySelector(".player-icons");
        getPlayerStatuses(player.id).forEach((status) => iconRow.appendChild(createStatusBadge(status)));
        wrapper.appendChild(card);
        dom.pitch.appendChild(wrapper);
    });
}

function commitChange(mutator, trackHistory = true) {
    const snapshot = JSON.stringify(state);
    mutator();
    if (trackHistory && snapshot !== JSON.stringify(state)) {
        historyStack.push(snapshot);
        if (historyStack.length > 50) {
            historyStack.shift();
        }
    }
    scheduleSave();
    refreshAll();
}

function undoLastChange() {
    const snapshot = historyStack.pop();
    if (!snapshot) {
        return;
    }
    state = migrateState(JSON.parse(snapshot));
    scheduleSave();
    refreshAll();
}

function cleanupHistoricalRecords() {
    state.injuries = state.injuries.filter((item) => shouldKeepHistorical(item.returnDate, state.metadata.settings.injuryRetentionDays));
    state.suspensions = state.suspensions.filter((item) => shouldKeepHistorical(item.endDate, state.metadata.settings.suspensionRetentionDays));
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

function getCurrentLineup() {
    return state.metadata.lineupMode === "match" ? getActiveMatchLineup() : getActiveSquad().generalLineup;
}

function getActiveSquad() {
    return state.squads.find((squad) => squad.id === state.metadata.lastOpenedSquadId) || state.squads[0];
}

function getActiveMatchLineup() {
    const squad = getActiveSquad();
    return squad.matchLineups.find((lineup) => lineup.id === state.metadata.lastOpenedMatchLineupId) || squad.matchLineups[0];
}

function getAvailablePlayersForCurrentLineup() {
    if (state.metadata.lineupMode === "general") {
        return [...state.players];
    }
    const lineup = getActiveMatchLineup();
    return state.players.filter((player) => lineup.availablePlayerIds.includes(player.id));
}

function getPlayerStatuses(playerId) {
    const statuses = [];
    const injury = state.injuries.find((item) => item.playerId === playerId && isRecordActive(item.returnDate));
    const suspension = state.suspensions.find((item) => item.playerId === playerId && isRecordActive(item.endDate));
    if (injury) {
        statuses.push({ type: "injury", label: `Kontuzja: ${injury.type}` });
    }
    if (suspension) {
        statuses.push({ type: "suspension", label: `Zawieszenie do ${suspension.endDate}` });
    }
    return statuses;
}

function createStatusBadge(status) {
    const badge = document.createElement("span");
    badge.className = "status-badge";
    const icon = document.createElement("img");
    icon.src = STATUS_ICONS[status.type];
    icon.alt = status.label;
    badge.title = "Kliknij po szczegóły";
    icon.addEventListener("error", () => {
        icon.remove();
        badge.textContent = status.type === "injury" ? "K" : "Z";
    }, { once: true });
    badge.addEventListener("click", () => {
        window.alert(status.label);
    });
    badge.append(icon);
    return badge;
}

function createFormationGuides(formation) {
    const rows = parseFormation(formation);
    return [{ top: 88, label: "BR" }, ...rows.map((count, index) => ({ top: 72 - index * (54 / Math.max(rows.length - 1, 1)), label: String(count) }))];
}

function buildFormationTargets(formation) {
    const rows = [1, ...parseFormation(formation)];
    const targets = [];
    rows.forEach((count, rowIndex) => {
        const top = rowIndex === 0 ? 88 : 72 - (rowIndex - 1) * (54 / Math.max(rows.length - 2, 1));
        for (let slot = 0; slot < count; slot += 1) {
            targets.push({ x: ((slot + 1) / (count + 1)) * 100, y: top, label: rowIndex === 0 ? "BR" : `${count}` });
        }
    });
    return targets;
}

function applyFormationLayout(lineup) {
    const rows = [1, ...parseFormation(lineup.formation)];
    const players = [...lineup.placedPlayers];
    if (!players.length) {
        return;
    }
    const targets = [];
    rows.forEach((count, rowIndex) => {
        const top = rowIndex === 0 ? 88 : 72 - (rowIndex - 1) * (54 / Math.max(rows.length - 2, 1));
        for (let slot = 0; slot < count; slot += 1) {
            targets.push({ x: ((slot + 1) / (count + 1)) * 100, y: top });
        }
    });
    while (targets.length < players.length) {
        const extra = targets.length - rows.reduce((sum, count) => sum + count, 0);
        targets.push({ x: ((extra % 4) + 1) * 20, y: 12 + Math.floor(extra / 4) * 6 });
    }
    players.forEach((placed, index) => {
        placed.x = clamp(targets[index].x, 8, 92);
        placed.y = clamp(targets[index].y, 8, 92);
    });
}

function migrateState(rawState) {
    const base = defaultState();
    const next = rawState || base;
    next.metadata = { ...base.metadata, ...next.metadata, settings: { ...base.metadata.settings, ...(next.metadata?.settings || {}) } };
    next.players = (next.players || []).map((player) => ({
        id: player.id || createId("player"),
        firstName: player.firstName || "",
        lastName: player.lastName || "",
        positions: Array.isArray(player.positions) ? player.positions : [],
        number: player.number || "",
        miniface: player.miniface || ""
    }));
    next.injuries = next.injuries || [];
    next.suspensions = next.suspensions || [];
    next.squads = (next.squads || base.squads).map((squad) => ({
        id: squad.id || createId("squad"),
        name: squad.name || "Skład",
        generalLineup: migrateLineup(squad.generalLineup || createLineupBase(), false),
        matchLineups: (squad.matchLineups || []).map((lineup) => migrateLineup(lineup, true))
    }));
    return next;
}

function migrateLineup(lineup, isMatch) {
    const migrated = { ...createLineupBase(), ...lineup };
    migrated.draftFormation = migrated.draftFormation || migrated.formation || "4-3-3";
    migrated.formation = migrated.formation || "4-3-3";
    migrated.availablePlayerIds = isMatch ? uniqueIds(migrated.availablePlayerIds || []) : [];
    if (!Array.isArray(migrated.placedPlayers)) {
        migrated.placedPlayers = migrateAssignments(migrated.assignments || {}, migrated.formation);
    }
    delete migrated.assignments;
    return migrated;
}

function migrateAssignments(assignments, formation) {
    const guides = createFormationGuides(formation);
    return Object.entries(assignments).filter(([, playerId]) => playerId).map(([slotId, playerId]) => {
        if (slotId === "gk-1") {
            return { playerId, x: 50, y: 88 };
        }
        const match = slotId.match(/row-(\d+)-slot-(\d+)/);
        const rowIndex = match ? Number(match[1]) : 1;
        const slotIndex = match ? Number(match[2]) : 1;
        const count = parseFormation(formation)[rowIndex - 1] || 3;
        return { playerId, x: (slotIndex / (count + 1)) * 100, y: guides[rowIndex]?.top || 72 };
    });
}

function createLineupBase() {
    return { formation: "4-3-3", draftFormation: "4-3-3", placedPlayers: [], availablePlayerIds: [] };
}

function sanitizePlacedPlayers(items) {
    const seen = new Set();
    return (items || []).filter((item) => {
        if (!item || !item.playerId || seen.has(item.playerId) || !getPlayerById(item.playerId)) {
            return false;
        }
        seen.add(item.playerId);
        item.x = clamp(Number(item.x) || 50, 8, 92);
        item.y = clamp(Number(item.y) || 50, 8, 92);
        return true;
    });
}

function getSelectedPositions() {
    return [...dom.playerPositions.querySelectorAll("input:checked")].map((input) => input.value);
}

function setSelectedPositions(positions) {
    dom.playerPositions.querySelectorAll("input").forEach((input) => {
        input.checked = positions.includes(input.value);
    });
}

function getPlayerById(playerId) {
    return state.players.find((player) => player.id === playerId) || null;
}

function getPlayerLabel(player) {
    const label = `${player.firstName} ${player.lastName}`.trim();
    return label || "Bez nazwy";
}

function formatPositions(positions) {
    return positions?.length ? positions.join(", ") : "Bez pozycji";
}

function normalizeDateInput(value) {
    const parts = String(value).trim().replaceAll("/", "-").replaceAll(".", "-").split("-").filter(Boolean);
    return parts.length === 3 ? `${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}-${parts[2]}` : String(value).trim();
}

function isValidFlexibleDate(value) {
    const parsed = parseFlexibleDate(value);
    return Boolean(parsed && parsed.day >= 1 && parsed.day <= 31 && parsed.month >= 1 && parsed.month <= 12);
}

function parseFlexibleDate(value) {
    const match = String(value).trim().match(/^(\d{1,2})-(\d{1,2})-(\d+)$/);
    if (!match) {
        return null;
    }
    return { day: Number(match[1]), month: Number(match[2]), year: BigInt(match[3]) };
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

function getTodayFlexibleDate() {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
}

function isRecordActive(endDate) {
    return compareFlexibleDates(endDate, getTodayFlexibleDate()) >= 0;
}

function compareByDateDesc(field) {
    return (a, b) => compareFlexibleDates(b[field], a[field]);
}

function parseFormation(value) {
    const numbers = String(value).split("-").map((part) => Number.parseInt(part.trim(), 10)).filter((part) => Number.isFinite(part) && part > 0);
    return numbers.length ? numbers : [4, 3, 3];
}

async function chooseDataFolder() {
    if (!("showDirectoryPicker" in window)) {
        window.alert("Ta przeglądarka nie obsługuje wyboru folderu. Uruchom aplikację w aktualnym Chrome albo Edge.");
        return;
    }
    try {
        directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
        await storeDirectoryHandle(directoryHandle);
        await loadOrCreateDirectoryData();
        scheduleSave(true);
        refreshAll();
    } catch (error) {
        console.error(error);
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
        if (permission === "granted") {
            directoryHandle = handle;
            await loadOrCreateDirectoryData();
        }
    } catch (error) {
        console.error(error);
    }
}

function openDirectoryDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DIRECTORY_DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(DIRECTORY_STORE_NAME);
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
    const value = await new Promise((resolve, reject) => {
        const tx = db.transaction(DIRECTORY_STORE_NAME, "readonly");
        const request = tx.objectStore(DIRECTORY_STORE_NAME).get(DIRECTORY_HANDLE_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
}

async function loadOrCreateDirectoryData() {
    const loaded = {};
    for (const [key, filename] of Object.entries(DATA_FILES)) {
        loaded[key] = await readJsonFile(filename);
    }
    state = migrateState({
        metadata: loaded.metadata,
        players: loaded.players?.players,
        injuries: loaded.injuries?.injuries,
        suspensions: loaded.suspensions?.suspensions,
        squads: loaded.squads?.squads
    });
}

async function readJsonFile(filename) {
    try {
        const fileHandle = await directoryHandle.getFileHandle(filename);
        const file = await fileHandle.getFile();
        return JSON.parse(await file.text());
    } catch (error) {
        return null;
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

async function persistAll() {
    saveToLocalStorage();
    if (directoryHandle) {
        await writeJsonFile(DATA_FILES.metadata, state.metadata);
        await writeJsonFile(DATA_FILES.players, { players: state.players });
        await writeJsonFile(DATA_FILES.injuries, { injuries: state.injuries });
        await writeJsonFile(DATA_FILES.suspensions, { suspensions: state.suspensions });
        await writeJsonFile(DATA_FILES.squads, { squads: state.squads });
    }
    updateSaveStatus();
}

// Final active overrides for team-folder loading and miniface file persistence.
function normalizeTeamData(teamData) {
    return {
        players: (teamData?.players || []).map((player) => ({
            id: player.id || createId("player"),
            firstName: player.firstName || "",
            lastName: player.lastName || "",
            positions: Array.isArray(player.positions) ? player.positions : [],
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

async function handlePlayerSubmit(event) {
    event.preventDefault();
    const existing = getPlayerById(dom.playerId.value);
    const playerId = dom.playerId.value || createId("player");
    const miniface = await fileToDataUrl(dom.playerMiniface.files[0]);
    const player = {
        id: playerId,
        firstName: dom.playerFirstName.value.trim(),
        lastName: dom.playerLastName.value.trim(),
        positions: getSelectedPositions(),
        number: dom.playerNumber.value.trim(),
        miniface: miniface || existing?.miniface || "",
        minifaceFileName: dom.playerMiniface.files[0] ? `miniface/${playerId}.png` : (existing?.minifaceFileName || "")
    };
    if (!player.firstName && !player.lastName) {
        await showAlertModal("Błąd", "Podaj przynajmniej imię albo nazwisko.");
        return;
    }
    commitChange(() => {
        const index = state.players.findIndex((item) => item.id === player.id);
        if (index >= 0) {
            state.players[index] = player;
        } else {
            state.players.push(player);
            state.squads.forEach((squad) => squad.matchLineups.forEach((lineup) => {
                lineup.availablePlayerIds = uniqueIds([...lineup.availablePlayerIds, player.id]);
            }));
        }
    });
    resetPlayerForm();
}

async function listDirectoryEntries(dirHandle) {
    const entries = [];
    if (!dirHandle?.entries) {
        return entries;
    }
    for await (const [name, handle] of dirHandle.entries()) {
        entries.push([name, handle]);
    }
    return entries;
}

async function readDataUrlFromHandle(fileHandle) {
    const file = await fileHandle.getFile();
    return readFileAsDataUrl(file);
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
    if (!player?.miniface || !String(player.miniface).startsWith("data:")) {
        return player?.minifaceFileName || "";
    }
    const relativePath = player.minifaceFileName || `miniface/${player.id}.png`;
    const directoryPath = relativePath.split("/").slice(0, -1).join("/");
    const fileName = relativePath.split("/").pop();
    const parentDir = directoryPath ? await ensureNestedDirectory(teamDir, directoryPath) : teamDir;
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
            minifaceFileName: player.minifaceFileName || ""
        };
        if (player.miniface && String(player.miniface).startsWith("data:")) {
            hydrated.miniface = player.miniface;
            hydrated.minifaceFileName = player.minifaceFileName || `miniface/${hydrated.id}.png`;
            return hydrated;
        }
        const fileRef = player.minifaceFileName || player.miniface;
        if (fileRef) {
            try {
                const fileHandle = await getNestedFileHandle(teamDir, fileRef);
                hydrated.miniface = await readDataUrlFromHandle(fileHandle);
                hydrated.minifaceFileName = fileRef;
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
    const hydratedPlayers = await hydratePlayersFromTeamDir(playersPayload?.players, teamDir);
    return {
        id: teamMeta?.id || createId("squad"),
        name: teamMeta?.name || fallbackName,
        teamFolder: fallbackName,
        teamData: normalizeTeamData({
            players: hydratedPlayers,
            injuries: injuriesPayload?.injuries,
            suspensions: suspensionsPayload?.suspensions
        }),
        generalLineup: migrateLineup(teamMeta?.generalLineup || createLineupBase(), false),
        matchLineups: (teamMeta?.matchLineups || []).map((lineup) => migrateLineup(lineup, true))
    };
}
chooseDataFolder = async function chooseDataFolderFinal() {
    if (!("showDirectoryPicker" in window)) {
        await showAlertModal("Brak obsługi", "Ta przeglądarka nie obsługuje wyboru folderu. Użyj aktualnego Chrome albo Edge.");
        return;
    }
    try {
        const pickedHandle = await window.showDirectoryPicker({ mode: "readwrite" });
        if (!pickedHandle) {
            return;
        }
        directoryHandle = pickedHandle;
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
        await showAlertModal("Błąd folderu", `Nie udało się otworzyć folderu danych: ${error?.message || error}`);
    }
};

restoreDirectoryHandle = async function restoreDirectoryHandleFinal() {
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
        updateSaveStatus();
    }
};

async function loadOrCreateDirectoryData() {
    const metadata = await readJsonFile(DATA_FILES.metadata);
    const squadsPayload = await readJsonFile(DATA_FILES.squads);
    const rootPlayers = await readJsonFile(DATA_FILES.players);
    const rootInjuries = await readJsonFile(DATA_FILES.injuries);
    const rootSuspensions = await readJsonFile(DATA_FILES.suspensions);

    const discoveredSquads = [];
    for (const [folderName, handle] of await listDirectoryEntries(directoryHandle)) {
        if (handle.kind !== "directory") {
            continue;
        }
        const squad = await readTeamBundleFromDirectory(handle, folderName);
        if (squad) {
            discoveredSquads.push(squad);
        }
    }

    const rootSquads = squadsPayload?.squads || [];
    const mergedSquads = rootSquads.map((rootSquad, index) => {
        const folderName = rootSquad.teamFolder || sanitizeFolderName(rootSquad.name || `squad-${index + 1}`);
        const discovered = discoveredSquads.find((item) => item.teamFolder === folderName);
        return {
            id: rootSquad.id || discovered?.id || createId("squad"),
            name: rootSquad.name || discovered?.name || `Skład ${index + 1}`,
            teamFolder: folderName,
            teamData: normalizeTeamData(discovered?.teamData),
            generalLineup: migrateLineup(discovered?.generalLineup || rootSquad.generalLineup || createLineupBase(), false),
            matchLineups: (discovered?.matchLineups || rootSquad.matchLineups || []).map((lineup) => migrateLineup(lineup, true))
        };
    });

    discoveredSquads.forEach((discovered) => {
        if (!mergedSquads.some((item) => item.teamFolder === discovered.teamFolder)) {
            mergedSquads.push(discovered);
        }
    });

    state = migrateState({
        metadata,
        players: [],
        injuries: [],
        suspensions: [],
        squads: mergedSquads
    });

    if (!state.squads.length) {
        state = migrateState({
            metadata,
            players: rootPlayers?.players,
            injuries: rootInjuries?.injuries,
            suspensions: rootSuspensions?.suspensions
        });
    } else if (!state.squads.some((squad) => squad.teamData?.players?.length || squad.teamData?.injuries?.length || squad.teamData?.suspensions?.length)) {
        ensureSquadTeamData(state.squads[0]);
        state.squads[0].teamData = normalizeTeamData({
            players: rootPlayers?.players,
            injuries: rootInjuries?.injuries,
            suspensions: rootSuspensions?.suspensions
        });
    }

    activeTeamDataSquadId = null;
    ensureStateConsistency();
}

async function persistAll() {
    saveToLocalStorage();
    if (!directoryHandle) {
        updateSaveStatus();
        return;
    }
    syncRootDataToSquad(getActiveSquad());
    const squadsPayload = {
        squads: state.squads.map((squad) => ({
            id: squad.id,
            name: squad.name,
            teamFolder: squad.teamFolder || sanitizeFolderName(squad.name),
            generalLineup: squad.generalLineup,
            matchLineups: squad.matchLineups
        }))
    };
    await writeJsonFile(DATA_FILES.metadata, state.metadata);
    await writeJsonFile(DATA_FILES.squads, squadsPayload);
    for (const squad of state.squads) {
        ensureSquadTeamData(squad);
        const teamDir = await directoryHandle.getDirectoryHandle(squad.teamFolder, { create: true });
        const serializedPlayers = [];
        for (const player of squad.teamData.players) {
            const minifaceFileName = await writePlayerMinifaceFile(teamDir, player);
            serializedPlayers.push({
                ...player,
                miniface: minifaceFileName || player.miniface || "",
                minifaceFileName
            });
        }
        await writeTeamJson(teamDir, "players.json", { players: serializedPlayers });
        await writeTeamJson(teamDir, "injuries.json", { injuries: squad.teamData.injuries });
        await writeTeamJson(teamDir, "suspensions.json", { suspensions: squad.teamData.suspensions });
        await writeTeamJson(teamDir, "team.json", {
            id: squad.id,
            name: squad.name,
            generalLineup: squad.generalLineup,
            matchLineups: squad.matchLineups
        });
    }
    updateSaveStatus();
}

function normalizeTeamData(teamData) {
    return {
        players: (teamData?.players || []).map((player) => ({
            id: player.id || createId("player"),
            firstName: player.firstName || "",
            lastName: player.lastName || "",
            positions: Array.isArray(player.positions) ? player.positions : [],
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

async function handlePlayerSubmit(event) {
    event.preventDefault();
    const existing = getPlayerById(dom.playerId.value);
    const playerId = dom.playerId.value || createId("player");
    const miniface = await fileToDataUrl(dom.playerMiniface.files[0]);
    const player = {
        id: playerId,
        firstName: dom.playerFirstName.value.trim(),
        lastName: dom.playerLastName.value.trim(),
        positions: getSelectedPositions(),
        number: dom.playerNumber.value.trim(),
        miniface: miniface || existing?.miniface || "",
        minifaceFileName: dom.playerMiniface.files[0] ? `miniface/${playerId}.png` : (existing?.minifaceFileName || "")
    };
    if (!player.firstName && !player.lastName) {
        await showAlertModal("Błąd", "Podaj przynajmniej imię albo nazwisko.");
        return;
    }
    commitChange(() => {
        const index = state.players.findIndex((item) => item.id === player.id);
        if (index >= 0) {
            state.players[index] = player;
        } else {
            state.players.push(player);
            state.squads.forEach((squad) => squad.matchLineups.forEach((lineup) => {
                lineup.availablePlayerIds = uniqueIds([...lineup.availablePlayerIds, player.id]);
            }));
        }
    });
    resetPlayerForm();
}

async function listDirectoryEntries(dirHandle) {
    const entries = [];
    if (!dirHandle?.entries) {
        return entries;
    }
    for await (const [name, handle] of dirHandle.entries()) {
        entries.push([name, handle]);
    }
    return entries;
}

async function readDataUrlFromHandle(fileHandle) {
    const file = await fileHandle.getFile();
    return readFileAsDataUrl(file);
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
    if (!player?.miniface || !String(player.miniface).startsWith("data:")) {
        return player?.minifaceFileName || "";
    }
    const relativePath = player.minifaceFileName || `miniface/${player.id}.png`;
    const directoryPath = relativePath.split("/").slice(0, -1).join("/");
    const fileName = relativePath.split("/").pop();
    const parentDir = directoryPath ? await ensureNestedDirectory(teamDir, directoryPath) : teamDir;
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
            minifaceFileName: player.minifaceFileName || ""
        };
        if (player.miniface && String(player.miniface).startsWith("data:")) {
            hydrated.miniface = player.miniface;
            hydrated.minifaceFileName = player.minifaceFileName || `miniface/${hydrated.id}.png`;
            return hydrated;
        }
        const fileRef = player.minifaceFileName || player.miniface;
        if (fileRef) {
            try {
                const fileHandle = await getNestedFileHandle(teamDir, fileRef);
                hydrated.miniface = await readDataUrlFromHandle(fileHandle);
                hydrated.minifaceFileName = fileRef;
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
    const hydratedPlayers = await hydratePlayersFromTeamDir(playersPayload?.players, teamDir);
    return {
        id: teamMeta?.id || createId("squad"),
        name: teamMeta?.name || fallbackName,
        teamFolder: fallbackName,
        teamData: normalizeTeamData({
            players: hydratedPlayers,
            injuries: injuriesPayload?.injuries,
            suspensions: suspensionsPayload?.suspensions
        }),
        generalLineup: migrateLineup(teamMeta?.generalLineup || createLineupBase(), false),
        matchLineups: (teamMeta?.matchLineups || []).map((lineup) => migrateLineup(lineup, true))
    };
}

async function loadOrCreateDirectoryData() {
    const metadata = await readJsonFile(DATA_FILES.metadata);
    const squadsPayload = await readJsonFile(DATA_FILES.squads);
    const rootPlayers = await readJsonFile(DATA_FILES.players);
    const rootInjuries = await readJsonFile(DATA_FILES.injuries);
    const rootSuspensions = await readJsonFile(DATA_FILES.suspensions);

    const discoveredSquads = [];
    for (const [folderName, handle] of await listDirectoryEntries(directoryHandle)) {
        if (handle.kind !== "directory") {
            continue;
        }
        const squad = await readTeamBundleFromDirectory(handle, folderName);
        if (squad) {
            discoveredSquads.push(squad);
        }
    }

    const rootSquads = squadsPayload?.squads || [];
    const mergedSquads = rootSquads.map((rootSquad, index) => {
        const folderName = rootSquad.teamFolder || sanitizeFolderName(rootSquad.name || `squad-${index + 1}`);
        const discovered = discoveredSquads.find((item) => item.teamFolder === folderName);
        return {
            id: rootSquad.id || discovered?.id || createId("squad"),
            name: rootSquad.name || discovered?.name || `Skład ${index + 1}`,
            teamFolder: folderName,
            teamData: normalizeTeamData(discovered?.teamData),
            generalLineup: migrateLineup(discovered?.generalLineup || rootSquad.generalLineup || createLineupBase(), false),
            matchLineups: (discovered?.matchLineups || rootSquad.matchLineups || []).map((lineup) => migrateLineup(lineup, true))
        };
    });

    discoveredSquads.forEach((discovered) => {
        if (!mergedSquads.some((item) => item.teamFolder === discovered.teamFolder)) {
            mergedSquads.push(discovered);
        }
    });

    state = migrateState({
        metadata,
        players: [],
        injuries: [],
        suspensions: [],
        squads: mergedSquads
    });

    if (!state.squads.length) {
        state = migrateState({
            metadata,
            players: rootPlayers?.players,
            injuries: rootInjuries?.injuries,
            suspensions: rootSuspensions?.suspensions
        });
    } else if (!state.squads.some((squad) => squad.teamData?.players?.length || squad.teamData?.injuries?.length || squad.teamData?.suspensions?.length)) {
        ensureSquadTeamData(state.squads[0]);
        state.squads[0].teamData = normalizeTeamData({
            players: rootPlayers?.players,
            injuries: rootInjuries?.injuries,
            suspensions: rootSuspensions?.suspensions
        });
    }

    activeTeamDataSquadId = null;
    ensureStateConsistency();
}

async function persistAll() {
    saveToLocalStorage();
    if (!directoryHandle) {
        updateSaveStatus();
        return;
    }
    syncRootDataToSquad(getActiveSquad());
    const squadsPayload = {
        squads: state.squads.map((squad) => ({
            id: squad.id,
            name: squad.name,
            teamFolder: squad.teamFolder || sanitizeFolderName(squad.name),
            generalLineup: squad.generalLineup,
            matchLineups: squad.matchLineups
        }))
    };
    await writeJsonFile(DATA_FILES.metadata, state.metadata);
    await writeJsonFile(DATA_FILES.squads, squadsPayload);
    for (const squad of state.squads) {
        ensureSquadTeamData(squad);
        const teamDir = await directoryHandle.getDirectoryHandle(squad.teamFolder, { create: true });
        const serializedPlayers = [];
        for (const player of squad.teamData.players) {
            const minifaceFileName = await writePlayerMinifaceFile(teamDir, player);
            serializedPlayers.push({
                ...player,
                miniface: minifaceFileName || player.miniface || "",
                minifaceFileName
            });
        }
        await writeTeamJson(teamDir, "players.json", { players: serializedPlayers });
        await writeTeamJson(teamDir, "injuries.json", { injuries: squad.teamData.injuries });
        await writeTeamJson(teamDir, "suspensions.json", { suspensions: squad.teamData.suspensions });
        await writeTeamJson(teamDir, "team.json", {
            id: squad.id,
            name: squad.name,
            generalLineup: squad.generalLineup,
            matchLineups: squad.matchLineups
        });
    }
    updateSaveStatus();
}

async function writeJsonFile(filename, data) {
    const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
}

function saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadFromLocalStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : defaultState();
    } catch (error) {
        return defaultState();
    }
}

function updateSaveStatus() {
    dom.saveStatus.textContent = directoryHandle ? "Autozapis aktywny" : "Brak folderu danych";
    dom.folderName.textContent = directoryHandle ? directoryHandle.name : "Dane lokalne w pamięci przeglądarki";
}

function parseRetentionValue(value) {
    if (value === "") {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function upsertById(collection, item) {
    const index = collection.findIndex((entry) => entry.id === item.id);
    if (index >= 0) {
        collection[index] = item;
    } else {
        collection.push(item);
    }
}

function actionButton(label, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function uniqueIds(values) {
    return [...new Set(values)];
}

function createId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function fileToDataUrl(file) {
    if (!file) {
        return Promise.resolve("");
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

let activeModalResolver = null;

function openModal({ title, bodyHtml, actions, closeable = true }) {
    const overlay = document.getElementById("modal-overlay");
    const titleNode = document.getElementById("modal-title");
    const bodyNode = document.getElementById("modal-body");
    const actionsNode = document.getElementById("modal-actions");
    const closeButton = document.getElementById("modal-close-button");
    titleNode.textContent = title;
    bodyNode.innerHTML = bodyHtml;
    actionsNode.innerHTML = "";
    closeButton.style.display = closeable ? "" : "none";
    actions.forEach((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = action.className || "ghost-button";
        button.textContent = action.label;
        button.addEventListener("click", action.onClick);
        actionsNode.appendChild(button);
    });
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
}

function closeModal(result) {
    const overlay = document.getElementById("modal-overlay");
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    if (activeModalResolver) {
        const resolve = activeModalResolver;
        activeModalResolver = null;
        resolve(result);
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
                { label: "Potwierdź", className: "primary-button", onClick: () => closeModal(true) }
            ]
        });
    });
}

function showPromptModal(title, label, initialValue = "") {
    return new Promise((resolve) => {
        activeModalResolver = resolve;
        openModal({
            title,
            bodyHtml: `<label class="inline-field"><span>${escapeHtml(label)}</span><input id="modal-input" type="text" value="${escapeHtml(initialValue)}"></label>`,
            actions: [
                { label: "Anuluj", className: "ghost-button", onClick: () => closeModal("") },
                {
                    label: "Zapisz",
                    className: "primary-button",
                    onClick: () => {
                        const value = document.getElementById("modal-input").value.trim();
                        closeModal(value);
                    }
                }
            ]
        });
        setTimeout(() => {
            const input = document.getElementById("modal-input");
            if (input) {
                input.focus();
                input.select();
            }
        }, 0);
    });
}

async function handlePlayerSubmit(event) {
    event.preventDefault();
    const miniface = await fileToDataUrl(dom.playerMiniface.files[0]);
    const player = {
        id: dom.playerId.value || createId("player"),
        firstName: dom.playerFirstName.value.trim(),
        lastName: dom.playerLastName.value.trim(),
        positions: getSelectedPositions(),
        number: dom.playerNumber.value.trim(),
        miniface: miniface || getPlayerById(dom.playerId.value)?.miniface || ""
    };
    if (!player.firstName && !player.lastName) {
        await showAlertModal("Błąd", "Podaj przynajmniej imię albo nazwisko.");
        return;
    }
    commitChange(() => {
        const index = state.players.findIndex((item) => item.id === player.id);
        if (index >= 0) {
            state.players[index] = player;
        } else {
            state.players.push(player);
            state.squads.forEach((squad) => squad.matchLineups.forEach((lineup) => {
                lineup.availablePlayerIds = uniqueIds([...lineup.availablePlayerIds, player.id]);
            }));
        }
    });
    resetPlayerForm();
}

async function handleInjurySubmit(event) {
    event.preventDefault();
    const injury = {
        id: dom.injuryId.value || createId("injury"),
        playerId: dom.injuryPlayerId.value,
        startDate: normalizeDateInput(dom.injuryStartDate.value),
        type: dom.injuryType.value.trim(),
        severity: dom.injurySeverity.value.trim(),
        returnDate: normalizeDateInput(dom.injuryReturnDate.value)
    };
    if (!injury.playerId || !isValidFlexibleDate(injury.startDate) || !isValidFlexibleDate(injury.returnDate)) {
        await showAlertModal("Błąd", "Wpisz daty w formacie dd-mm-rrrr.");
        return;
    }
    commitChange(() => upsertById(state.injuries, injury));
    resetInjuryForm();
}

async function handleSuspensionSubmit(event) {
    event.preventDefault();
    const suspension = {
        id: dom.suspensionId.value || createId("suspension"),
        playerId: dom.suspensionPlayerId.value,
        endDate: normalizeDateInput(dom.suspensionEndDate.value)
    };
    if (!suspension.playerId || !isValidFlexibleDate(suspension.endDate)) {
        await showAlertModal("Błąd", "Wpisz datę w formacie dd-mm-rrrr.");
        return;
    }
    commitChange(() => upsertById(state.suspensions, suspension));
    resetSuspensionForm();
}

async function addSquad() {
    const name = await showPromptModal("Nowy skład", "Nazwa nowego składu:", `Skład ${state.squads.length + 1}`);
    if (!name) {
        return;
    }
    commitChange(() => {
        const squad = {
            id: createId("squad"),
            name: name.trim(),
            generalLineup: createLineupBase(),
            matchLineups: [{ ...createLineupBase(), id: createId("match"), name: "Mecz 1", availablePlayerIds: state.players.map((player) => player.id) }]
        };
        state.squads.push(squad);
        state.metadata.lastOpenedSquadId = squad.id;
        state.metadata.lastOpenedMatchLineupId = squad.matchLineups[0].id;
        state.metadata.lineupMode = "general";
    });
}

async function renameActiveSquad() {
    const squad = getActiveSquad();
    const name = squad ? await showPromptModal("Zmień nazwę", "Nowa nazwa składu:", squad.name) : "";
    if (name) {
        commitChange(() => {
            squad.name = name.trim();
        });
    }
}

async function deleteActiveSquad() {
    const squad = getActiveSquad();
    if (squad && await showConfirmModal("Usuń skład", `Usunąć skład ${squad.name}?`)) {
        commitChange(() => {
            state.squads = state.squads.filter((item) => item.id !== squad.id);
        });
    }
}

async function addMatchLineup() {
    const squad = getActiveSquad();
    const name = squad ? await showPromptModal("Nowy skład meczowy", "Nazwa składu meczowego:", `Mecz ${squad.matchLineups.length + 1}`) : "";
    if (name) {
        commitChange(() => {
            const lineup = { ...createLineupBase(), id: createId("match"), name: name.trim(), availablePlayerIds: state.players.map((player) => player.id) };
            squad.matchLineups.push(lineup);
            state.metadata.lastOpenedMatchLineupId = lineup.id;
            state.metadata.lineupMode = "match";
        });
    }
}

async function renameActiveMatchLineup() {
    const lineup = getActiveMatchLineup();
    const name = lineup ? await showPromptModal("Zmień nazwę", "Nowa nazwa składu meczowego:", lineup.name) : "";
    if (name) {
        commitChange(() => {
            lineup.name = name.trim();
        });
    }
}

async function deleteActiveMatchLineup() {
    const squad = getActiveSquad();
    const lineup = getActiveMatchLineup();
    if (squad && lineup && await showConfirmModal("Usuń skład meczowy", `Usunąć ${lineup.name}?`)) {
        commitChange(() => {
            squad.matchLineups = squad.matchLineups.filter((item) => item.id !== lineup.id);
        });
    }
}

async function deletePlayer(playerId) {
    const player = getPlayerById(playerId);
    if (!player || !await showConfirmModal("Usuń zawodnika", `Usunąć zawodnika ${getPlayerLabel(player)}?`)) {
        return;
    }
    commitChange(() => {
        state.players = state.players.filter((item) => item.id !== playerId);
        state.injuries = state.injuries.filter((item) => item.playerId !== playerId);
        state.suspensions = state.suspensions.filter((item) => item.playerId !== playerId);
        state.squads.forEach((squad) => {
            squad.generalLineup.placedPlayers = squad.generalLineup.placedPlayers.filter((item) => item.playerId !== playerId);
            squad.matchLineups.forEach((lineup) => {
                lineup.placedPlayers = lineup.placedPlayers.filter((item) => item.playerId !== playerId);
                lineup.availablePlayerIds = lineup.availablePlayerIds.filter((id) => id !== playerId);
            });
        });
    });
}

function createStatusBadge(status) {
    const badge = document.createElement("span");
    badge.className = "status-badge";
    const icon = document.createElement("img");
    icon.src = STATUS_ICONS[status.type];
    icon.alt = status.label;
    badge.title = "Kliknij po szczegóły";
    icon.addEventListener("error", () => {
        icon.remove();
        badge.textContent = status.type === "injury" ? "K" : "Z";
    }, { once: true });
    badge.addEventListener("click", () => {
        showAlertModal(status.type === "injury" ? "Kontuzja" : "Zawieszenie", status.label);
    });
    badge.append(icon);
    return badge;
}

function getNearestFormationTarget(x, y, lineup, movingPlayerId) {
    const targets = buildFormationTargets(lineup.formation);
    const occupied = new Set(lineup.placedPlayers.filter((item) => item.playerId !== movingPlayerId).map((item) => `${item.x.toFixed(2)}|${item.y.toFixed(2)}`));
    const freeTargets = targets.filter((target) => !occupied.has(`${target.x.toFixed(2)}|${target.y.toFixed(2)}`));
    const pool = freeTargets.length ? freeTargets : targets;
    return pool.reduce((best, target) => {
        const bestDist = Math.hypot(best.x - x, best.y - y);
        const targetDist = Math.hypot(target.x - x, target.y - y);
        return targetDist < bestDist ? target : best;
    }, pool[0]);
}

function endDrag() {
    window.removeEventListener("pointermove", onDrag);
    dom.pitch.querySelectorAll(".draggable-player").forEach((element) => element.classList.remove("dragging"));
    if (!dragState || dragState.x === undefined) {
        dragState = null;
        return;
    }
    const { playerId, x, y } = dragState;
    dragState = null;
    commitChange(() => {
        const lineup = getCurrentLineup();
        const placed = lineup.placedPlayers.find((item) => item.playerId === playerId);
        if (placed) {
            const snap = getNearestFormationTarget(x, y, lineup, playerId);
            placed.x = snap.x;
            placed.y = snap.y;
        }
    });
}

function buildSmartFormationTargets(formation) {
    const rows = parseFormation(formation);
    const templates = [
        ["BR"],
        rowLabels("def", rows[0] || 4),
        rowLabels("mid", rows[1] || 3),
        rowLabels("att", rows[2] || 3),
        rowLabels("extra", rows[3] || 0),
        rowLabels("extra", rows[4] || 0)
    ];
    const targets = [];
    const rowTops = [92, 69, 43, 17, 7, 2];
    templates.forEach((labels, rowIndex) => {
        if (!labels.length) {
            return;
        }
        const top = rowTops[rowIndex] ?? 2;
        labels.forEach((label, index) => {
            targets.push({ x: ((index + 1) / (labels.length + 1)) * 100, y: top, label });
        });
    });
    return targets;
}

function fileToDataUrl(file) {
    if (!file) {
        return Promise.resolve("");
    }
    return readFileAsDataUrl(file).then((dataUrl) => normalizeMinifaceDataUrl(dataUrl));
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
        const outputSize = 256;
        const framePadding = 18;
        const usableSize = outputSize - framePadding * 2;
        const scale = Math.min(usableSize / cropWidth, usableSize / cropHeight);
        const drawWidth = Math.max(1, Math.round(cropWidth * scale));
        const drawHeight = Math.max(1, Math.round(cropHeight * scale));
        const offsetX = Math.round((outputSize - drawWidth) / 2);
        const offsetY = Math.round((outputSize - drawHeight) / 2);

        const outputCanvas = document.createElement("canvas");
        outputCanvas.width = outputSize;
        outputCanvas.height = outputSize;
        const outputContext = outputCanvas.getContext("2d");
        outputContext.imageSmoothingEnabled = true;
        outputContext.imageSmoothingQuality = "high";
        outputContext.clearRect(0, 0, outputSize, outputSize);
        outputContext.drawImage(
            sourceCanvas,
            minX,
            minY,
            cropWidth,
            cropHeight,
            offsetX,
            offsetY,
            drawWidth,
            drawHeight
        );
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
            if (x < minX) {
                minX = x;
            }
            if (x > maxX) {
                maxX = x;
            }
            if (y < minY) {
                minY = y;
            }
            if (y > maxY) {
                maxY = y;
            }
        }
    }

    return { minX, minY, maxX, maxY };
}

function isInactiveMatchPlayer(playerId) {
    return state.metadata.lineupMode === "match" && getPlayerStatuses(playerId).length > 0;
}

function getBenchCandidates(lineup) {
    const onPitch = new Set(lineup.placedPlayers.map((item) => item.playerId));
    const players = getAvailablePlayersForCurrentLineup().filter((player) => !onPitch.has(player.id));
    return players.sort((left, right) => {
        const inactiveDelta = Number(isInactiveMatchPlayer(left.id)) - Number(isInactiveMatchPlayer(right.id));
        if (inactiveDelta !== 0) {
            return inactiveDelta;
        }
        return getPlayerLabel(left).localeCompare(getPlayerLabel(right), "pl");
    });
}

function renderBench() {
    const lineup = getCurrentLineup();
    const players = getBenchCandidates(lineup);
    dom.benchList.innerHTML = "";
    if (!players.length) {
        dom.benchList.innerHTML = `<div class="empty-state">Brak zawodników poza boiskiem.</div>`;
        return;
    }
    players.forEach((player) => {
        const row = document.createElement("div");
        row.className = `bench-player selectable${selectedBenchPlayerId === player.id ? " selected" : ""}${isInactiveMatchPlayer(player.id) ? " match-inactive" : ""}`;
        row.innerHTML = `<img src="${player.miniface || "defaultMiniface.png"}" alt="${escapeHtml(getPlayerLabel(player))}"><div class="table-main"><strong>${escapeHtml(getPlayerLabel(player))}</strong><span class="status-text">${escapeHtml(formatPositions(player.positions))}${player.number ? ` | Nr ${escapeHtml(player.number)}` : ""}</span></div>`;
        const actions = document.createElement("div");
        actions.className = "player-icons";
        getPlayerStatuses(player.id).forEach((status) => actions.appendChild(createStatusBadge(status)));
        row.appendChild(actions);
        row.addEventListener("click", () => {
            selectedBenchPlayerId = selectedBenchPlayerId === player.id ? null : player.id;
            selectedPitchPlayerId = null;
            refreshAll();
        });
        dom.benchList.appendChild(row);
    });
}

function renderPitch() {
    const lineup = getCurrentLineup();
    const actionPanel = getLineupActionsPanel();
    actionPanel.innerHTML = "";
    actionPanel.classList.toggle("hidden", !selectedPitchPlayerId);
    if (selectedPitchPlayerId) {
        actionPanel.append(
            actionButton("Odznacz", "ghost-button", () => {
                selectedPitchPlayerId = null;
                refreshAll();
            }),
            actionButton("Mądry swap", "ghost-button", async () => smartSwapSelectedPlayer()),
            actionButton("Na ławkę", "danger-button", () => commitChange(() => {
                getCurrentLineup().placedPlayers = getCurrentLineup().placedPlayers.filter((item) => item.playerId !== selectedPitchPlayerId);
                selectedPitchPlayerId = null;
            }))
        );
    }

    dom.pitch.innerHTML = "";
    const targets = getFormationTargetsForLineup(lineup);
    targets.forEach((target) => {
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "formation-target";
        marker.style.left = `${target.x}%`;
        marker.style.top = `${target.y}%`;
        marker.title = target.label;
        marker.addEventListener("click", () => placeSelectedOnTarget(target));
        dom.pitch.appendChild(marker);
    });
    dom.lineupSummary.textContent = `${lineup.placedPlayers.length} zawodników na boisku. Formacja: ${lineup.formation}.`;
    lineup.placedPlayers.forEach((placed) => {
        const player = getPlayerById(placed.playerId);
        if (!player) {
            return;
        }
        const wrapper = document.createElement("button");
        wrapper.type = "button";
        wrapper.className = `draggable-player${selectedPitchPlayerId === player.id ? " selected" : ""}`;
        wrapper.style.left = `${placed.x}%`;
        wrapper.style.top = `${placed.y}%`;
        wrapper.dataset.playerId = player.id;
        wrapper.addEventListener("click", () => handlePitchPlayerClick(player.id));

        const card = document.createElement("div");
        card.className = `player-card${isInactiveMatchPlayer(player.id) ? " match-inactive" : ""}`;
        card.innerHTML = `<img src="${player.miniface || "defaultMiniface.png"}" alt="${escapeHtml(getPlayerLabel(player))}"><div class="player-ident"><div class="player-head"><span class="player-number-badge">${player.number ? escapeHtml(player.number) : ""}</span><span class="player-name">${escapeHtml(getPlayerLabel(player))}</span><span class="player-icons"></span></div><div class="player-positions">${escapeHtml(formatPositions(player.positions))}</div></div>`;
        const iconRow = card.querySelector(".player-icons");
        getPlayerStatuses(player.id).forEach((status) => iconRow.appendChild(createStatusBadge(status)));
        wrapper.appendChild(card);
        dom.pitch.appendChild(wrapper);
    });
}

function handlePitchPlayerClick(playerId) {
    if (selectedBenchPlayerId) {
        commitChange(() => {
            const lineup = getCurrentLineup();
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
            const lineup = getCurrentLineup();
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

async function smartSwapSelectedPlayer() {
    const player = getPlayerById(selectedPitchPlayerId);
    if (!player) {
        return;
    }
    const lineup = getCurrentLineup();
    const candidates = getBenchCandidates(lineup).filter((candidate) => {
        if (candidate.id === player.id) {
            return false;
        }
        return candidate.positions.some((position) => player.positions.includes(position));
    });
    if (!candidates.length) {
        await showAlertModal("Mądry swap", "Brak podobnych pozycji na ławce.");
        return;
    }
    const choice = await showChoiceModal("Mądry swap", candidates.map((candidate) => ({
        label: `${getPlayerLabel(candidate)}${candidate.number ? ` | ${candidate.number}` : ""} | ${formatPositions(candidate.positions)}`,
        value: candidate.id
    })));
    if (!choice) {
        return;
    }
    commitChange(() => {
        const current = lineup.placedPlayers.find((item) => item.playerId === selectedPitchPlayerId);
        if (current) {
            current.playerId = choice;
            selectedPitchPlayerId = null;
        }
    });
}

function applyFormationLayout(lineup) {
    const targets = getFormationTargetsForLineup(lineup).map((target, index) => ({ ...target, index }));
    const players = lineup.placedPlayers
        .map((placed) => ({ placed, player: getPlayerById(placed.playerId) }))
        .filter((item) => item.player);

    if (!players.length || !targets.length) {
        return;
    }

    const remainingPlayers = [...players];
    const assignments = [];

    targets.forEach((target) => {
        remainingPlayers.sort((left, right) => {
            const scoreDelta = scorePlayerForLabel(right.player, target.label) - scorePlayerForLabel(left.player, target.label);
            if (scoreDelta !== 0) {
                return scoreDelta;
            }
            const leftDistance = Math.hypot((left.placed.x ?? 50) - target.x, (left.placed.y ?? 50) - target.y);
            const rightDistance = Math.hypot((right.placed.x ?? 50) - target.x, (right.placed.y ?? 50) - target.y);
            return leftDistance - rightDistance;
        });
        const best = remainingPlayers.shift();
        if (best) {
            assignments.push({ placed: best.placed, target });
        }
    });

    remainingPlayers.forEach((entry, index) => {
        const fallbackX = 14 + (index % 5) * 18;
        const fallbackY = 8 + Math.floor(index / 5) * 8;
        assignments.push({ placed: entry.placed, target: { x: fallbackX, y: fallbackY } });
    });

    assignments.forEach(({ placed, target }) => {
        placed.x = clamp(target.x, 8, 92);
        placed.y = clamp(target.y, 2, 92);
    });
}

const baseDefaultState = defaultState;

defaultState = () => {
    const next = baseDefaultState();
    next.metadata.version = 3;
    next.metadata.settings = {
        injuryRetentionDays: null,
        suspensionRetentionDays: 1,
        matchLineupRetentionDays: null
    };
    next.squads = next.squads.map((squad) => ({
        ...squad,
        generalLineup: createLineupBase(),
        matchLineups: squad.matchLineups.map((lineup, index) => ({
            ...createLineupBase(),
            id: lineup.id,
            name: lineup.name || `Mecz ${index + 1}`
        }))
    }));
    return next;
};

const baseCacheDom = cacheDom;

cacheDom = function cacheDomOverride() {
    baseCacheDom();
    dom.matchDateField = document.getElementById("match-date-field");
    dom.matchDateInput = document.getElementById("match-date-input");
    dom.matchLineupRetentionDays = document.getElementById("match-lineup-retention-days");
};

const baseBindEvents = bindEvents;

bindEvents = function bindEventsOverride() {
    baseBindEvents();
    dom.matchDateInput?.addEventListener("change", handleMatchDateChange);
    dom.matchDateInput?.addEventListener("blur", handleMatchDateChange);
};

function handleMatchDateChange() {
    const lineup = getActiveMatchLineup();
    if (!lineup) {
        return;
    }
    const normalized = normalizeDateInput(dom.matchDateInput.value);
    if (normalized && !isValidFlexibleDate(normalized)) {
        showAlertModal("Błąd", "Wpisz datę meczu w formacie dd-mm-rrrr.");
        dom.matchDateInput.value = lineup.matchDate || "";
        return;
    }
    commitChange(() => {
        lineup.matchDate = normalized;
    });
}

function createLineupBase() {
    return { formation: "4-3-3", draftFormation: "4-3-3", placedPlayers: [], availablePlayerIds: [], matchDate: "" };
}

function migrateLineup(lineup, isMatch) {
    const migrated = { ...createLineupBase(), ...lineup };
    migrated.draftFormation = migrated.draftFormation || migrated.formation || "4-3-3";
    migrated.formation = migrated.formation || "4-3-3";
    migrated.matchDate = isMatch ? (migrated.matchDate || "") : "";
    migrated.availablePlayerIds = isMatch ? uniqueIds(migrated.availablePlayerIds || []) : [];
    if (!Array.isArray(migrated.placedPlayers)) {
        migrated.placedPlayers = migrateAssignments(migrated.assignments || {}, migrated.formation);
    }
    delete migrated.assignments;
    return migrated;
}

function ensureStateConsistency() {
    if (!state.squads.length) {
        state = defaultState();
    }
    if (!getActiveSquad()) {
        state.metadata.lastOpenedSquadId = state.squads[0]?.id || "";
    }
    const squad = getActiveSquad();
    if (!squad) {
        return;
    }
    squad.generalLineup = migrateLineup(squad.generalLineup || createLineupBase(), false);
    squad.generalLineup.placedPlayers = sanitizePlacedPlayers(squad.generalLineup.placedPlayers);
    squad.matchLineups = (squad.matchLineups || []).map((lineup) => migrateLineup(lineup, true));
    squad.matchLineups.forEach((lineup) => {
        lineup.availablePlayerIds = uniqueIds((lineup.availablePlayerIds || []).filter((id) => getPlayerById(id)));
        lineup.placedPlayers = sanitizePlacedPlayers(lineup.placedPlayers).filter((item) => lineup.availablePlayerIds.includes(item.playerId));
    });
    if (state.metadata.lineupMode === "match" && squad.matchLineups.length && !getActiveMatchLineup()) {
        state.metadata.lastOpenedMatchLineupId = squad.matchLineups[0].id;
    }
    if (state.metadata.lineupMode === "match" && !squad.matchLineups.length) {
        state.metadata.lastOpenedMatchLineupId = "";
    }
}

function getCurrentLineup() {
    if (state.metadata.lineupMode === "match") {
        return getActiveMatchLineup();
    }
    return getActiveSquad()?.generalLineup || createLineupBase();
}

function renderLineupControls() {
    const squad = getActiveSquad();
    const lineup = getCurrentLineup();
    const isMatchMode = state.metadata.lineupMode === "match";
    const activeMatchLineup = getActiveMatchLineup();
    dom.currentSquadName.textContent = squad?.name || "Brak składu";
    dom.renameSquadButton.disabled = !squad;
    dom.deleteSquadButton.disabled = !squad;
    dom.lineupModeButtons.forEach((button) => button.classList.toggle("active", button.dataset.lineupMode === state.metadata.lineupMode));
    dom.matchToolbar.classList.toggle("hidden", !isMatchMode);
    dom.availabilityPanel.classList.toggle("hidden", !isMatchMode);
    dom.availabilityDetails.classList.toggle("hidden", !isMatchMode);
    dom.matchDateField?.classList.toggle("hidden", !isMatchMode || !activeMatchLineup);
    dom.formationInput.value = lineup?.draftFormation || lineup?.formation || "4-3-3";
    if (dom.matchDateInput) {
        dom.matchDateInput.value = activeMatchLineup?.matchDate || "";
    }
    dom.matchLineupSelect.innerHTML = "";
    if (squad) {
        squad.matchLineups.forEach((lineupItem) => {
            const option = document.createElement("option");
            option.value = lineupItem.id;
            option.textContent = lineupItem.matchDate ? `${lineupItem.name} • ${lineupItem.matchDate}` : lineupItem.name;
            option.selected = lineupItem.id === state.metadata.lastOpenedMatchLineupId;
            dom.matchLineupSelect.appendChild(option);
        });
    }
    dom.renameMatchLineupButton.disabled = !activeMatchLineup;
    dom.deleteMatchLineupButton.disabled = !activeMatchLineup;
    renderAvailabilityPanel();
}

function renderAvailabilityPanel() {
    if (state.metadata.lineupMode !== "match") {
        dom.availabilityPanel.innerHTML = "";
        dom.availabilityDetails.open = false;
        return;
    }
    const lineup = getActiveMatchLineup();
    if (!lineup) {
        dom.availabilityPanel.innerHTML = `<div class="empty-state">Brak składów meczowych.</div>`;
        dom.availabilityDetails.open = false;
        return;
    }
    if (!state.players.length) {
        dom.availabilityPanel.innerHTML = `<div class="empty-state">Najpierw dodaj zawodników.</div>`;
        dom.availabilityDetails.open = false;
        return;
    }
    const grid = document.createElement("div");
    grid.className = "availability-grid";
    state.players.forEach((player) => {
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
                if (selectedBenchPlayerId === player.id) {
                    selectedBenchPlayerId = null;
                }
                if (selectedPitchPlayerId === player.id) {
                    selectedPitchPlayerId = null;
                }
            }
        }));
        row.appendChild(checkbox);
        grid.appendChild(row);
    });
    dom.availabilityPanel.innerHTML = "";
    dom.availabilityPanel.appendChild(grid);
}

function renderSettings() {
    dom.injuryRetentionDays.value = state.metadata.settings.injuryRetentionDays ?? "";
    dom.suspensionRetentionDays.value = state.metadata.settings.suspensionRetentionDays ?? "";
    if (dom.matchLineupRetentionDays) {
        dom.matchLineupRetentionDays.value = state.metadata.settings.matchLineupRetentionDays ?? "";
    }
}

function handleSettingsChange() {
    commitChange(() => {
        state.metadata.settings.injuryRetentionDays = parseRetentionValue(dom.injuryRetentionDays.value);
        state.metadata.settings.suspensionRetentionDays = parseRetentionValue(dom.suspensionRetentionDays.value);
        state.metadata.settings.matchLineupRetentionDays = parseRetentionValue(dom.matchLineupRetentionDays?.value);
    });
}

function cleanupHistoricalRecords() {
    state.injuries = state.injuries.filter((item) => shouldKeepHistorical(item.returnDate, state.metadata.settings.injuryRetentionDays));
    state.suspensions = state.suspensions.filter((item) => shouldKeepHistorical(item.endDate, state.metadata.settings.suspensionRetentionDays));
    state.squads.forEach((squad) => {
        squad.matchLineups = squad.matchLineups.filter((lineup) => shouldKeepMatchLineup(lineup, state.metadata.settings.matchLineupRetentionDays));
    });
    const activeSquad = getActiveSquad();
    if (state.metadata.lineupMode === "match" && activeSquad && !activeSquad.matchLineups.some((lineup) => lineup.id === state.metadata.lastOpenedMatchLineupId)) {
        state.metadata.lastOpenedMatchLineupId = activeSquad.matchLineups[0]?.id || "";
    }
}

function shouldKeepMatchLineup(lineup, retentionDays) {
    if (retentionDays === null || retentionDays === undefined || retentionDays === "") {
        return true;
    }
    if (!lineup?.matchDate || !isValidFlexibleDate(lineup.matchDate)) {
        return true;
    }
    return compareFlexibleDates(addDaysToFlexibleDate(lineup.matchDate, Number(retentionDays)), getTodayFlexibleDate()) >= 0;
}

function renderBench() {
    const lineup = getCurrentLineup();
    dom.benchList.innerHTML = "";
    if (!lineup) {
        dom.benchList.innerHTML = `<div class="empty-state">Brak aktywnego składu meczowego.</div>`;
        return;
    }
    const players = getBenchCandidates(lineup);
    if (!players.length) {
        dom.benchList.innerHTML = `<div class="empty-state">Brak zawodników poza boiskiem.</div>`;
        return;
    }
    players.forEach((player) => {
        const row = document.createElement("div");
        row.className = `bench-player selectable${selectedBenchPlayerId === player.id ? " selected" : ""}${isInactiveMatchPlayer(player.id) ? " match-inactive" : ""}`;
        row.innerHTML = `<img src="${player.miniface || "defaultMiniface.png"}" alt="${escapeHtml(getPlayerLabel(player))}"><div class="table-main"><strong>${escapeHtml(getPlayerLabel(player))}</strong><span class="status-text">${escapeHtml(formatPositions(player.positions))}${player.number ? ` | Nr ${escapeHtml(player.number)}` : ""}</span></div>`;
        const actions = document.createElement("div");
        actions.className = "player-icons";
        getPlayerStatuses(player.id).forEach((status) => actions.appendChild(createStatusBadge(status)));
        row.appendChild(actions);
        row.addEventListener("click", () => {
            selectedBenchPlayerId = selectedBenchPlayerId === player.id ? null : player.id;
            selectedPitchPlayerId = null;
            refreshAll();
        });
        dom.benchList.appendChild(row);
    });
}

function renderPitch() {
    const lineup = getCurrentLineup();
    const actionPanel = getLineupActionsPanel();
    actionPanel.innerHTML = "";
    actionPanel.classList.toggle("hidden", !selectedPitchPlayerId);
    if (selectedPitchPlayerId) {
        actionPanel.append(
            actionButton("Odznacz", "ghost-button", () => {
                selectedPitchPlayerId = null;
                refreshAll();
            }),
            actionButton("Mądry swap", "ghost-button", async () => smartSwapSelectedPlayer()),
            actionButton("Na ławkę", "danger-button", () => commitChange(() => {
                const current = getCurrentLineup();
                if (!current) {
                    return;
                }
                current.placedPlayers = current.placedPlayers.filter((item) => item.playerId !== selectedPitchPlayerId);
                selectedPitchPlayerId = null;
            }))
        );
    }

    dom.pitch.innerHTML = "";
    if (!lineup) {
        dom.lineupSummary.textContent = "Brak aktywnego składu meczowego.";
        return;
    }
    const targets = getFormationTargetsForLineup(lineup);
    targets.forEach((target) => {
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "formation-target";
        marker.style.left = `${target.x}%`;
        marker.style.top = `${target.y}%`;
        marker.title = target.label;
        marker.addEventListener("click", () => placeSelectedOnTarget(target));
        dom.pitch.appendChild(marker);
    });
    dom.lineupSummary.textContent = `${lineup.placedPlayers.length} zawodników na boisku. Formacja: ${lineup.formation}.${lineup.matchDate ? ` Mecz: ${lineup.matchDate}.` : ""}`;
    lineup.placedPlayers.forEach((placed) => {
        const player = getPlayerById(placed.playerId);
        if (!player) {
            return;
        }
        const wrapper = document.createElement("button");
        wrapper.type = "button";
        wrapper.className = `draggable-player${selectedPitchPlayerId === player.id ? " selected" : ""}`;
        wrapper.style.left = `${clamp(placed.x, 11, 89)}%`;
        wrapper.style.top = `${clamp(placed.y, 7, 93)}%`;
        wrapper.dataset.playerId = player.id;
        wrapper.addEventListener("click", () => handlePitchPlayerClick(player.id));

        const card = document.createElement("div");
        card.className = `player-card${isInactiveMatchPlayer(player.id) ? " match-inactive" : ""}`;
        card.innerHTML = `<img src="${player.miniface || "defaultMiniface.png"}" alt="${escapeHtml(getPlayerLabel(player))}"><div class="player-ident"><div class="player-head"><span class="player-number-badge">${player.number ? escapeHtml(player.number) : ""}</span><span class="player-name">${escapeHtml(getPlayerLabel(player))}</span><span class="player-icons"></span></div><div class="player-positions">${escapeHtml(formatPositions(player.positions))}</div></div>`;
        const iconRow = card.querySelector(".player-icons");
        getPlayerStatuses(player.id).forEach((status) => iconRow.appendChild(createStatusBadge(status)));
        wrapper.appendChild(card);
        dom.pitch.appendChild(wrapper);
    });
}

function applyFormationLayout(lineup) {
    const targets = getFormationTargetsForLineup(lineup).map((target) => ({ ...target }));
    const players = lineup.placedPlayers
        .map((placed) => ({ placed, player: getPlayerById(placed.playerId) }))
        .filter((item) => item.player);

    if (!players.length || !targets.length) {
        return;
    }

    const remainingPlayers = [...players];
    const assignments = [];

    targets.forEach((target) => {
        remainingPlayers.sort((left, right) => {
            const scoreDelta = scorePlayerForLabel(right.player, target.label) - scorePlayerForLabel(left.player, target.label);
            if (scoreDelta !== 0) {
                return scoreDelta;
            }
            const leftDistance = Math.hypot((left.placed.x ?? 50) - target.x, (left.placed.y ?? 50) - target.y);
            const rightDistance = Math.hypot((right.placed.x ?? 50) - target.x, (right.placed.y ?? 50) - target.y);
            return leftDistance - rightDistance;
        });
        const best = remainingPlayers.shift();
        if (best) {
            assignments.push({ placed: best.placed, target });
        }
    });

    remainingPlayers.forEach((entry, index) => {
        const fallbackX = 16 + (index % 4) * 18;
        const fallbackY = 10 + Math.floor(index / 4) * 9;
        assignments.push({ placed: entry.placed, target: { x: fallbackX, y: fallbackY } });
    });

    assignments.forEach(({ placed, target }) => {
        placed.x = clamp(target.x, 11, 89);
        placed.y = clamp(target.y, 7, 93);
    });
}

var activeTeamDataSquadId = null;

function normalizeTeamData(teamData) {
    return {
        players: (teamData?.players || []).map((player) => ({
            id: player.id || createId("player"),
            firstName: player.firstName || "",
            lastName: player.lastName || "",
            positions: Array.isArray(player.positions) ? player.positions : [],
            number: player.number || "",
            miniface: player.miniface || ""
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

function ensureSquadTeamData(squad) {
    if (!squad) {
        return;
    }
    squad.teamFolder = squad.teamFolder || sanitizeFolderName(squad.name);
    squad.teamData = normalizeTeamData(squad.teamData);
}

function syncRootDataToSquad(squad = state.squads.find((item) => item.id === activeTeamDataSquadId)) {
    if (!squad) {
        return;
    }
    ensureSquadTeamData(squad);
    squad.teamData = normalizeTeamData({
        players: state.players,
        injuries: state.injuries,
        suspensions: state.suspensions
    });
}

function loadSquadDataToRoot(squad) {
    ensureSquadTeamData(squad);
    const teamData = normalizeTeamData(squad.teamData);
    state.players = teamData.players;
    state.injuries = teamData.injuries;
    state.suspensions = teamData.suspensions;
    activeTeamDataSquadId = squad.id;
}

function setActiveSquadData(squadId) {
    const previous = state.squads.find((item) => item.id === activeTeamDataSquadId);
    if (previous) {
        syncRootDataToSquad(previous);
    }
    state.metadata.lastOpenedSquadId = squadId;
    const next = state.squads.find((item) => item.id === squadId);
    state.metadata.lastOpenedMatchLineupId = next?.matchLineups[0]?.id || "";
    selectedBenchPlayerId = null;
    selectedPitchPlayerId = null;
    if (next) {
        loadSquadDataToRoot(next);
    }
}

function ensureStateConsistency() {
    if (!state.squads.length) {
        state = defaultState();
    }
    state.squads.forEach((squad) => ensureSquadTeamData(squad));
    if (!getActiveSquad()) {
        state.metadata.lastOpenedSquadId = state.squads[0]?.id || "";
    }
    const activeSquad = getActiveSquad();
    if (!activeSquad) {
        return;
    }
    if (activeTeamDataSquadId !== activeSquad.id) {
        const previous = state.squads.find((item) => item.id === activeTeamDataSquadId);
        if (previous) {
            syncRootDataToSquad(previous);
        }
        loadSquadDataToRoot(activeSquad);
    }
    activeSquad.generalLineup = migrateLineup(activeSquad.generalLineup || createLineupBase(), false);
    activeSquad.generalLineup.placedPlayers = sanitizePlacedPlayers(activeSquad.generalLineup.placedPlayers);
    activeSquad.matchLineups = (activeSquad.matchLineups || []).map((lineup) => migrateLineup(lineup, true));
    activeSquad.matchLineups.forEach((lineup) => {
        lineup.availablePlayerIds = uniqueIds((lineup.availablePlayerIds || []).filter((id) => getPlayerById(id)));
        lineup.placedPlayers = sanitizePlacedPlayers(lineup.placedPlayers).filter((item) => lineup.availablePlayerIds.includes(item.playerId));
    });
    if (state.metadata.lineupMode === "match" && activeSquad.matchLineups.length && !getActiveMatchLineup()) {
        state.metadata.lastOpenedMatchLineupId = activeSquad.matchLineups[0].id;
    }
    if (state.metadata.lineupMode === "match" && !activeSquad.matchLineups.length) {
        state.metadata.lastOpenedMatchLineupId = "";
    }
}

function renderSquads() {
    dom.squadList.innerHTML = "";
    state.squads.forEach((squad) => {
        const item = document.createElement("div");
        item.className = `squad-item${squad.id === state.metadata.lastOpenedSquadId ? " active" : ""}`;
        item.innerHTML = `<div class="squad-main"><strong>${escapeHtml(squad.name)}</strong><span class="status-text">${squad.matchLineups.length} składów meczowych</span></div>`;
        item.appendChild(actionButton("Otwórz", "ghost-button", () => commitChange(() => {
            setActiveSquadData(squad.id);
        }, false)));
        dom.squadList.appendChild(item);
    });
}

async function addSquad() {
    const name = await showPromptModal("Nowy zestaw", "Nazwa nowej drużyny / zestawu:", `Zestaw ${state.squads.length + 1}`);
    if (!name) {
        return;
    }
    commitChange(() => {
        syncRootDataToSquad(getActiveSquad());
        const squad = {
            id: createId("squad"),
            name: name.trim(),
            teamFolder: sanitizeFolderName(name.trim()),
            teamData: normalizeTeamData(),
            generalLineup: createLineupBase(),
            matchLineups: []
        };
        state.squads.push(squad);
        setActiveSquadData(squad.id);
        state.metadata.lineupMode = "general";
    });
}

async function deleteActiveSquad() {
    const squad = getActiveSquad();
    if (!squad || !await showConfirmModal("Usuń zestaw", `Usunąć zestaw ${squad.name}?`)) {
        return;
    }
    commitChange(() => {
        const deletingId = squad.id;
        state.squads = state.squads.filter((item) => item.id !== deletingId);
        activeTeamDataSquadId = null;
        const fallback = state.squads[0];
        if (fallback) {
            setActiveSquadData(fallback.id);
        } else {
            state = defaultState();
            activeTeamDataSquadId = null;
        }
    });
}

async function addMatchLineup() {
    const squad = getActiveSquad();
    const name = squad ? await showPromptModal("Nowy skład meczowy", "Nazwa składu meczowego:", `Mecz ${squad.matchLineups.length + 1}`) : "";
    if (!name) {
        return;
    }
    const rawDate = await showPromptModal("Data meczu", "Podaj datę meczu lub zostaw puste:", "");
    const matchDate = normalizeDateInput(rawDate || "");
    if (matchDate && !isValidFlexibleDate(matchDate)) {
        await showAlertModal("Błąd", "Wpisz datę meczu w formacie dd-mm-rrrr.");
        return;
    }
    commitChange(() => {
        const lineup = {
            ...createLineupBase(),
            id: createId("match"),
            name: name.trim(),
            matchDate,
            availablePlayerIds: state.players.map((player) => player.id)
        };
        squad.matchLineups.push(lineup);
        state.metadata.lastOpenedMatchLineupId = lineup.id;
        state.metadata.lineupMode = "match";
    });
}

function buildSmartFormationTargets(formation) {
    const rows = parseFormation(formation);
    const templates = [
        ["BR"],
        rowLabels("def", rows[0] || 4),
        rowLabels("mid", rows[1] || 3),
        rowLabels("att", rows[2] || 3),
        rowLabels("extra", rows[3] || 0),
        rowLabels("extra", rows[4] || 0)
    ];
    const targets = [];
    const rowTops = [95, 74, 45, 16, 6, 1];
    templates.forEach((labels, rowIndex) => {
        if (!labels.length) {
            return;
        }
        const top = rowTops[rowIndex] ?? 1;
        labels.forEach((label, index) => {
            targets.push({ x: ((index + 1) / (labels.length + 1)) * 100, y: top, label });
        });
    });
    return targets;
}

function saveToLocalStorage() {
    syncRootDataToSquad(getActiveSquad());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function loadOrCreateDirectoryData() {
    const metadata = await readJsonFile(DATA_FILES.metadata);
    const squadsPayload = await readJsonFile(DATA_FILES.squads);
    const rootPlayers = await readJsonFile(DATA_FILES.players);
    const rootInjuries = await readJsonFile(DATA_FILES.injuries);
    const rootSuspensions = await readJsonFile(DATA_FILES.suspensions);

    const discoveredSquads = [];
    for (const [folderName, handle] of await listDirectoryEntries(directoryHandle)) {
        if (handle.kind !== "directory") {
            continue;
        }
        const squad = await readTeamBundleFromDirectory(handle, folderName);
        if (squad) {
            discoveredSquads.push(squad);
        }
    }

    const rootSquads = squadsPayload?.squads || [];
    const mergedSquads = rootSquads.map((rootSquad, index) => {
        const folderName = rootSquad.teamFolder || sanitizeFolderName(rootSquad.name || `squad-${index + 1}`);
        const discovered = discoveredSquads.find((item) => item.teamFolder === folderName);
        return {
            id: rootSquad.id || discovered?.id || createId("squad"),
            name: rootSquad.name || discovered?.name || `Skład ${index + 1}`,
            teamFolder: folderName,
            teamData: normalizeTeamData(discovered?.teamData),
            generalLineup: migrateLineup(discovered?.generalLineup || rootSquad.generalLineup || createLineupBase(), false),
            matchLineups: (discovered?.matchLineups || rootSquad.matchLineups || []).map((lineup) => migrateLineup(lineup, true))
        };
    });

    discoveredSquads.forEach((discovered) => {
        if (!mergedSquads.some((item) => item.teamFolder === discovered.teamFolder)) {
            mergedSquads.push(discovered);
        }
    });

    state = migrateState({
        metadata,
        players: [],
        injuries: [],
        suspensions: [],
        squads: mergedSquads
    });

    if (!state.squads.length) {
        state = migrateState({
            metadata,
            players: rootPlayers?.players,
            injuries: rootInjuries?.injuries,
            suspensions: rootSuspensions?.suspensions
        });
    } else if (!state.squads.some((squad) => squad.teamData?.players?.length || squad.teamData?.injuries?.length || squad.teamData?.suspensions?.length)) {
        ensureSquadTeamData(state.squads[0]);
        state.squads[0].teamData = normalizeTeamData({
            players: rootPlayers?.players,
            injuries: rootInjuries?.injuries,
            suspensions: rootSuspensions?.suspensions
        });
    }

    activeTeamDataSquadId = null;
    ensureStateConsistency();
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

async function persistAll() {
    saveToLocalStorage();
    if (!directoryHandle) {
        updateSaveStatus();
        return;
    }
    syncRootDataToSquad(getActiveSquad());
    const squadsPayload = {
        squads: state.squads.map((squad) => ({
            id: squad.id,
            name: squad.name,
            teamFolder: squad.teamFolder || sanitizeFolderName(squad.name),
            generalLineup: squad.generalLineup,
            matchLineups: squad.matchLineups
        }))
    };
    await writeJsonFile(DATA_FILES.metadata, state.metadata);
    await writeJsonFile(DATA_FILES.squads, squadsPayload);
    for (const squad of state.squads) {
        ensureSquadTeamData(squad);
        const teamDir = await directoryHandle.getDirectoryHandle(squad.teamFolder, { create: true });
        const serializedPlayers = [];
        for (const player of squad.teamData.players) {
            const minifaceFileName = await writePlayerMinifaceFile(teamDir, player);
            serializedPlayers.push({
                ...player,
                miniface: minifaceFileName || player.miniface || "",
                minifaceFileName
            });
        }
        await writeTeamJson(teamDir, "players.json", { players: serializedPlayers });
        await writeTeamJson(teamDir, "injuries.json", { injuries: squad.teamData.injuries });
        await writeTeamJson(teamDir, "suspensions.json", { suspensions: squad.teamData.suspensions });
        await writeTeamJson(teamDir, "team.json", {
            id: squad.id,
            name: squad.name,
            generalLineup: squad.generalLineup,
            matchLineups: squad.matchLineups
        });
    }
    updateSaveStatus();
}

function normalizeTeamData(teamData) {
    return {
        players: (teamData?.players || []).map((player) => ({
            id: player.id || createId("player"),
            firstName: player.firstName || "",
            lastName: player.lastName || "",
            positions: Array.isArray(player.positions) ? player.positions : [],
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

async function handlePlayerSubmit(event) {
    event.preventDefault();
    const existing = getPlayerById(dom.playerId.value);
    const playerId = dom.playerId.value || createId("player");
    const miniface = await fileToDataUrl(dom.playerMiniface.files[0]);
    const player = {
        id: playerId,
        firstName: dom.playerFirstName.value.trim(),
        lastName: dom.playerLastName.value.trim(),
        positions: getSelectedPositions(),
        number: dom.playerNumber.value.trim(),
        miniface: miniface || existing?.miniface || "",
        minifaceFileName: dom.playerMiniface.files[0] ? `miniface/${playerId}.png` : (existing?.minifaceFileName || "")
    };
    if (!player.firstName && !player.lastName) {
        await showAlertModal("Błąd", "Podaj przynajmniej imię albo nazwisko.");
        return;
    }
    commitChange(() => {
        const index = state.players.findIndex((item) => item.id === player.id);
        if (index >= 0) {
            state.players[index] = player;
        } else {
            state.players.push(player);
            state.squads.forEach((squad) => squad.matchLineups.forEach((lineup) => {
                lineup.availablePlayerIds = uniqueIds([...lineup.availablePlayerIds, player.id]);
            }));
        }
    });
    resetPlayerForm();
}

async function listDirectoryEntries(dirHandle) {
    const entries = [];
    if (!dirHandle?.entries) {
        return entries;
    }
    for await (const [name, handle] of dirHandle.entries()) {
        entries.push([name, handle]);
    }
    return entries;
}

async function readDataUrlFromHandle(fileHandle) {
    const file = await fileHandle.getFile();
    return readFileAsDataUrl(file);
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
    if (!player?.miniface || !String(player.miniface).startsWith("data:")) {
        return player?.minifaceFileName || "";
    }
    const relativePath = player.minifaceFileName || `miniface/${player.id}.png`;
    const directoryPath = relativePath.split("/").slice(0, -1).join("/");
    const fileName = relativePath.split("/").pop();
    const parentDir = directoryPath ? await ensureNestedDirectory(teamDir, directoryPath) : teamDir;
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
            minifaceFileName: player.minifaceFileName || ""
        };
        if (player.miniface && String(player.miniface).startsWith("data:")) {
            hydrated.miniface = player.miniface;
            hydrated.minifaceFileName = player.minifaceFileName || `miniface/${hydrated.id}.png`;
            return hydrated;
        }
        const fileRef = player.minifaceFileName || player.miniface;
        if (fileRef) {
            try {
                const fileHandle = await getNestedFileHandle(teamDir, fileRef);
                hydrated.miniface = await readDataUrlFromHandle(fileHandle);
                hydrated.minifaceFileName = fileRef;
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
    const hydratedPlayers = await hydratePlayersFromTeamDir(playersPayload?.players, teamDir);
    return {
        id: teamMeta?.id || createId("squad"),
        name: teamMeta?.name || fallbackName,
        teamFolder: fallbackName,
        teamData: normalizeTeamData({
            players: hydratedPlayers,
            injuries: injuriesPayload?.injuries,
            suspensions: suspensionsPayload?.suspensions
        }),
        generalLineup: migrateLineup(teamMeta?.generalLineup || createLineupBase(), false),
        matchLineups: (teamMeta?.matchLineups || []).map((lineup) => migrateLineup(lineup, true))
    };
}
