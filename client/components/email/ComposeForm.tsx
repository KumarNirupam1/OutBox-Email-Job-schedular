"use client";

import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { useScheduleEmail } from "@/features/emails/hooks/useEmail"; 
import { authClient } from "@/features/auth/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlignLeft,
  ArrowLeft,
  Bold,
  Clock,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Minus,
  Paperclip,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  Upload,
} from "lucide-react";
import Link from "next/link";

interface ComposeUser {
  id: string;
  email: string;
}

export function ComposeForm() {
  const router = useRouter();
  const scheduleEmail = useScheduleEmail();
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [user, setUser] = useState<ComposeUser | null>(null);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [startTime, setStartTime] = useState("");
  const [delayMinutes, setDelayMinutes] = useState(1);
  const [hourlyLimit, setHourlyLimit] = useState(10);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Type Your Reply..." }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
    ],
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => setBody(currentEditor.getHTML()),
  });

  useEffect(() => {
    void authClient.getSession().then(({ data }) => {
      if (data?.user) setUser({ id: data.user.id, email: data.user.email });
    });
  }, []);

  // --- Recipient Logic ---
  const addRecipients = (value: string) => {
    if (!value.trim()) return;
    
    const newEmails = value
      .split(/[,\s]+/)
      .map((email) => email.trim())
      .filter((email) => email.includes("@") && email.length > 5);
    
    const uniqueNewEmails = newEmails.filter((email) => !recipients.includes(email));
    
    if (uniqueNewEmails.length > 0) {
      setRecipients((current) => [...current, ...uniqueNewEmails]);
    }
    setRecipientInput("");
  };

  const handleLeadUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const emails: string[] = [];
        results.data.forEach((row) => {
          if (Array.isArray(row)) {
            row.forEach((cell) => {
              if (cell && typeof cell === "string" && cell.includes("@")) {
                const cleanEmail = cell.trim().replace(/^["']|["']$/g, "");
                if (cleanEmail.includes("@") && cleanEmail.length > 5 && !emails.includes(cleanEmail)) {
                  emails.push(cleanEmail);
                }
              }
            });
          } else if (typeof row === "string" && row.includes("@")) {
            const cleanEmail = row.trim().replace(/^["']|["']$/g, "");
            if (cleanEmail.includes("@") && cleanEmail.length > 5 && !emails.includes(cleanEmail)) {
              emails.push(cleanEmail);
            }
          }
        });
        
        const uniqueEmails = emails.filter((email) => !recipients.includes(email));
        setRecipients((current) => [...current, ...uniqueEmails]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      error: (error) => {
        console.error("CSV parsing error:", error);
        alert("Failed to parse CSV file.");
      },
    });
  };

  // --- Attachment Logic ---
  const handleAttachmentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAttachments((current) => [...current, ...Array.from(event.target.files ?? [])]);
    event.target.value = "";
  };

  // --- Scheduling Logic ---
  const setTomorrow = (hour: number) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(hour, 0, 0, 0);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const day = String(tomorrow.getDate()).padStart(2, "0");
    setStartTime(`${year}-${month}-${day}T${String(hour).padStart(2, "0")}:00`);
    setIsScheduleOpen(false);
  };

  const handleSend = async () => {
    const pending = recipientInput.trim()
      ? [...recipients, ...recipientInput.split(/[,\s]+/).map((e) => e.trim()).filter((e) => e.includes("@") && e.length > 5)]
      : recipients;
      
    if (!pending.length || !subject.trim() || !editor?.getText().trim()) {
      alert("Please add recipients, a subject, and email content.");
      return;
    }

    if (!startTime) {
      alert("Please select a start time using the clock icon.");
      return;
    }

    setIsSubmitting(true);
    const baseTime = new Date(startTime).getTime();
    
    try {
      let successCount = 0;
      for (let index = 0; index < pending.length; index += 1) {
        await scheduleEmail.mutateAsync({
          recipientEmail: pending[index],
          subject: subject.trim(),
          body,
          senderId: user?.id || "",
          scheduledAt: new Date(baseTime + index * delayMinutes * 60000).toISOString(),
        });
        successCount += 1;
      }
      
      alert(`Successfully scheduled ${successCount} email${successCount !== 1 ? "s" : ""}!`);
      router.push("/dashboard/scheduled");
    } catch (error) {
      console.error(error);
      alert("Failed to schedule emails. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="min-h-[calc(100vh-7rem)] bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
        <div className="flex items-center gap-2 text-base font-medium">
          <Link href="/dashboard/scheduled">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <span className="text-xl font-semibold">Compose New Email</span>
        </div>
        <div className="flex items-center gap-1">
          <input ref={attachmentInputRef} type="file" multiple className="hidden" onChange={handleAttachmentUpload} />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Add attachments" title="Add attachments" onClick={() => attachmentInputRef.current?.click()}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Popover open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Send later" title="Send later">
                <Clock className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <p className="text-sm font-medium">Send Later</p>
              <p className="text-xs text-muted-foreground mb-2">Pick date & time</p>
              <Input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mb-2" />
              <div className="space-y-1">
                {[10, 11, 15].map((hour) => (
                  <Button key={hour} type="button" variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => setTomorrow(hour)}>
                    Tomorrow, {hour === 15 ? "3:00 PM" : `${hour}:00 AM`}
                  </Button>
                ))}
              </div>
              <div className="flex justify-end gap-2 border-t pt-2 mt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
                <Button type="button" size="sm" onClick={() => setIsScheduleOpen(false)}>Done</Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button type="button" size="sm" className="h-8 rounded-full px-4 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => void handleSend()} disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>

      {/* Form Body */}
      <form onSubmit={(event) => { event.preventDefault(); void handleSend(); }} className="mx-auto max-w-4xl px-4 py-6 md:px-10">
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] border-b border-border/70 text-sm">
          
          {/* From */}
          <span className="py-3 text-muted-foreground font-medium">From</span>
          <Input value={user?.email || ""} readOnly placeholder="Loading..." className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 text-sm" />
          
          {/* To */}
          <span className="py-3 text-muted-foreground font-medium">To</span>
          <div className="flex min-h-10 flex-wrap items-center gap-1.5 py-2">
            {/* Green Tags for first 3 */}
            {recipients.slice(0, 3).map((recipient) => (
              <button
                key={recipient}
                type="button"
                onClick={() => setRecipients((current) => current.filter((item) => item !== recipient))}
                className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-50 px-2.5 py-0.5 text-[11px] font-medium text-green-700 hover:bg-green-100 transition-colors"
              >
                {recipient}
                <span className="text-[10px] text-green-600 ml-0.5">×</span>
              </button>
            ))}
            
            {/* +X Badge */}
            {recipients.length > 3 && (
              <span className="rounded-full border border-gray-300 bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
                +{recipients.length - 3}
              </span>
            )}
            
            {/* Input */}
            <Input
              value={recipientInput}
              onChange={(event) => setRecipientInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addRecipients(recipientInput);
                }
              }}
              onBlur={() => addRecipients(recipientInput)}
              placeholder=""
              className="h-7 min-w-[150px] flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 text-sm"
            />
            
            {/* Upload List */}
            <label className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-green-600 hover:bg-green-50 transition-colors ml-auto">
              <Upload className="h-3 w-3" />
              Upload List
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleLeadUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Subject */}
          <span className="py-3 text-muted-foreground font-medium">Subject</span>
          <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 text-sm" required />
        </div>

        {/* Delay & Hourly Limit */}
        <div className="flex items-center gap-4 border-b border-border/70 py-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Delay between 2 emails</span>
            <Input type="number" min={0} value={delayMinutes} onChange={(event) => setDelayMinutes(Number(event.target.value))} className="h-7 w-14 px-1 text-center text-xs" />
            <span className="text-muted-foreground">min</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Hourly Limit</span>
            <Input type="number" min={0} value={hourlyLimit} onChange={(event) => setHourlyLimit(Number(event.target.value))} className="h-7 w-14 px-1 text-center text-xs" />
          </div>
        </div>

        {/* Rich Text Editor */}
        <div className="mt-4 overflow-hidden rounded-md border border-border/50 bg-muted/10">
          <div className="flex flex-wrap items-center gap-0.5 border-b border-border/50 bg-background p-1">
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor?.chain().focus().undo().run()}><Undo2 className="h-3.5 w-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor?.chain().focus().redo().run()}><Redo2 className="h-3.5 w-3.5" /></Button>
            <span className="mx-1 h-4 w-px bg-border" />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-3.5 w-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor?.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-3.5 w-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor?.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-3.5 w-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor?.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote className="h-3.5 w-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor?.chain().focus().setHorizontalRule().run()}><Minus className="h-3.5 w-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough className="h-3.5 w-3.5" /></Button>
          </div>
          <EditorContent editor={editor} className="min-h-[20rem] px-4 py-4 text-sm [&_.ProseMirror]:min-h-[16rem] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-semibold" />
        </div>

        {/* Attachments Display */}
        {attachments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <button
                key={`${file.name}-${file.lastModified}-${index}`}
                type="button"
                onClick={() => setAttachments((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground hover:bg-muted/80"
              >
                <Paperclip className="h-3 w-3" />
                {file.name} 
                <span className="ml-1 text-[10px]">×</span>
              </button>
            ))}
          </div>
        )}
      </form>
    </section>
  );  
}