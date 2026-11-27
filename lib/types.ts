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

/** Sesi yang dikirim ke pemilik untuk kalender. Satu tanggal bisa punya beberapa sesi. */
export type OwnerSession = {
  id: string;
  date: string;
  title: string;
  client: string;
  contact: string;
  time: string;
  location: string;
  notes: string;
  docUrl: string;
  claimCode: string;
  memberCount: number;
};
