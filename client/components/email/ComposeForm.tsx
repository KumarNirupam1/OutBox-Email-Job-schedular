"use client";

import { useState } from "react";
import Papa from "papaparse";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { useScheduleEmail } from "@/features/emails/hooks/useEmail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bold,
  Clock,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Send,
  CheckCircle2,
  Strikethrough,
  AlignLeft,
  Undo2,
  Upload,
  Underline as UnderlineIcon,
} from "lucide-react";

export function ComposeForm() {
  const [emails, setEmails] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [senderId] = useState("cmtjneak40000todi4vyqd9o8"); // Replace with your actual sender ID or fetch from API
  const [startTime, setStartTime] = useState("");
  const [delayMinutes, setDelayMinutes] = useState(1); // Delay between emails in minutes
  const [hourlyLimit, setHourlyLimit] = useState(10);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Hi there, I noticed..." }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
    ],
    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      setBody(currentEditor.getHTML());
    },
  });
  
  const scheduleMutation = useScheduleEmail();
  const [isScheduling, setIsScheduling] = useState(false);
  const [successCount, setSuccessCount] = useState(0);

  // Handle CSV Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<string[]>(file, {
      complete: (results) => {
        // Extract emails from the first column of the CSV
        const extractedEmails = results.data
          .map((row) => row[0])
          .filter((email): email is string => Boolean(email?.includes("@")));
        
        setEmails(extractedEmails);
      },
      skipEmptyLines: true,
    });
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emails.length === 0) {
      alert("Please upload a CSV with at least one email.");
      return;
    }

    if (!editor?.getText().trim()) {
      alert("Please enter an email body.");
      return;
    }

    setIsScheduling(true);
    setSuccessCount(0);

    const startTimestamp = new Date(startTime).getTime();

    // Loop through each email and schedule it with a staggered delay
    for (let i = 0; i < emails.length; i++) {
      const scheduledTime = new Date(startTimestamp + i * delayMinutes * 60000).toISOString();

      try {
        await scheduleMutation.mutateAsync({
          recipientEmail: emails[i],
          subject,
          body,
          senderId,
          scheduledAt: scheduledTime,
        });
        setSuccessCount((prev) => prev + 1);
      } catch (error) {
        console.error(`Failed to schedule email for ${emails[i]}`, error);
      }
    }

    setIsScheduling(false);
    alert(`Successfully scheduled ${successCount} emails!`);
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Compose New Email Campaign
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* 1. CSV Upload */}
          <div className="space-y-2">
            <Label>Upload Email Leads (CSV)</Label>
            <div className="flex items-center gap-4 border-2 border-dashed rounded-lg p-6 bg-gray-50">
              <Upload className="h-8 w-8 text-gray-400" />
              <Input 
                type="file" 
                accept=".csv" 
                onChange={handleFileUpload} 
                className="flex-1"
              />
            </div>
            {emails.length > 0 && (
              <p className="text-sm text-green-600 font-medium">
                ✅ {emails.length} email addresses detected.
              </p>
            )}
          </div>

          {/* 2. Email Content */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)} 
                placeholder="e.g., Quick question about your business"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <div className="overflow-hidden rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring/50">
                <div className="flex flex-wrap items-center gap-1 border-b border-input bg-muted/50 p-2">
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()} aria-label="Undo" title="Undo">
                    <Undo2 />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()} aria-label="Redo" title="Redo">
                    <Redo2 />
                  </Button>
                  <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="Text style" aria-pressed={editor?.isActive("heading", { level: 2 })} title="Text style">
                    <Heading2 />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor?.chain().focus().toggleBold().run()} aria-label="Bold" aria-pressed={editor?.isActive("bold")} title="Bold">
                    <Bold />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor?.chain().focus().toggleItalic().run()} aria-label="Italic" aria-pressed={editor?.isActive("italic")} title="Italic">
                    <Italic />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor?.chain().focus().toggleUnderline().run()} aria-label="Underline" aria-pressed={editor?.isActive("underline")} title="Underline">
                    <UnderlineIcon />
                  </Button>
                  <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor?.chain().focus().setTextAlign("left").run()} aria-label="Align left" title="Align left">
                    <AlignLeft />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor?.chain().focus().toggleOrderedList().run()} aria-label="Numbered list" aria-pressed={editor?.isActive("orderedList")} title="Numbered list">
                    <ListOrdered />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor?.chain().focus().toggleBulletList().run()} aria-label="Bulleted list" aria-pressed={editor?.isActive("bulletList")} title="Bulleted list">
                    <List />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor?.chain().focus().sinkListItem("listItem").run()} aria-label="Increase indent" title="Increase indent">
                    <List />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor?.chain().focus().liftListItem("listItem").run()} aria-label="Decrease indent" title="Decrease indent">
                    <ListOrdered />
                  </Button>
                  <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor?.chain().focus().toggleBlockquote().run()} aria-label="Block quote" aria-pressed={editor?.isActive("blockquote")} title="Block quote">
                    <Quote />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor?.chain().focus().setHorizontalRule().run()} aria-label="Horizontal rule" title="Horizontal rule">
                    <Minus />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor?.chain().focus().toggleStrike().run()} aria-label="Strikethrough" aria-pressed={editor?.isActive("strike")} title="Strikethrough">
                    <Strikethrough />
                  </Button>
                </div>
                <EditorContent
                  editor={editor}
                  className="min-h-40 px-3 py-2 text-sm [&_.ProseMirror]:min-h-36 [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-['Hi_there,_I_noticed...'] [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-semibold"
                />
              </div>
            </div>
          </div>

          {/* 3. Scheduling Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input 
                type="datetime-local" 
                value={startTime} 
                onChange={(e) => setStartTime(e.target.value)} 
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Delay (Minutes)</Label>
              <Input 
                type="number" 
                value={delayMinutes} 
                onChange={(e) => setDelayMinutes(Number(e.target.value))} 
                min={1}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Hourly Limit</Label>
              <Input 
                type="number" 
                value={hourlyLimit} 
                onChange={(e) => setHourlyLimit(Number(e.target.value))} 
                min={1}
                required
              />
            </div>
          </div>

          {/* 4. Submit Button */}
          <Button 
            type="submit" 
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={isScheduling || emails.length === 0}
          >
            {isScheduling ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Scheduling {successCount}/{emails.length}...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Schedule {emails.length} Emails
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}