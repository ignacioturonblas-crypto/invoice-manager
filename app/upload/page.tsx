"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Camera, FileText, X, CheckCircle, Loader2 } from "lucide-react";

interface UploadingFile {
  name: string;
  status: "uploading" | "extracting" | "done" | "error";
  error?: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const router = useRouter();
  const supabase = createClient();

  async function processFile(file: File) {
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const filePath = `${user.id}/${fileName}`;
    const mimeType = file.type || "application/octet-stream";
    const fileType = file.type.includes("pdf") ? "pdf" : "image";

    // Update status: uploading
    setFiles((prev) =>
      prev.map((f) => f.name === file.name ? { ...f, status: "uploading" } : f)
    );

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("invoices")
      .upload(filePath, file, { contentType: mimeType });

    if (uploadError) {
      setFiles((prev) =>
        prev.map((f) => f.name === file.name ? { ...f, status: "error", error: uploadError.message } : f)
      );
      toast.error(`Upload failed: ${file.name}`);
      return;
    }

    // Create DB record
    const { data: invoice, error: dbError } = await supabase
      .from("invoices")
      .insert({
        file_path: filePath,
        file_name: file.name,
        file_type: fileType,
        type: "payment",
        status: "processing",
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (dbError || !invoice) {
      setFiles((prev) =>
        prev.map((f) => f.name === file.name ? { ...f, status: "error", error: "DB error" } : f)
      );
      return;
    }

    // Update status: extracting
    setFiles((prev) =>
      prev.map((f) => f.name === file.name ? { ...f, status: "extracting" } : f)
    );

    // Trigger AI extraction
    const res = await fetch("/api/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: invoice.id, filePath, mimeType }),
    });

    if (!res.ok) {
      setFiles((prev) =>
        prev.map((f) => f.name === file.name ? { ...f, status: "error", error: "Extraction failed" } : f)
      );
      toast.error(`Extraction failed for ${file.name} — you can edit fields manually`);
      return;
    }

    setFiles((prev) =>
      prev.map((f) => f.name === file.name ? { ...f, status: "done" } : f)
    );
    toast.success(`${file.name} processed successfully`);
  }

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = acceptedFiles.map((f) => ({
        name: f.name,
        status: "uploading" as const,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
      acceptedFiles.forEach(processFile);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supabase]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/heic": [".heic"],
    },
    multiple: true,
  });

  const allDone = files.length > 0 && files.every((f) => f.status === "done" || f.status === "error");

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">Upload Invoices</h1>
            <p className="text-sm text-zinc-500 mt-0.5">PDF or photos — we'll extract everything automatically</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            Back
          </Button>
        </div>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-zinc-900 bg-zinc-100"
              : "border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-10 w-10 text-zinc-400 mb-3" />
          <p className="text-sm font-medium text-zinc-700">
            {isDragActive ? "Drop files here" : "Drag & drop invoices here"}
          </p>
          <p className="text-xs text-zinc-400 mt-1">PDF, JPG, PNG — multiple files supported</p>
        </div>

        {/* Camera button for mobile */}
        <div className="mt-3">
          <label className="flex items-center justify-center gap-2 w-full border border-zinc-200 rounded-xl p-3 bg-white cursor-pointer hover:bg-zinc-50 transition-colors text-sm font-medium text-zinc-700">
            <Camera className="h-4 w-4" />
            Take a photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFiles((prev) => [...prev, { name: f.name, status: "uploading" }]);
                  processFile(f);
                }
              }}
            />
          </label>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-6 space-y-2">
            {files.map((f) => (
              <div
                key={f.name}
                className="flex items-center gap-3 bg-white border border-zinc-200 rounded-lg px-4 py-3"
              >
                <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
                <span className="text-sm text-zinc-700 truncate flex-1">{f.name}</span>
                {f.status === "uploading" && (
                  <span className="text-xs text-zinc-400 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Uploading
                  </span>
                )}
                {f.status === "extracting" && (
                  <span className="text-xs text-blue-600 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Extracting
                  </span>
                )}
                {f.status === "done" && (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                )}
                {f.status === "error" && (
                  <X className="h-4 w-4 text-red-500 shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}

        {allDone && (
          <Button className="w-full mt-4" onClick={() => router.push("/dashboard")}>
            Go to Dashboard
          </Button>
        )}
      </div>
    </div>
  );
}
