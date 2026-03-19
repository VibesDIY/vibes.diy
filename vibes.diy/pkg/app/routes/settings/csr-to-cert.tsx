import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { BuildURI } from "@adviser/cement";
import { useAuth as useClerkAuth } from "@clerk/react";
import { BrutalistCard, VibesButton } from "@vibes.diy/base";
import LoggedOutView from "../../components/LoggedOutView.js";
import BrutalistLayout from "../../components/BrutalistLayout.js";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import { toast } from "react-hot-toast";

export function meta() {
  return [{ title: "CSR to Certificate - Vibes DIY" }, { name: "description", content: "Convert CSR to signed certificate" }];
}

interface CsrFormInputs {
  csrContent: string;
}

const waitUntilClose = 5;

function CsrToCertContent() {
  const { isSignedIn, isLoaded } = useClerkAuth();
  const [searchParams] = useSearchParams();
  const csrParam = searchParams.get("csr");
  const returnUrl = searchParams.get("returnUrl");
  const { vibeDiyApi } = useVibesDiy();

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<CsrFormInputs>({
    defaultValues: {
      csrContent: csrParam || "",
    },
  });
  const [certificate, setCertificate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasAutoSubmitted = useRef(false);

  const onSubmit = async (data: CsrFormInputs) => {
    setError(null);
    setCertificate(null);
    vibeDiyApi
      .getCertFromCsr({
        csr: data.csrContent,
      })
      .then((res) => {
        console.log(res);
        if (res.isErr()) {
          toast.error(res.Err().message);
        } else {
          setCertificate(res.Ok().certificate);
        }
      })
      .catch((e) => toast.error((e as Error).message));
  };

  // Auto-submit when CSR param is provided and session is ready
  useEffect(() => {
    if (csrParam && !hasAutoSubmitted.current && isLoaded && isSignedIn) {
      hasAutoSubmitted.current = true;
      void onSubmit({ csrContent: csrParam });
    }
  }, [csrParam, isLoaded, isSignedIn]);

  // Navigate back to returnUrl with cert param after certificate is received
  useEffect(() => {
    if (certificate && returnUrl) {
      const timer = setTimeout(() => {
        const urlWithCert = BuildURI.from(returnUrl).setParam("cert", certificate).toString();
        window.location.href = urlWithCert;
      }, waitUntilClose * 1000);
      return () => clearTimeout(timer);
    }
  }, [certificate, returnUrl]);

  return (
    <BrutalistLayout title="CSR to Certificate" subtitle="Submit a Certificate Signing Request to receive a signed certificate">
      <BrutalistCard size="md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <label htmlFor="csr-input" className="block text-sm font-medium mb-2" style={{ color: "var(--vibes-text-secondary)" }}>
            Enter CSR content:
          </label>
          <textarea
            id="csr-input"
            rows={10}
            className="block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono text-sm"
            style={{ background: "var(--vibes-input-bg)", color: "var(--vibes-card-text)" }}
            placeholder="-----BEGIN CERTIFICATE REQUEST-----&#10;Paste your CSR here...&#10;-----END CERTIFICATE REQUEST-----"
            {...register("csrContent", { required: true })}
          ></textarea>
          <div className="mt-4">
            <VibesButton type="submit" variant="blue" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit CSR"}
            </VibesButton>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="mt-2 text-sm text-red-700">{error}</p>
          </div>
        )}
      </BrutalistCard>

      {certificate && (
        <BrutalistCard size="md">
          <h3 className="text-lg font-semibold mb-2">Signed Certificate</h3>
          {returnUrl && (
            <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
              Redirecting back in {waitUntilClose} seconds...
            </div>
          )}
          <textarea
            readOnly
            rows={15}
            className="w-full border border-gray-300 rounded-md p-2 font-mono text-sm"
            style={{ background: "var(--vibes-input-bg)", color: "var(--vibes-card-text)" }}
            value={certificate}
          ></textarea>
          <div className="mt-2">
            <VibesButton
              variant="blue"
              onClick={() => {
                void navigator.clipboard.writeText(certificate);
                alert("Certificate copied to clipboard!");
              }}
            >
              Copy to Clipboard
            </VibesButton>
          </div>
        </BrutalistCard>
      )}
    </BrutalistLayout>
  );
}

export default function CsrToCert() {
  const { isSignedIn, isLoaded } = useClerkAuth();

  if (!isSignedIn) {
    return <LoggedOutView isLoaded={isLoaded} />;
  }

  return <CsrToCertContent />;
}
