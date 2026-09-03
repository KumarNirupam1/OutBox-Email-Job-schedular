// features/emails/hooks/useEmail.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { emailApi } from "../api/email";
import { SchedulePayload } from "@/lib/types";

export function useScheduledEmails() {
  return useQuery({
    queryKey: ["emails", "scheduled"],
    queryFn: emailApi.getScheduled,
    staleTime: 30000, // 30 seconds
  });
}

export function useSentEmails() {
  return useQuery({
    queryKey: ["emails", "sent"],
    queryFn: emailApi.getSent,
    staleTime: 30000, // 30 seconds
  });
}

export function useScheduleEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SchedulePayload) => emailApi.schedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails", "scheduled"] });
    },
  });
}

export function useEmail(id: string) {
  return useQuery({
    queryKey: ["emails", id],
    queryFn: () => emailApi.getById(id),
    enabled: Boolean(id),
  });
}

export function useSearchEmails(query: string, status?: string) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: ["emails", "search", trimmed, status],
    queryFn: () => emailApi.search(trimmed, status),
    enabled: trimmed.length > 0,
    staleTime: 10_000,
    placeholderData: (previous) => previous,
  });
}

export function useSenders() {
  return useQuery({
    queryKey: ["senders"],
    queryFn: emailApi.getSenders,
    staleTime: 30_000,
  });
}

export function useEnsureSender() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => emailApi.ensureSender(),
    onSuccess: (sender) => {
      queryClient.setQueryData(["senders"], (current: unknown) => {
        if (Array.isArray(current)) {
          const alreadyPresent = current.some((s) => s.id === sender.id);
          return alreadyPresent ? current : [...current, sender];
        }
        return [sender];
      });
    },
  });
}