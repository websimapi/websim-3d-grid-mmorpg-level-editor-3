// ui.js – Sets up DOM event listeners, draggable sections, and toolbar interactions.
import { state } from "./state.js";
import { updateBlocksList } from "./blocks.js";
import { exportLevel, importLevel, uploadModel } from "./io.js";

export function initUI() {
  state.actionHistoryUI = document.getElementById("action-history");

  document.querySelectorAll(".tool-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.id !== "undo-action" && button.id !== "redo-action") {
        document.querySelectorAll(".tool-button").forEach((b) => b.classList.remove("active"));
        button.classList.add("active");
        if (button.id !== "place-block") {
          state.selectedModel = null;
          if (state.modelPreview) {
            state.scene.remove(state.modelPreview);
            state.modelPreview = null;
          }
        }
      }
    });
  });

  document.getElementById("export-json").addEventListener("click", exportLevel);

  document.getElementById("import-json").addEventListener("click", () => {
    document.getElementById("import-input").click();
  });

  document.getElementById("import-input").addEventListener("change", (event) => {
    if (event.target.files.length > 0) {
      importLevel(event.target.files[0]);
      event.target.value = "";
    }
  });

  document.getElementById("load-model").addEventListener("click", () => {
    document.getElementById("model-input").click();
  });
  document.getElementById("model-input").addEventListener("change", (event) => {
    if (event.target.files.length > 0) {
      uploadModel(event.target.files[0]);
      event.target.value = "";
    }
  });

  document.getElementById("toggle-menu").addEventListener("click", () => {
    const toolbar = document.getElementById("toolbar");
    const toggleButton = document.getElementById("toggle-menu");
    const arrow = toggleButton.querySelector(".menu-arrow");
    toolbar.classList.toggle("hidden");
    toggleButton.classList.toggle("menu-hidden");
    arrow.classList.toggle("collapsed");
  });

  initDraggableSections();

  window.addEventListener("keydown", (event) => {
    if ((event.key === "Delete" || event.key === "Backspace") && state.selectedPlacedAsset) {
      // Call deletePlacedAsset from assets.js if needed.
    }
    if (event.key === "`") {
      const debugConsole = document.getElementById("debug-console");
      debugConsole.classList.toggle("visible");
    }
    if (event.ctrlKey || event.metaKey) {
      if (event.key === "z") {
        if (event.shiftKey) {
          // redo action from history.js
        } else {
          // undo action from history.js
        }
        event.preventDefault();
      }
    }
  });

  document.getElementById("block-color").addEventListener("input", (e) => {
    if (state.selectedBlock) {
      if (state.initialBlockColor === null) {
        state.initialBlockColor = state.selectedBlock.material.color.getHexString();
      }
      state.selectedBlock.material.color.set(e.target.value);
    }
  });

  document.getElementById("block-color").addEventListener("change", (e) => {
    if (state.selectedBlock && state.initialBlockColor !== null) {
      state.debugInfo.lastAction = `Changed block color at ${state.selectedBlock.userData.key}`;
      state.initialBlockColor = null;
    }
  });
}

function initDraggableSections() {
  document.querySelectorAll(".toolbar-section").forEach((section) => {
    if (section && section.parentNode) {
      section.replaceWith(...section.childNodes);
    }
  });
  document.querySelectorAll(".section-header").forEach((header) => {
    const content = header.nextElementSibling;
    if (!content || !header.parentNode) return;
    const section = document.createElement("div");
    section.className = "toolbar-section";
    if (!header.parentNode.classList.contains("toolbar-section")) {
      header.parentNode.insertBefore(section, header);
      section.appendChild(header);
      section.appendChild(content);
    }
    let isDragging = false;
    let startY = 0;
    let initialRect = null;
    let placeholder = null;
    header.addEventListener("mousedown", (e) => {
      if (e.target.classList.contains("section-toggle")) return;
      e.preventDefault();
      isDragging = true;
      startY = e.clientY;
      initialRect = section.getBoundingClientRect();
      section.classList.add("dragging");
      section.style.width = `${initialRect.width}px`;
      section.style.left = `${initialRect.left}px`;
      section.style.top = `${initialRect.top}px`;
      placeholder = document.createElement("div");
      placeholder.style.height = `${initialRect.height}px`;
      placeholder.style.margin = "5px 0";
      placeholder.style.background = "rgba(100,100,100,0.2)";
      placeholder.style.borderRadius = "4px";
      if (section.parentNode) {
        section.parentNode.insertBefore(placeholder, section);
      }
      document.body.style.cursor = "grabbing";
    });
    document.addEventListener("mousemove", (e) => {
      if (!isDragging || !section.parentNode) return;
      const deltaY = e.clientY - startY;
      section.style.transform = `translateY(${deltaY}px)`;
      const draggingRect = section.getBoundingClientRect();
      const draggingCenter = draggingRect.top + draggingRect.height / 2;
      document.querySelectorAll(".drop-target").forEach((s) => s.classList.remove("drop-target"));
      const otherSections = Array.from(document.querySelectorAll(".toolbar-section")).filter((s) => s !== section);
      let dropTarget = null;
      for (const otherSection of otherSections) {
        const rect = otherSection.getBoundingClientRect();
        if (draggingCenter > rect.top && draggingCenter < rect.bottom) {
          dropTarget = otherSection;
          break;
        }
      }
      if (dropTarget && placeholder && placeholder.parentNode) {
        dropTarget.classList.add("drop-target");
        const rect = dropTarget.getBoundingClientRect();
        if (draggingCenter < rect.top + rect.height / 2) {
          dropTarget.parentNode.insertBefore(placeholder, dropTarget);
        } else {
          dropTarget.parentNode.insertBefore(placeholder, dropTarget.nextSibling);
        }
      }
    });
    document.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      section.classList.remove("dragging");
      section.style.transform = "";
      section.style.position = "";
      section.style.width = "";
      section.style.left = "";
      section.style.top = "";
      if (placeholder && placeholder.parentNode && section.parentNode) {
        placeholder.parentNode.insertBefore(section, placeholder);
        placeholder.remove();
      }
      document.querySelectorAll(".drop-target").forEach((s) => s.classList.remove("drop-target"));
      document.body.style.cursor = "";
    });
  });
}