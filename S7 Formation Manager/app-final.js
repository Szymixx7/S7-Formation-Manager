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
        refreshAll();
    } catch (error) {
        console.error(error);
        directoryHandle = null;
        updateSaveStatus();
    }
};
