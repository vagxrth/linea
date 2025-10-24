import Link from "next/link"
import { ArrowRight } from "lucide-react"
import InfiniteGallery from "@/components/infinite-gallery"

export default function Home() {
  const sampleImages = [
    { src: "/images/1.webp", alt: "Image 1" },
    { src: "/images/2.webp", alt: "Image 2" },
    { src: "/images/3.webp", alt: "Image 3" },
    { src: "/images/4.webp", alt: "Image 4" },
    { src: "/images/5.webp", alt: "Image 5" },
    { src: "/images/6.webp", alt: "Image 6" },
    { src: "/images/7.webp", alt: "Image 7" },
    { src: "/images/8.webp", alt: "Image 8" },
  ]

  return (
    <main className="min-h-screen ">
      <InfiniteGallery
        images={sampleImages}
        speed={1.2}
        zSpacing={3}
        visibleCount={12}
        falloff={{ near: 0.8, far: 14 }}
        className="h-screen w-full rounded-lg overflow-hidden"
      />
      <div className="h-screen inset-0 pointer-events-none fixed flex flex-col items-center justify-center text-center px-3 mix-blend-exclusion text-white">
        <h1 className="font-serif text-4xl md:text-7xl tracking-tight">
          <span className="italic">Experience, </span>
          <span className="bold">Linea</span>
        </h1>
        <p className="font-serif text-lg md:text-2xl tracking-wide mt-4 opacity-90">Think. Sketch. Design</p>
        <Link href="/auth/signin" className="pointer-events-auto mt-16">
          <button className="px-8 py-3 bg-white text-black font-serif text-lg rounded-lg hover:bg-gray-200 transition-all duration-300 flex items-center gap-2 group hover:gap-3 cursor-pointer">
            Get Started
            <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </Link>
      </div>
    </main>
  )
}
