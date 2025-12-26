import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Linea Pitch Deck",
  description: "Linea Pitch Deck",
};

export default function PitchPage() {
  return (
    <iframe
      src="/pitch.pdf"
      className="w-full h-screen"
      title="Linea Pitch Deck"
    />
  );
}

