(function () {
  "use strict";

  const statusNode = document.getElementById("status");
  const listNode = document.getElementById("book-list");
  const refreshButton = document.getElementById("refresh-button");
  const librarySelect = document.getElementById("library-filter");
  const monthSlider = document.getElementById("month-filter");
  const monthValue = document.getElementById("month-filter-value");
  const supportsIntersectionObserver = typeof IntersectionObserver !== "undefined";

  let libraries = [];
  let activeConfig = window.SRU_CONFIG;
  let activeFilterLabel = "";
  let pager = null;
  let observer = null;
  let sentinelNode = null;
  let isLoadingNextPage = false;
  let totalLoaded = 0;

  function setControlsDisabled(disabled) {
    librarySelect.disabled = disabled;
    monthSlider.disabled = disabled;
    refreshButton.disabled = disabled;
  }

  function getMonthLabel(monthCount) {
    return monthCount === 1 ? "Aktueller Monat" : `Letzte ${monthCount} Monate`;
  }

  function updateMonthSliderLabel() {
    const monthCount = Number(monthSlider.value) || 1;
    const label = getMonthLabel(monthCount);
    monthValue.textContent = label;
    monthSlider.setAttribute("aria-valuetext", label);
  }

  function getSelectedLibrary() {
    return libraries.find((library) => library.scope === librarySelect.value) || null;
  }

  function createActiveConfig() {
    const selectedLibrary = getSelectedLibrary();
    const selectedLibraries = selectedLibrary ? [selectedLibrary] : libraries;

    return {
      ...window.SRU_CONFIG,
      searchScope: selectedLibrary ? selectedLibrary.scope : "",
      tab: selectedLibrary ? selectedLibrary.scope : "",
      localField990Prefix: "",
      localField990Prefixes: selectedLibrary ? selectedLibraries.map(
        (library) => `NEL${library["field-filter-short"] || library["library-short"]}`
      ) : [],
      localField990WildcardPrefix: selectedLibrary ? "" : "NEL*",
      recentMonthCount: Number(monthSlider.value) || 1
    };
  }

  function createFilterLabel() {
    const selectedLibrary = getSelectedLibrary();
    const libraryName = selectedLibrary
      ? selectedLibrary["library-name"]
      : "Alle Bibliotheken (ABN)";
    const monthCount = Number(monthSlider.value) || 1;
    const monthLabel = monthCount === 1 ? "aktueller Monat" : `letzte ${monthCount} Monate`;

    return `${libraryName}, ${monthLabel}`;
  }

  function clearObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function removeSentinel() {
    if (sentinelNode) {
      sentinelNode.remove();
      sentinelNode = null;
    }
  }

  function setSentinel(message) {
    removeSentinel();

    const sentinel = document.createElement("li");
    sentinel.className = "book-item book-sentinel";
    sentinel.textContent = message;
    listNode.appendChild(sentinel);
    sentinelNode = sentinel;

    return sentinel;
  }

  function setLoadingStatus(pageNumber, loaded, total) {
    const totalHint = total > 0 ? ` von ${total}` : "";
    statusNode.textContent =
      `Neueingänge (${activeFilterLabel}): Seite ${pageNumber}, ${loaded}${totalHint} geladen.`;
  }

  async function loadNextPage() {
    if (!pager || isLoadingNextPage) {
      return;
    }

    isLoadingNextPage = true;
    setControlsDisabled(true);
    removeSentinel();

    try {
      const page = await pager.loadNextPage();

      if (!page.records.length && page.totalLoaded === 0) {
        listNode.innerHTML = '<li class="book-item">Keine neuen Zugänge gefunden.</li>';
        statusNode.textContent = "Keine neuen Zugänge gefunden.";
        clearObserver();
        return;
      }

      window.LibrarySruWidget.appendBooks(listNode, page.records, activeConfig, totalLoaded);
      totalLoaded = page.totalLoaded;
      setLoadingStatus(page.pageNumber, page.totalLoaded, page.totalAvailable);

      if (page.hasMore) {
        if (supportsIntersectionObserver) {
          const sentinel = setSentinel("Nach unten scrollen, um weitere Datensätze zu laden...");
          observer.observe(sentinel);
        } else {
          statusNode.textContent = `${statusNode.textContent} Browser unterstützt kein automatisches Nachladen.`;
        }
      } else {
        statusNode.textContent =
          `${page.totalLoaded} Neueingänge geladen (${activeFilterLabel}).`;
        clearObserver();
      }
    } catch (error) {
      const details = error && error.message ? ` Details: ${error.message}` : "";
      statusNode.textContent =
        `Datensätze konnten nicht nachgeladen werden. Bitte erneut laden.${details}`;
      clearObserver();
      removeSentinel();
      console.error(error);
    } finally {
      isLoadingNextPage = false;
      setControlsDisabled(false);
    }
  }

  async function load() {
    activeConfig = createActiveConfig();
    activeFilterLabel = createFilterLabel();
    statusNode.textContent = `Lade Neueingänge (${activeFilterLabel})...`;
    setControlsDisabled(true);
    clearObserver();
    removeSentinel();
    pager = null;
    totalLoaded = 0;
    listNode.innerHTML = "";

    try {
      pager = window.LibrarySruWidget.createPagedFetcher(activeConfig);

      if (supportsIntersectionObserver) {
        observer = new IntersectionObserver(
          (entries) => {
            const isVisible = entries.some((entry) => entry.isIntersecting);
            if (isVisible) {
              loadNextPage();
            }
          },
          { root: null, rootMargin: "280px 0px", threshold: 0 }
        );
      }

      await loadNextPage();
    } catch (error) {
      listNode.innerHTML = "";
      const details = error && error.message ? ` Details: ${error.message}` : "";
      statusNode.textContent =
        `Datensätze konnten nicht geladen werden. Bitte SRU-Endpunkt und CORS prüfen.${details}`;
      console.error(error);
    } finally {
      setControlsDisabled(false);
    }
  }

  function loadLibraries() {
    const dataNode = document.getElementById("library-data");
    const data = JSON.parse(dataNode?.textContent || "[]");
    libraries = data.filter(
      (library) => library.scope && library["library-short"] && library["library-name"]
    );

    if (libraries.length === 0) {
      throw new Error("Die Bibliotheksliste enthält keine gültigen Einträge.");
    }

    libraries.forEach((library) => {
      const option = document.createElement("option");
      option.value = library.scope;
      option.textContent = library["library-name"];
      librarySelect.appendChild(option);
    });

    const configuredScope = window.SRU_CONFIG.searchScope || "";
    librarySelect.value = libraries.some((library) => library.scope === configuredScope)
      ? configuredScope
      : "";

    const configuredMonthCount = Math.min(
      12,
      Math.max(1, Number(window.SRU_CONFIG.recentMonthCount) || 1)
    );
    monthSlider.value = String(configuredMonthCount);
    updateMonthSliderLabel();
  }

  refreshButton.addEventListener("click", load);
  librarySelect.addEventListener("change", load);
  monthSlider.addEventListener("input", updateMonthSliderLabel);
  monthSlider.addEventListener("change", load);

  try {
    loadLibraries();
    load();
  } catch (error) {
    statusNode.textContent = error.message;
    listNode.innerHTML = "";
    console.error(error);
  }
})();