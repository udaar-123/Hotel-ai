"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RequestOtpSchema, VerifyOtpSchema } from "@/modules/auth/validation";

type OtpRequestForm = z.infer<typeof RequestOtpSchema>;
type OtpVerifyForm = z.infer<typeof VerifyOtpSchema>;

export default function CustomerLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requestForm = useForm<OtpRequestForm>({
    resolver: zodResolver(RequestOtpSchema),
  });
  const verifyForm = useForm<OtpVerifyForm>({
    resolver: zodResolver(VerifyOtpSchema),
  });

  async function handleRequestOtp(data: OtpRequestForm) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setIdentifier(data.identifier);
      verifyForm.setValue("identifier", data.identifier);
      setStep("verify");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(data: OtpVerifyForm) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, code: data.code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      router.push("/");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-black mb-4 shadow-lg shadow-indigo-500/30">
            <svg
              className="w-7 h-7 text-gray-900"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Hotel Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">Customer Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-2xl">
          {step === "request" ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Sign in</h2>
              <p className="text-gray-500 text-sm mb-6">
                Enter your email or phone to receive a one-time code.
              </p>
              <form
                onSubmit={requestForm.handleSubmit(handleRequestOtp)}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email or Phone
                  </label>
                  <input
                    {...requestForm.register("identifier")}
                    type="text"
                    placeholder="you@example.com or +91..."
                    className="w-full px-4 py-3 rounded-xl bg-gray-50/70 border border-gray-200 text-gray-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                  {requestForm.formState.errors.identifier && (
                    <p className="text-red-400 text-xs mt-1.5">
                      {requestForm.formState.errors.identifier.message}
                    </p>
                  )}
                </div>
                {error && (
                  <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black hover:bg-gray-800 text-white rounded-xl py-3 font-medium transition-all"
                >
                  {loading ? "Sending code..." : "Send OTP Code"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Enter your code
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                We sent a 6-digit code to{" "}
                <span className="text-gray-900">{identifier}</span>.
              </p>
              <form
                onSubmit={verifyForm.handleSubmit(handleVerifyOtp)}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    OTP Code
                  </label>
                  <input type="hidden" {...verifyForm.register("identifier")} />
                  <input
                    {...verifyForm.register("code")}
                    type="text"
                    placeholder="123456"
                    maxLength={6}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50/70 border border-gray-200 text-gray-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-center text-2xl tracking-widest"
                  />
                  {verifyForm.formState.errors.code && (
                    <p className="text-red-400 text-xs mt-1.5">
                      {verifyForm.formState.errors.code.message}
                    </p>
                  )}
                </div>
                {error && (
                  <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black hover:bg-gray-800 text-white rounded-xl py-3 font-medium transition-all"
                >
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("request");
                    setError("");
                    verifyForm.reset();
                  }}
                  className="w-full text-gray-500 hover:text-gray-900 text-sm transition"
                >
                  ← Try a different email/phone
                </button>
              </form>
            </>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200/50 text-center">
            <Link
              href="/auth/staff/login"
              className="text-gray-500 hover:text-gray-900 text-sm transition"
            >
              Staff login →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
