// mock-data.ts — seed/demo/fallback data + shared type definitions.
// NOT a runtime source of truth. Runtime UI must read through the stores:
//   • books   → @/lib/books-store (getAllBooks / getEffectiveBookById / useBooksVersion)
//   • notes   → @/lib/notes-store (getAllNotes / getNotesForBook / getNoteById / useNotesVersion)
//   • reading → @/lib/book-workspace-store (getStoredSessions / getCombinedSessionsForBook)
// Mock arrays here are consumed inside those stores as initial seed for an empty app.
// Gigi mock (initialGigiMessages) is intentionally still consumed directly by /gigi
// because Gigi is a separate later phase.
export type BookStatus = "reading" | "queue" | "finished" | "paused" | "dropped";

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  cover_url?: string | null;
  coverGradient: string;
  coverAccent: string;
  description: string;
  pageCount: number;
  currentPage: number;
  publishedDate: string;
  genre: string;
  status: BookStatus;
  rating?: number;
  isFavourite: boolean;
  tags: string[];
}

const cover = (isbn: string) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;

export const books: Book[] = [
  { id: "1", title: "Zanim wystygnie kawa", author: "Toshikazu Kawaguchi", isbn: "9781529029581", cover_url: cover("9781529029581"), coverGradient: "linear-gradient(135deg,#c7d8e0,#7a96a8)", coverAccent: "#3a2418", description: "W cichej tokijskiej kawiarni można cofnąć się w czasie — jeśli zdążysz, nim wystygnie kawa.", pageCount: 224, currentPage: 142, publishedDate: "2015", genre: "Powieść współczesna", status: "reading", rating: 9, isFavourite: false, tags: ["japonia","czas","ciepłe"] },
  { id: "2", title: "Małe cuda z zakładu pogrzebowego", author: "Nuria Roca", isbn: "9788367616317", cover_url: cover("9788367616317"), coverGradient: "linear-gradient(135deg,#e6efe2,#a8c0a4)", coverAccent: "#3a4a2a", description: "Ciepła hiszpańska powieść o stracie, codziennych cudach i odnajdywaniu siebie.", pageCount: 312, currentPage: 0, publishedDate: "2023", genre: "Powieść obyczajowa", status: "queue", rating: 10, isFavourite: true, tags: ["hiszpania","emocje"] },
  { id: "3", title: "Słowik", author: "Kristin Hannah", isbn: "9780312577223", cover_url: cover("9780312577223"), coverGradient: "linear-gradient(135deg,#f3ecd8,#d1b878)", coverAccent: "#3a2a18", description: "Dwie siostry we Francji podczas II wojny światowej — historia odwagi i siostrzanej miłości.", pageCount: 528, currentPage: 528, publishedDate: "2015", genre: "Powieść historyczna", status: "finished", rating: 10, isFavourite: true, tags: ["wojna","siostry","francja"] },
  { id: "4", title: "Północna biblioteka", author: "Matt Haig", isbn: "9781786892713", cover_url: cover("9781786892713"), coverGradient: "linear-gradient(135deg,#1a2a4a,#0a1530)", coverAccent: "#e8c547", description: "Między życiem a śmiercią istnieje biblioteka, gdzie każda książka to inna wersja Twojego życia.", pageCount: 304, currentPage: 304, publishedDate: "2020", genre: "Powieść współczesna", status: "finished", rating: 10, isFavourite: true, tags: ["filozofia","życie"] },
  { id: "5", title: "Gdzie śpiewają raki", author: "Delia Owens", isbn: "9780735219090", cover_url: cover("9780735219090"), coverGradient: "linear-gradient(135deg,#f0c8a8,#8a4838)", coverAccent: "#2a1808", description: "Dziewczyna z bagien — historia samotności, miłości i ukrytych prawd.", pageCount: 384, currentPage: 384, publishedDate: "2018", genre: "Powieść współczesna", status: "finished", rating: 9, isFavourite: false, tags: ["natura","tajemnica"] },
  { id: "6", title: "Siedem sióstr", author: "Lucinda Riley", isbn: "9781447218401", cover_url: cover("9781447218401"), coverGradient: "linear-gradient(135deg,#c6a0d8,#5a3a78)", coverAccent: "#fff3d6", description: "Sześć sióstr po śmierci ojca odkrywa tajemnice swojego pochodzenia.", pageCount: 496, currentPage: 0, publishedDate: "2014", genre: "Saga rodzinna", status: "queue", rating: 8, isFavourite: false, tags: ["saga","podróże"] },
  { id: "7", title: "Cztery wiatry", author: "Kristin Hannah", isbn: "9781250178602", cover_url: cover("9781250178602"), coverGradient: "linear-gradient(135deg,#2a3a2a,#0e1a0e)", coverAccent: "#e8d9b8", description: "Wielki Kryzys w Ameryce — kobieta walczy o przetrwanie swojej rodziny.", pageCount: 464, currentPage: 0, publishedDate: "2021", genre: "Powieść historyczna", status: "queue", rating: 8, isFavourite: false, tags: ["ameryka","historia"] },
  { id: "8", title: "Atlas szepczących chmur", author: "David Mitchell", isbn: "9780340822777", cover_url: cover("9780340822777"), coverGradient: "linear-gradient(135deg,#c8d8e8,#6a8aa8)", coverAccent: "#1a2a3a", description: "Sześć splecionych historii rozciągniętych w czasie i przestrzeni.", pageCount: 528, currentPage: 0, publishedDate: "2004", genre: "Powieść współczesna", status: "queue", isFavourite: false, tags: ["literatura","czas"] },
  { id: "9", title: "Dom przy ulicy Amélie", author: "Kristin Harmel", isbn: "9781982158934", cover_url: cover("9781982158934"), coverGradient: "linear-gradient(135deg,#a8c0a4,#3a5a3a)", coverAccent: "#fff3d6", description: "Paryska historia o przyjaźni, stracie i książkach, które łączą pokolenia.", pageCount: 368, currentPage: 0, publishedDate: "2021", genre: "Powieść obyczajowa", status: "queue", isFavourite: false, tags: ["paryż","wojna"] },
  { id: "10", title: "Nocny ogród", author: "Sarah Addison Allen", isbn: "9780553807219", cover_url: cover("9780553807219"), coverGradient: "linear-gradient(135deg,#3a2a4a,#1a0e2a)", coverAccent: "#e8c8d8", description: "Magiczny realizm w małym miasteczku, gdzie ogród ma swoje sekrety.", pageCount: 304, currentPage: 0, publishedDate: "2010", genre: "Realizm magiczny", status: "queue", isFavourite: false, tags: ["magia","ogród"] },
];

export type NoteType = "quote" | "note" | "page-photo" | "chapter" | "other";
export type NoteInputMode = "text" | "handwriting";
export type NoteBackground = "plain" | "lined" | "grid" | "cream" | "dark";

export interface Note {
  id: string;
  bookId: string;
  type: NoteType;
  title?: string;
  content: string;
  quoteText?: string;
  comment?: string;
  pageNumber?: number;
  chapterNumber?: number;
  chapterTitle?: string;
  photoUrl?: string;
  inputMode?: NoteInputMode;
  drawingDataUrl?: string;
  drawingBackground?: NoteBackground;
  isFavourite: boolean;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
}

export const notes: Note[] = [
  { id: "n1", bookId: "1", type: "quote", quoteText: "Nie wznosisz się na poziom swoich celów. Spadasz do poziomu swoich systemów.", content: "", pageNumber: 186, isFavourite: true, tags: ["motywacja"], createdAt: "2024-05-12" },
  { id: "n2", bookId: "1", type: "page-photo", content: "Zdjęcie strony 213", pageNumber: 213, isFavourite: false, tags: ["piękna proza"], createdAt: "2024-05-15" },
  { id: "n3", bookId: "1", type: "chapter", chapterNumber: 12, chapterTitle: "Duży zwrot akcji", content: "Violet podejmuje trudną decyzję. Stawki zmieniają się całkowicie.", pageNumber: 312, isFavourite: true, tags: ["motywacja","ważne"], createdAt: "2024-05-10" },
  { id: "n4", bookId: "2", type: "note", content: "Myśli o przeszłości Xadena — w pierwszym tomie były tropy, które przegapiłam.", pageNumber: 245, isFavourite: false, tags: ["teoria"], createdAt: "2024-05-09" },
  { id: "n5", bookId: "5", type: "quote", quoteText: "Nie umrę dziś.", content: "", pageNumber: 312, isFavourite: true, tags: ["siła","violet","xaden"], createdAt: "2024-04-22" },
  { id: "n6", bookId: "3", type: "quote", quoteText: "Czasem najtrudniejsze wybory prowadzą do najlepszych wersji nas samych.", content: "", pageNumber: 145, isFavourite: true, tags: ["wybory","rozwój"], createdAt: "2024-04-18" },
  { id: "n7", bookId: "1", type: "chapter", chapterNumber: 1, chapterTitle: "Wprowadzenie do Akademii Basgiath", content: "Budowanie świata. Wrażliwość Violet jest pokazana od początku.", pageNumber: 12, isFavourite: false, tags: [], createdAt: "2024-05-05" },
  { id: "n8", bookId: "1", type: "chapter", chapterNumber: 2, chapterTitle: "Pierwszy trening", content: "Violet się męczy. Fizyczne wycieńczenie czuć dosłownie.", pageNumber: 38, isFavourite: false, tags: [], createdAt: "2024-05-05" },
  { id: "n9", bookId: "1", type: "chapter", chapterNumber: 3, chapterTitle: "Spotkanie z Xadenem", content: "Natychmiastowe napięcie. On coś wie o jej rodzinie.", pageNumber: 62, isFavourite: true, tags: ["xaden"], createdAt: "2024-05-06" },
  { id: "n10", bookId: "1", type: "chapter", chapterNumber: 4, chapterTitle: "Wyzwania się zaczynają", content: "Pierwszy prawdziwy test przetrwania.", pageNumber: 88, isFavourite: false, tags: [], createdAt: "2024-05-06" },
  { id: "n11", bookId: "1", type: "other", title: "Lista postaci", content: "Violet, Xaden, Mira, Dain, Liam, Rhiannon…", isFavourite: false, tags: ["referencje"], createdAt: "2024-05-04" },
  { id: "n12", bookId: "1", type: "other", title: "Moje teorie", content: "Ojciec Xadena jest powiązany z venin. Bariery słabną.", isFavourite: true, tags: ["teoria"], createdAt: "2024-05-08" },
  { id: "n13", bookId: "1", type: "other", title: "Do sprawdzenia", content: "Sprawdzić zasady wiązania ze smokiem w rozdziale 9.", isFavourite: false, tags: ["todo"], createdAt: "2024-05-10" },
  { id: "n14", bookId: "1", type: "other", title: "Luźne myśli", content: "Świat wydaje się prawdziwy. Chcę mapy.", isFavourite: false, tags: [], createdAt: "2024-05-11" },
  { id: "n15", bookId: "1", type: "other", title: "Ulubione momenty", content: "Pierwsza scena lotu. Czyste kino.", isFavourite: true, tags: ["ulubione"], createdAt: "2024-05-13" },
];

export interface ReadingSession {
  id: string; bookId: string; date: string; durationMinutes: number; startPage: number; endPage: number;
}
export const sessions: ReadingSession[] = [
  { id: "s1", bookId: "1", date: "Pon", durationMinutes: 45, startPage: 280, endPage: 305 },
  { id: "s2", bookId: "1", date: "Wt", durationMinutes: 30, startPage: 305, endPage: 320 },
  { id: "s3", bookId: "1", date: "Śr", durationMinutes: 65, startPage: 320, endPage: 350 },
  { id: "s4", bookId: "4", date: "Czw", durationMinutes: 20, startPage: 130, endPage: 142 },
  { id: "s5", bookId: "1", date: "Pt", durationMinutes: 55, startPage: 350, endPage: 380 },
  { id: "s6", bookId: "1", date: "Sob", durationMinutes: 80, startPage: 380, endPage: 420 },
  { id: "s7", bookId: "1", date: "Nd", durationMinutes: 40, startPage: 420, endPage: 445 },
];

export interface GigiMessage { id: string; role: "user" | "gigi"; content: string; }
export const initialGigiMessages: GigiMessage[] = [
  { id: "g1", role: "gigi", content: "Cześć Agata! W czym mogę dziś pomóc? ✨" },
  { id: "g2", role: "user", content: "Streścisz mi moje notatki o Fourth Wing?" },
  { id: "g3", role: "gigi", content: "Jasne! Masz 48 notatek do Fourth Wing. Główne wątki: rozwój, wybory, lojalność, strach i relacje. Wyróżniłaś 12 cytatów — większość o sile i podejmowaniu decyzji. Mam ułożyć z tego refleksję?" },
];

export const getBookById = (id: string) => books.find(b => b.id === id);
export const getNotesByBook = (id: string) => notes.filter(n => n.bookId === id);
export const getNotesByBookId = getNotesByBook;
export const getNotesByType = (bookId: string, type: NoteType) =>
  notes.filter(n => n.bookId === bookId && n.type === type);
export const getReadingSessionsByBookId = (bookId: string) =>
  sessions.filter(s => s.bookId === bookId);

export const bookStatusOptions = [
  { value: "queue", label: "W kolejce", description: "Książka czeka na przeczytanie." },
  { value: "started", label: "Zaczęte", description: "Aktualnie czytana książka." },
  { value: "paused", label: "Wstrzymane", description: "Czytanie zostało zatrzymane na później." },
  { value: "rejected", label: "Odrzucone", description: "Książka odłożona bez kończenia." },
  { value: "finished", label: "Przeczytane", description: "Książka została ukończona." },
] as const;

export type BookStatusKey = typeof bookStatusOptions[number]["value"];

export const statusToKey = (s: BookStatus): BookStatusKey => {
  switch (s) {
    case "reading": return "started";
    case "dropped": return "rejected";
    case "queue":
    case "paused":
    case "finished":
      return s;
  }
};

export const statusLabel = (s: BookStatus | BookStatusKey) => {
  const key = (s === "reading" ? "started" : s === "dropped" ? "rejected" : s) as BookStatusKey;
  return bookStatusOptions.find(o => o.value === key)?.label ?? "—";
};

export const calculateBookStats = (bookId: string) => {
  const book = getBookById(bookId);
  const ses = getReadingSessionsByBookId(bookId);
  const totalMinutes = ses.reduce((a, s) => a + s.durationMinutes, 0);
  const pagesFromSessions = ses.reduce((a, s) => a + Math.max(0, s.endPage - s.startPage), 0);
  const uniqueDays = new Set(ses.map(s => s.date)).size;
  const totalPages = book?.pageCount ?? 0;
  const currentPage = book?.currentPage ?? 0;
  const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
  return { totalMinutes, pagesFromSessions, uniqueDays, totalPages, currentPage, progress, sessions: ses };
};


export type SimpleNoteType = "quote" | "chapter" | "other";
export const simpleType = (t: NoteType): SimpleNoteType => {
  if (t === "quote") return "quote";
  if (t === "chapter") return "chapter";
  return "other";
};
export const noteTypeLabel = (t: SimpleNoteType) =>
  t === "quote" ? "Cytat" : t === "chapter" ? "Rozdział" : "Inne";

export const getNoteById = (id: string) => notes.find(n => n.id === id);
export const getNotesBySimpleType = (bookId: string, t: SimpleNoteType) =>
  notes.filter(n => n.bookId === bookId && simpleType(n.type) === t);
