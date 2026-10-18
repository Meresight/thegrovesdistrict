import { About } from "@/components/About";
import { Cafe } from "@/components/Cafe";
import { Contact } from "@/components/Contact";
import { Courts } from "@/components/Courts";
import { Events } from "@/components/Events";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { PlayerReviews } from "@/components/PlayerReviews";
import { WaysToPlay } from "@/components/WaysToPlay";
import { site } from "@/lib/config";

// Static shell regenerated every 5 minutes (events come from Supabase). Booking data is fetched live on the client.
export const revalidate = 300;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  name: site.name,
  description: site.description,
  url: site.url,
  image: `${site.url}/images/court-main.jpg`,
  sport: "Pickleball",
  hasMap: site.mapsUrl,
  geo: {
    "@type": "GeoCoordinates",
    latitude: 10.3458956,
    longitude: 123.953386,
  },
};

export default function Home() {
  return (
    <div className="mx-auto max-w-[1240px]">
      <div className="bg-white">
        <Header />
        <main>
          <Hero />
          <About />
          <Courts />
          <WaysToPlay />
          <Cafe />
          <Events />
          <PlayerReviews />
          <Faq />
          <Contact />
        </main>
        <Footer />
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
