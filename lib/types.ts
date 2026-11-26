export type DayStatus = "available" | "booked" | "blocked";

export type Settings = {
  studio: string;
  tagline: string;
  whatsapp: string;
  showInfoDefault: boolean;
};

/** Data yang dilihat client. Tanggal tanpa entri berarti tersedia. */
export type PublicDay = {
  date: string; // YYYY-MM-DD
  status: "booked" | "blocked";
  info: string;
  showInfo: boolean;
};

/** Sesi milik satu client, hanya berisi hal yang boleh dilihat client itu sendiri. */
export type MyBooking = {
  date: string;
  info: string;
  time: string;
  location: string;
};

/** Data yang hanya dikirim ke pemilik. */
export type PrivateDay = {
  date: string;
  client: string;
  clientEmail: string;
  contact: string;
  time: string;
  location: string;
  notes: string;
  docUrl: string;
  driveFolderId: string;
  editedFolderId: string;
  maxSelect: number;
  stage: "" | "proses" | "selesai";
  selection: { id: string; name: string }[];
};
