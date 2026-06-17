export type BookStatus = "reading" | "queue" | "finished" | "paused" | "dropped";

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
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

export const books: Book[] = [
  { id: "1", title: "Fourth Wing", author: "Rebecca Yarros", isbn: "9781649374042", coverGradient: "linear-gradient(135deg,#3a2418,#1a0e08)", coverAccent: "#c9a96e", description: "Dwudziestoletnia Violet Sorrengail miała wstąpić do Kwadrantu Skrybów, prowadząc ciche życie wśród ksiąg i historii. Ale jej matka, generał armii, ma inne plany…", pageCount: 502, currentPage: 328, publishedDate: "2023", genre: "Fantasy, romans", status: "reading", rating: 9, isFavourite: true, tags: ["smoki","romans","akademia"] },
  { id: "2", title: "Iron Flame", author: "Rebecca Yarros", isbn: "9781649374172", coverGradient: "linear-gradient(135deg,#5a1818,#2a0808)", coverAccent: "#f4d35e", description: "Pierwszy rok to czas, gdy zdobywasz przyjaciół. Drugi to czas, gdy próbują cię zabić.", pageCount: 640, currentPage: 0, publishedDate: "2023", genre: "Fantasy, romans", status: "queue", isFavourite: false, tags: ["smoki","kontynuacja"] },
  { id: "3", title: "Powerless", author: "Lauren Roberts", isbn: "9781665954945", coverGradient: "linear-gradient(135deg,#8a2a2a,#3a0e0e)", coverAccent: "#ffd9a0", description: "W królestwie Ilya Elici z niezwykłymi zdolnościami rządzą, a Zwykli są pogardzani…", pageCount: 528, currentPage: 528, publishedDate: "2023", genre: "Fantasy, YA", status: "finished", rating: 8, isFavourite: true, tags: ["romans","ya"] },
  { id: "4", title: "The Atlas Six", author: "Olivie Blake", isbn: "9781250854513", coverGradient: "linear-gradient(135deg,#1a2a4a,#0a1530)", coverAccent: "#e8c547", description: "Sześcioro wyjątkowych magów rywalizuje o miejsce w najbardziej tajnym stowarzyszeniu magicznych akademików.", pageCount: 388, currentPage: 142, publishedDate: "2022", genre: "Fantasy", status: "reading", rating: 8, isFavourite: false, tags: ["dark academia"] },
  { id: "5", title: "Verity", author: "Colleen Hoover", isbn: "9781538724736", coverGradient: "linear-gradient(135deg,#4a1a1a,#1a0808)", coverAccent: "#e8e8e8", description: "Lowen Ashleigh, pisarka na skraju finansowej ruiny, przyjmuje propozycję pracy życia.", pageCount: 336, currentPage: 336, publishedDate: "2018", genre: "Thriller, romans", status: "finished", rating: 9, isFavourite: true, tags: ["thriller","mrok"] },
  { id: "6", title: "Daisy Jones i The Six", author: "Taylor Jenkins Reid", isbn: "9781524798628", coverGradient: "linear-gradient(135deg,#c2785a,#7a3a1a)", coverAccent: "#fff3d6", description: "Wciągająca powieść o burzliwej karierze kultowego zespołu rockowego z lat 70.", pageCount: 368, currentPage: 0, publishedDate: "2019", genre: "Powieść historyczna", status: "queue", isFavourite: false, tags: ["muzyka","lata 70"] },
  { id: "7", title: "Niewidzialne życie Addie LaRue", author: "V.E. Schwab", isbn: "9780765387561", coverGradient: "linear-gradient(135deg,#2a3a4a,#0e1a2a)", coverAccent: "#e8d9b8", description: "Młoda kobieta zawiera faustowski pakt, by żyć wiecznie — i zostaje przeklęta, by każdy o niej zapominał.", pageCount: 448, currentPage: 0, publishedDate: "2020", genre: "Fantasy, romans", status: "queue", isFavourite: false, tags: ["polecane","emocjonalne"] },
  { id: "8", title: "Milcząca pacjentka", author: "Alex Michaelides", isbn: "9781250301697", coverGradient: "linear-gradient(135deg,#1a3a4a,#0a1a2a)", coverAccent: "#f0a8a8", description: "Wstrząsający thriller psychologiczny o akcie przemocy kobiety wobec męża.", pageCount: 336, currentPage: 0, publishedDate: "2019", genre: "Thriller", status: "queue", isFavourite: false, tags: ["thriller"] },
  { id: "9", title: "Atomowe nawyki", author: "James Clear", isbn: "9780735211292", coverGradient: "linear-gradient(135deg,#e8e2d4,#b8a888)", coverAccent: "#2a2a2a", description: "Drobne zmiany, niezwykłe rezultaty — sprawdzony sposób na budowanie dobrych nawyków.", pageCount: 320, currentPage: 320, publishedDate: "2018", genre: "Rozwój osobisty", status: "finished", rating: 8, isFavourite: false, tags: ["produktywność"] },
  { id: "10", title: "To kończy się na nas", author: "Colleen Hoover", isbn: "9781501110368", coverGradient: "linear-gradient(135deg,#7a9a6a,#3a5a3a)", coverAccent: "#fff3d6", description: "Historia miłości, odporności i odwagi, by przerwać błędne koło.", pageCount: 376, currentPage: 376, publishedDate: "2016", genre: "Romans", status: "finished", rating: 7, isFavourite: false, tags: ["romans","emocjonalne"] },
];

export type NoteType = "quote" | "note" | "page-photo" | "chapter" | "other";
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
  isFavourite: boolean;
  tags: string[];
  createdAt: string;
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
