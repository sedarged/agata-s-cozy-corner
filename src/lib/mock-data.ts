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
  { id: "1", title: "Fourth Wing", author: "Rebecca Yarros", isbn: "9781649374042", coverGradient: "linear-gradient(135deg,#3a2418,#1a0e08)", coverAccent: "#c9a96e", description: "Twenty-year-old Violet Sorrengail was supposed to enter the Scribe Quadrant, living a quiet life among books and history. But her mother, the commanding general, has other plans...", pageCount: 502, currentPage: 328, publishedDate: "2023", genre: "Fantasy, Romance", status: "reading", rating: 9, isFavourite: true, tags: ["dragons","romance","academy"] },
  { id: "2", title: "Iron Flame", author: "Rebecca Yarros", isbn: "9781649374172", coverGradient: "linear-gradient(135deg,#5a1818,#2a0808)", coverAccent: "#f4d35e", description: "The first year is when you make friends. The second year is when they try to kill you.", pageCount: 640, currentPage: 0, publishedDate: "2023", genre: "Fantasy, Romance", status: "queue", isFavourite: false, tags: ["dragons","sequel"] },
  { id: "3", title: "Powerless", author: "Lauren Roberts", isbn: "9781665954945", coverGradient: "linear-gradient(135deg,#8a2a2a,#3a0e0e)", coverAccent: "#ffd9a0", description: "In the kingdom of Ilya, Elites with extraordinary abilities rule and Ordinaries are looked down upon...", pageCount: 528, currentPage: 528, publishedDate: "2023", genre: "Fantasy, YA", status: "finished", rating: 8, isFavourite: true, tags: ["romance","ya"] },
  { id: "4", title: "The Atlas Six", author: "Olivie Blake", isbn: "9781250854513", coverGradient: "linear-gradient(135deg,#1a2a4a,#0a1530)", coverAccent: "#e8c547", description: "Six exceptional magicians compete for entry into the most secretive society of magical academics in the world.", pageCount: 388, currentPage: 142, publishedDate: "2022", genre: "Fantasy", status: "reading", rating: 8, isFavourite: false, tags: ["dark academia"] },
  { id: "5", title: "Verity", author: "Colleen Hoover", isbn: "9781538724736", coverGradient: "linear-gradient(135deg,#4a1a1a,#1a0808)", coverAccent: "#e8e8e8", description: "Lowen Ashleigh is a struggling writer on the brink of financial ruin when she accepts the job offer of a lifetime.", pageCount: 336, currentPage: 336, publishedDate: "2018", genre: "Thriller, Romance", status: "finished", rating: 9, isFavourite: true, tags: ["thriller","dark"] },
  { id: "6", title: "Daisy Jones & The Six", author: "Taylor Jenkins Reid", isbn: "9781524798628", coverGradient: "linear-gradient(135deg,#c2785a,#7a3a1a)", coverAccent: "#fff3d6", description: "A gripping novel about the whirlwind rise of an iconic 1970s rock group.", pageCount: 368, currentPage: 0, publishedDate: "2019", genre: "Historical Fiction", status: "queue", isFavourite: false, tags: ["music","70s"] },
  { id: "7", title: "The Invisible Life of Addie LaRue", author: "V.E. Schwab", isbn: "9780765387561", coverGradient: "linear-gradient(135deg,#2a3a4a,#0e1a2a)", coverAccent: "#e8d9b8", description: "A young woman makes a Faustian bargain to live forever and is cursed to be forgotten by everyone she meets.", pageCount: 448, currentPage: 0, publishedDate: "2020", genre: "Fantasy, Romance", status: "queue", isFavourite: false, tags: ["recommended","emotional"] },
  { id: "8", title: "The Silent Patient", author: "Alex Michaelides", isbn: "9781250301697", coverGradient: "linear-gradient(135deg,#1a3a4a,#0a1a2a)", coverAccent: "#f0a8a8", description: "A shocking psychological thriller of a woman's act of violence against her husband.", pageCount: 336, currentPage: 0, publishedDate: "2019", genre: "Thriller", status: "queue", isFavourite: false, tags: ["thriller"] },
  { id: "9", title: "Atomic Habits", author: "James Clear", isbn: "9780735211292", coverGradient: "linear-gradient(135deg,#e8e2d4,#b8a888)", coverAccent: "#2a2a2a", description: "Tiny changes, remarkable results — an easy and proven way to build good habits.", pageCount: 320, currentPage: 320, publishedDate: "2018", genre: "Self-Help", status: "finished", rating: 8, isFavourite: false, tags: ["productivity"] },
  { id: "10", title: "It Ends With Us", author: "Colleen Hoover", isbn: "9781501110368", coverGradient: "linear-gradient(135deg,#7a9a6a,#3a5a3a)", coverAccent: "#fff3d6", description: "A story of love, resilience, and the courage to break the cycle.", pageCount: 376, currentPage: 376, publishedDate: "2016", genre: "Romance", status: "finished", rating: 7, isFavourite: false, tags: ["romance","emotional"] },
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
  { id: "n1", bookId: "1", type: "quote", quoteText: "You do not rise to the level of your goals. You fall to the level of your systems.", content: "", pageNumber: 186, isFavourite: true, tags: ["motivation"], createdAt: "2024-05-12" },
  { id: "n2", bookId: "1", type: "page-photo", content: "Page 213 capture", pageNumber: 213, isFavourite: false, tags: ["beautiful prose"], createdAt: "2024-05-15" },
  { id: "n3", bookId: "1", type: "chapter", chapterNumber: 12, chapterTitle: "Big turning point", content: "Violet makes a difficult decision. The stakes shift entirely here.", pageNumber: 312, isFavourite: true, tags: ["motivation","important"], createdAt: "2024-05-10" },
  { id: "n4", bookId: "2", type: "note", content: "Thoughts about Xaden's past — there are clues from book one I missed.", pageNumber: 245, isFavourite: false, tags: ["theory"], createdAt: "2024-05-09" },
  { id: "n5", bookId: "5", type: "quote", quoteText: "I will not die today.", content: "", pageNumber: 312, isFavourite: true, tags: ["strength","violet","xaden"], createdAt: "2024-04-22" },
  { id: "n6", bookId: "3", type: "quote", quoteText: "Sometimes the hardest choices lead to the best versions of us.", content: "", pageNumber: 145, isFavourite: true, tags: ["choices","growth"], createdAt: "2024-04-18" },
  { id: "n7", bookId: "1", type: "chapter", chapterNumber: 1, chapterTitle: "Introduction to Basgiath War College", content: "Setting the world. Violet's vulnerability is established early.", pageNumber: 12, isFavourite: false, tags: [], createdAt: "2024-05-05" },
  { id: "n8", bookId: "1", type: "chapter", chapterNumber: 2, chapterTitle: "The first training", content: "Violet is struggling. The physical toll feels real.", pageNumber: 38, isFavourite: false, tags: [], createdAt: "2024-05-05" },
  { id: "n9", bookId: "1", type: "chapter", chapterNumber: 3, chapterTitle: "Met Xaden", content: "Instant tension. He knows something about her family.", pageNumber: 62, isFavourite: true, tags: ["xaden"], createdAt: "2024-05-06" },
  { id: "n10", bookId: "1", type: "chapter", chapterNumber: 4, chapterTitle: "The challenges begin", content: "First real test of survival.", pageNumber: 88, isFavourite: false, tags: [], createdAt: "2024-05-06" },
  { id: "n11", bookId: "1", type: "other", title: "Character List", content: "Violet, Xaden, Mira, Dain, Liam, Rhiannon...", isFavourite: false, tags: ["reference"], createdAt: "2024-05-04" },
  { id: "n12", bookId: "1", type: "other", title: "My Theories", content: "Xaden's father is connected to the venin. The wards are failing.", isFavourite: true, tags: ["theory"], createdAt: "2024-05-08" },
  { id: "n13", bookId: "1", type: "other", title: "Things to Check", content: "Look up dragon bonding rules in chapter 9.", isFavourite: false, tags: ["todo"], createdAt: "2024-05-10" },
  { id: "n14", bookId: "1", type: "other", title: "Random Thoughts", content: "The world-building feels lived-in. I want a map.", isFavourite: false, tags: [], createdAt: "2024-05-11" },
  { id: "n15", bookId: "1", type: "other", title: "Favorite Moments", content: "The first flight scene. Pure cinema.", isFavourite: true, tags: ["favourite"], createdAt: "2024-05-13" },
];

export interface ReadingSession {
  id: string; bookId: string; date: string; durationMinutes: number; startPage: number; endPage: number;
}
export const sessions: ReadingSession[] = [
  { id: "s1", bookId: "1", date: "Mon", durationMinutes: 45, startPage: 280, endPage: 305 },
  { id: "s2", bookId: "1", date: "Tue", durationMinutes: 30, startPage: 305, endPage: 320 },
  { id: "s3", bookId: "1", date: "Wed", durationMinutes: 65, startPage: 320, endPage: 350 },
  { id: "s4", bookId: "4", date: "Thu", durationMinutes: 20, startPage: 130, endPage: 142 },
  { id: "s5", bookId: "1", date: "Fri", durationMinutes: 55, startPage: 350, endPage: 380 },
  { id: "s6", bookId: "1", date: "Sat", durationMinutes: 80, startPage: 380, endPage: 420 },
  { id: "s7", bookId: "1", date: "Sun", durationMinutes: 40, startPage: 420, endPage: 445 },
];

export interface GigiMessage { id: string; role: "user" | "gigi"; content: string; }
export const initialGigiMessages: GigiMessage[] = [
  { id: "g1", role: "gigi", content: "Hi Agata! How can I help you today? ✨" },
  { id: "g2", role: "user", content: "Can you summarize my notes on Fourth Wing?" },
  { id: "g3", role: "gigi", content: "Sure! You have 48 notes on Fourth Wing. The main themes are: growth, choices, loyalty, fear, and relationships. You highlighted 12 quotes — most about strength and decision-making. Want me to pull them together as a reflection?" },
];

export const getBookById = (id: string) => books.find(b => b.id === id);
export const getNotesByBook = (id: string) => notes.filter(n => n.bookId === id);
