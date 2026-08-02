import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-background text-foreground">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          Hotel Management System
        </h1>
        <p className="text-xl text-muted-foreground max-w-[600px]">
          Welcome to the Hotel Management System. Please navigate to the appropriate dashboard or booking portal.
        </p>
        <div className="flex gap-4">
          <Button variant="default">Customer Portal</Button>
          <Button variant="outline">Staff Login</Button>
        </div>
      </main>
    </div>
  );
}
