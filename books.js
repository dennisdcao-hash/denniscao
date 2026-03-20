document.addEventListener("DOMContentLoaded", () => {
  const CURRENT_YEAR = new Date().getFullYear();

  function renderBooks(books, container, label) {
    if (!books.length) return;
    const el = document.getElementById(container);
    if (label) {
      const heading = document.createElement("h3");
      heading.className = "shelf-label";
      heading.textContent = label;
      el.appendChild(heading);
    }

    const grid = document.createElement("div");
    grid.className = "book-grid";
    books.forEach((book) => {
      const a = document.createElement("a");
      a.href = book.link;
      a.target = "_blank";
      a.rel = "noopener";
      a.className = "book";
      a.title = `${book.title} by ${book.author}`;

      if (book.cover) {
        const img = document.createElement("img");
        img.src = book.cover;
        img.alt = book.title;
        img.loading = "lazy";
        a.appendChild(img);
      }

      const info = document.createElement("span");
      info.className = "book-title";
      info.textContent = book.title;
      a.appendChild(info);

      if (book.pages) {
        const pages = document.createElement("span");
        pages.className = "book-pages";
        pages.textContent = `${book.pages} pp`;
        a.appendChild(pages);
      }

      grid.appendChild(a);
    });
    el.appendChild(grid);
  }

  function renderYearStats(books) {
    const thisYear = books.filter((b) => {
      if (!b.readAt) return false;
      return new Date(b.readAt).getFullYear() === CURRENT_YEAR;
    });
    if (!thisYear.length) return;

    const totalPages = thisYear.reduce((sum, b) => sum + b.pages, 0);
    const el = document.getElementById("reading-stats");
    el.innerHTML =
      `<span>${thisYear.length} book${thisYear.length !== 1 ? "s" : ""} in ${CURRENT_YEAR}</span>` +
      (totalPages
        ? `<span class="stat-sep">&middot;</span><span>${totalPages.toLocaleString()} pages</span>`
        : "");
  }

  fetch("books.json")
    .then((res) => res.json())
    .then((data) => {
      const recent = data.read.slice(0, 5);
      renderBooks(recent, "recent-books", null);
      renderYearStats(data.read);
    })
    .catch(() => {
      // Silently fail
    });
});
