"use client";

import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import DOMPurify from "isomorphic-dompurify";
import {
  ArrowLeft,
  Archive,
  Download,
  Paperclip,
  Star,
  Trash2,
} from "lucide-react";
import { useEmail } from "@/features/emails/hooks/useEmail";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

function getRecipientName(email: string) {
  const localPart = email.split("@")[0] || email;

  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function EmailDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: email, isLoading, isError } = useEmail(params.id);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading email...</div>;
  }

  if (isError || !email) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>Unable to load this email.</p>
        <Button variant="outline" onClick={() => router.back()}>Go back</Button>
      </div>
    );
  }

  const messageDate = email.sentAt || email.scheduledAt;
  const senderEmail = email.sender?.email || "Unknown sender";
  const senderName = email.status === "PENDING" ? "You" : getRecipientName(email.recipientEmail);

  return (
    <article className="min-h-full bg-background">
      <div className="flex items-center justify-between gap-4 border-b px-4 py-2 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Go back" title="Go back" onClick={() => router.back()}>
            <ArrowLeft />
          </Button>
          <h1 className="min-w-0 truncate text-xl font-medium tracking-tight">
            {email.subject}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Star email" title="Star email">
            <Star />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Archive email" title="Archive email">
            <Archive />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete email" title="Delete email">
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <div className="flex items-start gap-3 border-b pb-4">
          <Avatar className="mt-1 h-10 w-10 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary">
              {senderName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {senderName}
                  <span className="ml-2 font-normal text-muted-foreground">
                    &lt;{senderEmail}&gt;
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">to me</p>
              </div>
              <time className="shrink-0 text-xs text-muted-foreground" dateTime={messageDate}>
                {format(new Date(messageDate), "MMM d, h:mm a")}
              </time>
            </div>

            <div
              className="prose prose-sm mt-6 max-w-none text-foreground [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_strong]:font-bold [&_ul]:list-disc"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(email.body || "") }}
            />

            {email.attachments && email.attachments.length > 0 && (
              <div className="mt-6 border-t pt-4">
                <p className="mb-3 text-sm font-medium">Attachments</p>
                <div className="space-y-2">
                  {email.attachments.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2 hover:bg-muted/50"
                    >
                      <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {file.name}
                      </span>
                      {typeof file.size === "number" && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                      )}
                      {file.url && (
                        <a
                          href={file.url}
                          download={file.name}
                          aria-label={`Download ${file.name}`}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
