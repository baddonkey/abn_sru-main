(function () {
  "use strict";

  function buildRecentMonthCodes(prefixes, monthCount) {
    const codes = [];
    const today = new Date();
    const totalMonths = Math.max(monthCount || 0, 0);

    for (let offset = 0; offset < totalMonths; offset += 1) {
      const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
      const year = String(date.getFullYear()).slice(-2);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      prefixes.forEach((prefix) => {
        codes.push(`${prefix}${year}${month}`);
      });
    }

    return codes;
  }

  function resolveQuery(config) {
    if (config.localField990WildcardPrefix) {
      const codes = buildRecentMonthCodes(
        [config.localField990WildcardPrefix],
        config.recentMonthCount || 1
      );

      return codes
        .map((code) => `alma.local_field_990 all "${code}"`)
        .join(" or ");
    }

    const prefixes = Array.isArray(config.localField990Prefixes)
      ? config.localField990Prefixes.filter(Boolean)
      : [config.localField990Prefix].filter(Boolean);

    if (prefixes.length > 0) {
      const codes = buildRecentMonthCodes(
        prefixes,
        config.recentMonthCount || 2
      );

      return codes
        .map((code) => `alma.local_field_990=${code}`)
        .join(" or ");
    }

    return config.query;
  }

  function readFirstByLocalName(parent, localName) {
    const node = Array.from(parent.getElementsByTagName("*")).find(
      (candidate) => candidate.localName === localName
    );
    return node ? node.textContent.trim() : "";
  }

  function readMarcControlField(recordNode, tag) {
    const field = Array.from(recordNode.getElementsByTagName("*")).find(
      (candidate) => candidate.localName === "controlfield" && candidate.getAttribute("tag") === tag
    );

    return field ? field.textContent.trim() : "";
  }

  function readMarcSubfields(recordNode, tag, code) {
    return Array.from(recordNode.getElementsByTagName("*")).flatMap((candidate) => {
      if (candidate.localName !== "datafield" || candidate.getAttribute("tag") !== tag) {
        return [];
      }

      return Array.from(candidate.children)
        .filter(
          (subfield) => subfield.localName === "subfield" && subfield.getAttribute("code") === code
        )
        .map((subfield) => subfield.textContent.trim())
        .filter(Boolean);
    });
  }

  function readMarcSubfieldValue(fieldNode, code) {
    const subfield = Array.from(fieldNode.children).find(
      (candidate) => candidate.localName === "subfield" && candidate.getAttribute("code") === code
    );

    return subfield ? subfield.textContent.trim() : "";
  }

  function parseHoldings(recordNode) {
    const avaFields = Array.from(recordNode.getElementsByTagName("*")).filter(
      (candidate) => candidate.localName === "datafield" && candidate.getAttribute("tag") === "AVA"
    );

    const seen = new Set();

    return avaFields
      .map((fieldNode) => {
        const library = cleanCatalogText(
          readMarcSubfieldValue(fieldNode, "q") || readMarcSubfieldValue(fieldNode, "b")
        );
        const location = cleanCatalogText(
          readMarcSubfieldValue(fieldNode, "c") || readMarcSubfieldValue(fieldNode, "d")
        );
        const locationLabel = [library, location].filter(Boolean).join(" - ") || "Unbekannt";

        return {
          library,
          location,
          locationLabel
        };
      })
      .filter((holding) => {
        if (seen.has(holding.locationLabel)) {
          return false;
        }

        seen.add(holding.locationLabel);
        return true;
      });
  }

  function readMarcJoinedSubfields(recordNode, tag, codes) {
    const values = [];

    Array.from(recordNode.getElementsByTagName("*")).forEach((candidate) => {
      if (candidate.localName !== "datafield" || candidate.getAttribute("tag") !== tag) {
        return;
      }

      codes.forEach((code) => {
        Array.from(candidate.children)
          .filter(
            (subfield) => subfield.localName === "subfield" && subfield.getAttribute("code") === code
          )
          .forEach((subfield) => {
            const value = subfield.textContent.trim();
            if (value) {
              values.push(value);
            }
          });
      });
    });

    return values.join(" ").trim();
  }

  function normalizeIsbn(value) {
    const normalized = value.replace(/[^0-9Xx]/g, "").toUpperCase();
    return normalized.length >= 10 ? normalized : "";
  }

  function cleanCatalogText(value) {
    return (value || "")
      .replace(/<</g, "")
      .replace(/>>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanCreatorText(value) {
    return cleanCatalogText(value)
      .replace(/\b\d{4}-\d{0,4}\b/g, "")
      .replace(/\([^)]*\)$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildPublicationLine(place, publisher) {
    const cleanPlace = cleanCatalogText(place).replace(/[\[\]]/g, "").trim();
    const cleanPublisher = cleanCatalogText(publisher).replace(/[\[\]]/g, "").trim();

    if (cleanPlace && cleanPublisher) {
      return `${cleanPlace}: ${cleanPublisher}`;
    }

    return cleanPlace || cleanPublisher;
  }

  function normalizeDisplayDate(value) {
    const cleaned = cleanCatalogText(value);
    const years = Array.from(cleaned.matchAll(/(?:\[)?(\d{4})(?:\])?/g)).map((match) => match[1]);
    const uniqueYears = Array.from(new Set(years));

    if (uniqueYears.length > 0) {
      return uniqueYears[0];
    }

    return cleaned.replace(/[\[\]]/g, "").replace(/©/g, "").trim();
  }

  function parseMarcRecord(recordNode) {
    const title = cleanCatalogText(readMarcJoinedSubfields(recordNode, "245", ["a", "b"])) || "Ohne Titel";
    const creator =
      cleanCreatorText(readMarcJoinedSubfields(recordNode, "100", ["a", "d"])) ||
      cleanCreatorText(readMarcJoinedSubfields(recordNode, "110", ["a"])) ||
      cleanCreatorText(readMarcJoinedSubfields(recordNode, "111", ["a"])) ||
      cleanCreatorText(readMarcJoinedSubfields(recordNode, "700", ["a", "d"])) ||
      "Unbekannt";
    const publicationLine =
      buildPublicationLine(
        readMarcJoinedSubfields(recordNode, "264", ["a"]),
        readMarcJoinedSubfields(recordNode, "264", ["b"])
      ) ||
      buildPublicationLine(
        readMarcJoinedSubfields(recordNode, "260", ["a"]),
        readMarcJoinedSubfields(recordNode, "260", ["b"])
      );
    const dateSource =
      readMarcJoinedSubfields(recordNode, "264", ["c"]) ||
      readMarcJoinedSubfields(recordNode, "260", ["c"]);
    const date = normalizeDisplayDate(dateSource) || "Ohne Erscheinungsjahr";
    const identifier =
      readMarcSubfields(recordNode, "856", "u")[0] ||
      readMarcSubfields(recordNode, "024", "a")[0] ||
      "";
    const summary =
      readMarcJoinedSubfields(recordNode, "520", ["a"]) ||
      readMarcJoinedSubfields(recordNode, "505", ["a"]) ||
      readMarcJoinedSubfields(recordNode, "500", ["a"]);
    const isbn = normalizeIsbn(readMarcSubfields(recordNode, "020", "a")[0] || "");
    const accessionCode = readMarcSubfields(recordNode, "990", "a")[0] || "";
    const modifiedAt = readMarcControlField(recordNode, "005");
    const holdings = parseHoldings(recordNode);

    return {
      title,
      creator,
      publicationLine,
      date,
      identifier,
      summary,
      isbn,
      holdings,
      accessionCode,
      modifiedAt
    };
  }

  function parseDcRecord(recordNode) {
    const title = cleanCatalogText(readFirstByLocalName(recordNode, "title")) || "Ohne Titel";
    const creator = cleanCreatorText(readFirstByLocalName(recordNode, "creator")) || "Unbekannt";
    const date = normalizeDisplayDate(readFirstByLocalName(recordNode, "date")) || "Ohne Erscheinungsjahr";
    const identifier = readFirstByLocalName(recordNode, "identifier");
    const summary = readFirstByLocalName(recordNode, "description");

    return {
      title,
      creator,
      publicationLine: "",
      date,
      identifier,
      summary,
      isbn: "",
      holdings: [],
      accessionCode: "",
      modifiedAt: ""
    };
  }

  function compareBooksDescending(left, right) {
    const leftMonth = left.accessionCode.match(/(\d{2})(0[1-9]|1[0-2])$/)?.[0] || "";
    const rightMonth = right.accessionCode.match(/(\d{2})(0[1-9]|1[0-2])$/)?.[0] || "";
    const accessionCompare = rightMonth.localeCompare(leftMonth);
    if (accessionCompare !== 0) {
      return accessionCompare;
    }

    const modifiedCompare = right.modifiedAt.localeCompare(left.modifiedAt);
    if (modifiedCompare !== 0) {
      return modifiedCompare;
    }

    return left.title.localeCompare(right.title);
  }

  function getDebugInfo(config) {
    return {
      query: resolveQuery(config),
      sortMode: config.localField990WildcardPrefix ||
        config.localField990Prefix ||
        config.localField990Prefixes?.length
        ? "Client-Sortierung: 990$a absteigend, 005 absteigend, Titel aufsteigend"
        : "Server-Reihenfolge",
      fetchLimit: config.maximumRecords,
      sruPageSize: config.sruPageSize || config.maximumRecords,
      displayLimit: config.displayLimit || config.maximumRecords,
      recordSchema: config.recordSchema
    };
  }

  function buildCatalogRecordUrl(book, config) {
    if (!book.recordIdentifier || !config.vid) {
      return "";
    }

    const params = new URLSearchParams({
      docid: `alma${book.recordIdentifier}`,
      context: "L",
      vid: config.vid,
      lang: "de"
    });

    if (config.searchScope) {
      params.set("search_scope", config.searchScope);
    }

    if (config.tab) {
      params.set("tab", config.tab);
    }

    return `https://abn.swisscovery.ch/discovery/fulldisplay?${params.toString()}`;
  }

  function buildThumbnailUrl(book) {
    if (!book.isbn) {
      return "";
    }

    return `https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg?default=false`;
  }

  function createSummaryElements(summaryText) {
    const text = (summaryText || "").trim();
    if (!text) {
      return { summary: null, toggleButton: null };
    }

    const summary = document.createElement("p");
    summary.className = "book-summary";
    const previewLimit = 280;

    if (text.length <= previewLimit) {
      summary.textContent = text;
      return { summary, toggleButton: null };
    }

    const previewText = `${text.slice(0, previewLimit).trimEnd()} ...`;
    summary.textContent = previewText;
    summary.dataset.collapsedText = previewText;
    summary.dataset.expandedText = text;
    summary.dataset.expanded = "false";

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "summary-toggle";
    toggleButton.textContent = "Mehr anzeigen";
    toggleButton.setAttribute("aria-expanded", "false");
    toggleButton.addEventListener("click", () => {
      const isExpanded = summary.dataset.expanded === "true";
      summary.dataset.expanded = isExpanded ? "false" : "true";
      summary.textContent = isExpanded
        ? summary.dataset.collapsedText
        : summary.dataset.expandedText;
      toggleButton.textContent = isExpanded ? "Mehr anzeigen" : "Weniger anzeigen";
      toggleButton.setAttribute("aria-expanded", isExpanded ? "false" : "true");
    });

    return { summary, toggleButton };
  }

  function encodeSruParams(config, startRecordOverride) {
    const params = new URLSearchParams({
      operation: "searchRetrieve",
      version: config.version,
      query: resolveQuery(config),
      recordSchema: config.recordSchema,
      maximumRecords: String(config.requestMaximumRecords || config.sruPageSize || config.maximumRecords),
      startRecord: String(startRecordOverride || config.startRecord)
    });

    if (config.vid) {
      params.set("vid", config.vid);
    }

    if (config.searchScope) {
      params.set("search_scope", config.searchScope);
      params.set("scope", config.searchScope);
    }

    if (config.tab) {
      params.set("tab", config.tab);
    }

    if (config.sortKeys) {
      params.set("sortKeys", config.sortKeys);
    }

    return params.toString();
  }

  function parseSruResponse(xmlText) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "application/xml");
    const parseError = xml.querySelector("parsererror");
    if (parseError) {
      throw new Error("Invalid XML response from SRU service.");
    }

    const diagnostics = Array.from(xml.getElementsByTagName("*")).filter(
      (candidate) => candidate.localName === "diagnostic"
    );

    if (diagnostics.length > 0) {
      const diagnosticMessages = diagnostics
        .map((diagnostic) => {
          const uri = readFirstByLocalName(diagnostic, "uri");
          const details =
            readFirstByLocalName(diagnostic, "details") ||
            readFirstByLocalName(diagnostic, "message") ||
            "Unbekannte SRU-Diagnose";

          return uri ? `${details} (${uri})` : details;
        })
        .filter(Boolean);

      throw new Error(
        `SRU-Diagnose: ${diagnosticMessages.join("; ") || "Unbekannter Fehler"}`
      );
    }

    const responseRecordNodes = Array.from(xml.getElementsByTagName("*")).filter(
      (candidate) => candidate.localName === "record" && candidate.parentElement?.localName === "records"
    );

    const records = responseRecordNodes.map((recordNode) => {
      const recordIdentifier = readFirstByLocalName(recordNode, "recordIdentifier");
      const payloadNode = Array.from(recordNode.getElementsByTagName("*")).find(
        (candidate) => candidate.parentElement?.localName === "recordData"
      );

      if (!payloadNode) {
        return {
          ...parseDcRecord(recordNode),
          recordIdentifier
        };
      }

      if (payloadNode.localName === "record") {
        return {
          ...parseMarcRecord(payloadNode),
          recordIdentifier
        };
      }

      return {
        ...parseDcRecord(payloadNode),
        recordIdentifier
      };
    });

    const numberOfRecords = Number(readFirstByLocalName(xml, "numberOfRecords") || "0");
    const nextRecordPosition = Number(readFirstByLocalName(xml, "nextRecordPosition") || "0");

    return {
      records,
      numberOfRecords,
      nextRecordPosition
    };
  }

  async function fetchSruPage(config, startRecord) {
    const url = `${config.endpoint}?${encodeSruParams(config, startRecord)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`SRU request failed with status ${response.status}`);
      }

      const xmlText = await response.text();
      return parseSruResponse(xmlText);
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(`SRU request timeout after ${config.timeoutMs} ms (startRecord=${startRecord}).`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchLatestBooks(config) {
    const targetCount = Math.max(config.maximumRecords, config.displayLimit || 0);
    const allRecords = [];
    let startRecord = config.startRecord;
    let nextRecordPosition = startRecord;
    let numberOfRecords = 0;

    while (startRecord && allRecords.length < targetCount) {
      const page = await fetchSruPage(config, startRecord);
      allRecords.push(...page.records);
      numberOfRecords = page.numberOfRecords;
      nextRecordPosition = page.nextRecordPosition;

      if (!nextRecordPosition || nextRecordPosition <= startRecord || allRecords.length >= numberOfRecords) {
        break;
      }

      startRecord = nextRecordPosition;
    }

    return allRecords
      .sort(compareBooksDescending)
      .slice(0, config.displayLimit || config.maximumRecords);
  }

  function createPagedFetcher(config) {
    const configuredLimit = config.displayLimit || config.maximumRecords;
    const totalLimit = configuredLimit > 0 ? configuredLimit : Number.POSITIVE_INFINITY;
    const pageSize = Math.max(1, config.sruPageSize || config.maximumRecords || 50);

    let nextStartRecord = config.startRecord || 1;
    let loadedCount = 0;
    let pageNumber = 0;
    let totalAvailable = 0;
    let exhausted = false;

    async function loadNextPage() {
      if (exhausted || !nextStartRecord) {
        return {
          records: [],
          pageNumber,
          totalLoaded: loadedCount,
          totalAvailable,
          hasMore: false,
          nextRecordPosition: 0
        };
      }

      const remaining = Number.isFinite(totalLimit)
        ? Math.max(totalLimit - loadedCount, 0)
        : pageSize;
      const requestMaximumRecords = Math.max(1, Math.min(pageSize, remaining || pageSize));
      const page = await fetchSruPage({ ...config, requestMaximumRecords }, nextStartRecord);
      pageNumber += 1;

      const records = page.records || [];
      loadedCount += records.length;
      totalAvailable = page.numberOfRecords;

      const hasServerNext = Boolean(
        page.nextRecordPosition && page.nextRecordPosition > nextStartRecord
      );
      const reachedClientLimit = Number.isFinite(totalLimit) && loadedCount >= totalLimit;
      const reachedServerTotal = totalAvailable > 0 && loadedCount >= totalAvailable;

      const hasMore = hasServerNext && !reachedClientLimit && !reachedServerTotal;
      nextStartRecord = hasMore ? page.nextRecordPosition : 0;
      exhausted = !hasMore;

      return {
        records,
        pageNumber,
        totalLoaded: loadedCount,
        totalAvailable,
        hasMore,
        nextRecordPosition: nextStartRecord
      };
    }

    function hasMore() {
      return !exhausted;
    }

    return {
      loadNextPage,
      hasMore
    };
  }

  async function fetchLatestBooksProgressively(config, onPage) {
    const targetCount = Math.max(config.maximumRecords, config.displayLimit || 0);
    const allRecords = [];
    let startRecord = config.startRecord;
    let nextRecordPosition = startRecord;
    let numberOfRecords = 0;
    let pageNumber = 0;

    while (startRecord && allRecords.length < targetCount) {
      const page = await fetchSruPage(config, startRecord);
      pageNumber += 1;
      allRecords.push(...page.records);
      numberOfRecords = page.numberOfRecords;
      nextRecordPosition = page.nextRecordPosition;

      if (typeof onPage === "function") {
        onPage({
          pageRecords: page.records,
          pageNumber,
          totalLoaded: allRecords.length,
          numberOfRecords,
          nextRecordPosition
        });
      }

      if (!nextRecordPosition || nextRecordPosition <= startRecord || allRecords.length >= numberOfRecords) {
        break;
      }

      startRecord = nextRecordPosition;
    }

    return allRecords
      .sort(compareBooksDescending)
      .slice(0, config.displayLimit || config.maximumRecords);
  }

  function createBookListItem(book, index, config) {
    const li = document.createElement("li");
    li.className = "book-item";
    li.style.animationDelay = `${Math.min(index * 70, 420)}ms`;

    const cardBody = document.createElement("div");
    cardBody.className = "book-card-body";

    const content = document.createElement("div");
    content.className = "book-content";

    const thumbnailUrl = config?.showThumbnails ? buildThumbnailUrl(book) : "";
    if (thumbnailUrl) {
      const thumbnail = document.createElement("img");
      thumbnail.className = "book-thumbnail";
      thumbnail.src = thumbnailUrl;
      thumbnail.alt = `Cover für ${book.title}`;
      thumbnail.loading = "lazy";
      thumbnail.referrerPolicy = "no-referrer";
      thumbnail.addEventListener("error", () => {
        thumbnail.remove();
      });
      cardBody.appendChild(thumbnail);
    }

    const title = document.createElement("h3");
    title.className = "book-title";

    const catalogUrl = buildCatalogRecordUrl(book, config || {});
    if (catalogUrl) {
      const titleLink = document.createElement("a");
      titleLink.className = "book-title-link";
      titleLink.href = catalogUrl;
      titleLink.target = "_blank";
      titleLink.rel = "noopener noreferrer";
      titleLink.textContent = book.title;
      title.appendChild(titleLink);
    } else {
      title.textContent = book.title;
    }

    const meta = document.createElement("p");
    meta.className = "book-meta";
    meta.textContent = book.creator;

    const publication = document.createElement("p");
    publication.className = "book-publication";
    publication.textContent = [book.publicationLine, book.date].filter(Boolean).join(" | ");

    const availability = document.createElement("p");
    availability.className = "book-availability";
    const uniqueLibraries = Array.from(
      new Set(
        (Array.isArray(book.holdings) ? book.holdings : [])
          .map((holding) => (holding && holding.library ? cleanCatalogText(holding.library) : ""))
          .filter(Boolean)
      )
    );
    availability.textContent = uniqueLibraries.length
      ? `Verfügbar in: ${uniqueLibraries.join(", ")}`
      : "Verfügbar in: Keine Bibliotheksangabe";

    const { summary, toggleButton } = createSummaryElements(book.summary);

    content.appendChild(title);
    content.appendChild(meta);
    if (publication.textContent) {
      content.appendChild(publication);
    }
    content.appendChild(availability);
    if (summary) {
      content.appendChild(summary);
    }
    if (toggleButton) {
      content.appendChild(toggleButton);
    }

    cardBody.appendChild(content);
    li.appendChild(cardBody);

    return li;
  }

  function appendBooks(container, books, config, startIndex) {
    books.forEach((book, offset) => {
      container.appendChild(createBookListItem(book, (startIndex || 0) + offset, config));
    });
  }

  function renderBooks(container, books, config) {
    container.innerHTML = "";

    if (!books.length) {
      container.innerHTML = '<li class="book-item">Keine neuen Zugänge gefunden.</li>';
      return;
    }

    appendBooks(container, books, config, 0);
  }

  window.LibrarySruWidget = {
    fetchLatestBooks,
    createPagedFetcher,
    fetchLatestBooksProgressively,
    appendBooks,
    renderBooks,
    getDebugInfo
  };
})();