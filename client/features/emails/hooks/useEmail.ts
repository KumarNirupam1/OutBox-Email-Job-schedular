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