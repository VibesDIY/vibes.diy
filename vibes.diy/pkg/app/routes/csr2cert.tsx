import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { SignIn, useAuth } from "@clerk/clerk-react";
import { BuildURI } from "@adviser/cement";
import { useVibeDiy } from "../vibe-diy-provider.js";

const REDIRECT_DELAY_S = 3;

export function meta() {
  return [{ title: "Device Registration - Vibes DIY" }];
}

export default function CsrToCert() {
  const { vibeDiyApi } = useVibeDiy();
  const { isSignedIn, isLoaded } = useAuth();
  const [searchParams] = useSearchParams();
  const csrParam = searchParams.get("csr");
  const returnUrl = searchParams.get("returnUrl");
  const stateParam = searchParams.get("state");

  const [certificate, setCertificate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const hasAutoSubmitted = useRef(false);

  async function submitCsr(csr: string) {
    setSubmitting(true);
    setError(null);
    setCertificate(null);
    try {
      const result = await vibeDiyApi.getCertFromCsr({ csr });
      if (result.isOk()) {
        setCertificate(result.Ok().certificate);
      } else {
        const err = result.Err();
        setError(typeof err === "string" ? err : err.message || "Failed to get certificate");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-submit when CSR param is provided and user is signed in
  useEffect(() => {
    if (csrParam && isSignedIn && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true;
      void submitCsr(csrParam);
    }
  }, [csrParam, isSignedIn]);

  // Redirect back with cert after receiving it
  useEffect(() => {
    if (certificate && returnUrl) {
      const timer = setTimeout(() => {
        const uri = BuildURI.from(returnUrl).setParam("cert", certificate);
        if (stateParam) {
          uri.setParam("state", stateParam);
        }
        window.location.href = uri.toString();
      }, REDIRECT_DELAY_S * 1000);
      return () => clearTimeout(timer);
    }
  }, [certificate, returnUrl, stateParam]);

  if (!isLoaded) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div style={{ padding: "2rem", maxWidth: "400px", margin: "0 auto" }}>
        <h2 style={{ marginBottom: "1rem" }}>Sign in to authorize device</h2>
        <p style={{ marginBottom: "1rem", color: "#666" }}>
          Sign in to your Vibes DIY account to register this device.
        </p>
        <SignIn />
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "1rem" }}>Device Registration</h2>

      {submitting && (
        <p style={{ color: "#666" }}>Signing certificate...</p>
      )}

      {error && (
        <div style={{ padding: "1rem", background: "#fee", border: "1px solid #fcc", borderRadius: "4px", marginBottom: "1rem" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {certificate && (
        <div>
          <div style={{ padding: "1rem", background: "#efe", border: "1px solid #cfc", borderRadius: "4px", marginBottom: "1rem" }}>
            Device registered successfully.
          </div>
          {returnUrl && (
            <p style={{ color: "#666" }}>
              Redirecting back to CLI in {REDIRECT_DELAY_S} seconds...
            </p>
          )}
          {!returnUrl && (
            <div>
              <p style={{ marginBottom: "0.5rem" }}>Certificate:</p>
              <textarea
                readOnly
                rows={6}
                value={certificate}
                style={{ width: "100%", fontFamily: "monospace", fontSize: "12px" }}
              />
              <button
                onClick={() => void navigator.clipboard.writeText(certificate)}
                style={{ marginTop: "0.5rem", cursor: "pointer" }}
              >
                Copy to Clipboard
              </button>
            </div>
          )}
        </div>
      )}

      {!csrParam && !certificate && !submitting && (
        <p style={{ color: "#666" }}>
          No CSR provided. This page is used by the <code>use-vibes login</code> command.
        </p>
      )}
    </div>
  );
}
