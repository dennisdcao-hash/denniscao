document.addEventListener("DOMContentLoaded", () => {
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = lightbox.querySelector("img");
  const lightboxCaption = lightbox.querySelector(".lightbox-caption");
  const items = () => document.querySelectorAll(".gallery-item");
  let currentIndex = 0;

  function openLightbox(index) {
    const all = items();
    if (!all.length) return;
    currentIndex = index;
    const img = all[currentIndex].querySelector("img");
    const caption = all[currentIndex].querySelector(".caption");
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightboxCaption.textContent = caption ? caption.textContent : "";
    lightbox.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.classList.remove("active");
    document.body.style.overflow = "";
  }

  function navigate(dir) {
    const all = items();
    if (!all.length) return;
    currentIndex = (currentIndex + dir + all.length) % all.length;
    openLightbox(currentIndex);
  }

  document.querySelector(".gallery").addEventListener("click", (e) => {
    const item = e.target.closest(".gallery-item");
    if (!item) return;
    const all = Array.from(items());
    openLightbox(all.indexOf(item));
  });

  lightbox.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
  lightbox.querySelector(".lightbox-prev").addEventListener("click", () => navigate(-1));
  lightbox.querySelector(".lightbox-next").addEventListener("click", () => navigate(1));

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("active")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") navigate(-1);
    if (e.key === "ArrowRight") navigate(1);
  });
});
