const STORAGE_KEY = "s7-formation-manager-state";
const DATA_FILES = {
    metadata: "metadata.json",
    players: "players.json",
    injuries: "injuries.json",
    suspensions: "suspensions.json",
    squads: "squads.json"
};

const STATUS_ICONS = {
    injury: "kontuzjowany.png",
    suspension: "zawieszony.png"
};

const defaultState = () => {
    const squadId = createId("squad");
    const matchLineupId = createId("match");

    return {
        metadata: {
            version: 1,
            lastOpenedSquadId: squadId,
            lineupMode: "general",
            lastOpenedMatchLineupId: matchLineupId
        },
        players: [],
        injuries: [],
        suspensions: [],
        squads: [
            {
                id: squadId,
                name: "Skład 1",
                generalLineup: {
                    formation: "4-3-3",
                    assignments: {}
                },
                matchLineups: [
                    {
                        id: matchLineupId,
                        name: "Mecz 1",
                        formation: "4-3-3",
                        assignments: {},
                        availablePlayerIds: []
                    }
                ]
            }
        ]
    };
};

let state = loadFromLocalStorage();
let directoryHandle = null;
let saveTimer = null;

const dom = {};

document.addEventListener("DOMContentLoaded", () => {
    cacheDom();
    bindEvents();
    refreshAll();
});

function cacheDom() {
    dom.tabButtons = [...document.querySelectorAll(".tab-button")];
    dom.tabPanels = [...document.querySelectorAll(".tab-panel")];
    dom.chooseFolderButton = document.getElementById("choose-folder-button");
    dom.saveStatus = document.getElementById("save-status");
    dom.folderName = document.getElementById("folder-name");

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
    dom.formationInput = document.getElementById("formation-input");
    dom.availabilityPanel = document.getElementById("availability-panel");
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
}

function bindEvents() {
    dom.tabButtons.forEach((button) => {
        button.addEventListener("click", () => switchTab(button.dataset.tab));
    });

    dom.chooseFolderButton.addEventListener("click", chooseDataFolder);
    dom.addSquadButton.addEventListener("click", addSquad);
    dom.renameSquadButton.addEventListener("click", renameActiveSquad);
    dom.deleteSquadButton.addEventListener("click", deleteActiveSquad);

    dom.lineupModeButtons.forEach((button) => {
        button.addEventListener("click", () => {
            state.metadata.lineupMode = button.dataset.lineupMode;
            scheduleSave();
            refreshAll();
        });
    });

    dom.matchLineupSelect.addEventListener("change", () => {
        state.metadata.lastOpenedMatchLineupId = dom.matchLineupSelect.value;
        scheduleSave();
        refreshAll();
    });

    dom.addMatchLineupButton.addEventListener("click", addMatchLineup);
    dom.renameMatchLineupButton.addEventListener("click", renameActiveMatchLineup);
    dom.deleteMatchLineupButton.addEventListener("click", deleteActiveMatchLineup);
    dom.formationInput.addEventListener("change", updateFormation);

    dom.playerForm.addEventListener("submit", handlePlayerSubmit);
    dom.cancelPlayerEdit.addEventListener("click", resetPlayerForm);

    dom.injuryForm.addEventListener("submit", handleInjurySubmit);
    dom.cancelInjuryEdit.addEventListener("click", resetInjuryForm);

    dom.suspensionForm.addEventListener("submit", handleSuspensionSubmit);
    dom.cancelSuspensionEdit.addEventListener("click", resetSuspensionForm);
}

function switchTab(tabId) {
    dom.tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tabId));
    dom.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tabId));
}

function refreshAll() {
    ensureStateConsistency();
    renderSquads();
    renderLineupControls();
    renderPitch();
    renderBench();
    renderPlayerLists();
    renderInjurySection();
    renderSuspensionSection();
    updateSaveStatus();
    saveToLocalStorage();
}

function ensureStateConsistency() {
    if (!state.squads.length) {
        const fresh = defaultState();
        state.squads = fresh.squads;
        state.metadata.lastOpenedSquadId = fresh.metadata.lastOpenedSquadId;
        state.metadata.lastOpenedMatchLineupId = fresh.metadata.lastOpenedMatchLineupId;
        state.metadata.lineupMode = "general";
    }

    if (!getActiveSquad()) {
        state.metadata.lastOpenedSquadId = state.squads[0].id;
    }

    const squad = getActiveSquad();
    if (!squad.matchLineups.length) {
        const matchLineup = createMatchLineup("Mecz 1");
        matchLineup.availablePlayerIds = state.players.map((player) => player.id);
        squad.matchLineups.push(matchLineup);
    }

    if (!getActiveMatchLineup()) {
        state.metadata.lastOpenedMatchLineupId = squad.matchLineups[0].id;
    }
}

function renderSquads() {
    dom.squadList.innerHTML = "";

    state.squads.forEach((squad) => {
        const item = document.createElement("div");
        item.className = `squad-item${squad.id === state.metadata.lastOpenedSquadId ? " active" : ""}`;

        const main = document.createElement("div");
        main.className = "squad-main";
        main.innerHTML = `
            <strong>${escapeHtml(squad.name)}</strong>
            <span class="status-text">${squad.matchLineups.length} składów meczowych</span>
        `;

        const openButton = document.createElement("button");
        openButton.className = "ghost-button";
        openButton.type = "button";
        openButton.textContent = "Otwórz";
        openButton.addEventListener("click", () => {
            state.metadata.lastOpenedSquadId = squad.id;
            state.metadata.lastOpenedMatchLineupId = squad.matchLineups[0]?.id || "";
            scheduleSave();
            refreshAll();
        });

        item.append(main, openButton);
        dom.squadList.appendChild(item);
    });
}

function renderLineupControls() {
    const squad = getActiveSquad();
    const activeLineup = getCurrentLineup();
    const isMatchMode = state.metadata.lineupMode === "match";

    dom.currentSquadName.textContent = squad?.name || "Brak składu";
    dom.lineupModeButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.lineupMode === state.metadata.lineupMode);
    });
    dom.matchToolbar.classList.toggle("hidden", !isMatchMode);
    dom.availabilityPanel.classList.toggle("hidden", !isMatchMode);
    dom.renameSquadButton.disabled = !squad;
    dom.deleteSquadButton.disabled = !squad;
    dom.formationInput.value = activeLineup?.formation || "";

    renderMatchLineupSelect(squad);
    renderAvailabilityPanel();
}

function renderMatchLineupSelect(squad) {
    dom.matchLineupSelect.innerHTML = "";

    if (!squad) {
        return;
    }

    squad.matchLineups.forEach((lineup) => {
        const option = document.createElement("option");
        option.value = lineup.id;
        option.textContent = lineup.name;
        option.selected = lineup.id === state.metadata.lastOpenedMatchLineupId;
        dom.matchLineupSelect.appendChild(option);
    });
}

function renderAvailabilityPanel() {
    if (state.metadata.lineupMode !== "match") {
        dom.availabilityPanel.innerHTML = "";
        return;
    }

    const lineup = getActiveMatchLineup();

    if (!lineup) {
        dom.availabilityPanel.innerHTML = `<div class="empty-state">Brak składu meczowego.</div>`;
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

        const left = document.createElement("div");
        left.className = "table-main";
        left.innerHTML = `
            <strong>${escapeHtml(getPlayerLabel(player))}</strong>
            <span class="status-text">${escapeHtml(player.positions.join(", "))}</span>
        `;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = lineup.availablePlayerIds.includes(player.id);
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                lineup.availablePlayerIds = uniqueIds([...lineup.availablePlayerIds, player.id]);
            } else {
                lineup.availablePlayerIds = lineup.availablePlayerIds.filter((id) => id !== player.id);
                removePlayerFromAssignments(lineup.assignments, player.id);
            }
            scheduleSave();
            refreshAll();
        });

        row.append(left, checkbox);
        grid.appendChild(row);
    });

    dom.availabilityPanel.innerHTML = `
        <div class="section-header">
            <div>
                <p class="section-kicker">Lista obecności</p>
                <h3>Dostępność na mecz</h3>
            </div>
        </div>
    `;
    dom.availabilityPanel.appendChild(grid);
}

function renderPitch() {
    const lineup = getCurrentLineup();
    const formationRows = parseFormation(lineup?.formation || "4-3-3");
    const slots = buildFormationSlots(formationRows);
    const availablePlayers = getAvailablePlayersForCurrentLineup();
    const assignedIds = new Set(Object.values(lineup.assignments || {}).filter(Boolean));
    const availableOptions = [
        { value: "", label: "Nieprzypisany" },
        ...availablePlayers.map((player) => ({
            value: player.id,
            label: `${getPlayerLabel(player)} (${player.positions.join("/")})`
        }))
    ];

    dom.pitch.innerHTML = "";
    dom.lineupSummary.textContent = `${slots.length} pozycji na boisku. Ustawienie: ${lineup.formation || "4-3-3"}.`;

    slots.forEach((slot) => {
        const player = state.players.find((candidate) => candidate.id === lineup.assignments[slot.id]);
        const statuses = player ? getPlayerStatuses(player.id) : [];
        const wrapper = document.createElement("div");
        wrapper.className = "player-slot";
        wrapper.style.left = `${slot.left}%`;
        wrapper.style.top = `${slot.top}%`;

        const card = document.createElement("div");
        card.className = `player-card${player ? "" : " empty"}`;

        const image = document.createElement("img");
        image.src = player?.miniface || "defaultMiniface.png";
        image.alt = player ? getPlayerLabel(player) : "Brak zawodnika";

        const ident = document.createElement("div");
        ident.className = "player-ident";
        ident.innerHTML = `
            <div class="player-meta">${escapeHtml(slot.label)}</div>
            <strong>${player ? escapeHtml(getPlayerLabel(player)) : "Wybierz zawodnika"}</strong>
            <div class="player-meta">${player ? escapeHtml(player.positions.join(", ")) : "Brak przypisania"}</div>
        `;

        const footer = document.createElement("div");
        footer.className = "slot-footer";

        const chip = document.createElement("span");
        chip.className = "position-chip";
        chip.textContent = slot.label;
        footer.appendChild(chip);

        statuses.forEach((status) => {
            footer.appendChild(createStatusBadge(status));
        });

        ident.appendChild(footer);
        card.append(image, ident);

        const select = document.createElement("select");
        select.className = "slot-select";

        availableOptions.forEach((optionData) => {
            const option = document.createElement("option");
            option.value = optionData.value;
            option.textContent = optionData.label;
            const isSelected = optionData.value === (player?.id || "");
            const optionInUse = optionData.value && assignedIds.has(optionData.value) && optionData.value !== player?.id;
            option.selected = isSelected;
            option.disabled = optionInUse;
            select.appendChild(option);
        });

        select.addEventListener("change", () => {
            assignPlayerToSlot(slot.id, select.value || "");
        });

        wrapper.append(card, select);
        dom.pitch.appendChild(wrapper);
    });
}

function renderBench() {
    const lineup = getCurrentLineup();
    const availablePlayers = getAvailablePlayersForCurrentLineup();
    const assigned = new Set(Object.values(lineup.assignments || {}).filter(Boolean));
    const benchPlayers = availablePlayers.filter((player) => !assigned.has(player.id));

    dom.benchList.innerHTML = "";

    if (!benchPlayers.length) {
        dom.benchList.innerHTML = `<div class="empty-state">Brak dodatkowych zawodników do pokazania.</div>`;
        return;
    }

    benchPlayers.forEach((player) => {
        const row = document.createElement("div");
        row.className = "bench-player";

        const placeholder = document.createElement("div");
        placeholder.className = "miniface-placeholder";

        const main = document.createElement("div");
        main.className = "table-main";
        main.innerHTML = `
            <strong>${escapeHtml(getPlayerLabel(player))}</strong>
            <span class="status-text">${escapeHtml(player.positions.join(", "))}</span>
        `;

        const statuses = document.createElement("div");
        statuses.className = "player-statuses";
        getPlayerStatuses(player.id).forEach((status) => {
            statuses.appendChild(createStatusBadge(status));
        });

        row.append(placeholder, main, statuses);
        dom.benchList.appendChild(row);
    });
}

function renderPlayerLists() {
    const options = [`<option value="">Wybierz zawodnika</option>`];
    state.players.forEach((player) => {
        options.push(`<option value="${player.id}">${escapeHtml(getPlayerLabel(player))}</option>`);
    });

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

        const main = document.createElement("div");
        main.className = "table-main";
        main.innerHTML = `
            <strong>${escapeHtml(getPlayerLabel(player))}</strong>
            <span class="status-text">Pozycje: ${escapeHtml(player.positions.join(", "))}${player.number ? ` | Nr ${player.number}` : ""}</span>
        `;

        const actions = document.createElement("div");
        actions.className = "toolbar-actions";

        const editButton = document.createElement("button");
        editButton.className = "ghost-button";
        editButton.type = "button";
        editButton.textContent = "Edytuj";
        editButton.addEventListener("click", () => editPlayer(player.id));

        const deleteButton = document.createElement("button");
        deleteButton.className = "danger-button";
        deleteButton.type = "button";
        deleteButton.textContent = "Usuń";
        deleteButton.addEventListener("click", () => deletePlayer(player.id));

        actions.append(editButton, deleteButton);
        row.append(main, actions);
        dom.playersList.appendChild(row);
    });
}

function renderInjurySection() {
    dom.injuriesList.innerHTML = "";

    if (!state.injuries.length) {
        dom.injuriesList.innerHTML = `<div class="empty-state">Brak zapisanych kontuzji.</div>`;
        return;
    }

    state.injuries.forEach((injury) => {
        const player = getPlayerById(injury.playerId);
        const row = document.createElement("div");
        row.className = "table-row";
        row.innerHTML = `
            <div class="table-main">
                <strong>${escapeHtml(player ? getPlayerLabel(player) : "Usunięty zawodnik")}</strong>
                <span class="status-text">${escapeHtml(injury.type)} | ${escapeHtml(injury.severity)} | od ${escapeHtml(injury.startDate)} do ${escapeHtml(injury.returnDate)}</span>
            </div>
        `;

        const actions = document.createElement("div");
        actions.className = "toolbar-actions";
        actions.append(
            actionButton("Edytuj", "ghost-button", () => editInjury(injury.id)),
            actionButton("Usuń", "danger-button", () => deleteInjury(injury.id))
        );

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

    state.suspensions.forEach((suspension) => {
        const player = getPlayerById(suspension.playerId);
        const row = document.createElement("div");
        row.className = "table-row";
        row.innerHTML = `
            <div class="table-main">
                <strong>${escapeHtml(player ? getPlayerLabel(player) : "Usunięty zawodnik")}</strong>
                <span class="status-text">Koniec zawieszenia: ${escapeHtml(suspension.endDate)}</span>
            </div>
        `;

        const actions = document.createElement("div");
        actions.className = "toolbar-actions";
        actions.append(
            actionButton("Edytuj", "ghost-button", () => editSuspension(suspension.id)),
            actionButton("Usuń", "danger-button", () => deleteSuspension(suspension.id))
        );

        row.appendChild(actions);
        dom.suspensionsList.appendChild(row);
    });
}

async function handlePlayerSubmit(event) {
    event.preventDefault();
    const miniface = await fileToDataUrl(dom.playerMiniface.files[0]);
    const player = {
        id: dom.playerId.value || createId("player"),
        firstName: dom.playerFirstName.value.trim(),
        lastName: dom.playerLastName.value.trim(),
        positions: dom.playerPositions.value.split(",").map((value) => value.trim()).filter(Boolean),
        number: dom.playerNumber.value.trim(),
        miniface: miniface || getPlayerById(dom.playerId.value)?.miniface || ""
    };

    if (!player.firstName || !player.lastName || !player.positions.length) {
        return;
    }

    const existingIndex = state.players.findIndex((item) => item.id === player.id);
    if (existingIndex >= 0) {
        state.players[existingIndex] = player;
    } else {
        state.players.push(player);
        state.squads.forEach((squad) => {
            squad.matchLineups.forEach((lineup) => {
                lineup.availablePlayerIds = uniqueIds([...lineup.availablePlayerIds, player.id]);
            });
        });
    }

    scheduleSave();
    resetPlayerForm();
    refreshAll();
}

function editPlayer(playerId) {
    const player = getPlayerById(playerId);
    if (!player) {
        return;
    }

    dom.playerId.value = player.id;
    dom.playerFirstName.value = player.firstName;
    dom.playerLastName.value = player.lastName;
    dom.playerPositions.value = player.positions.join(", ");
    dom.playerNumber.value = player.number;
    switchTab("players");
}

function deletePlayer(playerId) {
    const player = getPlayerById(playerId);
    if (!player || !window.confirm(`Usunąć zawodnika ${getPlayerLabel(player)}?`)) {
        return;
    }

    state.players = state.players.filter((item) => item.id !== playerId);
    state.injuries = state.injuries.filter((item) => item.playerId !== playerId);
    state.suspensions = state.suspensions.filter((item) => item.playerId !== playerId);
    state.squads.forEach((squad) => {
        removePlayerFromAssignments(squad.generalLineup.assignments, playerId);
        squad.matchLineups.forEach((lineup) => {
            removePlayerFromAssignments(lineup.assignments, playerId);
            lineup.availablePlayerIds = lineup.availablePlayerIds.filter((id) => id !== playerId);
        });
    });

    scheduleSave();
    refreshAll();
}

function resetPlayerForm() {
    dom.playerForm.reset();
    dom.playerId.value = "";
}

function handleInjurySubmit(event) {
    event.preventDefault();
    const injury = {
        id: dom.injuryId.value || createId("injury"),
        playerId: dom.injuryPlayerId.value,
        startDate: dom.injuryStartDate.value,
        type: dom.injuryType.value.trim(),
        severity: dom.injurySeverity.value.trim(),
        returnDate: dom.injuryReturnDate.value
    };

    const index = state.injuries.findIndex((item) => item.id === injury.id);
    if (index >= 0) {
        state.injuries[index] = injury;
    } else {
        state.injuries.push(injury);
    }

    scheduleSave();
    resetInjuryForm();
    refreshAll();
}

function editInjury(injuryId) {
    const injury = state.injuries.find((item) => item.id === injuryId);
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

function deleteInjury(injuryId) {
    state.injuries = state.injuries.filter((item) => item.id !== injuryId);
    scheduleSave();
    refreshAll();
}

function resetInjuryForm() {
    dom.injuryForm.reset();
    dom.injuryId.value = "";
}

function handleSuspensionSubmit(event) {
    event.preventDefault();
    const suspension = {
        id: dom.suspensionId.value || createId("suspension"),
        playerId: dom.suspensionPlayerId.value,
        endDate: dom.suspensionEndDate.value
    };

    const index = state.suspensions.findIndex((item) => item.id === suspension.id);
    if (index >= 0) {
        state.suspensions[index] = suspension;
    } else {
        state.suspensions.push(suspension);
    }

    scheduleSave();
    resetSuspensionForm();
    refreshAll();
}

function editSuspension(suspensionId) {
    const suspension = state.suspensions.find((item) => item.id === suspensionId);
    if (!suspension) {
        return;
    }

    dom.suspensionId.value = suspension.id;
    dom.suspensionPlayerId.value = suspension.playerId;
    dom.suspensionEndDate.value = suspension.endDate;
    switchTab("suspensions");
}

function deleteSuspension(suspensionId) {
    state.suspensions = state.suspensions.filter((item) => item.id !== suspensionId);
    scheduleSave();
    refreshAll();
}

function resetSuspensionForm() {
    dom.suspensionForm.reset();
    dom.suspensionId.value = "";
}

function addSquad() {
    const name = window.prompt("Nazwa nowego składu:", `Skład ${state.squads.length + 1}`);
    if (!name) {
        return;
    }

    const squad = {
        id: createId("squad"),
        name: name.trim(),
        generalLineup: {
            formation: "4-3-3",
            assignments: {}
        },
        matchLineups: [createMatchLineup("Mecz 1")]
    };
    squad.matchLineups[0].availablePlayerIds = state.players.map((player) => player.id);

    state.squads.push(squad);
    state.metadata.lastOpenedSquadId = squad.id;
    state.metadata.lastOpenedMatchLineupId = squad.matchLineups[0].id;
    state.metadata.lineupMode = "general";
    scheduleSave();
    refreshAll();
}

function renameActiveSquad() {
    const squad = getActiveSquad();
    if (!squad) {
        return;
    }

    const name = window.prompt("Nowa nazwa składu:", squad.name);
    if (!name) {
        return;
    }

    squad.name = name.trim();
    scheduleSave();
    refreshAll();
}

function deleteActiveSquad() {
    const squad = getActiveSquad();
    if (!squad || !window.confirm(`Usunąć skład ${squad.name}?`)) {
        return;
    }

    state.squads = state.squads.filter((item) => item.id !== squad.id);
    scheduleSave();
    refreshAll();
}

function addMatchLineup() {
    const squad = getActiveSquad();
    if (!squad) {
        return;
    }

    const name = window.prompt("Nazwa składu meczowego:", `Mecz ${squad.matchLineups.length + 1}`);
    if (!name) {
        return;
    }

    const lineup = createMatchLineup(name.trim());
    lineup.availablePlayerIds = state.players.map((player) => player.id);
    squad.matchLineups.push(lineup);
    state.metadata.lastOpenedMatchLineupId = lineup.id;
    state.metadata.lineupMode = "match";
    scheduleSave();
    refreshAll();
}

function renameActiveMatchLineup() {
    const lineup = getActiveMatchLineup();
    if (!lineup) {
        return;
    }

    const name = window.prompt("Nowa nazwa składu meczowego:", lineup.name);
    if (!name) {
        return;
    }

    lineup.name = name.trim();
    scheduleSave();
    refreshAll();
}

function deleteActiveMatchLineup() {
    const squad = getActiveSquad();
    const lineup = getActiveMatchLineup();
    if (!squad || !lineup || !window.confirm(`Usunąć ${lineup.name}?`)) {
        return;
    }

    squad.matchLineups = squad.matchLineups.filter((item) => item.id !== lineup.id);
    scheduleSave();
    refreshAll();
}

function updateFormation() {
    const lineup = getCurrentLineup();
    if (!lineup) {
        return;
    }

    lineup.formation = dom.formationInput.value.trim() || "4-3-3";
    normalizeAssignmentsForFormation(lineup);
    scheduleSave();
    refreshAll();
}

function assignPlayerToSlot(slotId, playerId) {
    const lineup = getCurrentLineup();
    if (!lineup) {
        return;
    }

    Object.keys(lineup.assignments).forEach((key) => {
        if (lineup.assignments[key] === playerId) {
            lineup.assignments[key] = "";
        }
    });

    lineup.assignments[slotId] = playerId;
    scheduleSave();
    refreshAll();
}

function getCurrentLineup() {
    const squad = getActiveSquad();
    if (!squad) {
        return { formation: "4-3-3", assignments: {} };
    }

    return state.metadata.lineupMode === "match" ? getActiveMatchLineup() : squad.generalLineup;
}

function getActiveSquad() {
    return state.squads.find((squad) => squad.id === state.metadata.lastOpenedSquadId) || null;
}

function getActiveMatchLineup() {
    const squad = getActiveSquad();
    return squad?.matchLineups.find((lineup) => lineup.id === state.metadata.lastOpenedMatchLineupId) || squad?.matchLineups[0] || null;
}

function getAvailablePlayersForCurrentLineup() {
    if (state.metadata.lineupMode === "general") {
        return [...state.players];
    }

    const lineup = getActiveMatchLineup();
    if (!lineup) {
        return [];
    }

    return state.players.filter((player) => lineup.availablePlayerIds.includes(player.id));
}

function getPlayerStatuses(playerId) {
    const statuses = [];
    const injury = state.injuries.find((item) => item.playerId === playerId);
    const suspension = state.suspensions.find((item) => item.playerId === playerId);

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
    icon.addEventListener("error", () => {
        icon.remove();
        badge.textContent = status.type === "injury" ? "K" : "Z";
        badge.append(` ${status.label}`);
    }, { once: true });

    badge.append(icon, document.createTextNode(status.label));
    return badge;
}

function parseFormation(formation) {
    const values = formation.split("-").map((part) => Number.parseInt(part.trim(), 10)).filter((value) => Number.isFinite(value) && value > 0);
    if (!values.length) {
        return [4, 3, 3];
    }

    const totalOutfield = values.reduce((sum, value) => sum + value, 0);
    if (totalOutfield !== 10) {
        return [4, 3, 3];
    }

    return values;
}

function buildFormationSlots(formationRows) {
    const slots = [{ id: "gk-1", label: "GK", left: 50, top: 90 }];
    const labelsByRow = [
        ["LB", "LCB", "RCB", "RB", "WB"],
        ["LM", "LCM", "CM", "RCM", "RM", "DM", "AM"],
        ["LW", "LF", "CF", "RF", "RW", "SS"],
        ["ST", "CF", "ST2", "WF"],
        ["FWD1", "FWD2", "FWD3"]
    ];
    const rowCount = formationRows.length;

    formationRows.forEach((count, index) => {
        const rowTop = 78 - index * (58 / Math.max(rowCount - 1, 1));
        for (let i = 0; i < count; i += 1) {
            const left = ((i + 1) / (count + 1)) * 100;
            const fallbackLabel = `P${index + 1}.${i + 1}`;
            const label = labelsByRow[index]?.[i] || fallbackLabel;
            slots.push({
                id: `row-${index + 1}-slot-${i + 1}`,
                label,
                left,
                top: rowTop
            });
        }
    });

    return slots;
}

function normalizeAssignmentsForFormation(lineup) {
    const validSlots = new Set(buildFormationSlots(parseFormation(lineup.formation)).map((slot) => slot.id));
    Object.keys(lineup.assignments).forEach((slotId) => {
        if (!validSlots.has(slotId)) {
            delete lineup.assignments[slotId];
        }
    });
}

function removePlayerFromAssignments(assignments, playerId) {
    Object.keys(assignments).forEach((slotId) => {
        if (assignments[slotId] === playerId) {
            assignments[slotId] = "";
        }
    });
}

function getPlayerById(playerId) {
    return state.players.find((player) => player.id === playerId) || null;
}

function getPlayerLabel(player) {
    return `${player.firstName} ${player.lastName}`.trim();
}

async function chooseDataFolder() {
    if (!("showDirectoryPicker" in window)) {
        window.alert("Ta przeglądarka nie obsługuje wyboru folderu. Uruchom aplikację w aktualnym Chrome albo Edge.");
        return;
    }

    try {
        directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
        await loadOrCreateDirectoryData();
        scheduleSave(true);
        refreshAll();
    } catch (error) {
        console.error(error);
    }
}

async function loadOrCreateDirectoryData() {
    const loaded = {};

    for (const [key, filename] of Object.entries(DATA_FILES)) {
        loaded[key] = await readJsonFile(filename);
    }

    const defaults = defaultState();

    state = {
        metadata: loaded.metadata || defaults.metadata,
        players: loaded.players?.players || defaults.players,
        injuries: loaded.injuries?.injuries || defaults.injuries,
        suspensions: loaded.suspensions?.suspensions || defaults.suspensions,
        squads: loaded.squads?.squads || defaults.squads
    };
}

async function readJsonFile(filename) {
    try {
        const fileHandle = await directoryHandle.getFileHandle(filename);
        const file = await fileHandle.getFile();
        const text = await file.text();
        return JSON.parse(text);
    } catch (error) {
        return null;
    }
}

function scheduleSave(immediate = false) {
    window.clearTimeout(saveTimer);

    if (immediate) {
        persistAll().catch((error) => console.error(error));
        return;
    }

    if (dom.saveStatus) {
        dom.saveStatus.textContent = "Zapisywanie...";
    }

    saveTimer = window.setTimeout(() => {
        persistAll().catch((error) => console.error(error));
    }, 250);
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

async function writeJsonFile(filename, data) {
    const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
}

function saveToLocalStorage() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadFromLocalStorage() {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : defaultState();
    } catch (error) {
        return defaultState();
    }
}

function updateSaveStatus() {
    if (!dom.saveStatus || !dom.folderName) {
        return;
    }

    dom.saveStatus.textContent = directoryHandle ? "Autozapis aktywny" : "Brak folderu danych";
    dom.folderName.textContent = directoryHandle ? directoryHandle.name : "Dane lokalne w pamięci przeglądarki";
}

function createMatchLineup(name) {
    return {
        id: createId("match"),
        name,
        formation: "4-3-3",
        assignments: {},
        availablePlayerIds: []
    };
}

function createId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function uniqueIds(values) {
    return [...new Set(values)];
}

function actionButton(label, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
}

function escapeHtml(value) {
    return String(value)
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
