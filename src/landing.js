import { BOOK_OPTIONS, BOOK_TITLES, bookCover } from "./data.js";
import { hasChosenBook, setBook } from "./spoilers.js";

const landing = document.querySelector("#landing");
const lastBook = BOOK_OPTIONS.at(-1);

function close(n) {
  setBook(n);
  landing.hidden = true;
  landing.dispatchEvent(new Event("close"));
}

const upcoming = document.createElement("div");
upcoming.className = "landing-upcoming";
const upcomingCover = new Image();
upcomingCover.src = "assets/covers/book-10.webp";
upcomingCover.alt = "Book 10";
upcomingCover.addEventListener("error", () => {
  const placeholder = document.createElement("div");
  placeholder.className = "landing-placeholder";
  placeholder.textContent = "Book 10";
  upcomingCover.replaceWith(placeholder);
});
const upcomingNote = document.createElement("p");
upcomingNote.textContent = "I'll add this one to the map once I finish reading it myself.";
upcoming.append(upcomingCover, upcomingNote);

landing.querySelector(".landing-books").replaceChildren(
  upcoming,
  ...BOOK_OPTIONS.filter((n) => n > 0).reverse().map((n) => {
    const b = document.createElement("button");
    b.setAttribute("aria-label", `Book ${n}${n === lastBook ? "+" : ""}: ${BOOK_TITLES[n]}`);
    b.title = BOOK_TITLES[n];
    const img = new Image();
    img.src = bookCover(n);
    img.alt = "";
    b.append(img);
    b.addEventListener("click", () => close(n));
    return b;
  }),
);
document.querySelector("#landing-unread").addEventListener("click", () => close(0));
landing.hidden = hasChosenBook();
