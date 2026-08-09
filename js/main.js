(function () {
  "use strict";

  const statusNode = document.getElementById("status");
  const listNode = document.getElementById("book-list");
  const refreshButton = document.getElementById("refresh-button");
  const activeScope = window.SRU_CONFIG.searchScope || "network";
  const isRecentAccessionMode = Boolean(window.SRU_CONFIG.localField990Prefix);
  const supportsIntersectionObserver = typeof IntersectionObserver !== "undefined";

  let pager = null;
  let observer = null;
  let sentinelNode = null;
  let isLoadingNextPage = false;
  let totalLoaded = 0;

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
    statusNode.textContent = isRecentAccessionMode
      ? `Zugänge (${activeScope}): Seite ${pageNumber}, ${loaded}${totalHint} geladen.`
      : `Datensätze (${activeScope}): Seite ${pageNumber}, ${loaded}${totalHint} geladen.`;
  }

  async function loadNextPage() {
    if (!pager || isLoadingNextPage) {
      return;
    }

    isLoadingNextPage = true;
    removeSentinel();

    try {
      const page = await pager.loadNextPage();

      if (!page.records.length && page.totalLoaded === 0) {
        listNode.innerHTML = '<li class="book-item">Keine neuen Zugänge gefunden.</li>';
        statusNode.textContent = "Keine neuen Zugänge gefunden.";
        clearObserver();
        return;
      }

      window.LibrarySruWidget.appendBooks(listNode, page.records, window.SRU_CONFIG, totalLoaded);
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
        statusNode.textContent = isRecentAccessionMode
          ? `${page.totalLoaded} Zugänge aus aktuellem und letztem Monat geladen (${activeScope}).`
          : `${page.totalLoaded} Datensätze geladen (${activeScope}).`;
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
    }
  }

  async function load() {
    statusNode.textContent = isRecentAccessionMode
      ? `Lade Zugänge aus aktuellem und letztem Monat (${activeScope})...`
      : `Lade aktuelle Katalogdaten (${activeScope})...`;
    refreshButton.disabled = true;
    clearObserver();
    removeSentinel();
    pager = null;
    totalLoaded = 0;
    listNode.innerHTML = "";

    try {
      pager = window.LibrarySruWidget.createPagedFetcher(window.SRU_CONFIG);

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
      refreshButton.disabled = false;
    }
  }

  refreshButton.addEventListener("click", load);
  load();
})();