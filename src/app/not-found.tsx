import Link from "next/link";
import { btnPrimary } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-screen max-w-[1240px] place-items-center p-3">
      <div className="w-full bg-white px-6 py-24 text-center">
        <p className="text-[11px] uppercase tracking-[0.14em] text-mute">404</p>
        <h1 className="mt-3 text-4xl tracking-[-0.035em] md:text-6xl">Out of bounds.</h1>
        <p className="mt-3 text-sm text-mute">That page doesn’t exist.</p>
        <Link href="/" className={`${btnPrimary} mt-8`}>
          Back to the club
        </Link>
      </div>
    </div>
  );
}
