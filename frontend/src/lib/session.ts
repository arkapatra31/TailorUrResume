import { toast } from "sonner";
import { buildSession, useStore, type SessionFile } from "@/store";
import { downloadBlob } from "./utils";

export function exportSession() {
  const s = buildSession();
  downloadBlob(new Blob([JSON.stringify(s, null, 2)], { type: "application/json" }), "tailorurresume-session.json");
  useStore.setState({ dirty: false });
  toast.success("Session saved", { description: "Your API key is not included in the file." });
}

export function importSessionFile(file: File) {
  file.text().then((t) => {
    try {
      const s = JSON.parse(t) as SessionFile;
      if (s.app !== "TailorUrResume" || s.version !== 1) throw new Error("bad");
      useStore.getState().loadSession(s);
      toast.success("Session restored", { description: "Re-enter your API key to continue generating." });
    } catch {
      toast.error("That file is not a valid TailorUrResume session.");
    }
  });
}

export function pickSessionFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = () => input.files?.[0] && importSessionFile(input.files[0]);
  input.click();
}
