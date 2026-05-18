const PLUGIN_ID = "collie-video-premiere-bridge";
const PLUGIN_VERSION = "0.1.0";
const DEFAULT_BRIDGE_DIR = "~/Library/Application Support/CollieVideo/premiere-bridge";
const EXPECTED_BRIDGE_DIR_SUFFIX = "/Library/Application Support/CollieVideo/premiere-bridge";
const PROJECT_BIN_NAME = "Collie Video Imports";
const REQUEST_TYPE_IMPORT_SELECTED_VIDEOS = "import-selected-videos";

const BRIDGE_DIRECTORY_NAMES = Object.freeze({
  requests: "requests",
  completed: "completed",
  failed: "failed",
  imports: "imports",
});

const BRIDGE_STATUS = Object.freeze({
  ready: "ready",
  notReady: "not_ready",
  error: "error",
});

const REQUEST_LIFECYCLE_STATE = Object.freeze({
  queued: "queued",
  processing: "processing",
  completed: "completed",
  failed: "failed",
});

const TOKEN_KEYS = Object.freeze({
  bridgeFolder: "collieVideoBridgeFolderToken",
});

const state = {
  bridgeFolder: null,
  bridgePath: null,
  activeProjectName: null,
  activeProjectPath: null,
  heartbeatTimer: null,
  requestTimer: null,
  processingRequestIds: new Set(),
};

const ui = {};

function getLocalFileSystem() {
  return require("uxp").storage.localFileSystem;
}

function getPremiereApp() {
  try {
    return require("premierepro");
  } catch (error) {
    return null;
  }
}

function setText(key, value) {
  if (ui[key]) {
    ui[key].textContent = value;
  }
}

function setLastActivity(message) {
  setText("lastActivity", message);
}

function normalizeNativePath(value) {
  return String(value || "").replace(/\/+$/, "");
}

function normalizeComparablePath(value) {
  return normalizeNativePath(value).replace(/\\/g, "/");
}

function isAbsoluteFilePath(value) {
  return typeof value === "string" && (/^\//.test(value) || /^[A-Za-z]:[\\/]/.test(value));
}

function getEntryPath(entry) {
  if (!entry) {
    return "";
  }

  try {
    const localFileSystem = getLocalFileSystem();

    if (typeof localFileSystem.getNativePath === "function") {
      return localFileSystem.getNativePath(entry);
    }
  } catch (error) {
    // Fall back to nativePath below.
  }

  return entry.nativePath || "";
}

function isExpectedBridgeFolder(entry) {
  const nativePath = normalizeComparablePath(getEntryPath(entry));

  if (!nativePath) {
    return true;
  }

  return nativePath.endsWith(EXPECTED_BRIDGE_DIR_SUFFIX);
}

async function createPersistentToken(entry) {
  const localFileSystem = getLocalFileSystem();
  return localFileSystem.createPersistentToken(entry);
}

async function restoreEntry(tokenKey) {
  const token = localStorage.getItem(tokenKey);

  if (!token) {
    return null;
  }

  try {
    const localFileSystem = getLocalFileSystem();
    return await localFileSystem.getEntryForPersistentToken(token);
  } catch (error) {
    localStorage.removeItem(tokenKey);
    return null;
  }
}

async function selectBridgeFolder() {
  const localFileSystem = getLocalFileSystem();
  const folder = await localFileSystem.getFolder();

  if (!folder) {
    return;
  }

  if (!isExpectedBridgeFolder(folder)) {
    setLastActivity(`Choose ${DEFAULT_BRIDGE_DIR} as the bridge folder.`);
    return;
  }

  localStorage.setItem(TOKEN_KEYS.bridgeFolder, await createPersistentToken(folder));
  state.bridgeFolder = folder;
  state.bridgePath = getEntryPath(folder);
  await ensureBridgeSubfolders();
  await refreshPanel();
  setLastActivity(`Bridge folder connected: ${state.bridgePath || DEFAULT_BRIDGE_DIR}`);
}

async function restoreFolders() {
  state.bridgeFolder = await restoreEntry(TOKEN_KEYS.bridgeFolder);
  state.bridgePath = getEntryPath(state.bridgeFolder);

  if (state.bridgeFolder && !isExpectedBridgeFolder(state.bridgeFolder)) {
    localStorage.removeItem(TOKEN_KEYS.bridgeFolder);
    state.bridgeFolder = null;
    state.bridgePath = null;
    setLastActivity(`Stored bridge folder is not ${DEFAULT_BRIDGE_DIR}. Select it again.`);
    return;
  }

  if (state.bridgeFolder) {
    await ensureBridgeSubfolders();
  }
}

async function getFolderEntries(folder) {
  if (!folder) {
    return [];
  }

  return folder.getEntries();
}

async function getChildEntry(folder, name) {
  const entries = await getFolderEntries(folder);
  return entries.find((entry) => entry.name === name) || null;
}

async function getOrCreateFolder(folder, name) {
  const existingEntry = await getChildEntry(folder, name);

  if (existingEntry) {
    if (!existingEntry.isFolder) {
      throw new Error(`${name} exists but is not a folder.`);
    }

    return existingEntry;
  }

  if (typeof folder.createFolder === "function") {
    return folder.createFolder(name);
  }

  return folder.createEntry(name, { type: require("uxp").storage.types.folder });
}

async function ensureBridgeSubfolders() {
  if (!state.bridgeFolder) {
    return null;
  }

  const folders = {};

  for (const name of Object.values(BRIDGE_DIRECTORY_NAMES)) {
    folders[name] = await getOrCreateFolder(state.bridgeFolder, name);
  }

  return folders;
}

async function createOrOverwriteFile(folder, name, contents) {
  const file = await folder.createFile(name, { overwrite: true });
  await file.write(contents);
  return file;
}

async function deleteEntry(entry) {
  if (entry && typeof entry.delete === "function") {
    await entry.delete();
  }
}

function getCurrentStatus(projectInfo) {
  if (!state.bridgeFolder) {
    return {
      status: BRIDGE_STATUS.notReady,
      message: "Bridge folder is not connected.",
    };
  }

  if (!projectInfo.activeProjectName) {
    return {
      status: BRIDGE_STATUS.notReady,
      message: "No active Premiere project is open.",
    };
  }

  return {
    status: BRIDGE_STATUS.ready,
    message: "Collie Video bridge is ready.",
  };
}

async function getActiveProject() {
  const premiereApp = getPremiereApp();

  if (!premiereApp || !premiereApp.Project || !premiereApp.Project.getActiveProject) {
    throw new Error("Premiere UXP Project API is unavailable.");
  }

  const project = await premiereApp.Project.getActiveProject();

  if (!project) {
    throw new Error("No active Premiere project is open.");
  }

  return project;
}

async function getActiveProjectInfo() {
  const premiereApp = getPremiereApp();

  if (!premiereApp || !premiereApp.Project || !premiereApp.Project.getActiveProject) {
    return {
      activeProjectName: null,
      activeProjectPath: null,
    };
  }

  try {
    const project = await premiereApp.Project.getActiveProject();

    if (!project) {
      return {
        activeProjectName: null,
        activeProjectPath: null,
      };
    }

    return {
      activeProjectName: project.name || project.documentName || "Open project",
      activeProjectPath: project.path || project.documentPath || null,
    };
  } catch (error) {
    return {
      activeProjectName: null,
      activeProjectPath: null,
    };
  }
}

async function writeHeartbeat() {
  if (!state.bridgeFolder) {
    return;
  }

  const projectInfo = await getActiveProjectInfo();
  state.activeProjectName = projectInfo.activeProjectName;
  state.activeProjectPath = projectInfo.activeProjectPath;

  const currentStatus = getCurrentStatus(projectInfo);
  const payload = {
    plugin: PLUGIN_ID,
    status: currentStatus.status,
    message: currentStatus.message,
    updatedAt: new Date().toISOString(),
    activeProjectName: projectInfo.activeProjectName,
    activeProjectPath: projectInfo.activeProjectPath,
    bridgeDir: state.bridgePath || DEFAULT_BRIDGE_DIR,
    outputDirectory: null,
    version: PLUGIN_VERSION,
  };

  await createOrOverwriteFile(state.bridgeFolder, "status.json", `${JSON.stringify(payload, null, 2)}\n`);
  updateStatusText(currentStatus.message);
}

function updateStatusText(activityMessage) {
  setText("bridgeStatus", state.bridgeFolder ? state.bridgePath || "Connected" : "Not connected");
  setText("projectStatus", state.activeProjectName || "No active project");
  setText("heartbeatStatus", new Date().toLocaleTimeString());

  if (activityMessage) {
    setLastActivity(activityMessage);
  }
}

async function refreshPanel() {
  try {
    await writeHeartbeat();
  } catch (error) {
    setLastActivity(error.message || "Unable to write bridge heartbeat.");
  }

  updateStatusText();
}

function executeProjectAction(project, createAction, undoString) {
  if (!project || typeof project.executeTransaction !== "function") {
    throw new Error("Premiere project transactions are unavailable.");
  }

  const execute = () => {
    const transactionResult = project.executeTransaction((compoundAction) => {
      const action = createAction();

      if (!action) {
        throw new Error("Premiere did not create the requested action.");
      }

      const actionAdded = compoundAction.addAction(action);

      if (actionAdded === false) {
        throw new Error("Premiere could not add the action to the transaction.");
      }
    }, undoString);

    if (transactionResult === false) {
      throw new Error(`Premiere transaction failed: ${undoString}`);
    }
  };

  if (typeof project.lockedAccess === "function") {
    project.lockedAccess(execute);
    return;
  }

  execute();
}

async function getProjectItemId(projectItem) {
  try {
    return typeof projectItem.getId === "function" ? projectItem.getId() : null;
  } catch (error) {
    return null;
  }
}

function asFolderItem(projectItem) {
  if (!projectItem) {
    return null;
  }

  if (typeof projectItem.getItems === "function") {
    return projectItem;
  }

  const premiereApp = getPremiereApp();

  if (premiereApp && premiereApp.FolderItem && premiereApp.FolderItem.cast) {
    try {
      const folderItem = premiereApp.FolderItem.cast(projectItem);
      return folderItem && typeof folderItem.getItems === "function" ? folderItem : null;
    } catch (error) {
      return null;
    }
  }

  return null;
}

function asClipProjectItem(projectItem) {
  if (!projectItem) {
    return null;
  }

  if (typeof projectItem.getMediaFilePath === "function") {
    return projectItem;
  }

  const premiereApp = getPremiereApp();

  if (premiereApp && premiereApp.ClipProjectItem && premiereApp.ClipProjectItem.cast) {
    try {
      const clipProjectItem = premiereApp.ClipProjectItem.cast(projectItem);
      return clipProjectItem && typeof clipProjectItem.getMediaFilePath === "function"
        ? clipProjectItem
        : null;
    } catch (error) {
      return null;
    }
  }

  return null;
}

async function getProjectFolderItems(folderItem) {
  if (!folderItem || typeof folderItem.getItems !== "function") {
    return [];
  }

  return folderItem.getItems();
}

async function findProjectBinByName(folderItem, binName) {
  const items = await getProjectFolderItems(folderItem);
  const match = items.find((item) => item && item.name === binName);

  if (!match) {
    return null;
  }

  const folderMatch = asFolderItem(match);

  if (!folderMatch) {
    throw new Error(`Project item "${binName}" already exists but is not a bin.`);
  }

  return folderMatch;
}

async function getOrCreateImportBin(project) {
  if (!project || typeof project.getRootItem !== "function") {
    throw new Error("Premiere getRootItem API is unavailable.");
  }

  const rootItem = await project.getRootItem();
  const existingBin = await findProjectBinByName(rootItem, PROJECT_BIN_NAME);

  if (existingBin) {
    return existingBin;
  }

  if (!rootItem || typeof rootItem.createBinAction !== "function") {
    throw new Error("Premiere cannot create a project bin from the root item.");
  }

  executeProjectAction(project, () => rootItem.createBinAction(PROJECT_BIN_NAME, false), "Create Collie Video Imports bin");

  const refreshedRootItem = await project.getRootItem();
  const createdBin = await findProjectBinByName(refreshedRootItem, PROJECT_BIN_NAME);

  if (!createdBin) {
    throw new Error(`Unable to create or find the "${PROJECT_BIN_NAME}" bin.`);
  }

  return createdBin;
}

async function collectProjectItemIds(folderItem, depth) {
  if (depth < 0) {
    return new Set();
  }

  const ids = new Set();
  const items = await getProjectFolderItems(folderItem);

  for (const item of items) {
    const itemId = await getProjectItemId(item);

    if (itemId) {
      ids.add(itemId);
    }

    const childFolder = asFolderItem(item);

    if (childFolder) {
      const childIds = await collectProjectItemIds(childFolder, depth - 1);
      childIds.forEach((childId) => ids.add(childId));
    }
  }

  return ids;
}

async function getProjectItemMediaPath(projectItem) {
  const clipProjectItem = asClipProjectItem(projectItem);

  if (!clipProjectItem) {
    return null;
  }

  try {
    return await clipProjectItem.getMediaFilePath();
  } catch (error) {
    return null;
  }
}

async function findClipProjectItemByPath(folderItem, absolutePath, ignoredIds, depth) {
  if (depth < 0) {
    return null;
  }

  const targetPath = normalizeComparablePath(absolutePath);
  const items = await getProjectFolderItems(folderItem);
  let fallbackMatch = null;

  for (const item of items) {
    const itemId = await getProjectItemId(item);
    const mediaPath = await getProjectItemMediaPath(item);

    if (mediaPath && normalizeComparablePath(mediaPath) === targetPath) {
      const clipProjectItem = asClipProjectItem(item);

      if (!ignoredIds.has(itemId)) {
        return clipProjectItem;
      }

      fallbackMatch = fallbackMatch || clipProjectItem;
    }

    const childFolder = asFolderItem(item);

    if (childFolder) {
      const childMatch = await findClipProjectItemByPath(childFolder, absolutePath, ignoredIds, depth - 1);

      if (childMatch) {
        return childMatch;
      }
    }
  }

  return fallbackMatch;
}

async function importVideoIntoBin(project, targetBin, video) {
  if (!project || typeof project.importFiles !== "function") {
    throw new Error("Premiere importFiles API is unavailable.");
  }

  const existingIds = await collectProjectItemIds(targetBin, 2);
  const importSucceeded = await project.importFiles([video.absolutePath], true, targetBin, false);

  if (importSucceeded === false) {
    throw new Error(`Premiere could not import ${video.fileName}.`);
  }

  const importedClip = await findClipProjectItemByPath(targetBin, video.absolutePath, existingIds, 2);

  if (!importedClip) {
    throw new Error(`Imported clip could not be resolved in the project bin: ${video.fileName}`);
  }

  return importedClip;
}

function validateRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new Error("Request JSON must be an object.");
  }

  if (request.type !== REQUEST_TYPE_IMPORT_SELECTED_VIDEOS) {
    throw new Error(`Unsupported request type: ${request.type}`);
  }

  if (typeof request.id !== "string" || request.id.trim() === "") {
    throw new Error("Request is missing an id.");
  }

  if (request.status && !Object.values(REQUEST_LIFECYCLE_STATE).includes(request.status)) {
    throw new Error(`Unsupported request status: ${request.status}`);
  }

  if (!Array.isArray(request.videos) || request.videos.length === 0) {
    throw new Error("Request must include selected videos.");
  }

  request.videos.forEach((video, index) => {
    if (!video || typeof video !== "object" || Array.isArray(video)) {
      throw new Error(`videos[${index}] must be an object.`);
    }

    if (!video.fileName || !video.absolutePath) {
      throw new Error(`videos[${index}] is missing fileName or absolutePath.`);
    }

    if (!isAbsoluteFilePath(video.absolutePath)) {
      throw new Error(`videos[${index}].absolutePath must be absolute.`);
    }
  });
}

async function writeFailedRequest(requestFile, request, error, partialResult) {
  const folders = await ensureBridgeSubfolders();
  const failedRequest = Object.assign({}, request || {}, {
    id: request && request.id ? request.id : requestFile.name.replace(/\.json$/, ""),
    status: REQUEST_LIFECYCLE_STATE.failed,
    failedAt: new Date().toISOString(),
    error: {
      message: error && error.message ? error.message : String(error),
    },
  });

  if (partialResult) {
    failedRequest.partialResult = partialResult;
  }

  await createOrOverwriteFile(
    folders[BRIDGE_DIRECTORY_NAMES.failed],
    requestFile.name,
    `${JSON.stringify(failedRequest, null, 2)}\n`
  );
  await deleteEntry(requestFile);
}

async function writeCompletedRequest(requestFile, request, result) {
  const folders = await ensureBridgeSubfolders();
  const completedRequest = Object.assign({}, request, {
    status: REQUEST_LIFECYCLE_STATE.completed,
    completedAt: new Date().toISOString(),
    result,
  });

  await createOrOverwriteFile(
    folders[BRIDGE_DIRECTORY_NAMES.completed],
    requestFile.name,
    `${JSON.stringify(completedRequest, null, 2)}\n`
  );
  await deleteEntry(requestFile);
}

async function processImportRequest(request, partialResult) {
  const project = await getActiveProject();
  const importBin = await getOrCreateImportBin(project);
  const importedItems = partialResult.importedItems;

  for (const [videoIndex, video] of request.videos.entries()) {
    setLastActivity(`Importing ${video.fileName} (${videoIndex + 1}/${request.videos.length}).`);

    const clipProjectItem = await importVideoIntoBin(project, importBin, video);
    const itemId = await getProjectItemId(clipProjectItem);

    importedItems.push({
      videoId: video.id,
      fileName: video.fileName,
      sourcePath: video.absolutePath,
      originalSourcePath: video.originalAbsolutePath || null,
      projectItemId: itemId || null,
      importedAt: new Date().toISOString(),
    });
  }

  return {
    importedCount: importedItems.length,
    importedItems,
  };
}

async function processRequestFile(requestFile) {
  const requestId = requestFile.name.replace(/\.json$/, "");

  if (state.processingRequestIds.has(requestId)) {
    return;
  }

  state.processingRequestIds.add(requestId);
  let request = null;
  let partialResult = null;

  try {
    const rawRequest = await requestFile.read();
    request = JSON.parse(rawRequest);
    validateRequest(request);
    partialResult = {
      importedItems: [],
    };

    const result = await processImportRequest(request, partialResult);

    await writeCompletedRequest(requestFile, request, result);
    setLastActivity(`Request ${requestId} imported ${result.importedCount} file(s).`);
  } catch (error) {
    let parsedRequest = null;

    try {
      parsedRequest = JSON.parse(await requestFile.read());
    } catch (parseError) {
      parsedRequest = { id: requestId, type: REQUEST_TYPE_IMPORT_SELECTED_VIDEOS };
    }

    if (partialResult && Array.isArray(partialResult.importedItems) && partialResult.importedItems.length > 0) {
      partialResult.note = "Some Premiere changes may already have been made before this failure.";
    } else {
      partialResult = null;
    }

    await writeFailedRequest(requestFile, parsedRequest, error, partialResult);
    setLastActivity(`Request ${requestId} failed: ${error.message || error}`);
  } finally {
    state.processingRequestIds.delete(requestId);
  }
}

async function processRequests() {
  if (!state.bridgeFolder) {
    setLastActivity("Select a bridge folder before processing requests.");
    return;
  }

  const projectInfo = await getActiveProjectInfo();
  const currentStatus = getCurrentStatus(projectInfo);

  state.activeProjectName = projectInfo.activeProjectName;
  state.activeProjectPath = projectInfo.activeProjectPath;

  if (currentStatus.status !== BRIDGE_STATUS.ready) {
    setLastActivity(currentStatus.message);
    return;
  }

  const folders = await ensureBridgeSubfolders();
  const requestsFolder = folders[BRIDGE_DIRECTORY_NAMES.requests];
  const entries = await getFolderEntries(requestsFolder);
  const requestFiles = entries
    .filter((entry) => entry.isFile && entry.name.endsWith(".json"))
    .sort((first, second) => first.name.localeCompare(second.name));

  if (requestFiles.length === 0) {
    setLastActivity("No pending Premiere requests.");
    return;
  }

  await processRequestFile(requestFiles[0]);
}

function startTimers() {
  if (!state.heartbeatTimer) {
    state.heartbeatTimer = setInterval(refreshPanel, 5000);
  }

  if (!state.requestTimer) {
    state.requestTimer = setInterval(() => {
      if (!state.bridgeFolder) {
        return;
      }

      processRequests().catch((error) => {
        setLastActivity(error.message || "Unable to process Premiere request.");
      });
    }, 4000);
  }
}

async function initialize() {
  ui.bridgeStatus = document.getElementById("bridgeStatus");
  ui.projectStatus = document.getElementById("projectStatus");
  ui.heartbeatStatus = document.getElementById("heartbeatStatus");
  ui.lastActivity = document.getElementById("lastActivity");

  document.getElementById("selectBridgeFolder").addEventListener("click", () =>
    selectBridgeFolder().catch((error) => {
      setLastActivity(error.message || "Unable to select bridge folder.");
    })
  );
  document.getElementById("processNow").addEventListener("click", () =>
    processRequests().catch((error) => {
      setLastActivity(error.message || "Unable to process requests.");
    })
  );

  await restoreFolders();
  await refreshPanel();
  startTimers();
}

document.addEventListener("DOMContentLoaded", () => {
  initialize().catch((error) => {
    setLastActivity(error.message || "Unable to initialize Collie Video Bridge.");
  });
});
