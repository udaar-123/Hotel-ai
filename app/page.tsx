import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cookies } from "next/headers";
import { decryptSession } from "@/modules/auth/utils";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const session = await decryptSession(token);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-background text-foreground">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          Hotel Management System
        </h1>
        <p className="text-xl text-muted-foreground max-w-[600px]">
          Welcome to the Hotel Management System. Please navigate to the
          appropriate dashboard or booking portal.
        </p>

        <div className="flex gap-4">
          {session ? (
            <>
              <Link
                href="/dashboard"
                className={buttonVariants({ variant: "default" })}
              >
                Go to Dashboard
              </Link>
              <form
                action={async () => {
                  "use server";
                  const c = await cookies();
                  c.delete("session");
                }}
              >
                <button
                  type="submit"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Logout
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/auth/customer/login"
                className={buttonVariants({ variant: "default" })}
              >
                Customer Portal
              </Link>
              <Link
                href="/auth/staff/login"
                className={buttonVariants({ variant: "outline" })}
              >
                Staff Login
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
