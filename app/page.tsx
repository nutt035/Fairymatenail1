import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full flex-col items-center justify-between 
                       py-20 px-6 sm:px-10 bg-white dark:bg-black">
        
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />

        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left max-w-xl w-full">
          <h1 className="text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Fairymate Queue System
          </h1>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            ระบบจัดการคิวร้านทำเล็บ.
          </p>
        </div>

      </main>
    </div>
  );
}
