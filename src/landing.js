import { BOOK_OPTIONS, BOOK_TITLES } from "./data.js";
import { hasChosenBook, setBook } from "./spoilers.js";

const landing = document.querySelector("#landing");
const lastBook = BOOK_OPTIONS.at(-1);

function close(n) {
  setBook(n);
  landing.hidden = true;
  landing.dispatchEvent(new Event("close"));
}

const upcomingCover = landing.querySelector(".landing-upcoming img");
const showPlaceholder = () => {
  const placeholder = document.createElement("div");
  placeholder.className = "landing-placeholder";
  placeholder.textContent = "Book 10";
  upcomingCover.replaceWith(placeholder);
};
if (upcomingCover.complete && !upcomingCover.naturalWidth) showPlaceholder();
else upcomingCover.addEventListener("error", showPlaceholder);

for (const b of landing.querySelectorAll(".landing-books button[data-book]")) {
  const n = Number(b.dataset.book);
  b.setAttribute("aria-label", `Book ${n}${n === lastBook ? "+" : ""}: ${BOOK_TITLES[n]}`);
  b.title = BOOK_TITLES[n];
  b.addEventListener("click", () => close(n));
}
document.querySelector("#landing-unread").addEventListener("click", () => close(0));
landing.hidden = hasChosenBook();
